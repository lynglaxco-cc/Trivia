window.TriviaAPIV3 = (() => {
  const config = window.TRIVIA_CONFIG_V3 || {};
  const BASE = config.appScriptUrl;
  let counter = 0;

  function request(action, params = {}) {
    return new Promise((resolve, reject) => {
      if (!BASE) return reject(new Error('Trivia backend URL is not configured.'));
      const callback = '__triviaV3_' + Date.now() + '_' + (++counter);
      const script = document.createElement('script');
      let done = false;
      const cleanup = () => {
        done = true;
        if (script.parentNode) script.parentNode.removeChild(script);
        try { delete window[callback]; } catch (e) { window[callback] = undefined; }
      };
      const timer = setTimeout(() => {
        if (done) return;
        cleanup();
        reject(new Error('The trivia backend did not respond. Please check the Apps Script Web App deployment.'));
      }, 15000);

      window[callback] = data => {
        clearTimeout(timer);
        cleanup();
        if (!data || data.ok === false) reject(new Error((data && data.error) || 'The trivia backend returned an error.'));
        else resolve(data);
      };

      const query = new URLSearchParams({ action, callback });
      Object.keys(params).forEach(k => {
        if (params[k] !== undefined && params[k] !== null) query.set(k, String(params[k]));
      });
      script.src = BASE + (BASE.indexOf('?') >= 0 ? '&' : '?') + query.toString();
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        cleanup();
        reject(new Error('The trivia backend could not be reached. JSONP request failed. Check that the Apps Script Web App is deployed for web access.'));
      };
      document.head.appendChild(script);
    });
  }

  return {
    health: () => request('health'),
    startSession: p => request('startSession', p),
    getQuestion: p => request('getQuestion', p),
    submitAnswer: p => request('submitAnswer', p),
    logIntegrity: p => request('logIntegrity', p),
    finishSession: p => request('finishSession', p),
    getLeaderboard: () => request('getLeaderboard'),
    getRevealData: () => request('getRevealData')
  };
})();
