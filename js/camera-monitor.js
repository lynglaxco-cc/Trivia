window.TriviaCameraMonitor = (() => {
  let video = null;
  let callback = null;
  let faceDetector = null;
  let objectModel = null;
  let running = false;
  let busy = false;
  let lastFaceCenter = null;
  let lastFaceEventAt = 0;
  let lastDeviceEventAt = 0;
  let faceMissingSince = null;
  let multipleFaceSince = null;
  let offCenterSince = null;
  let timer = null;

  const COOLDOWN_MS = 8000;
  const FACE_INTERVAL_MS = 900;
  const DEVICE_INTERVAL_MS = 2200;

  function emit(type, detail = {}) {
    const event = { type, at: new Date().toISOString(), ...detail };
    if (callback) callback(event);
  }

  function canEmit(lastAt) {
    return Date.now() - lastAt >= COOLDOWN_MS;
  }

  function setSignal(id, text, bad = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = `${bad ? '⚠' : '●'} ${text}`;
    el.dataset.state = bad ? 'warning' : 'ok';
  }

  async function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(s => s.src === src);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = () => reject(new Error(`Could not load integrity model: ${src}`));
      document.head.appendChild(script);
    });
  }

  async function init(videoElement, eventCallback) {
    video = videoElement;
    callback = eventCallback || (() => {});
    const signals = document.getElementById('cameraSignals');
    if (signals) signals.classList.remove('hidden');

    // MediaPipe is loaded by index.html. If it is unavailable, the quiz still
    // works, but the enhanced face check is marked unavailable rather than
    // pretending that monitoring is active.
    if (window.FaceDetection) {
      faceDetector = new FaceDetection({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
      });
      faceDetector.setOptions({
        model: 'short',
        minDetectionConfidence: 0.55
      });
      faceDetector.onResults(handleFaceResults);
      setSignal('faceSignal', 'Face check ready');
    } else {
      setSignal('faceSignal', 'Face check unavailable', true);
    }

    // COCO-SSD can identify a visible cell phone. It is deliberately optional
    // and runs locally. A positive result is only an integrity signal, not proof
    // that a participant is cheating.
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
      if (window.cocoSsd) {
        objectModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        setSignal('deviceSignal', 'Visible-device check ready');
      }
    } catch (error) {
      console.warn('Optional device detector unavailable:', error);
      setSignal('deviceSignal', 'Visible-device check unavailable', true);
    }
  }

  function handleFaceResults(results) {
    if (!running) return;
    const detections = results?.detections || [];
    const count = detections.length;

    if (count === 0) {
      setSignal('faceSignal', 'Face not detected', true);
      if (!faceMissingSince) faceMissingSince = Date.now();
      if (Date.now() - faceMissingSince >= 3000 && canEmit(lastFaceEventAt)) {
        lastFaceEventAt = Date.now();
        emit('FACE_NOT_DETECTED', { durationMs: Date.now() - faceMissingSince });
      }
      return;
    }

    faceMissingSince = null;

    if (count > 1) {
      setSignal('faceSignal', `Multiple faces detected (${count})`, true);
      if (!multipleFaceSince) multipleFaceSince = Date.now();
      if (Date.now() - multipleFaceSince >= 1500 && canEmit(lastFaceEventAt)) {
        lastFaceEventAt = Date.now();
        emit('MULTIPLE_FACES', { count });
      }
    } else {
      multipleFaceSince = null;
      setSignal('faceSignal', 'Single face detected');
    }

    const box = detections[0]?.locationData?.relativeBoundingBox;
    if (!box) return;
    const cx = box.xMin + box.width / 2;
    const cy = box.yMin + box.height / 2;

    if (lastFaceCenter) {
      const movement = Math.hypot(cx - lastFaceCenter.x, cy - lastFaceCenter.y);
      if (movement > 0.13 && canEmit(lastFaceEventAt)) {
        lastFaceEventAt = Date.now();
        emit('FACE_MOVEMENT', { magnitude: Number(movement.toFixed(3)) });
      }
    }
    lastFaceCenter = { x: cx, y: cy };

    // A face persistently far from the camera centre is recorded as an
    // attention/movement signal. This does not claim to know why the person
    // moved or what they were looking at.
    const offCenter = Math.abs(cx - 0.5) > 0.30 || Math.abs(cy - 0.5) > 0.32;
    if (offCenter) {
      setSignal('faceSignal', 'Face position changed', true);
      if (!offCenterSince) offCenterSince = Date.now();
      if (Date.now() - offCenterSince >= 2500 && canEmit(lastFaceEventAt)) {
        lastFaceEventAt = Date.now();
        emit('FACE_OFF_CENTER', { x: Number(cx.toFixed(3)), y: Number(cy.toFixed(3)) });
      }
    } else {
      offCenterSince = null;
    }
  }

  async function checkForVisiblePhone() {
    if (!running || !objectModel || !video || video.readyState < 2 || busy) return;
    busy = true;
    try {
      const predictions = await objectModel.detect(video, 5, 0.35);
      const phones = predictions.filter(p => p.class === 'cell phone' && p.score >= 0.55);
      if (phones.length) {
        setSignal('deviceSignal', 'Possible phone visible', true);
        if (canEmit(lastDeviceEventAt)) {
          lastDeviceEventAt = Date.now();
          emit('POSSIBLE_PHONE_VISIBLE', {
            confidence: Number(Math.max(...phones.map(p => p.score)).toFixed(2)),
            count: phones.length
          });
        }
      } else {
        setSignal('deviceSignal', 'No phone detected');
      }
    } catch (error) {
      console.warn('Device detection failed:', error);
    } finally {
      busy = false;
    }
  }

  async function tick() {
    if (!running || !video || video.readyState < 2) return;
    if (faceDetector) {
      try { await faceDetector.send({ image: video }); } catch (error) { console.warn('Face detection failed:', error); }
    }
    checkForVisiblePhone();
  }

  function start() {
    if (running) return;
    running = true;
    lastFaceCenter = null;
    faceMissingSince = null;
    multipleFaceSince = null;
    offCenterSince = null;
    timer = setInterval(tick, FACE_INTERVAL_MS);
    emit('CAMERA_MONITORING_STARTED');
  }

  function stop() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
    emit('CAMERA_MONITORING_STOPPED');
  }

  return { init, start, stop };
})();
