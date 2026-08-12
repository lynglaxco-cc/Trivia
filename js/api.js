window.TriviaAPI = (() => {
  const config = window.TRIVIA_CONFIG || {};

  // Fallback keeps the frontend functional even if an older cached config.js is served.
  const BACKEND_URL = config.appScriptUrl || 'https://script.google.com/macros/s/AKfycbxCKHbQz8RfSgDz54rKWqXlW5T4ZiHOLSjCRZdgiBZyCy0BK6LKIbIgy5qjM-uo16d2/exec';

  async function request(action, payload = {}) {
    if (!BACKEND_URL) {
      throw new Error('Trivia backend URL is not configured.');
    }

    let response;
    try {
      response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload })
      });
    } catch (error) {
      throw new Error(`The trivia backend could not be reached. Check that the Apps Script Web App is deployed for web access. (${error.message || 'network error'})`);
    }

    let raw;
    try {
      raw = await response.text();
    } catch (error) {
      throw new Error(`The trivia backend returned an unreadable response (${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(`Backend request failed (${response.status}). ${raw.slice(0, 180)}`);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error(`The Apps Script backend did not return JSON. HTTP ${response.status}. The deployment may need to be updated. Response: ${raw.slice(0, 180)}`);
    }

    if (data && data.ok === false && data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  return {
    startSession: payload => request('startSession', payload),
    getQuestions: payload => request('getQuestions', payload),
    submitAnswer: payload => request('submitAnswer', payload),
    logIntegrity: payload => request('logIntegrity', payload),
    finishSession: payload => request('finishSession', payload),
    getLeaderboard: payload => request('getLeaderboard', payload),
    getRevealData: payload => request('getRevealData', payload)
  };
})();
