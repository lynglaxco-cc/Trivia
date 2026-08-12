window.TriviaIntegrity = (() => {
  const events = [];
  let enabled = false;
  let handler = null;

  function emit(type, detail = {}) {
    const event = { type, at: new Date().toISOString(), ...detail };
    events.push(event);
    if (handler) handler(event);
    return event;
  }

  function start(callback) {
    handler = callback || null;
    if (enabled) return;
    enabled = true;

    document.addEventListener('visibilitychange', () => {
      emit(document.hidden ? 'TAB_HIDDEN' : 'TAB_VISIBLE');
    });
    window.addEventListener('blur', () => emit('WINDOW_BLUR'));
    window.addEventListener('focus', () => emit('WINDOW_FOCUS'));
    document.addEventListener('fullscreenchange', () => {
      emit(document.fullscreenElement ? 'FULLSCREEN_ENTERED' : 'FULLSCREEN_EXITED');
    });
    window.addEventListener('pagehide', () => emit('PAGE_HIDDEN'));
  }

  async function requestFullscreen() {
    const element = document.documentElement;
    if (!document.fullscreenElement && element.requestFullscreen) {
      try {
        await element.requestFullscreen();
        emit('FULLSCREEN_ENTERED');
        return true;
      } catch (error) {
        emit('FULLSCREEN_REQUEST_FAILED', { message: error.message });
        return false;
      }
    }
    return !!document.fullscreenElement;
  }

  function getEvents() { return [...events]; }

  return { start, requestFullscreen, emit, getEvents };
})();
