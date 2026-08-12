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
    timerId: null,
    remaining: config.questionTimeSeconds
  };

  // Temporary local questions let us test the GitHub-hosted frontend before
  // connecting the Apps Script backend. Replace through the API later.
  const demoQuestions = [
    { id: 'demo-1', text: '“Mere paas maa hai.” — Which film is this dialogue from?', options: ['Deewaar', 'Sholay', 'Don', 'Agneepath'] },
    { id: 'demo-2', text: '“Kitne aadmi the?” — Which film is this dialogue from?', options: ['Sholay', 'Zanjeer', 'Dabangg', 'Lagaan'] },
    { id: 'demo-3', text: '“Bade bade deshon mein aisi chhoti chhoti baatein hoti rehti hain.” — Which film?', options: ['Dilwale Dulhania Le Jayenge', 'Kabhi Khushi Kabhie Gham', 'Mohabbatein', 'Kuch Kuch Hota Hai'] }
  ];

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
      pill.textContent = '● Camera active';
      pill.style.color = 'var(--green)';
    } else {
      text.textContent = 'Camera is not currently active.';
      pill.textContent = '● Camera issue';
      pill.style.color = '#b42318';
    }
  }

  async function enableCamera() {
    const button = $('enableCameraBtn');
    button.disabled = true;
    message('Requesting camera access…');
    try {
      await TriviaCamera.enable();
      cameraState('active');
      button.classList.add('hidden');
      $('startQuizBtn').classList.remove('hidden');
      message('Camera connected successfully. You can start the trivia.', 'success');
    } catch (error) {
      button.disabled = false;
      message(error.message || 'Camera access could not be enabled.', 'error');
      cameraState('inactive');
    }
  }

  async function startQuiz() {
    state.name = $('participantName').value.trim();
    if (!state.name) return message('Please enter your name.', 'error');
    if (state.name.length > config.maxNameLength) return message('Please use a shorter name.', 'error');
    if (config.cameraRequired && !TriviaCamera.isActive()) return message('Please enable the camera first.', 'error');

    $('startQuizBtn').disabled = true;
    message('Starting trivia…');

    let result;
    try {
      result = await TriviaAPI.startSession({ name: state.name });
    } catch (error) {
      console.warn(error);
      result = { offline: true };
    }

    state.sessionId = result?.sessionId || `demo-${Date.now()}`;
    state.questions = result?.questions?.length ? result.questions : demoQuestions;
    state.index = 0;
    state.answers = [];

    TriviaIntegrity.start(event => {
      $('integrityText').textContent = `Integrity: ${event.type.replaceAll('_', ' ').toLowerCase()}`;
      if (state.sessionId && !result?.offline) {
        TriviaAPI.logIntegrity({ sessionId: state.sessionId, event }).catch(console.warn);
      }
    });

    if (config.fullscreenRequired) await TriviaIntegrity.requestFullscreen();

    show('quizScreen');
    renderQuestion();
  }

  function renderQuestion() {
    clearInterval(state.timerId);
    state.selected = null;
    const q = state.questions[state.index];
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

    state.remaining = config.questionTimeSeconds;
    $('timer').textContent = state.remaining;
    state.timerId = setInterval(() => {
      state.remaining -= 1;
      $('timer').textContent = Math.max(0, state.remaining);
      if (state.remaining <= 0) {
        clearInterval(state.timerId);
        saveAnswer(null, true);
      }
    }, 1000);
  }

  function selectOption(index, button) {
    state.selected = index;
    document.querySelectorAll('.option').forEach(el => el.classList.remove('selected'));
    button.classList.add('selected');
    $('saveAnswerBtn').disabled = false;
  }

  async function saveAnswer(timedOut = false) {
    clearInterval(state.timerId);
    const q = state.questions[state.index];
    const answer = state.selected;
    state.answers.push({ questionId: q.id, answer, timedOut });
    $('saveAnswerBtn').disabled = true;

    if (state.sessionId && !state.sessionId.startsWith('demo-')) {
      try { await TriviaAPI.submitAnswer({ sessionId: state.sessionId, questionId: q.id, answer, timedOut }); }
      catch (error) { console.warn(error); }
    }

    if (state.index < state.questions.length - 1) {
      state.index += 1;
      renderQuestion();
    } else {
      completeQuiz();
    }
  }

  async function completeQuiz() {
    clearInterval(state.timerId);
    if (state.sessionId && !state.sessionId.startsWith('demo-')) {
      try { await TriviaAPI.finishSession({ sessionId: state.sessionId }); }
      catch (error) { console.warn(error); }
    }
    show('completeScreen');
  }

  function reveal() {
    window.location.href = 'reveal.html';
  }

  TriviaCamera.init($('cameraPreview'), cameraState);
  $('enableCameraBtn').addEventListener('click', enableCamera);
  $('startQuizBtn').addEventListener('click', startQuiz);
  $('saveAnswerBtn').addEventListener('click', () => saveAnswer(false));
  $('revealBtn').addEventListener('click', reveal);
})();
