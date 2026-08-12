window.TriviaAPI = (() => {
  const config = window.TRIVIA_CONFIG;

  async function request(action, payload = {}) {
    if (!config.appScriptUrl) {
      return { ok: false, offline: true, action, ...payload };
    }

    const response = await fetch(config.appScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) throw new Error(`Backend request failed (${response.status}).`);
    return response.json();
  }

  return {
    startSession: payload => request('startSession', payload),
    getQuestions: payload => request('getQuestions', payload),
    submitAnswer: payload => request('submitAnswer', payload),
    logIntegrity: payload => request('logIntegrity', payload),
    finishSession: payload => request('finishSession', payload)
  };
})();
