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
    answers: []
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
    } else {
      text.textContent = 'Camera is not currently active.';
      if (pill) {
        pill.textContent = '● Camera issue';
        pill.style.color = '#b42318';
      }
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
      $('startQuizBtn').disabled = false;
      return message('The trivia backend could not be reached. Please try again.', 'error');
    }

    if (!result?.questions?.length) {
      $('startQuizBtn').disabled = false;
      return message('No question set was returned by the trivia backend. Connect the 20-question Apps Script question bank before starting.', 'error');
    }

    state.sessionId = result.sessionId || null;
    state.questions = result.questions;
    state.index = 0;
    state.answers = [];

    if (config.expectedQuestionCount && state.questions.length !== config.expectedQuestionCount) {
      $('startQuizBtn').disabled = false;
      return message(`The backend returned ${state.questions.length} questions; ${config.expectedQuestionCount} are required.`, 'error');
    }

    TriviaIntegrity.start(event => {
      $('integrityText').textContent = `Integrity: ${event.type.replaceAll('_', ' ').toLowerCase()}`;
      if (state.sessionId) {
        TriviaAPI.logIntegrity({ sessionId: state.sessionId, event }).catch(console.warn);
      }
    });

    if (config.fullscreenRequired) await TriviaIntegrity.requestFullscreen();

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
      if (state.sessionId) {
        await TriviaAPI.submitAnswer({
          sessionId: state.sessionId,
          questionId: q.id,
          answer
        });
      }
    } catch (error) {
      console.warn(error);
      $('saveAnswerBtn').disabled = false;
      return message('Your answer could not be saved. Please try again.', 'error');
    }

    if (state.index < state.questions.length - 1) {
      state.index += 1;
      renderQuestion();
    } else {
      completeQuiz();
    }
  }

  async function completeQuiz() {
    if (state.sessionId) {
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
  $('saveAnswerBtn').addEventListener('click', saveAnswer);
  $('revealBtn').addEventListener('click', reveal);
})();
