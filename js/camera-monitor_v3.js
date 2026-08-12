window.TriviaCameraMonitorV3 = (() => {
  let video = null;
  let callback = () => {};
  let faceDetector = null;
  let objectModel = null;
  let running = false;
  let busy = false;
  let timer = null;
  let lastFaceCenter = null;
  let faceMissingSince = null;
  let multipleFaceSince = null;
  let offCenterSince = null;
  let lastFaceEventAt = 0;
  let lastDeviceEventAt = 0;

  const COOLDOWN = 8000;
  const INTERVAL = 900;
  const DEVICE_INTERVAL = 2400;

  function emit(type, detail) {
    callback(Object.assign({ type, at: new Date().toISOString() }, detail || {}));
  }

  function canEmit(last) { return Date.now() - last >= COOLDOWN; }

  function signal(id, text, bad) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (bad ? '⚠ ' : '● ') + text;
    el.dataset.state = bad ? 'warning' : 'ok';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(s => s.src === src);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, {once:true});
        existing.addEventListener('error', reject, {once:true});
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { s.dataset.loaded = 'true'; resolve(); };
      s.onerror = () => reject(new Error('Could not load monitoring model.'));
      document.head.appendChild(s);
    });
  }

  async function init(videoElement, eventCallback) {
    video = videoElement;
    callback = eventCallback || (() => {});

    if (window.FaceDetection) {
      faceDetector = new FaceDetection({
        locateFile: file => 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/' + file
      });
      faceDetector.setOptions({ model:'short', minDetectionConfidence:0.55 });
      faceDetector.onResults(handleFaceResults);
      signal('faceSignal', 'Face check ready', false);
    } else {
      signal('faceSignal', 'Face check unavailable', true);
    }

    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
      if (window.cocoSsd) {
        objectModel = await window.cocoSsd.load({base:'lite_mobilenet_v2'});
        signal('deviceSignal', 'Visible-device check ready', false);
      }
    } catch (e) {
      signal('deviceSignal', 'Visible-device check unavailable', true);
      console.warn(e);
    }
  }

  function handleFaceResults(results) {
    if (!running) return;
    const detections = results && results.detections ? results.detections : [];
    const count = detections.length;

    if (count === 0) {
      signal('faceSignal', 'Face not detected', true);
      if (!faceMissingSince) faceMissingSince = Date.now();
      if (Date.now() - faceMissingSince >= 3000 && canEmit(lastFaceEventAt)) {
        lastFaceEventAt = Date.now();
        emit('FACE_NOT_DETECTED', {durationMs:Date.now()-faceMissingSince});
      }
      return;
    }
    faceMissingSince = null;

    if (count > 1) {
      signal('faceSignal', 'Multiple faces detected (' + count + ')', true);
      if (!multipleFaceSince) multipleFaceSince = Date.now();
      if (Date.now() - multipleFaceSince >= 1500 && canEmit(lastFaceEventAt)) {
        lastFaceEventAt = Date.now();
        emit('MULTIPLE_FACES', {count:count});
      }
    } else {
      multipleFaceSince = null;
      signal('faceSignal', 'Single face detected', false);
    }

    const box = detections[0] && detections[0].locationData && detections[0].locationData.relativeBoundingBox;
    if (!box) return;
    const cx = box.xMin + box.width/2;
    const cy = box.yMin + box.height/2;

    if (lastFaceCenter) {
      const movement = Math.hypot(cx-lastFaceCenter.x, cy-lastFaceCenter.y);
      if (movement > 0.13 && canEmit(lastFaceEventAt)) {
        lastFaceEventAt = Date.now();
        emit('FACE_MOVEMENT', {magnitude:Number(movement.toFixed(3))});
      }
    }
    lastFaceCenter = {x:cx,y:cy};

    const off = Math.abs(cx-0.5)>0.30 || Math.abs(cy-0.5)>0.32;
    if (off) {
      signal('faceSignal', 'Face position changed', true);
      if (!offCenterSince) offCenterSince = Date.now();
      if (Date.now()-offCenterSince >= 2500 && canEmit(lastFaceEventAt)) {
        lastFaceEventAt = Date.now();
        emit('FACE_OFF_CENTER', {x:Number(cx.toFixed(3)),y:Number(cy.toFixed(3))});
      }
    } else {
      offCenterSince = null;
    }
  }

  async function checkDevice() {
    if (!running || !objectModel || !video || video.readyState < 2 || busy) return;
    busy = true;
    try {
      const predictions = await objectModel.detect(video, 5, 0.35);
      const phones = predictions.filter(p => p.class === 'cell phone' && p.score >= 0.55);
      if (phones.length) {
        signal('deviceSignal', 'Possible phone visible', true);
        if (canEmit(lastDeviceEventAt)) {
          lastDeviceEventAt = Date.now();
          emit('POSSIBLE_PHONE_VISIBLE', {
            confidence:Number(Math.max(...phones.map(p=>p.score)).toFixed(2)),
            count:phones.length
          });
        }
      } else {
        signal('deviceSignal', 'No phone detected', false);
      }
    } catch(e) {
      console.warn('Device detection failed',e);
    } finally { busy=false; }
  }

  async function tick() {
    if (!running || !video || video.readyState < 2) return;
    if (faceDetector) {
      try { await faceDetector.send({image:video}); } catch(e) { console.warn('Face detection failed',e); }
    }
    checkDevice();
  }

  function start() {
    if (running) return;
    running = true;
    lastFaceCenter = null;
    faceMissingSince = null;
    multipleFaceSince = null;
    offCenterSince = null;
    timer = setInterval(tick, INTERVAL);
    emit('CAMERA_MONITORING_STARTED');
  }

  function stop() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
    emit('CAMERA_MONITORING_STOPPED');
  }

  return {init,start,stop};
})();
