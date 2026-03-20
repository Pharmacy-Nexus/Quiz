byId('submitAnswerBtn')?.remove();
const DATA_FILES = {
  subjects: 'data/subjects.json',
  topics: 'data/topics.json',
  questions: 'data/questions.json',
  quizsets: 'data/quizsets.json'
};

const STORAGE_KEYS = {
  subjects: 'pn_subjects',
  topics: 'pn_topics',
  questions: 'pn_questions',
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

async function initializeData() {
  if (appData?.subjects) return appData;

  const embedded = window.PHARMACY_NEXUS_DATA || null;
  let seedSubjects = embedded?.subjects;
  let seedTopics = embedded?.topics;
  let seedQuestions = embedded?.questions;
  let seedQuizsets = embedded?.quizsets;

  if (!seedSubjects || !seedTopics || !seedQuestions || !seedQuizsets) {
    try {
      [seedSubjects, seedTopics, seedQuestions, seedQuizsets] = await Promise.all([
        readJson(DATA_FILES.subjects),
        readJson(DATA_FILES.topics),
        readJson(DATA_FILES.questions),
        readJson(DATA_FILES.quizsets)
      ]);
    } catch (error) {
      console.warn('Falling back to embedded data seed.', error);
      seedSubjects = seedSubjects || [];
      seedTopics = seedTopics || [];
      seedQuestions = seedQuestions || [];
      seedQuizsets = seedQuizsets || [];
    }
  }

  const defaultSettings = embedded?.settings || { owner: '', repo: '', branch: 'main', token: '' };
  const defaultProgress = embedded?.progress || { attempts: [], recent: [] };

  if (!localStorage.getItem(STORAGE_KEYS.subjects)) save(STORAGE_KEYS.subjects, seedSubjects);
  if (!localStorage.getItem(STORAGE_KEYS.topics)) save(STORAGE_KEYS.topics, seedTopics);
  if (!localStorage.getItem(STORAGE_KEYS.questions)) save(STORAGE_KEYS.questions, seedQuestions);
  if (!localStorage.getItem(STORAGE_KEYS.quizsets)) save(STORAGE_KEYS.quizsets, seedQuizsets);
  if (!localStorage.getItem(STORAGE_KEYS.settings)) save(STORAGE_KEYS.settings, defaultSettings);
  if (!localStorage.getItem(STORAGE_KEYS.progress)) save(STORAGE_KEYS.progress, defaultProgress);

  appData = {
    subjects: load(STORAGE_KEYS.subjects, seedSubjects),
    topics: load(STORAGE_KEYS.topics, seedTopics),
    questions: load(STORAGE_KEYS.questions, seedQuestions),
    quizsets: load(STORAGE_KEYS.quizsets, seedQuizsets),
    settings: load(STORAGE_KEYS.settings, defaultSettings),
    progress: load(STORAGE_KEYS.progress, defaultProgress)
  };

  return appData;
}

function syncData() {
  save(STORAGE_KEYS.subjects, appData.subjects);
  save(STORAGE_KEYS.topics, appData.topics);
  save(STORAGE_KEYS.questions, appData.questions);
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
  const qCount = appData.questions.filter((q) => q.topicId === topic.id).length;

  // ✅ عدد الـ sets (كل 30 سؤال)
  const setsCount = Math.ceil(qCount / 30);

  // ✅ إنشاء الأزرار بشكل ديناميك
  const setsButtons = Array.from({ length: setsCount }, (_, i) => `
    <a class="btn btn-primary" href="quiz.html?subject=${topic.subjectId}&topic=${topic.id}&mode=study&set=${i + 1}">
      Study ${i + 1}
    </a>
  `).join('');

  return `
    <article class="card topic-card">
      <h3>${topic.name}</h3>

      <div class="topic-meta">
        <span>${qCount} Questions</span>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${setsButtons}
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

function updateProgress(question, selectedIndex, isCorrect, mode) {
  const store = getProgressStore();
  const topicId = question.topicId;
  const existing = store.attempts.find((item) => item.questionId === question.id && item.mode === mode);
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
      timestamp: Date.now()
    });
  }
  store.recent.unshift({
    questionText: question.question,
    topicId,
    subjectId: question.subjectId,
    correct: isCorrect,
    mode,
    timestamp: Date.now()
  });
  store.recent = store.recent.slice(0, 12);
  syncData();
}

function createQuizState() {
  const search = params();
  const mode = search.get('mode') || 'study';
  let questions = [...appData.questions];
  let title = 'Quiz';
  let subject = null;
  let topic = null;

  if (mode === 'exam') {
    const session = load(STORAGE_KEYS.session, null);
    if (session?.questions?.length) {
      questions = session.questions.map((id) => appData.questions.find((q) => q.id === id)).filter(Boolean);
      title = 'Final Exam Session';
    }
  
  } else {
    const subjectId = search.get('subject');
    const topicId = search.get('topic');
    subject = appData.subjects.find((s) => s.id === subjectId);
    topic = appData.topics.find((t) => t.id === topicId);
    questions = questions.filter((q) => (!subjectId || q.subjectId === subjectId) && (!topicId || q.topicId === topicId));
    title = topic?.name || subject?.name || 'Study Quiz';
  }

  // ✅ Study Sets System (NEW - safe)
if (mode === 'study') {
  const set = Number(search.get('set') || 1);
  const start = (set - 1) * 30;
  questions = questions.slice(start, start + 30);
}
  return {
    mode,
    title,
    subject,
    topic,
    questions,
    currentIndex: 0,
    selectedIndex: null,
    submitted: false,
    timerInterval: null,
    remainingSeconds: load(STORAGE_KEYS.session, null)?.timeLimit ? load(STORAGE_KEYS.session, null).timeLimit * 60 : null
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

  if (!state.questions.length) {
    questionText.textContent = 'No questions available for this topic yet.';
    optionsWrap.innerHTML = `<div class="notice-box">Add questions from the admin panel or choose another topic.</div>`;
    qsa('.quiz-actions-row button, .pager-row button').forEach((btn) => btn.disabled = true);
    return;
  }

  if (sidebarTitle) sidebarTitle.textContent = state.title;
  if (modeLabel) modeLabel.textContent = state.mode === 'exam' ? 'Final Exam' : 'Study Mode';
  if (metaText) metaText.textContent = state.mode === 'exam'
    ? 'Exam simulation with a timer and randomized questions.'
    : 'One question at a time with answer explanation after every submission.';

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
    difficultyBadge.textContent = q.difficulty;
    caseScenario.textContent = q.caseScenario || '';
    caseScenario.classList.toggle('hidden', !q.caseScenario);
    explanationBox.classList.add('hidden');
    explanationBox.textContent = q.explanation;
    progressText.textContent = `Question ${state.currentIndex + 1} of ${state.questions.length}`;
    progressBar.style.width = `${((state.currentIndex + 1) / state.questions.length) * 100}%`;

    optionsWrap.innerHTML = q.options.map((opt, idx) => `
      <button class="option-btn" data-option-index="${idx}">
        <span class="option-letter">${String.fromCharCode(65 + idx)}</span>
        <span>${opt}</span>
      </button>
    `).join('');

 qsa('.option-btn', optionsWrap).forEach((btn) => {
  btn.addEventListener('click', () => {
    if (state.submitted) return;

    qsa('.option-btn', optionsWrap).forEach((item) =>
      item.classList.remove('selected')
    );

    btn.classList.add('selected');

    state.selectedIndex = Number(btn.dataset.optionIndex);

    // ✅ AUTO SUBMIT
    // ✅ animation click
btn.style.transform = "scale(0.95)";
setTimeout(() => {
  btn.style.transform = "scale(1)";
}, 150);
    applySubmission();
  });
});
    }

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
    updateProgress(q, state.selectedIndex, state.selectedIndex === correct, state.mode);
  };

  byId('submitAnswerBtn')?.addEventListener('click', applySubmission);
  byId('showExplanationBtn')?.addEventListener('click', () => explanationBox.classList.remove('hidden'));
 byId('nextQuestionBtn')?.addEventListener('click', () => {

  if (state.currentIndex < state.questions.length - 1) {
    
    state.currentIndex += 1;
    render();

  } else {

    // ✅ وصلنا لنهاية الـ set

    const reviewData = {
      questions: state.questions,
      attempts: appData.progress.attempts
    };

    localStorage.setItem("pn_review_data", JSON.stringify(reviewData));

    window.location.href = "review.html";
  }

});
  
  byId('prevQuestionBtn')?.addEventListener('click', () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      render();
    }
  });
  byId('shuffleBtn')?.addEventListener('click', () => {
    state.questions.sort(() => Math.random() - 0.5);
    state.currentIndex = 0;
    render();
  });
  byId('resetProgressBtn')?.addEventListener('click', () => {
    appData.progress.attempts = appData.progress.attempts.filter((item) => {
      if (state.mode === 'exam') return item.mode !== 'exam';
      return item.topicId !== state.topic?.id;
    });
    syncData();
    render();
  });

  if (state.mode === 'exam' && timerText && state.remainingSeconds) {
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
        alert('Exam time finished.');
      }
    }, 1000);
  }

  render();
}

function renderFinalExamPage() {

  const subjectSelect = byId("examSubjectSelect");
  const mode1Card = byId("mode1Card");
  const mode2Card = byId("mode2Card");
  const targetedWrap = byId("targetedTopicsWrap");
  const topicsWrap = byId("examTopicsChecklist");

  let examMode = "comprehensive";

  // fill subjects
  subjectSelect.innerHTML =
    `<option value="all">All Available Subjects (Comprehensive)</option>` +
    appData.subjects
      .map(s => `<option value="${s.id}">${s.name}</option>`)
      .join("");

  // MODE SWITCH
  mode1Card.onclick = () => {
    examMode = "comprehensive";

    mode1Card.classList.add("active");
    mode2Card.classList.remove("active");

    targetedWrap.classList.add("hidden");
  };

  mode2Card.onclick = () => {
    examMode = "targeted";

    mode2Card.classList.add("active");
    mode1Card.classList.remove("active");

    targetedWrap.classList.remove("hidden");

    renderTopicsChecklist();
  };

  // subject change
  subjectSelect.addEventListener("change", () => {
    if (examMode === "targeted") {
      renderTopicsChecklist();
    }
  });

  function renderTopicsChecklist() {

    const subjectId = subjectSelect.value;

    topicsWrap.innerHTML = "";

    if (subjectId === "all") return;

    const topics = appData.topics.filter(
      t => t.subjectId === subjectId
    );

    topics.forEach(t => {

      const row = document.createElement("label");

      row.style.display = "block";
      row.style.marginBottom = "6px";

      row.innerHTML = `
        <input type="checkbox" value="${t.id}">
        ${t.name}
      `;

      topicsWrap.appendChild(row);

    });
  }

  // generate exam
  byId("generateExamBtn").addEventListener("click", () => {

    const subjectId = subjectSelect.value;
    const difficulty = byId("examDifficultySelect").value;
    const count = Number(byId("examQuestionCount").value || 50);
    const timelimit = Number(byId("examTimeLimit").value || 60);

    let questions = [...appData.questions];

    if (examMode === "targeted") {

      const checked = [
        ...topicsWrap.querySelectorAll("input:checked")
      ].map(i => i.value);

      questions = questions.filter(q =>
        checked.includes(q.topicId)
      );

    } else {

      if (subjectId !== "all") {
        questions = questions.filter(
          q => q.subjectId === subjectId
        );
      }

    }

    if (difficulty !== "mixed") {
      questions = questions.filter(
        q => q.difficulty === difficulty
      );
    }

    questions = questions
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    save(STORAGE_KEYS.session, {
      questions: questions.map(q => q.id),
      timelimit,
      startedAt: Date.now()
    });

    window.location.href = "quiz.html?mode=exam";

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
  byId('statSuccess').textContent = `${successRate}%`;
  byId('statSolved').textContent = String(solved);
  byId('statQuizSets').textContent = String(attempts.filter((a) => a.mode === 'study').length);
  byId('statFinalExams').textContent = String(attempts.filter((a) => a.mode === 'exam').length);

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
  byId('recentActivity').innerHTML = recent.length ? recent.slice(0, 5).map((r) => `<p>${r.correct ? '✅' : '❌'} ${r.questionText.slice(0, 72)}...</p>`).join('') : '<p class="small-note">No recent activity.</p>';
  byId('studyRecommendation').textContent = weak[0] ? `Focus next on ${weak[0].name}. Your recent accuracy there is ${Math.round(weak[0].percent)}%.` : 'Complete quizzes to get personalized recommendations.';

  const achievementConfig = [
    ['First Steps', solved >= 10, 'Solved 10 questions', '📘'],
    ['Rising Scholar', solved >= 50, 'Solved 50 questions', '🎯'],
    ['Century Club', solved >= 100, 'Solved 100 questions', '💯'],
    ['Quiz Master', attempts.filter((a) => a.mode === 'study').length >= 5, 'Completed 5 quiz sets', '🏆'],
    ['Quiz Champion', attempts.filter((a) => a.mode === 'study').length >= 10, 'Completed 10 quiz sets', '🥇'],
    ['Exam Ready', attempts.filter((a) => a.mode === 'exam').length >= 1, 'Completed first final exam', '🎓'],
    ['Exam Veteran', attempts.filter((a) => a.mode === 'exam').length >= 3, 'Completed 3 final exams', '⭐'],
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
  await githubPutFile('data/subjects.json', appData.subjects, `${message} • subjects`);
  await githubPutFile('data/topics.json', appData.topics, `${message} • topics`);
  await githubPutFile('data/questions.json', appData.questions, `${message} • questions`);
  await githubPutFile('data/quizsets.json', appData.quizsets, `${message} • quizsets`);
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

  const fillSelect = (select, items) => {
    if (!select) return;
    select.innerHTML = items.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
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
      appData.questions = appData.questions.filter((q) => q.subjectId !== id);
      await persistAndMaybeSync('Admin deleted a subject');
      refreshAllAdminLists();
    }));
  };

  const renderTopicsAdmin = () => {
    const subjectSelect = byId('adminTopicSubjectSelect');
    fillSelect(subjectSelect, appData.subjects);
    const selectedSubjectId = subjectSelect.value || appData.subjects[0]?.id;
    const topics = appData.topics.filter((t) => t.subjectId === selectedSubjectId);
    byId('adminTopicsList').innerHTML = topics.map((topic) => {
      const qCount = appData.questions.filter((q) => q.topicId === topic.id).length;
      return `
        <article class="stack-item">
          <div>
            <h4>${topic.name}</h4>
            <p>ID: ${topic.id} • ${qCount} questions</p>
          </div>
          <div class="stack-actions"><button class="icon-btn" data-delete-topic="${topic.id}">🗑</button></div>
        </article>
      `;
    }).join('') || `<div class="notice-box">No topics for this subject yet.</div>`;
    qsa('[data-delete-topic]').forEach((btn) => btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteTopic;
      appData.topics = appData.topics.filter((t) => t.id !== id);
      appData.questions = appData.questions.filter((q) => q.topicId !== id);
      await persistAndMaybeSync('Admin deleted a topic');
      refreshAllAdminLists();
    }));
  };

  const renderQuestionsAdmin = () => {
    const subjectSelect = byId('adminQuestionSubjectSelect');
    fillSelect(subjectSelect, appData.subjects);

    const subjectId = subjectSelect.value || appData.subjects[0]?.id;
    const topicSelect = byId('adminQuestionTopicSelect');
    const filteredTopics = appData.topics.filter((t) => t.subjectId === subjectId);

    const previousTopicId = topicSelect?.dataset.selectedTopicId || topicSelect?.value || '';
    fillSelect(topicSelect, filteredTopics);

    if (topicSelect) {
      if (previousTopicId && filteredTopics.some((t) => t.id === previousTopicId)) {
        topicSelect.value = previousTopicId;
      }
      topicSelect.dataset.selectedTopicId = topicSelect.value || '';
    }

    const topicId = topicSelect?.value || '';
    const questions = appData.questions.filter((q) => (!subjectId || q.subjectId === subjectId) && (!topicId || q.topicId === topicId));
    byId('adminQuestionsList').innerHTML = questions.length ? questions.map((q) => `
      <article class="stack-item">
        <div>
          <h4>${q.question.slice(0, 90)}${q.question.length > 90 ? '…' : ''}</h4>
          <p>${q.type} • ${q.difficulty}${q.imageUrl ? ' • image' : ''}</p>
        </div>
        <div class="stack-actions"><button class="icon-btn" data-delete-question="${q.id}">🗑</button></div>
      </article>
    `).join('') : `<div class="notice-box">Select a subject and topic to view questions.</div>`;
    qsa('[data-delete-question]').forEach((btn) => btn.addEventListener('click', async () => {
      appData.questions = appData.questions.filter((q) => q.id !== btn.dataset.deleteQuestion);
      await persistAndMaybeSync('Admin deleted a question');
      refreshAllAdminLists();
    }));
  };

  const renderQuizsetsAdmin = () => {
    fillSelect(byId('quizsetSubjectSelect'), appData.subjects);
    const currentSubject = byId('quizsetSubjectSelect').value || appData.subjects[0]?.id;
    fillSelect(byId('quizsetTopicSelect'), appData.topics.filter((t) => t.subjectId === currentSubject));
    byId('adminQuizsetsList').innerHTML = appData.quizsets.map((set) => `
      <article class="stack-item">
        <div>
          <h4>${set.name}</h4>
          <p>${appData.subjects.find((s) => s.id === set.subjectId)?.name || ''} • ${appData.topics.find((t) => t.id === set.topicId)?.name || ''} • ${set.timeLimit} min</p>
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

    const newTopic = { id: slugify(name), name, subjectId };
    appData.topics.push(newTopic);
    byId('topicNameInput').value = '';
    byId('topicForm').classList.add('hidden');
    await persistAndMaybeSync('Admin added a topic');
    refreshAllAdminLists();

    const questionSubjectSelect = byId('adminQuestionSubjectSelect');
    const questionTopicSelect = byId('adminQuestionTopicSelect');
    if (questionSubjectSelect) questionSubjectSelect.value = subjectId;
    if (questionTopicSelect) {
      questionTopicSelect.dataset.selectedTopicId = newTopic.id;
      renderQuestionsAdmin();
      questionTopicSelect.value = newTopic.id;
    }
  });

  byId('adminQuestionSubjectSelect')?.addEventListener('change', () => {
    const topicSelect = byId('adminQuestionTopicSelect');
    if (topicSelect) topicSelect.dataset.selectedTopicId = '';
    renderQuestionsAdmin();
  });
  byId('adminQuestionTopicSelect')?.addEventListener('change', (e) => {
    e.target.dataset.selectedTopicId = e.target.value;
    renderQuestionsAdmin();
  });
  byId('showAddQuestionBtn')?.addEventListener('click', () => byId('questionForm').classList.toggle('hidden'));
  byId('questionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subjectId = byId('adminQuestionSubjectSelect').value;
    const topicId = byId('adminQuestionTopicSelect').value;
    const options = [
      byId('option1Input').value.trim(),
      byId('option2Input').value.trim(),
      byId('option3Input').value.trim(),
      byId('option4Input').value.trim()
    ];
    appData.questions.push({
      id: `q-${Date.now()}`,
      subjectId,
      topicId,
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
    byId('questionForm').classList.add('hidden');
    await persistAndMaybeSync('Admin added a question');
    refreshAllAdminLists();
  });

  byId('quizsetSubjectSelect')?.addEventListener('change', refreshAllAdminLists);
  byId('showAddQuizsetBtn')?.addEventListener('click', () => byId('quizsetForm').classList.toggle('hidden'));
  byId('quizsetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    appData.quizsets.push({
      id: `quiz-${Date.now()}`,
      name: byId('quizsetNameInput').value,
      subjectId: byId('quizsetSubjectSelect').value,
      topicId: byId('quizsetTopicSelect').value,
      timeLimit: Number(byId('quizsetTimeInput').value || 10)
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

