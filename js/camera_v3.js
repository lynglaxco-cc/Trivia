window.TriviaCameraV3 = (() => {
  let stream = null;
  let video = null;
  let onStateChange = () => {};

  function init(videoElement, stateCallback) {
    video = videoElement;
    onStateChange = stateCallback || (() => {});
  }

  async function enable() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access is not supported by this browser.');
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 } },
      audio: false
    });
    const track = stream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') throw new Error('The camera did not return a live video track.');
    track.addEventListener('ended', () => onStateChange('ended'));
    track.addEventListener('mute', () => onStateChange('muted'));
    track.addEventListener('unmute', () => onStateChange('active'));
    video.srcObject = stream;
    video.style.display = 'block';
    await video.play();
    onStateChange('active');
    return { active: true, label: track.label || 'Camera' };
  }

  function stop() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    if (video) video.srcObject = null;
    onStateChange('stopped');
  }

  function isActive() {
    return !!stream && stream.getVideoTracks().some(t => t.readyState === 'live');
  }

  return { init, enable, stop, isActive };
})();
