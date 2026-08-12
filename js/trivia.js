(() => {
  const config = window.TRIVIA_CONFIG;
  const $ = id => document.getElementById(id);
  const screens = ['introScreen', 'quizScreen', 'completeScreen'];

  const state = {
    name: '',
    sessionId: null,
    questions: [],
    index: 0,
    selected: null,
    answers: [],
    result: null
  };

  function show(id) {
    screens.forEach(screen => $(screen).classList.toggle('active', screen === id));
  }

  function message(text, type = '') {
    const el = $('message');
    el.textContent = text;
    el.dataset.type = type;
  }

  function cameraState(status) {
    const text = $('cameraStatusText');
    const pill = $('integrityPill');

    if (status === 'active') {
      text.textContent = 'Camera connected. Keep it active throughout the trivia.';
      if (pill) {
        pill.textContent = '● Camera active';
        pill.style.color = 'var(--green)';
      }
    } else if (status === 'ended' || status === 'stopped') {
      text.textContent = 'Camera connection ended.';
      if (pill) {
        pill.textContent = '● Camera issue';
        pill.style.color = '#b42318';
      }
    } else {
      text.textContent = 'Camera is not currently active.';
      if (pill) {
        pill.textContent = '● Camera issue';
        pill.style.color = '#b42318';
      }
    }
  }

  async function beginTrivia() {
    const button = $('startQuizBtn');
    state.name = $('participantName').value.trim();

    if (!state.name) {
      message('Please enter your name before beginning.', 'error');
      $('participantName').focus();
      return;
    }

    if (state.name.length > config.maxNameLength) {
      message('Please use a shorter name.', 'error');
      return;
    }

    button.disabled = true;
    message('Getting things ready…');

    // IMPORTANT: getUserMedia is called directly from the user click flow.
    // This is what allows the browser to show its native camera prompt.
    try {
      if (config.cameraRequired && !TriviaCamera.isActive()) {
        message('Please allow camera access when your browser asks.');
        await TriviaCamera.enable();
      }
    } catch (error) {
      button.disabled = false;
      cameraState('inactive');
      message(error.message || 'Camera access is required to begin the trivia.', 'error');
      return;
    }

    cameraState('active');
    message('Camera ready. Starting your trivia…');

    let result;
    try {
      result = await TriviaAPI.startSession({ name: state.name });
    } catch (error) {
      button.disabled = false;
      message(error.message || 'The trivia backend could not be reached. Please try again.', 'error');
      return;
    }

    if (!result?.sessionId || !Array.isArray(result.questions)) {
      button.disabled = false;
      message('The trivia backend returned an invalid session. Please contact the host.', 'error');
      return;
    }

    if (config.expectedQuestionCount && result.questions.length !== config.expectedQuestionCount) {
      button.disabled = false;
      message(`The backend returned ${result.questions.length} questions; ${config.expectedQuestionCount} are required.`, 'error');
      return;
    }

    state.sessionId = result.sessionId;
    state.questions = result.questions;
    state.index = 0;
    state.answers = [];
    state.result = null;

    TriviaIntegrity.start(event => {
      $('integrityText').textContent = `Integrity: ${event.type.replaceAll('_', ' ').toLowerCase()}`;
      if (state.sessionId) {
        TriviaAPI.logIntegrity({ sessionId: state.sessionId, event }).catch(console.warn);
      }
    });

    if (config.fullscreenRequired) {
      await TriviaIntegrity.requestFullscreen();
    }

    show('quizScreen');
    renderQuestion();
  }

  function renderQuestion() {
    state.selected = null;
    const q = state.questions[state.index];
    if (!q) return completeQuiz();

    $('questionNumber').textContent = `Question ${state.index + 1} of ${state.questions.length}`;
    $('questionText').textContent = q.text;
    $('saveAnswerBtn').disabled = true;

    const options = $('options');
    options.innerHTML = '';

    q.options.forEach((option, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'option';
      button.textContent = `${String.fromCharCode(65 + i)}. ${option}`;
      button.addEventListener('click', () => selectOption(i, button));
      options.appendChild(button);
    });
  }

  function selectOption(index, button) {
    state.selected = index;
    document.querySelectorAll('.option').forEach(el => el.classList.remove('selected'));
    button.classList.add('selected');
    $('saveAnswerBtn').disabled = false;
  }

  async function saveAnswer() {
    if (state.selected === null) return;

    const q = state.questions[state.index];
    const answer = state.selected;
    state.answers.push({ questionId: q.id, answer });
    $('saveAnswerBtn').disabled = true;

    try {
      await TriviaAPI.submitAnswer({
        sessionId: state.sessionId,
        questionId: q.id,
        answer
      });
    } catch (error) {
      console.warn(error);
      $('saveAnswerBtn').disabled = false;
      message(error.message || 'Your answer could not be saved. Please try again.', 'error');
      return;
    }

    if (state.index < state.questions.length - 1) {
      state.index += 1;
      renderQuestion();
    } else {
      await completeQuiz();
    }
  }

  async function completeQuiz() {
    $('completionMessage').textContent = 'Calculating your score and loading the live leaderboard…';
    show('completeScreen');

    try {
      state.result = await TriviaAPI.finishSession({ sessionId: state.sessionId });
    } catch (error) {
      console.warn(error);
      $('completionMessage').textContent = 'Your responses were submitted, but the score could not be loaded yet.';
      return;
    }

    renderScore(state.result);

    try {
      const leaderboard = await TriviaAPI.getLeaderboard({ sessionId: state.sessionId });
      renderLeaderboard(leaderboard, state.result);
    } catch (error) {
      console.warn(error);
      // Keep the participant score visible even if the leaderboard call fails.
      renderLeaderboard({ entries: [] }, state.result);
    }
  }

  function renderScore(result) {
    const score = result?.score ?? result?.points ?? 0;
    const total = result?.totalQuestions ?? state.questions.length;
    const correct = result?.correct ?? result?.correctAnswers;
    const position = result?.rank ?? result?.position;

    $('scoreSummary').classList.remove('hidden');
    $('scoreSummary').innerHTML = `
      <div class="score-main"><strong>${escapeHtml(String(score))}</strong><span>points</span></div>
      <div class="score-details">
        ${correct !== undefined ? `<span>${escapeHtml(String(correct))}/${escapeHtml(String(total))} correct</span>` : ''}
        ${position ? `<span>Rank #${escapeHtml(String(position))}</span>` : ''}
      </div>`;

    $('completionMessage').textContent = 'Your trivia is complete. Here is your result and the current leaderboard.';
  }

  function renderLeaderboard(data, result) {
    const entries = Array.isArray(data?.entries) ? data.entries : (Array.isArray(data?.leaderboard) ? data.leaderboard : []);
    const currentName = state.name;
    const currentSessionId = state.sessionId;

    $('leaderboard').classList.remove('hidden');

    if (!entries.length) {
      $('leaderboard').innerHTML = '<h3>Leaderboard</h3><p class="small-note">The leaderboard will appear here once the host backend returns the results.</p>';
      return;
    }

    const rows = entries.slice(0, 10).map((entry, index) => {
      const isCurrent = (entry.sessionId && entry.sessionId === currentSessionId) || (!entry.sessionId && entry.name === currentName);
      const rank = entry.rank ?? index + 1;
      const score = entry.score ?? entry.points ?? 0;
      return `<tr class="${isCurrent ? 'current-player' : ''}">
        <td>${escapeHtml(String(rank))}</td>
        <td>${isCurrent ? '<strong>You</strong>' : escapeHtml(String(entry.name ?? 'Participant'))}</td>
        <td>${escapeHtml(String(score))}</td>
      </tr>`;
    }).join('');

    $('leaderboard').innerHTML = `
      <h3>Leaderboard</h3>
      <table>
        <thead><tr><th>#</th><th>Player</th><th>Score</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function reveal() {
    const query = state.sessionId ? `?sessionId=${encodeURIComponent(state.sessionId)}` : '';
    window.location.href = `reveal.html${query}`;
  }

  TriviaCamera.init($('cameraPreview'), cameraState);
  $('startQuizBtn').addEventListener('click', beginTrivia);
  $('saveAnswerBtn').addEventListener('click', saveAnswer);
  $('revealBtn').addEventListener('click', reveal);
})();
