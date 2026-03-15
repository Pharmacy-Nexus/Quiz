const DATA_FILES = {
  subjects: 'data/subjects.json',
  topics: 'data/topics.json',
  studyQuestions: 'data/study_questions.json',
  quizQuestions: 'data/quiz_questions.json',
  quizsets: 'data/quizsets.json',
  legacyQuestions: 'data/questions.json'
};

const STORAGE_KEYS = {
  subjects: 'pn_subjects',
  topics: 'pn_topics',
  studyQuestions: 'pn_study_questions',
  quizQuestions: 'pn_quiz_questions',
  quizsets: 'pn_quizsets',
  settings: 'pn_settings',
  progress: 'pn_progress',
  session: 'pn_exam_session'
};

let appData = null;

function byId(id) {
  return document.getElementById(id);
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function readJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to read ${path}`);
  return response.json();
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uniqueBy(values) {
  return [...new Set(values.filter(Boolean))];
}

function getStudyQuestions() {
  return Array.isArray(appData?.studyQuestions) ? appData.studyQuestions : [];
}

function getQuizQuestions() {
  return Array.isArray(appData?.quizQuestions) ? appData.quizQuestions : [];
}

function getQuestionBank(bank = 'study') {
  return bank === 'quiz' ? getQuizQuestions() : getStudyQuestions();
}

function getTopicStudyQuestions(topicId) {
  return getStudyQuestions().filter((q) => q.topicId === topicId);
}

function getTopicQuizQuestions(topicId) {
  return getQuizQuestions().filter((q) => q.topicId === topicId);
}

function getTopicQuizsets(topicId) {
  return (appData?.quizsets || []).filter((set) => set.topicId === topicId);
}

function buildQuestionFilePath(bank, subjectId, topicId) {
  return `data/${bank}_questions/${subjectId}/${topicId}.json`;
}

function buildGroupedQuestionFiles(items, bank) {
  const grouped = {};
  items.forEach((question) => {
    if (!question.subjectId || !question.topicId) return;
    const path = buildQuestionFilePath(bank, question.subjectId, question.topicId);
    if (!grouped[path]) grouped[path] = [];
    grouped[path].push(question);
  });
  return grouped;
}

function getSelectedValues(container) {
  return qsa('input[type="checkbox"]:checked', container).map((input) => input.value);
}

function shuffleArray(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

async function initializeData() {
  if (appData?.subjects) return appData;

  const embedded = window.PHARMACY_NEXUS_DATA || null;
  let seedSubjects = embedded?.subjects;
  let seedTopics = embedded?.topics;
  let seedStudyQuestions = embedded?.studyQuestions || embedded?.questions;
  let seedQuizQuestions = embedded?.quizQuestions;
  let seedQuizsets = embedded?.quizsets;

  if (!seedSubjects || !seedTopics || !seedStudyQuestions || !seedQuizQuestions || !seedQuizsets) {
    try {
      const [subjects, topics, studyQuestions, quizQuestions, quizsets] = await Promise.all([
        readJson(DATA_FILES.subjects),
        readJson(DATA_FILES.topics),
        readJson(DATA_FILES.studyQuestions).catch(() => readJson(DATA_FILES.legacyQuestions).catch(() => [])),
        readJson(DATA_FILES.quizQuestions).catch(() => []),
        readJson(DATA_FILES.quizsets)
      ]);
      seedSubjects = seedSubjects || subjects;
      seedTopics = seedTopics || topics;
      seedStudyQuestions = seedStudyQuestions || studyQuestions;
      seedQuizQuestions = seedQuizQuestions || quizQuestions;
      seedQuizsets = seedQuizsets || quizsets;
    } catch (error) {
      console.warn('Falling back to embedded data seed.', error);
      seedSubjects = seedSubjects || [];
      seedTopics = seedTopics || [];
      seedStudyQuestions = seedStudyQuestions || [];
      seedQuizQuestions = seedQuizQuestions || [];
      seedQuizsets = seedQuizsets || [];
    }
  }

  const defaultSettings = embedded?.settings || { owner: '', repo: '', branch: 'main', token: '' };
  const defaultProgress = embedded?.progress || { attempts: [], recent: [] };

  if (!localStorage.getItem(STORAGE_KEYS.subjects)) save(STORAGE_KEYS.subjects, seedSubjects);
  if (!localStorage.getItem(STORAGE_KEYS.topics)) save(STORAGE_KEYS.topics, seedTopics);
  if (!localStorage.getItem(STORAGE_KEYS.studyQuestions)) save(STORAGE_KEYS.studyQuestions, seedStudyQuestions);
  if (!localStorage.getItem(STORAGE_KEYS.quizQuestions)) save(STORAGE_KEYS.quizQuestions, seedQuizQuestions);
  if (!localStorage.getItem(STORAGE_KEYS.quizsets)) save(STORAGE_KEYS.quizsets, seedQuizsets);
  if (!localStorage.getItem(STORAGE_KEYS.settings)) save(STORAGE_KEYS.settings, defaultSettings);
  if (!localStorage.getItem(STORAGE_KEYS.progress)) save(STORAGE_KEYS.progress, defaultProgress);

  appData = {
    subjects: load(STORAGE_KEYS.subjects, seedSubjects),
    topics: load(STORAGE_KEYS.topics, seedTopics),
    studyQuestions: load(STORAGE_KEYS.studyQuestions, seedStudyQuestions),
    quizQuestions: load(STORAGE_KEYS.quizQuestions, seedQuizQuestions),
    quizsets: load(STORAGE_KEYS.quizsets, seedQuizsets),
    settings: load(STORAGE_KEYS.settings, defaultSettings),
    progress: load(STORAGE_KEYS.progress, defaultProgress)
  };

  return appData;
}


function syncData() {
  save(STORAGE_KEYS.subjects, appData.subjects);
  save(STORAGE_KEYS.topics, appData.topics);
  save(STORAGE_KEYS.studyQuestions, appData.studyQuestions);
  save(STORAGE_KEYS.quizQuestions, appData.quizQuestions);
  save(STORAGE_KEYS.quizsets, appData.quizsets);
  save(STORAGE_KEYS.settings, appData.settings);
  save(STORAGE_KEYS.progress, appData.progress);
}


function params() {
  return new URLSearchParams(window.location.search);
}

function renderSubjectCard(subject) {
  const topicCount = appData.topics.filter((t) => t.subjectId === subject.id).length;
  return `
    <article class="card subject-card">
      <div class="subject-card-top">
        <h3>${subject.name}</h3>
      </div>
      <div class="subject-card-bottom">
        <div class="subject-meta">
          <svg viewBox="0 0 24 24"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H19v14.5a1.5 1.5 0 0 1-1.5 1.5H7.5A2.5 2.5 0 0 1 5 17.5v-11Zm0 0A2.5 2.5 0 0 0 7.5 9H19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>${topicCount} Topic${topicCount === 1 ? '' : 's'} Available</span>
        </div>
        <a class="btn btn-primary" href="topics.html?subject=${subject.id}">Open Topics</a>
      </div>
    </article>
  `;
}

function renderTopicCard(topic) {
  const studyCount = getTopicStudyQuestions(topic.id).length;
  const quizCount = getTopicQuizsets(topic.id).length;
  return `
    <article class="card topic-card">
      <h3>${topic.name}</h3>
      <div class="topic-meta">
        <svg viewBox="0 0 24 24"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H19v14.5a1.5 1.5 0 0 1-1.5 1.5H7.5A2.5 2.5 0 0 1 5 17.5v-11Zm0 0A2.5 2.5 0 0 0 7.5 9H19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>${studyCount} Study Question${studyCount === 1 ? '' : 's'}</span>
      </div>
      <div class="topic-meta">
        <svg viewBox="0 0 24 24"><path d="M12 3 3 8l9 5 9-5-9-5Zm-7 9.5v3.764C5 17.782 8.239 19 12 19s7-1.218 7-2.736V12.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>${quizCount} Quiz Set${quizCount === 1 ? '' : 's'}</span>
      </div>
      <div class="panel-actions" style="justify-content:flex-start; gap:12px; margin-top:16px;">
        <a class="btn btn-primary" href="quiz.html?subject=${topic.subjectId}&topic=${topic.id}&mode=study">Start Study</a>
        <a class="btn btn-secondary" href="quiz.html?subject=${topic.subjectId}&topic=${topic.id}&mode=quiz">Start Quiz</a>
      </div>
    </article>
  `;
}


function activateHeroSearch() {
  const search = byId('heroSearch');
  if (!search) return;
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.location.href = `subjects.html?search=${encodeURIComponent(search.value.trim())}`;
    }
  });
}

function setupSubjectSearch(input, listElement, subjects) {
  const draw = (term = '') => {
    const filtered = subjects.filter((s) => s.name.toLowerCase().includes(term.toLowerCase()));
    listElement.innerHTML = filtered.length
      ? filtered.map(renderSubjectCard).join('')
      : `<div class="notice-box">No subjects found for “${term}”.</div>`;
  };
  draw(params().get('search') || '');
  if (params().get('search')) input.value = params().get('search');
  input?.addEventListener('input', (e) => draw(e.target.value));
}

function renderHome() {
  const container = byId('featuredSubjects');
  if (container) container.innerHTML = appData.subjects.slice(0, 4).map(renderSubjectCard).join('');
  activateHeroSearch();
}

function renderSubjectsPage() {
  const list = byId('subjectList');
  const input = byId('subjectSearch');
  if (list && input) setupSubjectSearch(input, list, appData.subjects);
}

function renderTopicsPage() {
  const subjectId = params().get('subject');
  const subject = appData.subjects.find((s) => s.id === subjectId) || appData.subjects[0];
  const title = byId('topicPageTitle');
  const eyebrow = byId('topicSubjectEyebrow');
  if (title) title.textContent = `${subject.name} Topics`;
  if (eyebrow) eyebrow.textContent = subject.name;
  const list = byId('topicList');
  const input = byId('topicSearch');
  const topics = appData.topics.filter((t) => t.subjectId === subject.id);
  const draw = (term = '') => {
    const filtered = topics.filter((t) => t.name.toLowerCase().includes(term.toLowerCase()));
    list.innerHTML = filtered.length
      ? filtered.map(renderTopicCard).join('')
      : `<div class="notice-box">No topics found.</div>`;
  };
  draw();
  input?.addEventListener('input', (e) => draw(e.target.value));
}

function getProgressStore() {
  if (!appData.progress) appData.progress = { attempts: [], recent: [] };
  if (!Array.isArray(appData.progress.attempts)) appData.progress.attempts = [];
  if (!Array.isArray(appData.progress.recent)) appData.progress.recent = [];
  return appData.progress;
}

function updateProgress(question, selectedIndex, isCorrect, mode, sessionId = null) {
  const store = getProgressStore();
  const topicId = question.topicId;
  const existing = store.attempts.find((item) =>
    item.questionId === question.id &&
    item.mode === mode &&
    (item.sessionId || null) === (sessionId || null)
  );
  if (existing) {
    existing.correct = isCorrect;
    existing.selectedIndex = selectedIndex;
    existing.attempts += 1;
    existing.timestamp = Date.now();
  } else {
    store.attempts.push({
      questionId: question.id,
      topicId,
      subjectId: question.subjectId,
      correct: isCorrect,
      selectedIndex,
      attempts: 1,
      mode,
      sessionId,
      timestamp: Date.now()
    });
  }
  store.recent.unshift({
    questionText: question.question,
    topicId,
    subjectId: question.subjectId,
    correct: isCorrect,
    mode,
    sessionId,
    timestamp: Date.now()
  });
  store.recent = store.recent.slice(0, 12);
  syncData();
}


function createQuizState() {
  const search = params();
  const mode = search.get('mode') || 'study';
  const subjectId = search.get('subject');
  const topicId = search.get('topic');
  const quizsetId = search.get('quizset');
  const subject = appData.subjects.find((s) => s.id === subjectId) || null;
  const topic = appData.topics.find((t) => t.id === topicId) || null;
  let questions = [];
  let title = 'Quiz';
  let metaText = 'Question-by-question practice with explanations after every answer.';
  let timerMinutes = null;
  let sessionId = null;
  let quizset = null;

  if (mode === 'exam') {
    const session = load(STORAGE_KEYS.session, null);
    if (session?.questions?.length) {
      questions = session.questions
        .map((id) => getStudyQuestions().find((q) => q.id === id))
        .filter(Boolean);
      title = 'Final Exam Session';
      metaText = 'Exam simulation with a timer and randomized questions.';
      timerMinutes = session.timeLimit || null;
      sessionId = session.startedAt || null;
    }
  } else if (mode === 'quiz') {
    if (quizsetId) {
      quizset = (appData.quizsets || []).find((set) => set.id === quizsetId) || null;
      questions = (quizset?.questionIds || [])
        .map((id) => getQuizQuestions().find((q) => q.id === id))
        .filter(Boolean);
      title = quizset?.name || topic?.name || 'Topic Quiz';
      metaText = 'Timed quiz set built from real exam questions.';
      timerMinutes = quizset?.timeLimit || null;
      sessionId = quizset?.id || null;
    } else {
      title = topic?.name || subject?.name || 'Available Quiz Sets';
      metaText = 'Choose one of the available quiz sets for this topic.';
    }
  } else {
    questions = getStudyQuestions().filter((q) => (!subjectId || q.subjectId === subjectId) && (!topicId || q.topicId === topicId)).slice(0, 30);
    title = topic?.name || subject?.name || 'Study Quiz';
    metaText = 'One question at a time with answer explanation after every submission. Max 30 questions per study set.';
    sessionId = topic?.id ? `study-${topic.id}` : null;
  }

  return {
    mode,
    title,
    subject,
    topic,
    quizset,
    questions,
    currentIndex: 0,
    selectedIndex: null,
    submitted: false,
    timerInterval: null,
    remainingSeconds: timerMinutes ? timerMinutes * 60 : null,
    metaText,
    sessionId
  };
}


function renderQuizPage() {
  const state = createQuizState();
  const sidebarTitle = byId('quizTopicTitle');
  const modeLabel = byId('quizModeLabel');
  const metaText = byId('quizMetaText');
  const questionText = byId('questionText');
  const caseScenario = byId('caseScenario');
  const optionsWrap = byId('optionsWrap');
  const explanationBox = byId('explanationBox');
  const progressText = byId('questionProgressText');
  const progressBar = byId('quizProgressBar');
  const timerText = byId('timerText');
  const subjectBadge = byId('subjectBadge');
  const topicBadge = byId('topicBadge');
  const difficultyBadge = byId('difficultyBadge');
  const submitBtn = byId('submitAnswerBtn');
  const showExplanationBtn = byId('showExplanationBtn');
  const prevBtn = byId('prevQuestionBtn');
  const nextBtn = byId('nextQuestionBtn');

  if (sidebarTitle) sidebarTitle.textContent = state.title;
  if (modeLabel) modeLabel.textContent =
    state.mode === 'exam' ? 'Final Exam' :
    state.mode === 'quiz' ? 'Quiz Mode' :
    'Study Mode';
  if (metaText) metaText.textContent = state.metaText;

  if (state.mode === 'quiz' && !state.quizset) {
    const topicQuizsets = getTopicQuizsets(state.topic?.id);
    questionText.textContent = 'Available Quiz Sets';
    caseScenario.classList.add('hidden');
    explanationBox.classList.add('hidden');
    progressText.textContent = `${topicQuizsets.length} quiz set${topicQuizsets.length === 1 ? '' : 's'} available`;
    progressBar.style.width = '0%';
    subjectBadge.textContent = state.subject?.name || 'Subject';
    topicBadge.textContent = state.topic?.name || 'Topic';
    difficultyBadge.textContent = 'Quiz';
    optionsWrap.innerHTML = topicQuizsets.length ? topicQuizsets.map((set) => `
      <article class="card" style="padding:18px; margin-bottom:12px;">
        <h3 style="margin-bottom:8px;">${escapeHtml(set.name)}</h3>
        <p class="muted" style="margin-bottom:8px;">${set.questionIds?.length || 0} questions • ${set.timeLimit || 10} min</p>
        <a class="btn btn-primary" href="quiz.html?subject=${set.subjectId}&topic=${set.topicId}&mode=quiz&quizset=${set.id}">Start Quiz</a>
      </article>
    `).join('') : `<div class="notice-box">No quiz sets available for this topic yet.</div>`;
    [submitBtn, showExplanationBtn, prevBtn, nextBtn].forEach((btn) => btn?.setAttribute('disabled', 'disabled'));
    return;
  }

  if (!state.questions.length) {
    questionText.textContent = 'No questions available for this selection yet.';
    optionsWrap.innerHTML = `<div class="notice-box">Add questions from the admin panel or choose another topic.</div>`;
    [submitBtn, showExplanationBtn, prevBtn, nextBtn].forEach((btn) => btn?.setAttribute('disabled', 'disabled'));
    return;
  }

  [submitBtn, showExplanationBtn, prevBtn, nextBtn].forEach((btn) => btn?.removeAttribute('disabled'));

  const render = () => {
    const q = state.questions[state.currentIndex];
    state.selectedIndex = null;
    state.submitted = false;
    const imageMarkup = q.imageUrl
      ? `<div class="question-image-wrap" style="margin-bottom:16px;"><img src="${escapeHtml(q.imageUrl)}" alt="Question image" style="max-width:100%; border-radius:16px; display:block;" loading="lazy"></div>`
      : '';
    questionText.innerHTML = `${imageMarkup}${escapeHtml(q.question)}`;
    subjectBadge.textContent = appData.subjects.find((s) => s.id === q.subjectId)?.name || 'Subject';
    topicBadge.textContent = appData.topics.find((t) => t.id === q.topicId)?.name || 'Topic';
    difficultyBadge.textContent = q.difficulty || (state.mode === 'quiz' ? 'Quiz' : 'Difficulty');
    caseScenario.textContent = q.caseScenario || '';
    caseScenario.classList.toggle('hidden', !q.caseScenario);
    explanationBox.classList.add('hidden');
    explanationBox.textContent = q.explanation || '';
    progressText.textContent = `Question ${state.currentIndex + 1} of ${state.questions.length}`;
    progressBar.style.width = `${((state.currentIndex + 1) / state.questions.length) * 100}%`;

    optionsWrap.innerHTML = q.options.map((opt, idx) => `
      <button class="option-btn" data-option-index="${idx}">
        <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
        <span>${escapeHtml(opt)}</span>
      </button>
    `).join('');

    qsa('.option-btn', optionsWrap).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.submitted) return;
        qsa('.option-btn', optionsWrap).forEach((item) => item.classList.remove('selected'));
        btn.classList.add('selected');
        state.selectedIndex = Number(btn.dataset.optionIndex);
      });
    });
  };

  const applySubmission = () => {
    const q = state.questions[state.currentIndex];
    if (state.selectedIndex === null) return;
    state.submitted = true;
    const correct = q.correctAnswer;
    qsa('.option-btn', optionsWrap).forEach((btn, idx) => {
      if (idx === correct) btn.classList.add('correct');
      if (idx === state.selectedIndex && idx !== correct) btn.classList.add('wrong');
    });
    explanationBox.classList.remove('hidden');
    updateProgress(q, state.selectedIndex, state.selectedIndex === correct, state.mode, state.sessionId);
  };

  submitBtn?.addEventListener('click', applySubmission);
  showExplanationBtn?.addEventListener('click', () => explanationBox.classList.remove('hidden'));
  nextBtn?.addEventListener('click', () => {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex += 1;
      render();
    }
  });
  prevBtn?.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      render();
    }
  });
  byId('shuffleBtn')?.addEventListener('click', () => {
    state.questions = shuffleArray(state.questions);
    state.currentIndex = 0;
    render();
  });
  byId('resetProgressBtn')?.addEventListener('click', () => {
    appData.progress.attempts = appData.progress.attempts.filter((item) => {
      if (state.mode === 'exam') return item.mode !== 'exam';
      if (state.mode === 'quiz') return !(item.mode === 'quiz' && item.sessionId === state.sessionId);
      return !(item.mode === 'study' && item.topicId === state.topic?.id);
    });
    syncData();
    render();
  });

  if ((state.mode === 'exam' || state.mode === 'quiz') && timerText && state.remainingSeconds) {
    timerText.classList.remove('hidden');
    const drawTimer = () => {
      const minutes = String(Math.floor(state.remainingSeconds / 60)).padStart(2, '0');
      const seconds = String(state.remainingSeconds % 60).padStart(2, '0');
      timerText.textContent = `${minutes}:${seconds}`;
    };
    drawTimer();
    state.timerInterval = setInterval(() => {
      state.remainingSeconds -= 1;
      drawTimer();
      if (state.remainingSeconds <= 0) {
        clearInterval(state.timerInterval);
        alert(state.mode === 'exam' ? 'Exam time finished.' : 'Quiz time finished.');
      }
    }, 1000);
  } else if (timerText) {
    timerText.classList.add('hidden');
  }

  render();
}


function renderFinalExamPage() {
  const subjectSelect = byId('examSubjectSelect');
  const difficultySelect = byId('examDifficultySelect');
  const countInput = byId('examQuestionCount');
  const timeInput = byId('examTimeLimit');
  const mode1Card = byId('mode1Card');
  const mode2Card = byId('mode2Card');
  const targetedWrap = byId('targetedTopicsWrap');
  const topicsChecklist = byId('examTopicsChecklist');
  const targetedHint = byId('targetedTopicsHint');

  let examMode = 'comprehensive';

  const setMode = (mode) => {
    examMode = mode;
    mode1Card?.classList.toggle('active', mode === 'comprehensive');
    mode2Card?.classList.toggle('active', mode === 'targeted');
    targetedWrap?.classList.toggle('hidden', mode !== 'targeted');
    if (mode === 'targeted' && subjectSelect.value === 'all' && appData.subjects[0]) {
      subjectSelect.value = appData.subjects[0].id;
      renderTopicsChecklist();
    }
  };

  const renderTopicsChecklist = () => {
    const subjectId = subjectSelect.value;
    const topicItems = appData.topics.filter((t) => subjectId !== 'all' && t.subjectId === subjectId);
    if (!topicsChecklist) return;
    if (!topicItems.length) {
      topicsChecklist.innerHTML = `<div class="notice-box">Choose a specific subject to hand-pick topics.</div>`;
      if (targetedHint) targetedHint.textContent = 'Mode 2 works with a single subject and any number of topics you choose.';
      return;
    }
    topicsChecklist.innerHTML = topicItems.map((topic) => `
      <label class="check-row topic-check">
        <input type="checkbox" value="${topic.id}">
        <span>${topic.name}</span>
      </label>
    `).join('');
    if (targetedHint) targetedHint.textContent = 'Select any number of topics for the generated exam.';
  };

  subjectSelect.innerHTML = `<option value="all">All Available Subjects (Comprehensive)</option>` +
    appData.subjects.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');

  mode1Card?.addEventListener('click', () => setMode('comprehensive'));
  mode2Card?.addEventListener('click', () => setMode('targeted'));
  subjectSelect?.addEventListener('change', renderTopicsChecklist);

  setMode('comprehensive');
  renderTopicsChecklist();

  byId('generateExamBtn')?.addEventListener('click', () => {
    const subjectId = subjectSelect.value;
    const difficulty = difficultySelect.value;
    const count = Number(countInput.value || 50);
    const timeLimit = Number(timeInput.value || 60);
    let questions = [...getStudyQuestions()];

    if (examMode === 'comprehensive') {
      if (subjectId !== 'all') questions = questions.filter((q) => q.subjectId === subjectId);
    } else {
      const selectedTopics = getSelectedValues(topicsChecklist);
      if (subjectId === 'all') {
        alert('Mode 2 requires a single subject.');
        return;
      }
      if (!selectedTopics.length) {
        alert('Choose at least one topic for Mode 2.');
        return;
      }
      questions = questions.filter((q) => q.subjectId === subjectId && selectedTopics.includes(q.topicId));
    }

    if (difficulty !== 'mixed') questions = questions.filter((q) => q.difficulty === difficulty);
    questions = shuffleArray(questions).slice(0, count);

    save(STORAGE_KEYS.session, {
      questions: questions.map((q) => q.id),
      timeLimit,
      startedAt: Date.now(),
      mode: examMode
    });
    window.location.href = 'quiz.html?mode=exam';
  });
}


function summarizeDashboard() {
  const progress = getProgressStore();
  const attempts = progress.attempts;
  const recent = progress.recent;
  const empty = byId('dashboardEmptyState');
  const content = byId('dashboardContent');
  if (!attempts.length) {
    empty?.classList.remove('hidden');
    content?.classList.add('hidden');
    return;
  }
  empty?.classList.add('hidden');
  content?.classList.remove('hidden');

  const solved = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const successRate = Math.round((correct / solved) * 100);
  const quizSessions = uniqueBy(attempts.filter((a) => a.mode === 'quiz').map((a) => a.sessionId)).length;
  const examSessions = uniqueBy(attempts.filter((a) => a.mode === 'exam').map((a) => a.sessionId)).length;

  byId('statSuccess').textContent = `${successRate}%`;
  byId('statSolved').textContent = String(solved);
  byId('statQuizSets').textContent = String(quizSessions);
  byId('statFinalExams').textContent = String(examSessions);

  const subjectProgress = appData.subjects.map((subject) => {
    const items = attempts.filter((a) => a.subjectId === subject.id);
    if (!items.length) return { name: subject.name, value: 0 };
    const pct = Math.round((items.filter((a) => a.correct).length / items.length) * 100);
    return { name: subject.name, value: pct };
  });
  byId('subjectProgressList').innerHTML = subjectProgress.map((item) => `
    <div class="progress-item">
      <p><span>${item.name}</span><span>${item.value ? `${item.value}%` : 'No data'}</span></p>
      <div class="progress-track"><span style="width:${item.value}%"></span></div>
    </div>
  `).join('');

  const topicSummary = appData.topics.map((topic) => {
    const items = attempts.filter((a) => a.topicId === topic.id);
    const percent = items.length ? (items.filter((a) => a.correct).length / items.length) * 100 : null;
    return { name: topic.name, items: items.length, percent };
  }).filter((t) => t.items);
  const strengths = topicSummary.filter((t) => t.items >= 1).sort((a, b) => b.percent - a.percent).slice(0, 3);
  const weak = topicSummary.filter((t) => t.items >= 1).sort((a, b) => a.percent - b.percent).slice(0, 3);
  byId('strengthAreas').innerHTML = strengths.length ? strengths.map((t) => `<p><strong>${t.name}</strong> — ${Math.round(t.percent)}%</p>`).join('') : '<p class="small-note">Need at least 1 completed topic to show strengths.</p>';
  byId('weakAreas').innerHTML = weak.length ? weak.map((t) => `<p><strong>${t.name}</strong> — ${Math.round(t.percent)}%</p>`).join('') : '<p class="small-note">Complete more quizzes to identify weak areas.</p>';
  byId('recentActivity').innerHTML = recent.length ? recent.slice(0, 5).map((r) => `<p>${r.correct ? '✅' : '❌'} ${escapeHtml(r.questionText).slice(0, 72)}...</p>`).join('') : '<p class="small-note">No recent activity.</p>';
  byId('studyRecommendation').textContent = weak[0] ? `Focus next on ${weak[0].name}. Your recent accuracy there is ${Math.round(weak[0].percent)}%.` : 'Complete quizzes to get personalized recommendations.';

  const achievementConfig = [
    ['First Steps', solved >= 10, 'Solved 10 questions', '📘'],
    ['Rising Scholar', solved >= 50, 'Solved 50 questions', '🎯'],
    ['Century Club', solved >= 100, 'Solved 100 questions', '💯'],
    ['Quiz Master', quizSessions >= 5, 'Completed 5 quiz sets', '🏆'],
    ['Quiz Champion', quizSessions >= 10, 'Completed 10 quiz sets', '🥇'],
    ['Exam Ready', examSessions >= 1, 'Completed first final exam', '🎓'],
    ['Exam Veteran', examSessions >= 3, 'Completed 3 final exams', '⭐'],
    ['High Achiever', successRate >= 80, 'Scored 80%+ overall', '🔥'],
    ['Perfectionist', successRate === 100 && solved >= 5, 'Scored 100% overall', '✨']
  ];
  byId('achievementsGrid').innerHTML = achievementConfig.map(([title, unlocked, subtitle, icon]) => `
    <article class="card ${unlocked ? '' : 'locked'}">
      <div class="achievement-icon" style="opacity:${unlocked ? 1 : 0.35}">${icon}</div>
      <h4>${title}</h4>
      <p>${subtitle}</p>
    </article>
  `).join('');

  byId('resetDashboardBtn')?.addEventListener('click', () => {
    appData.progress = { attempts: [], recent: [] };
    syncData();
    window.location.reload();
  });
}


function fillSelect(select, items, placeholder = 'Select...') {
  if (!select) return;
  select.innerHTML = items.map((item) => `<option value="${item.id}">${item.name}</option>`).join('') || `<option value="">${placeholder}</option>`;
}


const ADMIN_SECURITY = {
  password: 'PharmacyNexusAdmin2026',
  trustedDeviceKey: 'pn_admin_trusted_device',
  sessionUnlockKey: 'pn_admin_session_unlock'
};

function hasGithubSettings() {
  return Boolean(appData?.settings?.owner && appData?.settings?.repo && appData?.settings?.branch && appData?.settings?.token);
}

function encodeBase64Unicode(input) {
  return btoa(unescape(encodeURIComponent(input)));
}

async function githubGetFile(path) {
  const { owner, repo, branch, token } = appData.settings;
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub read failed for ${path}`);
  return response.json();
}

async function githubPutFile(path, data, message, retry = true) {
  const { owner, repo, branch, token } = appData.settings;
  const existing = await githubGetFile(path);
  const body = {
    message,
    branch,
    content: encodeBase64Unicode(JSON.stringify(data, null, 2))
  };
  if (existing?.sha) body.sha = existing.sha;

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (response.status === 409 && retry) {
    return githubPutFile(path, data, message, false);
  }

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `GitHub write failed for ${path}`);
  }

  return response.json();
}

async function syncGithubData(message = 'Update pharmacy nexus data') {
  await githubPutFile(DATA_FILES.subjects, appData.subjects, `${message} • subjects`);
  await githubPutFile(DATA_FILES.topics, appData.topics, `${message} • topics`);
  await githubPutFile(DATA_FILES.studyQuestions, appData.studyQuestions, `${message} • study questions`);
  await githubPutFile(DATA_FILES.quizQuestions, appData.quizQuestions, `${message} • quiz questions`);
  await githubPutFile(DATA_FILES.quizsets, appData.quizsets, `${message} • quizsets`);
  await githubPutFile(DATA_FILES.legacyQuestions, appData.studyQuestions, `${message} • legacy questions`);

  const studyFiles = buildGroupedQuestionFiles(appData.studyQuestions, 'study');
  for (const [path, items] of Object.entries(studyFiles)) {
    await githubPutFile(path, items, `${message} • ${path}`);
  }

  const quizFiles = buildGroupedQuestionFiles(appData.quizQuestions, 'quiz');
  for (const [path, items] of Object.entries(quizFiles)) {
    await githubPutFile(path, items, `${message} • ${path}`);
  }
}


async function persistAndMaybeSync(message) {
  syncData();
  const statusNode = byId('adminSyncStatus');
  if (statusNode) {
    statusNode.textContent = hasGithubSettings() ? 'Syncing to GitHub...' : 'Saved locally. Add GitHub settings to push live.';
    statusNode.dataset.state = hasGithubSettings() ? 'loading' : 'local';
  }
  if (!hasGithubSettings()) return;
  try {
    await syncGithubData(message);
    if (statusNode) {
      statusNode.textContent = 'Synced to GitHub successfully.';
      statusNode.dataset.state = 'success';
    }
  } catch (error) {
    console.error(error);
    if (statusNode) {
      statusNode.textContent = 'GitHub sync failed. Local changes were saved in this browser only.';
      statusNode.dataset.state = 'error';
    }
    alert('GitHub sync failed. Check token, repo, branch, and file permissions.');
  }
}


function renderAdmin() {
  const gate = byId('adminGate');
  const shell = byId('adminShell');
  if (!gate || !shell) return;

  const unlockStatus = byId('adminUnlockStatus');
  const trustedDevice = localStorage.getItem(ADMIN_SECURITY.trustedDeviceKey) === 'trusted';
  const sessionUnlocked = sessionStorage.getItem(ADMIN_SECURITY.sessionUnlockKey) === '1';

  function revealShell() {
    gate.classList.add('hidden');
    shell.classList.remove('hidden');
    initializeAdminInterface();
  }

  function lockShell() {
    gate.classList.remove('hidden');
    shell.classList.add('hidden');
    sessionStorage.removeItem(ADMIN_SECURITY.sessionUnlockKey);
  }

  byId('adminUnlockForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = byId('adminPasswordInput').value;
    if (password !== ADMIN_SECURITY.password) {
      unlockStatus.textContent = 'Wrong password.';
      unlockStatus.dataset.state = 'error';
      return;
    }
    sessionStorage.setItem(ADMIN_SECURITY.sessionUnlockKey, '1');
    if (byId('trustThisDeviceCheckbox')?.checked) localStorage.setItem(ADMIN_SECURITY.trustedDeviceKey, 'trusted');
    unlockStatus.textContent = '';
    revealShell();
  });

  byId('adminForgetDeviceBtn')?.addEventListener('click', () => {
    localStorage.removeItem(ADMIN_SECURITY.trustedDeviceKey);
    sessionStorage.removeItem(ADMIN_SECURITY.sessionUnlockKey);
    unlockStatus.textContent = 'Trusted device removed.';
    unlockStatus.dataset.state = 'local';
  });

  if (trustedDevice || sessionUnlocked) revealShell();
  else lockShell();
}

function initializeAdminInterface() {
  if (window.__pnAdminInitialized) return;
  window.__pnAdminInitialized = true;

  const viewMap = {
    subjects: byId('adminViewSubjects'),
    topics: byId('adminViewTopics'),
    questions: byId('adminViewQuestions'),
    quizsets: byId('adminViewQuizsets'),
    settings: byId('adminViewSettings')
  };

  const switchView = (key) => {
    qsa('.sidebar-link').forEach((btn) => btn.classList.toggle('active', btn.dataset.adminView === key));
    Object.entries(viewMap).forEach(([viewKey, panel]) => panel?.classList.toggle('hidden', viewKey !== key));
  };

  qsa('.sidebar-link').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.adminView));
  });

  qsa('[data-cancel-form]').forEach((btn) => {
    btn.addEventListener('click', () => byId(btn.dataset.cancelForm)?.classList.add('hidden'));
  });

  const localFillSelect = (select, items) => {
    if (!select) return;
    select.innerHTML = items.length
      ? items.map((item) => `<option value="${item.id}">${item.name}</option>`).join('')
      : '<option value="">No options yet</option>';
  };

  const renderSubjectsAdmin = () => {
    byId('adminSubjectsList').innerHTML = appData.subjects.map((subject) => {
      const topicCount = appData.topics.filter((t) => t.subjectId === subject.id).length;
      return `
        <article class="stack-item">
          <div>
            <h4>${subject.name}</h4>
            <p>ID: ${subject.id}</p>
          </div>
          <div class="stack-actions">
            <span class="mini-badge">${topicCount} Topics</span>
            <button class="icon-btn" data-delete-subject="${subject.id}">🗑</button>
          </div>
        </article>
      `;
    }).join('');
    qsa('[data-delete-subject]').forEach((btn) => btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteSubject;
      appData.subjects = appData.subjects.filter((s) => s.id !== id);
      appData.topics = appData.topics.filter((t) => t.subjectId !== id);
      appData.studyQuestions = appData.studyQuestions.filter((q) => q.subjectId !== id);
      appData.quizQuestions = appData.quizQuestions.filter((q) => q.subjectId !== id);
      appData.quizsets = appData.quizsets.filter((set) => set.subjectId !== id);
      await persistAndMaybeSync('Admin deleted a subject');
      refreshAllAdminLists();
    }));
  };

  const renderTopicsAdmin = () => {
    const subjectSelect = byId('adminTopicSubjectSelect');
    localFillSelect(subjectSelect, appData.subjects);
    const selectedSubjectId = subjectSelect.value || appData.subjects[0]?.id;
    const topics = appData.topics.filter((t) => t.subjectId === selectedSubjectId);
    byId('adminTopicsList').innerHTML = topics.map((topic) => {
      const studyCount = getTopicStudyQuestions(topic.id).length;
      const quizCount = getTopicQuizQuestions(topic.id).length;
      return `
        <article class="stack-item">
          <div>
            <h4>${topic.name}</h4>
            <p>ID: ${topic.id} • ${studyCount} study • ${quizCount} quiz</p>
          </div>
          <div class="stack-actions"><button class="icon-btn" data-delete-topic="${topic.id}">🗑</button></div>
        </article>
      `;
    }).join('') || `<div class="notice-box">No topics for this subject yet.</div>`;
    qsa('[data-delete-topic]').forEach((btn) => btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteTopic;
      appData.topics = appData.topics.filter((t) => t.id !== id);
      appData.studyQuestions = appData.studyQuestions.filter((q) => q.topicId !== id);
      appData.quizQuestions = appData.quizQuestions.filter((q) => q.topicId !== id);
      appData.quizsets = appData.quizsets.filter((set) => set.topicId !== id);
      await persistAndMaybeSync('Admin deleted a topic');
      refreshAllAdminLists();
    }));
  };

  const renderQuestionsAdmin = () => {
    const bankFilter = byId('adminQuestionBankFilter')?.value || 'study';
    const subjectSelect = byId('adminQuestionSubjectSelect');
    localFillSelect(subjectSelect, appData.subjects);
    const subjectId = subjectSelect.value || appData.subjects[0]?.id;
    const topicSelect = byId('adminQuestionTopicSelect');
    localFillSelect(topicSelect, appData.topics.filter((t) => t.subjectId === subjectId));
    const topicId = topicSelect.value;
    const questions = getQuestionBank(bankFilter).filter((q) => (!subjectId || q.subjectId === subjectId) && (!topicId || q.topicId === topicId));
    byId('adminQuestionsList').innerHTML = questions.length ? questions.map((q) => `
      <article class="stack-item">
        <div>
          <h4>${escapeHtml(q.question.slice(0, 90))}${q.question.length > 90 ? '…' : ''}</h4>
          <p>${bankFilter === 'quiz' ? 'Quiz bank' : 'Study bank'} • ${q.type} • ${q.difficulty}${q.imageUrl ? ' • image' : ''}</p>
        </div>
        <div class="stack-actions"><button class="icon-btn" data-delete-question="${q.id}" data-delete-bank="${bankFilter}">🗑</button></div>
      </article>
    `).join('') : `<div class="notice-box">Select a subject and topic to view questions.</div>`;
    qsa('[data-delete-question]').forEach((btn) => btn.addEventListener('click', async () => {
      const bank = btn.dataset.deleteBank;
      if (bank === 'quiz') appData.quizQuestions = appData.quizQuestions.filter((q) => q.id !== btn.dataset.deleteQuestion);
      else appData.studyQuestions = appData.studyQuestions.filter((q) => q.id !== btn.dataset.deleteQuestion);
      appData.quizsets = appData.quizsets.map((set) => ({
        ...set,
        questionIds: (set.questionIds || []).filter((id) => id !== btn.dataset.deleteQuestion)
      }));
      await persistAndMaybeSync('Admin deleted a question');
      refreshAllAdminLists();
    }));
  };

  const renderQuizsetQuestionPicker = () => {
    const subjectId = byId('quizsetSubjectSelect')?.value;
    const topicId = byId('quizsetTopicSelect')?.value;
    const picker = byId('quizsetQuestionPicker');
    const quizQuestions = getQuizQuestions().filter((q) => (!subjectId || q.subjectId === subjectId) && (!topicId || q.topicId === topicId));
    if (!picker) return;
    if (!quizQuestions.length) {
      picker.innerHTML = '<div class="notice-box">No quiz-bank questions for this topic yet. Add Quiz questions first.</div>';
      return;
    }
    picker.innerHTML = quizQuestions.map((q) => `
      <label class="check-row" style="align-items:flex-start;">
        <input type="checkbox" value="${q.id}">
        <span>${escapeHtml(q.question.slice(0, 120))}${q.question.length > 120 ? '…' : ''}</span>
      </label>
    `).join('');
  };

  const renderQuizsetsAdmin = () => {
    localFillSelect(byId('quizsetSubjectSelect'), appData.subjects);
    const currentSubject = byId('quizsetSubjectSelect').value || appData.subjects[0]?.id;
    localFillSelect(byId('quizsetTopicSelect'), appData.topics.filter((t) => t.subjectId === currentSubject));
    renderQuizsetQuestionPicker();
    byId('adminQuizsetsList').innerHTML = appData.quizsets.map((set) => `
      <article class="stack-item">
        <div>
          <h4>${escapeHtml(set.name)}</h4>
          <p>${appData.subjects.find((s) => s.id === set.subjectId)?.name || ''} • ${appData.topics.find((t) => t.id === set.topicId)?.name || ''} • ${set.questionIds?.length || 0} questions • ${set.timeLimit} min</p>
        </div>
        <div class="stack-actions"><button class="icon-btn" data-delete-quizset="${set.id}">🗑</button></div>
      </article>
    `).join('');
    qsa('[data-delete-quizset]').forEach((btn) => btn.addEventListener('click', async () => {
      appData.quizsets = appData.quizsets.filter((q) => q.id !== btn.dataset.deleteQuizset);
      await persistAndMaybeSync('Admin deleted a quiz set');
      refreshAllAdminLists();
    }));
  };

  const renderSettings = () => {
    byId('settingOwner').value = appData.settings.owner || '';
    byId('settingRepo').value = appData.settings.repo || '';
    byId('settingBranch').value = appData.settings.branch || 'main';
    byId('settingToken').value = appData.settings.token || '';
    const statusNode = byId('adminSyncStatus');
    if (statusNode) {
      statusNode.textContent = hasGithubSettings() ? 'GitHub sync is configured.' : 'GitHub sync is not configured yet.';
      statusNode.dataset.state = hasGithubSettings() ? 'success' : 'local';
    }
  };

  function refreshAllAdminLists() {
    renderSubjectsAdmin();
    renderTopicsAdmin();
    renderQuestionsAdmin();
    renderQuizsetsAdmin();
    renderSettings();
  }

  refreshAllAdminLists();

  byId('showAddSubjectBtn')?.addEventListener('click', () => byId('subjectForm').classList.toggle('hidden'));
  byId('subjectForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = byId('subjectNameInput').value.trim();
    if (!name) return;
    appData.subjects.push({ id: slugify(name), name });
    byId('subjectNameInput').value = '';
    byId('subjectForm').classList.add('hidden');
    await persistAndMaybeSync('Admin added a subject');
    refreshAllAdminLists();
  });

  byId('adminTopicSubjectSelect')?.addEventListener('change', refreshAllAdminLists);
  byId('showAddTopicBtn')?.addEventListener('click', () => byId('topicForm').classList.toggle('hidden'));
  byId('topicForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = byId('topicNameInput').value.trim();
    const subjectId = byId('adminTopicSubjectSelect').value;
    if (!name || !subjectId) return;
    appData.topics.push({ id: slugify(name), name, subjectId });
    byId('topicNameInput').value = '';
    byId('topicForm').classList.add('hidden');
    await persistAndMaybeSync('Admin added a topic');
    refreshAllAdminLists();
  });

  byId('adminQuestionBankFilter')?.addEventListener('change', refreshAllAdminLists);
  byId('adminQuestionSubjectSelect')?.addEventListener('change', refreshAllAdminLists);
  byId('adminQuestionTopicSelect')?.addEventListener('change', refreshAllAdminLists);
  byId('showAddQuestionBtn')?.addEventListener('click', () => byId('questionForm').classList.toggle('hidden'));
  byId('questionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bank = byId('questionBankInput').value;
    const subjectId = byId('adminQuestionSubjectSelect').value;
    const topicId = byId('adminQuestionTopicSelect').value;
    const options = [
      byId('option1Input').value.trim(),
      byId('option2Input').value.trim(),
      byId('option3Input').value.trim(),
      byId('option4Input').value.trim()
    ];
    const target = bank === 'quiz' ? appData.quizQuestions : appData.studyQuestions;
    target.push({
      id: `${bank}-q-${Date.now()}`,
      subjectId,
      topicId,
      bank,
      type: byId('questionTypeInput').value,
      difficulty: byId('questionDifficultyInput').value,
      question: byId('questionTextInput').value.trim(),
      caseScenario: byId('questionCaseInput').value.trim(),
      imageUrl: byId('questionImageInput')?.value.trim() || '',
      options,
      correctAnswer: Number(byId('correctAnswerInput').value),
      explanation: byId('questionExplanationInput').value.trim()
    });
    e.target.reset();
    byId('questionBankInput').value = bank;
    byId('questionForm').classList.add('hidden');
    await persistAndMaybeSync(bank === 'quiz' ? 'Admin added a quiz-bank question' : 'Admin added a study question');
    refreshAllAdminLists();
  });

  byId('quizsetSubjectSelect')?.addEventListener('change', refreshAllAdminLists);
  byId('quizsetTopicSelect')?.addEventListener('change', renderQuizsetQuestionPicker);
  byId('showAddQuizsetBtn')?.addEventListener('click', () => {
    byId('quizsetForm').classList.toggle('hidden');
    renderQuizsetQuestionPicker();
  });
  byId('quizsetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const questionIds = getSelectedValues(byId('quizsetQuestionPicker'));
    if (!questionIds.length) {
      alert('Select at least one quiz-bank question for this quiz set.');
      return;
    }
    appData.quizsets.push({
      id: `quiz-${Date.now()}`,
      name: byId('quizsetNameInput').value.trim(),
      subjectId: byId('quizsetSubjectSelect').value,
      topicId: byId('quizsetTopicSelect').value,
      timeLimit: Number(byId('quizsetTimeInput').value || 10),
      questionIds
    });
    e.target.reset();
    byId('quizsetForm').classList.add('hidden');
    await persistAndMaybeSync('Admin added a quiz set');
    refreshAllAdminLists();
  });

  byId('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    appData.settings = {
      owner: byId('settingOwner').value.trim(),
      repo: byId('settingRepo').value.trim(),
      branch: byId('settingBranch').value.trim() || 'main',
      token: byId('settingToken').value.trim()
    };
    syncData();
    renderSettings();
    if (hasGithubSettings()) {
      await persistAndMaybeSync('Admin synced settings and data');
    }
  });

  byId('disconnectBtn')?.addEventListener('click', () => {
    appData.settings = { owner: '', repo: '', branch: 'main', token: '' };
    syncData();
    localStorage.removeItem(ADMIN_SECURITY.trustedDeviceKey);
    sessionStorage.removeItem(ADMIN_SECURITY.sessionUnlockKey);
    renderSettings();
    window.location.reload();
  });

  switchView('subjects');
}


function pageRouter() {
  const page = document.body.dataset.page;
  switch (page) {
    case 'home': renderHome(); break;
    case 'subjects': renderSubjectsPage(); break;
    case 'topics': renderTopicsPage(); break;
    case 'quiz': renderQuizPage(); break;
    case 'final-exam': renderFinalExamPage(); break;
    case 'dashboard': summarizeDashboard(); break;
    case 'admin': renderAdmin(); break;
    default: break;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initializeData();
  pageRouter();
});
