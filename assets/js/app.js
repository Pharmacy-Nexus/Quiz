const pages = ['home','subjects','topics','sets','study','review','dashboard','finalexam','examlive','saved'];
const navIds = ['home','subjects','dashboard','saved','finalexam'];
const STORAGE_KEY = 'pharmacyNexusState';
const DEFAULT_STATE = {
  currentPage: 'home',
  savedQuestion: false,
  notes: [],
  savedItems: {},
  notesByQuestion: {},
  savedView: { tab: 'all', search: '', subject: 'all' },
  finalExamsDone: 2,
  accuracy: 6,
  savedQuestions: 12,
  personalNotes: 4,
  selectedSubjectId: null,
  selectedTopicId: null,
  currentSetIndex: 0,
  currentQuestionIndex: 0,
  currentTopicQuestions: [],
  currentTopicMeta: null,
  studyResults: {},
  studyMode: 'set',
  retryQuestionIds: [],
  attemptHistory: [],
  currentSessionId: null,
  currentSessionLogged: false,
  examBuilder: {
    mode: 'multiple',
    scope: 'all',
    difficulty: 'all',
    questionCount: 20,
    timeLimit: 30,
    subjectId: null,
    topicSubjectId: null,
    selectedTopicIds: [],
    flags: { timed: true, hidden: true, review: true, retry: true },
    topicSearch: ''
  },
  currentExamSession: null,
  reviewContext: 'study',
  themeMode: 'light',
  dailyChallenge: null
};

const PN_DATA = {
  subjectsIndex: null,
  subjectsMap: new Map(),
  topicsMap: new Map(),
  topicFilesCache: new Map()
};

function navigateTo(pageId) {
  pages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) {
      el.classList.remove('active');
      el.classList.add('page');
    }
  });

  const target = document.getElementById('page-' + pageId);
  if (target) {
    target.classList.add('active', 'fade-in');
    target.classList.remove('page');
  }

  navIds.forEach(id => document.getElementById('nav-' + id)?.classList.remove('active'));
  document.getElementById('nav-' + pageId)?.classList.add('active');

  appState.currentPage = pageId;
  saveState();
  if (pageId === 'review') renderReviewPage();
  if (pageId === 'dashboard') renderDashboardPage();
  if (pageId === 'finalexam') initFinalExamBuilder();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE };
  } catch {
    return { ...DEFAULT_STATE };
  }
}


let appState = loadState();
syncSavedStats?.();

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function getDailyChallengeState() {
  const dc = appState.dailyChallenge || {};
  if (dc.dateKey !== getTodayKey()) return null;
  return dc;
}

function applyTheme(theme = 'light') {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  appState.themeMode = theme;
  saveState();
  const icon = theme === 'dark' ? 'light_mode' : 'dark_mode';
  document.querySelectorAll('[data-theme-toggle-icon]').forEach(el => el.textContent = icon);
  document.querySelectorAll('[data-theme-toggle-label]').forEach(el => el.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode');
}
window.applyTheme = applyTheme;

function toggleTheme() {
  applyTheme(appState.themeMode === 'dark' ? 'light' : 'dark');
}
window.toggleTheme = toggleTheme;

function canGuardExamInteractions() {
  return ['study','examlive','review'].includes(appState.currentPage);
}

function showGuardMessage() {
  const el = document.getElementById('copy-guard-message');
  if (!el) return;
  el.classList.remove('hidden');
  clearTimeout(showGuardMessage._t);
  showGuardMessage._t = setTimeout(() => el.classList.add('hidden'), 1500);
}

function buildDeterministicRandom(seedStr = '0') {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function() {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed(arr = [], seed = '0') {
  const rand = buildDeterministicRandom(seed);
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch {}
}

function createSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function beginStudySession(mode = 'set') {
  appState.studyMode = mode;
  appState.currentQuestionIndex = 0;
  appState.currentSessionId = createSessionId();
  appState.currentSessionLogged = false;
  appState.reviewContext = 'study';
  clearInterval(examTimerRef);
  appState.currentExamSession = null;
}

function getStudyResultEntry(topicId, questionId) {
  const entry = appState.studyResults?.[topicId]?.[questionId];
  if (entry && typeof entry === 'object') return entry;
  if (entry === true || entry === false) return { correct: entry, choice: undefined };
  return null;
}

function getStudyResultCorrect(topicId, questionId) {
  const entry = getStudyResultEntry(topicId, questionId);
  return entry ? entry.correct === true : undefined;
}

function getStudyResultChoice(topicId, questionId) {
  const entry = getStudyResultEntry(topicId, questionId);
  return entry && entry.choice !== undefined ? Number(entry.choice) : undefined;
}


function flattenAllTopics() {
  const all = [];
  PN_DATA.topicsMap.forEach((subjectJson, subjectId) => {
    const subjectMeta = PN_DATA.subjectsMap.get(subjectId);
    (subjectJson?.topics || []).forEach(topic => {
      all.push({
        ...topic,
        id: topic.id || slugify(topic.name),
        subjectId,
        subjectName: subjectMeta?.name || ''
      });
    });
  });
  return all;
}

function getAggregateTopicStats(topicMeta) {
  const results = appState.studyResults?.[topicMeta.id] || {};
  const entries = Object.values(results).map(entry => (entry && typeof entry === 'object') ? entry : { correct: entry });
  const totalAnswered = entries.length;
  const correct = entries.filter(entry => entry.correct === true).length;
  const totalQuestions = Number(topicMeta.questionsCount || 0) || totalAnswered;
  const accuracy = totalAnswered ? Math.round((correct / totalAnswered) * 100) : 0;
  return { totalAnswered, correct, totalQuestions, accuracy };
}

function getOverallResultStats() {
  let totalAnswered = 0;
  let correct = 0;
  Object.values(appState.studyResults || {}).forEach(topicMap => {
    Object.values(topicMap || {}).forEach(value => {
      totalAnswered += 1;
      if (value === true) correct += 1;
    });
  });
  return {
    totalAnswered,
    correct,
    accuracy: totalAnswered ? Math.round((correct / totalAnswered) * 100) : 0
  };
}

function formatShortDate(isoString) {
  try {
    return new Date(isoString).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

function summarizeDashboard() {
  const allTopics = flattenAllTopics();
  const topicStats = allTopics.map(topic => ({ ...topic, ...getAggregateTopicStats(topic) }));
  const attemptedTopics = topicStats.filter(t => t.totalAnswered > 0);
  const weakestTopic = attemptedTopics.length
    ? [...attemptedTopics].sort((a, b) => (a.accuracy - b.accuracy) || (a.correct - b.correct))[0]
    : topicStats[0] || null;
  const strongest = [...attemptedTopics].sort((a, b) => (b.accuracy - a.accuracy) || (b.correct - a.correct)).slice(0, 4);
  const weakest = [...attemptedTopics].sort((a, b) => (a.accuracy - b.accuracy) || (a.correct - b.correct)).slice(0, 4);
  const overall = getOverallResultStats();
  const history = Array.isArray(appState.attemptHistory) ? [...appState.attemptHistory].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
  const studyHistory = history.filter(item => item.type === 'study');
  const examHistory = history.filter(item => item.type === 'finalExam');
  const last5 = studyHistory.slice(0, 5);
  const avg = list => list.length ? Math.round(list.reduce((sum, item) => sum + Number(item.accuracy || 0), 0) / list.length) : 0;
  const currentTopicMeta = appState.currentTopicMeta || null;
  const currentSet = getCurrentSetQuestions ? getCurrentSetQuestions() : [];
  const currentProgress = currentTopicMeta ? getTopicProgress(currentTopicMeta.id) : { answered: 0, correct: 0 };
  return {
    allTopics,
    topicStats,
    attemptedTopics,
    weakestTopic,
    strongest,
    weakest,
    overall,
    history,
    studyHistory,
    examHistory,
    currentTopicMeta,
    currentSet,
    currentProgress,
    last5Avg: avg(last5),
    studyAvg: avg(studyHistory),
    finalAvg: avg(examHistory),
    savedQuestions: Number(appState.savedQuestions || 0),
    savedNotes: Number(appState.personalNotes || 0)
  };
}

function buildDashboardTopicRow(topic, tone = 'secondary') {
  const percent = Number(topic.accuracy || 0);
  const barClass = tone === 'weak' ? 'bg-tertiary-container' : 'bg-secondary';
  return `<div class="pb-4 border-b border-outline-variant/15 last:border-b-0 last:pb-0">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h4 class="text-xl font-extrabold text-primary leading-tight">${escapeHtml(topic.name)}</h4>
        <p class="text-on-surface-variant text-base leading-relaxed">${escapeHtml(topic.subjectName || '')} • ${topic.correct}/${topic.totalAnswered} correct • ${topic.totalAnswered} answered</p>
      </div>
      <div class="min-w-[92px] text-right">
        <div class="text-2xl font-black text-primary mb-2">${percent}%</div>
        <div class="w-full h-2 bg-surface-container rounded-full overflow-hidden"><div class="h-full ${barClass} rounded-full" style="width:${Math.max(percent, percent ? 4 : 0)}%"></div></div>
      </div>
    </div>
  </div>`;
}

function buildDashboardRecentItem(item) {
  const emoji = item.type === 'finalExam' ? '📝' : '📘';
  const title = item.type === 'finalExam' ? 'Final Exam' : (item.topicName || 'Study Session');
  const subtitle = item.type === 'finalExam'
    ? `Mixed • ${formatShortDate(item.createdAt)}`
    : `${escapeHtml(item.subjectName || '')} • ${formatShortDate(item.createdAt)}`;
  return `<div class="rounded-[1.5rem] border border-outline-variant/20 bg-surface p-4 flex items-center justify-between gap-4">
    <div class="flex items-center gap-4 min-w-0">
      <div class="w-12 h-12 rounded-2xl bg-tertiary-fixed/30 flex items-center justify-center text-xl flex-shrink-0">${emoji}</div>
      <div class="min-w-0">
        <h4 class="text-xl font-extrabold text-primary truncate">${escapeHtml(title)}</h4>
        <p class="text-on-surface-variant text-base truncate">${subtitle}</p>
      </div>
    </div>
    <div class="text-right flex-shrink-0">
      <div class="inline-flex items-center justify-center min-w-[68px] px-3 py-1 rounded-full bg-surface-container text-primary text-xl font-black">${item.correct}/${item.total}</div>
      <div class="text-on-surface-variant text-2xl font-bold mt-2">${item.accuracy}%</div>
    </div>
  </div>`;
}

function buildAchievementRow(label, detail, unlocked = false) {
  return `<div class="rounded-[1.5rem] p-4 border ${unlocked ? 'border-tertiary-fixed/40 bg-surface-container-lowest' : 'border-outline-variant/20 bg-surface'} flex items-center gap-4">
    <div class="w-12 h-12 rounded-2xl flex items-center justify-center ${unlocked ? 'bg-tertiary-fixed/30' : 'bg-surface-container'} text-2xl">${unlocked ? '🏅' : '⭕'}</div>
    <div>
      <h4 class="text-xl font-extrabold text-primary">${escapeHtml(label)}</h4>
      <p class="text-on-surface-variant text-base">${escapeHtml(detail)}</p>
    </div>
  </div>`;
}

function renderDashboardChart(history = []) {
  const wrap = document.getElementById('dashboard-chart-wrap');
  if (!wrap) return;
  const items = history.slice(0, 6).reverse();
  if (!items.length) {
    wrap.innerHTML = '<div class="h-[220px] flex items-center justify-center text-on-surface-variant text-sm">Complete a few study sessions to see your accuracy chart.</div>';
    return;
  }
  const width = 420, height = 220, pad = 28;
  const usableH = 150;
  const barW = 38;
  const gap = 22;
  const startX = 34;
  const bars = items.map((item, idx) => {
    const x = startX + idx * (barW + gap);
    const h = Math.max(8, (Number(item.accuracy || 0) / 100) * usableH);
    const y = 175 - h;
    const label = item.type === 'finalExam' ? 'Exam' : `S${items.length - idx}`;
    return `<g>
      <rect x="${x}" y="${y}" rx="10" ry="10" width="${barW}" height="${h}" fill="${item.type === 'finalExam' ? '#316574' : '#cba72f'}"></rect>
      <text x="${x + barW/2}" y="${y - 8}" text-anchor="middle" font-size="12" fill="#00151b" font-weight="700">${item.accuracy}%</text>
      <text x="${x + barW/2}" y="198" text-anchor="middle" font-size="12" fill="#71787b">${label}</text>
    </g>`;
  }).join('');
  wrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="w-full h-[220px]" aria-label="Recent performance chart">
    <rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="#f8f9fa"></rect>
    <line x1="24" y1="175" x2="${width - 20}" y2="175" stroke="#d9dadb" stroke-width="2"></line>
    <line x1="24" y1="28" x2="24" y2="175" stroke="#d9dadb" stroke-width="2"></line>
    <text x="8" y="34" font-size="11" fill="#71787b">100</text>
    <text x="12" y="102" font-size="11" fill="#71787b">50</text>
    <text x="16" y="179" font-size="11" fill="#71787b">0</text>
    ${bars}
  </svg>`;
}

function renderDashboardPage() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  const summary = summarizeDashboard();
  const overall = summary.overall;
  appState.accuracy = overall.accuracy;
  saveState();
  renderPersistentStats();

  const stage = overall.accuracy >= 80 ? 'Excellent momentum' : overall.accuracy >= 60 ? 'Building strong recovery' : overall.accuracy > 0 ? 'Just getting started' : 'No tracked accuracy yet';
  const deltaText = summary.studyHistory.length >= 2
    ? (() => {
        const current = Number(summary.studyHistory[0]?.accuracy || 0);
        const prev = Number(summary.studyHistory[1]?.accuracy || 0);
        const diff = current - prev;
        if (diff === 0) return 'No change from your previous session.';
        return `${diff > 0 ? 'Up' : 'Down'} ${Math.abs(diff)}% from your previous session.`;
      })()
    : 'Build a few sessions to unlock trend tracking.';
  const deltaTone = summary.studyHistory.length >= 2 && Number(summary.studyHistory[0]?.accuracy || 0) >= Number(summary.studyHistory[1]?.accuracy || 0) ? 'text-secondary' : 'text-error';

  const ring = document.getElementById('dashboard-overall-ring');
  if (ring) {
    const circumference = 2 * Math.PI * 48;
    ring.setAttribute('stroke-dasharray', `${(overall.accuracy / 100) * circumference} ${circumference}`);
  }
  const setText = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  setText('dashboard-overall-value', `${overall.accuracy}%`);
  setText('dashboard-overall-stage', stage);
  setText('dashboard-overall-progress-label', `${overall.accuracy}%`);
  const bar = document.getElementById('dashboard-overall-progress-bar'); if (bar) bar.style.width = `${overall.accuracy}%`;
  const deltaEl = document.getElementById('dashboard-overall-delta'); if (deltaEl) { deltaEl.textContent = deltaText; deltaEl.className = `text-sm md:text-base font-bold mb-8 ${deltaTone}`; }

  setText('dashboard-metric-success', `${overall.accuracy}%`);
  setText('dashboard-metric-solved', String(overall.totalAnswered));
  setText('dashboard-metric-sessions', String(summary.studyHistory.length));
  setText('dashboard-metric-finals', String(summary.examHistory.length || appState.finalExamsDone || 0));

  const next = summary.weakestTopic;
  if (next) {
    setText('dashboard-next-title', next.name);
    setText('dashboard-next-meta', `${next.subjectName || ''} • ${next.accuracy}% accuracy • ${next.correct}/${next.totalAnswered} correct`);
  }

  if (summary.currentTopicMeta) {
    setText('dashboard-resume-title', summary.currentTopicMeta.name);
    setText('dashboard-resume-meta', `${summary.currentTopicMeta.subjectName} • Set ${Number(appState.currentSetIndex || 0) + 1} • Resume from question ${Math.min((appState.currentQuestionIndex || 0) + 1, Math.max(summary.currentSet.length,1))}`);
  }

  const strengthWrap = document.getElementById('dashboard-strength-list');
  if (strengthWrap) strengthWrap.innerHTML = summary.strongest.length
    ? summary.strongest.map(topic => buildDashboardTopicRow(topic, 'strength')).join('')
    : '<div class="text-on-surface-variant text-sm">No solved topics yet.</div>';

  const weakWrap = document.getElementById('dashboard-weak-list');
  if (weakWrap) weakWrap.innerHTML = summary.weakest.length
    ? summary.weakest.map(topic => buildDashboardTopicRow(topic, 'weak')).join('')
    : '<div class="text-on-surface-variant text-sm">No weak areas yet.</div>';

  const recentWrap = document.getElementById('dashboard-recent-list');
  if (recentWrap) recentWrap.innerHTML = summary.history.length
    ? summary.history.slice(0, 6).map(buildDashboardRecentItem).join('')
    : '<div class="rounded-[1.5rem] border border-outline-variant/20 bg-surface p-5 text-on-surface-variant">No recent activity yet. Finish a study set and it will appear here.</div>';

  renderDashboardChart(summary.history);
  setText('dashboard-last5', `${summary.last5Avg}%`);
  setText('dashboard-study-avg', `${summary.studyAvg}%`);
  setText('dashboard-final-avg', `${summary.finalAvg || 0}%`);
  setText('dashboard-saved-qs', String(summary.savedQuestions));
  setText('dashboard-saved-notes', String(summary.savedNotes));

  const achievements = [
    buildAchievementRow('Studied 100 Questions', `${overall.totalAnswered >= 100 ? 'Unlocked' : 'In progress'} • ${overall.totalAnswered}/100`, overall.totalAnswered >= 100),
    buildAchievementRow('Completed 5 Study Sessions', `${summary.studyHistory.length >= 5 ? 'Unlocked' : 'In progress'} • ${summary.studyHistory.length}/5`, summary.studyHistory.length >= 5),
    buildAchievementRow('Completed 3 Final Exams', `${(summary.examHistory.length || appState.finalExamsDone || 0) >= 3 ? 'Unlocked' : 'In progress'} • ${(summary.examHistory.length || appState.finalExamsDone || 0)}/3`, (summary.examHistory.length || appState.finalExamsDone || 0) >= 3),
    buildAchievementRow('Reached 80%+ Overall', `${overall.accuracy >= 80 ? 'Unlocked' : 'In progress'} • ${overall.accuracy}%`, overall.accuracy >= 80)
  ];
  const achWrap = document.getElementById('dashboard-achievements');
  if (achWrap) achWrap.innerHTML = achievements.join('');
}
window.renderDashboardPage = renderDashboardPage;

function dashboardResumeStudy() {
  if (appState.currentTopicMeta && Array.isArray(appState.currentTopicQuestions) && appState.currentTopicQuestions.length) {
    renderStudyQuestion();
    navigateTo('study');
    return;
  }
  if (appState.selectedSubjectId && appState.selectedTopicId) {
    selectTopic(appState.selectedSubjectId, appState.selectedTopicId);
    return;
  }
  navigateTo('subjects');
}
window.dashboardResumeStudy = dashboardResumeStudy;

function dashboardOpenWeakest() {
  const summary = summarizeDashboard();
  const weakest = summary.weakestTopic;
  if (!weakest) {
    navigateTo('subjects');
    return;
  }
  selectTopic(weakest.subjectId, weakest.id);
}
window.dashboardOpenWeakest = dashboardOpenWeakest;

function logCurrentAttempt() {
  const meta = appState.currentTopicMeta;
  if (!meta || appState.currentSessionLogged) return;
  const questions = getActiveStudyQuestions();
  if (!questions.length) return;
  const total = questions.length;
  const correct = questions.filter(q => getStudyResultCorrect(meta.id, q.id) === true).length;
  const wrong = questions.filter(q => getStudyResultCorrect(meta.id, q.id) === false).length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  appState.attemptHistory = Array.isArray(appState.attemptHistory) ? appState.attemptHistory : [];
  appState.attemptHistory.unshift({
    id: appState.currentSessionId || createSessionId(),
    type: 'study',
    subjectId: meta.subjectId,
    subjectName: meta.subjectName,
    topicId: meta.id,
    topicName: meta.name,
    setIndex: appState.currentSetIndex,
    mode: appState.studyMode,
    total,
    correct,
    wrong,
    accuracy,
    createdAt: new Date().toISOString()
  });
  appState.attemptHistory = appState.attemptHistory.slice(0, 60);
  appState.currentSessionLogged = true;
  saveState();
}

function slugify(value = '') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getThemeClasses(theme = 'primary') {
  switch (theme) {
    case 'secondary':
      return { iconWrap: 'bg-secondary-container/60 text-on-secondary-container', stat: 'text-secondary', accent: 'text-secondary', pill: 'bg-secondary-container text-on-secondary-container' };
    case 'surface':
      return { iconWrap: 'bg-surface-container-high text-on-surface', stat: 'text-primary', accent: 'text-outline', pill: 'bg-surface-container text-on-surface-variant' };
    default:
      return { iconWrap: 'bg-primary-container text-primary-fixed', stat: 'text-tertiary', accent: 'text-tertiary', pill: 'bg-secondary-container text-on-secondary-container' };
  }
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function getSavedItemsList() {
  return Object.values(appState.savedItems || {}).sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
}

function getNotesList() {
  return Object.values(appState.notesByQuestion || {}).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

function syncSavedStats() {
  appState.savedQuestions = getSavedItemsList().length;
  appState.personalNotes = getNotesList().length;
}

function renderPersistentStats() {
  syncSavedStats();
  document.getElementById('home-accuracy') && (document.getElementById('home-accuracy').textContent = `${appState.accuracy}%`);
  document.getElementById('home-saved-count') && (document.getElementById('home-saved-count').textContent = appState.savedQuestions);
  document.getElementById('home-notes-count') && (document.getElementById('home-notes-count').textContent = appState.personalNotes);
  document.getElementById('home-final-exams-count') && (document.getElementById('home-final-exams-count').textContent = appState.finalExamsDone);
  document.getElementById('saved-count-badge') && (document.getElementById('saved-count-badge').textContent = `${appState.savedQuestions} Saved Questions`);
  document.getElementById('notes-count-badge') && (document.getElementById('notes-count-badge').textContent = `${appState.personalNotes} Personal Notes`);
}

function computeTotalQuestions(subjects = []) {
  return subjects.reduce((sum, subject) => sum + Number(subject.questionsCount || 0), 0);
}

function setSubjectStats(subjects = []) {
  const count = subjects.length;
  const totalQuestions = computeTotalQuestions(subjects);
  document.getElementById('hero-subject-count') && (document.getElementById('hero-subject-count').textContent = count);
  document.getElementById('subjects-available-count') && (document.getElementById('subjects-available-count').textContent = `${count} Subjects Available`);
  document.getElementById('hero-question-count') && (document.getElementById('hero-question-count').textContent = totalQuestions);
}

function buildHomeSubjectCard(subject) {
  const theme = getThemeClasses(subject.theme);
  return `
    <div class="bg-surface-container-lowest rounded-xl p-6 ambient-shadow ghost-border group cursor-pointer hover:-translate-y-1 transition-transform" onclick="selectSubject('${escapeHtml(subject.id)}')">
      <div class="w-10 h-10 rounded-lg ${theme.iconWrap} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <span class="material-symbols-outlined text-lg" style="font-variation-settings:'FILL' 1">${escapeHtml(subject.icon || 'science')}</span>
      </div>
      <h3 class="font-bold text-primary text-base mb-1">${escapeHtml(subject.name)}</h3>
      <p class="text-xs text-on-surface-variant mb-4 leading-relaxed">${escapeHtml(subject.description || '')}</p>
      <div class="flex justify-between items-center border-t border-outline-variant/15 pt-3">
        <span class="text-xs font-bold ${theme.stat} uppercase tracking-wider">${Number(subject.topicsCount || 0)} Topics • ${Number(subject.questionsCount || 0)} Qs</span>
        <span class="material-symbols-outlined text-outline text-base group-hover:text-tertiary transition-colors">arrow_forward</span>
      </div>
    </div>`;
}

function buildFeaturedSubjectCard(subject) {
  const badge = getThemeClasses(subject.theme).pill;
  return `
    <article class="md:col-span-8 bg-surface-container-lowest rounded-xl p-8 md:p-12 relative overflow-hidden group cursor-pointer ambient-shadow ghost-border flex flex-col justify-between min-h-[360px]" onclick="selectSubject('${escapeHtml(subject.id)}')">
      <div class="absolute top-0 right-0 w-64 h-64 bg-primary-fixed-dim rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/3 group-hover:opacity-40 transition-opacity duration-700"></div>
      <div class="relative z-10 flex flex-col items-start gap-5">
        <div class="${badge} px-4 py-1.5 rounded-full"><span class="text-xs font-bold tracking-widest uppercase">Foundational</span></div>
        <div>
          <h2 class="text-3xl font-extrabold text-primary tracking-tight mb-2" style="letter-spacing:-0.02em">${escapeHtml(subject.name)}</h2>
          <p class="text-on-surface-variant text-base leading-relaxed max-w-lg">${escapeHtml(subject.description || '')}</p>
        </div>
      </div>
      <div class="relative z-10 mt-10 flex items-center justify-between border-t border-surface-container-high pt-5">
        <div class="flex items-center gap-8">
          <div><span class="text-3xl font-light text-primary">${Number(subject.topicsCount || 0)}</span><span class="block text-xs font-bold tracking-wider text-outline uppercase mt-0.5">Topics</span></div>
          <div><span class="text-3xl font-light text-primary">${Number(subject.questionsCount || 0)}</span><span class="block text-xs font-bold tracking-wider text-outline uppercase mt-0.5">Questions</span></div>
          <div><span class="text-3xl font-light text-secondary">${appState.accuracy}%</span><span class="block text-xs font-bold tracking-wider text-outline uppercase mt-0.5">Accuracy</span></div>
        </div>
        <button class="flex items-center gap-2 text-tertiary font-bold hover:text-tertiary-container transition-colors group-hover:translate-x-1 duration-300">Open Topics <span class="material-symbols-outlined">arrow_forward</span></button>
      </div>
    </article>`;
}

function buildCompactSubjectCard(subject) {
  const theme = getThemeClasses(subject.theme);
  return `
    <article class="md:col-span-4 bg-surface-container-lowest rounded-xl p-8 relative overflow-hidden group cursor-pointer ambient-shadow ghost-border min-h-[360px] flex flex-col justify-between" onclick="selectSubject('${escapeHtml(subject.id)}')">
      <div class="flex items-start justify-between mb-5">
        <div class="w-11 h-11 rounded-full ${theme.iconWrap} flex items-center justify-center"><span class="material-symbols-outlined">${escapeHtml(subject.icon || 'science')}</span></div>
        <span class="text-xs font-bold tracking-widest text-outline uppercase">Subject</span>
      </div>
      <div>
        <h3 class="text-2xl font-bold tracking-tight mb-2 text-primary">${escapeHtml(subject.name)}</h3>
        <p class="text-on-surface-variant text-sm leading-relaxed">${escapeHtml(subject.description || '')}</p>
      </div>
      <div class="mt-auto flex items-end justify-between pt-6">
        <div>
          <p class="text-2xl font-light text-primary">${Number(subject.topicsCount || 0)} <span class="text-sm text-on-surface-variant">Topics</span></p>
          <p class="text-xl font-light ${theme.accent}">${Number(subject.questionsCount || 0)} <span class="text-sm text-on-surface-variant">Questions</span></p>
        </div>
        <span class="material-symbols-outlined text-tertiary text-3xl group-hover:scale-110 transition-transform">${escapeHtml(subject.icon || 'science')}</span>
      </div>
    </article>`;
}

function renderHomeSubjects(subjects = []) {
  const grid = document.getElementById('home-subjects-grid');
  if (!grid) return;
  grid.innerHTML = subjects.slice(0, 3).map(buildHomeSubjectCard).join('');
}

function renderSubjectsPage(subjects = []) {
  const grid = document.getElementById('subjects-grid');
  if (!grid) return;
  if (!subjects.length) {
    grid.innerHTML = '<div class="md:col-span-12 bg-surface-container-lowest rounded-xl p-8 ambient-shadow ghost-border text-on-surface-variant">No subjects found yet.</div>';
    return;
  }
  const sorted = [...subjects].sort((a, b) => (a.order || 999) - (b.order || 999));
  const first = sorted[0];
  const rest = sorted.slice(1);
  let html = buildFeaturedSubjectCard(first);
  rest.forEach(subject => { html += buildCompactSubjectCard(subject); });
  html += `
    <section class="md:col-span-12 mt-4 bg-primary-container rounded-xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6 ghost-border ambient-shadow">
      <div class="max-w-xl">
        <h3 class="text-2xl font-bold text-primary-fixed tracking-tight mb-3">Pharmacy Nexus Library</h3>
        <p class="text-on-primary-container text-sm leading-relaxed">Subjects, topics, and questions now load from JSON files so your public UI stays clean while your admin updates the content behind the scenes.</p>
      </div>
      <div class="flex-shrink-0 bg-primary/40 backdrop-blur-md p-6 rounded-lg border border-white/10 font-mono text-primary-fixed-dim">
        <div class="text-xs text-on-primary-container mb-2 uppercase tracking-wider">Live Subject Count</div>
        <div class="text-lg">${sorted.length} subjects · ${computeTotalQuestions(sorted)} questions</div>
      </div>
    </section>`;
  grid.innerHTML = html;
}

function filterSubjects(q) {
  const query = String(q || '').trim().toLowerCase();
  document.querySelectorAll('#subjects-grid article').forEach(card => {
    const show = !query || card.textContent.toLowerCase().includes(query);
    card.style.display = show ? '' : 'none';
  });
}
window.filterSubjects = filterSubjects;

function bindTopicSearch() {
  const input = document.getElementById('topic-search');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = 'true';
  input.addEventListener('input', () => renderTopicsPage(input.value));
}

function renderTopicsPage(query = '') {
  const subjectId = appState.selectedSubjectId || PN_DATA.subjectsIndex?.subjects?.[0]?.id;
  if (!subjectId) return;
  const subjectMeta = PN_DATA.subjectsMap.get(subjectId);
  const subjectData = PN_DATA.topicsMap.get(subjectId) || { topics: [] };
  if (!subjectMeta) return;
  const allTopics = [...(subjectData.topics || [])].sort((a, b) => (a.order || 999) - (b.order || 999));
  const q = String(query || document.getElementById('topic-search')?.value || '').trim().toLowerCase();
  const topics = !q ? allTopics : allTopics.filter(topic => `${topic.name} ${topic.description || ''}`.toLowerCase().includes(q));

  const breadcrumb = document.querySelector('#page-topics nav');
  if (breadcrumb) {
    breadcrumb.innerHTML = `<button onclick="navigateTo('subjects')" class="hover:text-on-primary transition-colors">Subjects</button><span class="material-symbols-outlined text-base">chevron_right</span><span class="text-on-primary font-bold">${escapeHtml(subjectMeta.name)}</span>`;
  }
  const heroTitle = document.querySelector('#page-topics h1');
  const heroDesc = document.querySelector('#page-topics h1 + p');
  const stats = document.querySelectorAll('#page-topics .grid.grid-cols-2.gap-4 .text-3xl.font-black');
  if (heroTitle) heroTitle.textContent = subjectMeta.name;
  if (heroDesc) heroDesc.textContent = subjectMeta.description || '';
  if (stats[0]) stats[0].textContent = allTopics.length;
  if (stats[1]) stats[1].textContent = Number(subjectMeta.questionsCount || 0);
  if (stats[2]) stats[2].textContent = `${appState.accuracy}%`;
  document.getElementById('topics-available-count') && (document.getElementById('topics-available-count').textContent = `${topics.length} Topics`);

  const topicsWrapper = document.getElementById('topics-list');
  if (!topicsWrapper) return;
  if (!topics.length) {
    topicsWrapper.innerHTML = `<article class="group bg-surface-container-lowest rounded-xl p-6 md:p-8 flex flex-col gap-4 items-start relative overflow-hidden"><div class="flex items-center gap-3 mb-1"><span class="material-symbols-outlined text-outline text-base">info</span><span class="text-xs font-bold uppercase tracking-widest text-outline">No topics found</span></div><h3 class="text-xl font-extrabold text-primary mb-1">Nothing matches your search</h3><p class="text-on-surface-variant text-sm leading-relaxed">Try another keyword or add topics from the admin page.</p></article>`;
    return;
  }

  topicsWrapper.innerHTML = topics.map((topic, index) => {
    const easy = Number(topic.difficultyBreakdown?.easy || 0);
    const medium = Number(topic.difficultyBreakdown?.medium || 0);
    const hard = Number(topic.difficultyBreakdown?.hard || 0);
    const total = Number(topic.questionsCount || easy + medium + hard || 0);
    const statusLabel = index === 0 ? 'Available' : 'Topic';
    const statusAccent = index === 0 ? 'text-tertiary' : 'text-on-surface-variant';
    return `
      <article class="group bg-surface-container-lowest rounded-xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start relative overflow-hidden hover:bg-surface-bright transition-colors cursor-pointer" onclick="selectTopic('${escapeHtml(subjectId)}','${escapeHtml(topic.id || slugify(topic.name))}')">
        <div class="absolute left-0 top-0 bottom-0 w-1.5 ${index === 0 ? 'bg-tertiary' : 'bg-secondary'} opacity-80 rounded-l-xl"></div>
        <div class="flex-1 pl-2">
          <div class="flex items-center gap-3 mb-3"><span class="material-symbols-outlined ${index === 0 ? 'text-secondary' : 'text-outline'} text-base" style="font-variation-settings:'FILL' 1">${index === 0 ? 'check_circle' : 'menu_book'}</span><span class="text-xs font-bold uppercase tracking-widest ${statusAccent}">${statusLabel}</span><span class="px-2.5 py-0.5 bg-surface-container rounded-full text-xs font-bold text-primary">${total} Questions</span></div>
          <h3 class="text-xl font-extrabold text-primary mb-2">${escapeHtml(topic.name)}</h3>
          <p class="text-on-surface-variant text-sm leading-relaxed mb-4">${escapeHtml(topic.description || '')}</p>
          <div class="flex flex-wrap gap-2"><span class="px-3 py-1 bg-surface-container-low text-primary rounded-lg text-xs font-bold border border-outline-variant/15">Easy ${easy}</span><span class="px-3 py-1 bg-surface-container-low text-primary rounded-lg text-xs font-bold border border-outline-variant/15">Medium ${medium}</span><span class="px-3 py-1 bg-surface-container-low text-primary rounded-lg text-xs font-bold border border-outline-variant/15">Hard ${hard}</span></div>
        </div>
        <div class="w-full md:w-auto flex items-center md:items-end gap-4 pl-2"><button class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-on-primary-fixed transition-colors flex items-center gap-2">Open Topic <span class="material-symbols-outlined text-base">arrow_forward</span></button></div>
      </article>`;
  }).join('');
}

async function loadTopicQuestions(subjectId, topicId) {
  const subjectData = PN_DATA.topicsMap.get(subjectId) || { topics: [] };
  const topicMeta = (subjectData.topics || []).find(t => (t.id || slugify(t.name)) === topicId);
  if (!topicMeta?.file) throw new Error('Topic file not found.');
  if (!PN_DATA.topicFilesCache.has(topicMeta.file)) {
    PN_DATA.topicFilesCache.set(topicMeta.file, await fetchJson(topicMeta.file));
  }
  const topicJson = PN_DATA.topicFilesCache.get(topicMeta.file);
  appState.selectedSubjectId = subjectId;
  appState.selectedTopicId = topicId;
  appState.currentTopicMeta = {
    ...topicMeta,
    subjectName: PN_DATA.subjectsMap.get(subjectId)?.name || '',
    subjectId
  };
  appState.currentTopicQuestions = Array.isArray(topicJson.questions) ? topicJson.questions : [];
  appState.currentSetIndex = 0;
  beginStudySession('set');
  if (!appState.studyResults[topicId]) appState.studyResults[topicId] = {};
  saveState();
  renderSetsPage();
}

function getCurrentTopicQuestionChunks() {
  const questions = appState.currentTopicQuestions || [];
  const chunks = [];
  for (let i = 0; i < questions.length; i += 30) chunks.push(questions.slice(i, i + 30));
  return chunks.length ? chunks : [[]];
}

function getDifficultyCounts(questions = []) {
  return questions.reduce((acc, q) => {
    const key = String(q.difficulty || 'easy').toLowerCase();
    if (key === 'hard') acc.hard += 1;
    else if (key === 'medium') acc.medium += 1;
    else acc.easy += 1;
    return acc;
  }, { easy: 0, medium: 0, hard: 0 });
}

function getTopicProgress(topicId) {
  const results = appState.studyResults?.[topicId] || {};
  const answered = Object.keys(results).length;
  const correct = Object.values(results).filter(Boolean).length;
  return { answered, correct };
}

function renderSetsPage() {
  const meta = appState.currentTopicMeta;
  const questions = appState.currentTopicQuestions || [];
  if (!meta) return;
  const counts = getDifficultyCounts(questions);
  const chunks = getCurrentTopicQuestionChunks();
  const progress = getTopicProgress(meta.id);
  const progressPercent = questions.length ? Math.round((progress.answered / questions.length) * 100) : 0;

  const crumbs = document.querySelector('#page-sets nav');
  if (crumbs) {
    crumbs.innerHTML = `<button onclick="navigateTo('subjects')" class="hover:text-primary transition-colors">Subjects</button><span class="material-symbols-outlined text-sm">chevron_right</span><button onclick="navigateTo('topics')" class="hover:text-primary transition-colors">${escapeHtml(meta.subjectName)}</button><span class="material-symbols-outlined text-sm">chevron_right</span><span class="text-primary font-bold">${escapeHtml(meta.name)}</span>`;
  }
  document.getElementById('sets-subject-topic-label') && (document.getElementById('sets-subject-topic-label').textContent = `${meta.subjectName} • Topic`);
  document.getElementById('sets-topic-title') && (document.getElementById('sets-topic-title').textContent = meta.name);
  document.getElementById('sets-topic-description') && (document.getElementById('sets-topic-description').textContent = meta.description || 'Topic questions loaded from JSON.');
  document.getElementById('sets-accuracy-pill') && (document.getElementById('sets-accuracy-pill').textContent = `${appState.accuracy}% Accuracy`);
  document.getElementById('sets-complete-pill') && (document.getElementById('sets-complete-pill').textContent = `${progressPercent}% Complete`);
  document.getElementById('sets-mastery-score') && (document.getElementById('sets-mastery-score').textContent = `${progressPercent}%`);
  document.getElementById('sets-easy-count') && (document.getElementById('sets-easy-count').textContent = counts.easy);
  document.getElementById('sets-medium-count') && (document.getElementById('sets-medium-count').textContent = counts.medium);
  document.getElementById('sets-hard-count') && (document.getElementById('sets-hard-count').textContent = counts.hard);
  document.getElementById('sets-total-count') && (document.getElementById('sets-total-count').textContent = questions.length);
  document.getElementById('sets-resume-progress-text') && (document.getElementById('sets-resume-progress-text').textContent = `${progressPercent}%`);
  document.getElementById('sets-resume-title') && (document.getElementById('sets-resume-title').textContent = progress.answered ? `Resume from Question ${Math.min(progress.answered + 1, questions.length)}` : 'Start from Question 1');
  document.getElementById('sets-resume-subtitle') && (document.getElementById('sets-resume-subtitle').textContent = `Set ${appState.currentSetIndex + 1} • ${progress.answered} of ${questions.length} answered`);
  document.getElementById('sets-count-label') && (document.getElementById('sets-count-label').textContent = `${chunks.length} Sets`);

  const setGrid = document.getElementById('sets-grid');
  if (setGrid) {
    setGrid.innerHTML = chunks.map((chunk, idx) => {
      const start = idx * 30 + 1;
      const end = start + chunk.length - 1;
      const answeredInSet = chunk.filter(q => appState.studyResults?.[meta.id]?.[q.id] !== undefined).length;
      const pct = chunk.length ? Math.round((answeredInSet / chunk.length) * 100) : 0;
      const started = answeredInSet > 0;
      return `
        <div class="bg-surface-container-lowest rounded-xl p-6 ambient-shadow group cursor-pointer hover:-translate-y-0.5 transition-transform" onclick="startSet(${idx})">
          <div class="flex justify-between items-start mb-4"><span class="px-3 py-1 ${started ? 'bg-tertiary/10 text-tertiary' : 'bg-surface-container text-on-surface-variant'} rounded-full text-xs font-bold uppercase tracking-wider">Set ${idx + 1} • ${started ? 'In Progress' : 'Not Started'}</span><span class="material-symbols-outlined text-outline group-hover:text-tertiary transition-colors">arrow_outward</span></div>
          <h3 class="text-lg font-bold text-primary mb-1">Questions ${start}–${end}</h3>
          <p class="text-sm text-on-surface-variant mb-5">${escapeHtml(meta.name)} • ${chunk.length} question${chunk.length === 1 ? '' : 's'} in this set.</p>
          <div class="flex justify-between items-center pt-4 border-t border-outline-variant/15">
            <div><div class="flex justify-between text-xs mb-1 text-on-surface-variant"><span>Progress</span><span>${pct}%</span></div><div class="w-32 bg-surface-container rounded-full h-1.5 overflow-hidden"><div class="bg-tertiary h-1.5 rounded-full" style="width:${pct}%"></div></div></div>
            <button onclick="event.stopPropagation(); startSet(${idx});" class="${started ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-primary border border-outline-variant/15'} px-5 py-2 rounded-lg text-sm font-bold">${started ? 'Resume Set' : 'Start Set'}</button>
          </div>
        </div>`;
    }).join('');
  }
}

function difficultyBadgeClass(difficulty) {
  const d = String(difficulty || 'easy').toLowerCase();
  if (d === 'hard') return 'bg-error-container/40 text-on-error-container';
  if (d === 'medium') return 'bg-tertiary/10 text-tertiary';
  return 'bg-secondary-container/50 text-on-secondary-container';
}

function formatType(type = '') {
  return String(type).replace(/_/g, '/').toUpperCase();
}

function startSet(index = 0) {
  appState.currentSetIndex = index;
  appState.retryQuestionIds = [];
  const previewQuestions = (getCurrentTopicQuestionChunks()[index] || []);
  const meta = appState.currentTopicMeta;
  if (meta && previewQuestions.length) {
    const fullyAnswered = previewQuestions.every(q => getStudyResultCorrect(meta.id, q.id) !== undefined);
    if (fullyAnswered) resetQuestionsAttempt(previewQuestions.map(q => q.id));
  }
  beginStudySession('set');
  saveState();
  navigateTo('study');
  renderStudyQuestion();
}
window.startSet = startSet;

function getCurrentSetQuestions() {
  const chunks = getCurrentTopicQuestionChunks();
  return chunks[appState.currentSetIndex] || [];
}

function getActiveStudyQuestions() {
  const setQuestions = getCurrentSetQuestions();
  if ((appState.studyMode === 'wrong' || appState.studyMode === 'daily') && Array.isArray(appState.retryQuestionIds) && appState.retryQuestionIds.length) {
    const wanted = new Set(appState.retryQuestionIds);
    const filtered = (appState.currentTopicQuestions || setQuestions).filter(q => wanted.has(q.id));
    if (filtered.length) return filtered;
  }
  return setQuestions;
}

function resetQuestionsAttempt(questionIds = []) {
  const meta = appState.currentTopicMeta;
  if (!meta || !Array.isArray(questionIds) || !questionIds.length) return;
  appState.studyResults = appState.studyResults || {};
  appState.studyResults[meta.id] = appState.studyResults[meta.id] || {};
  const idSet = new Set(questionIds);
  questionIds.forEach(id => delete appState.studyResults[meta.id][id]);
  (appState.currentTopicQuestions || []).forEach(q => {
    if (idSet.has(q.id)) delete q.userChoice;
  });
}

function renderStudyQuestion() {
  const meta = appState.currentTopicMeta;
  const setQuestions = getActiveStudyQuestions();
  const q = setQuestions[appState.currentQuestionIndex];
  if (!meta || !q) {
    navigateTo('sets');
    return;
  }
  const total = setQuestions.length;
  const humanIndex = appState.currentQuestionIndex + 1;
  const pct = Math.round((humanIndex / total) * 100);
  const results = appState.studyResults?.[meta.id] || {};
  const resultEntries = Object.values(results).map(entry => (entry && typeof entry === 'object') ? entry : { correct: entry });
  const correctCount = resultEntries.filter(entry => entry.correct === true).length;
  const wrongCount = resultEntries.filter(entry => entry.correct === false).length;

  const studyHeader = document.getElementById('study-header-topic');
  if (studyHeader) {
    studyHeader.textContent = appState.studyMode === 'daily' ? `Daily Challenge • ${meta.name}` : `${meta.name} • Set ${appState.currentSetIndex + 1}${appState.studyMode === 'wrong' ? ' • Wrong Questions Retry' : ''}`;
  }
  document.getElementById('study-q-counter') && (document.getElementById('study-q-counter').textContent = `${humanIndex} of ${total}`);
  document.getElementById('study-progress') && (document.getElementById('study-progress').style.width = `${pct}%`);
  document.getElementById('study-progress-percent') && (document.getElementById('study-progress-percent').textContent = `${pct}%`);
  document.getElementById('study-difficulty') && (document.getElementById('study-difficulty').textContent = String(q.difficulty || 'easy').toUpperCase());
  document.getElementById('study-difficulty') && (document.getElementById('study-difficulty').className = `px-3 py-1 rounded-full ${difficultyBadgeClass(q.difficulty)} text-xs font-bold uppercase tracking-wider`);
  document.getElementById('study-type') && (document.getElementById('study-type').textContent = formatType(q.type || 'mcq'));
  document.getElementById('study-question') && (document.getElementById('study-question').textContent = q.questionText || 'No question text');
  document.getElementById('correct-count') && (document.getElementById('correct-count').textContent = correctCount);
  document.getElementById('wrong-count') && (document.getElementById('wrong-count').textContent = wrongCount);

  const caseBox = document.getElementById('study-case');
  if (caseBox) {
    if (q.caseText) {
      caseBox.textContent = q.caseText;
      caseBox.classList.remove('hidden');
    } else {
      caseBox.classList.add('hidden');
      caseBox.textContent = '';
    }
  }

  const imageWrap = document.getElementById('study-image-wrap');
  const image = document.getElementById('study-image');
  if (imageWrap && image) {
    if (q.imageUrl) {
      image.src = q.imageUrl;
      imageWrap.classList.remove('hidden');
    } else {
      image.src = '';
      imageWrap.classList.add('hidden');
    }
  }

  const options = Array.isArray(q.options) && q.options.length ? q.options : ['True', 'False'];
  const answerEntry = getStudyResultEntry(meta.id, q.id);
  const wasAnswered = answerEntry !== null;
  const optionsWrap = document.getElementById('study-options');
  if (optionsWrap) {
    optionsWrap.innerHTML = options.map((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const isCorrect = idx === Number(q.correctAnswer);
      const userChoice = getStudyResultChoice(meta.id, q.id);
      const wasWrong = getStudyResultCorrect(meta.id, q.id) === false;
      const answeredClass = !wasAnswered ? '' : (isCorrect ? 'answer-correct' : (wasWrong && idx === Number(userChoice) ? 'answer-wrong' : ''));
      const pointerClass = wasAnswered ? 'pointer-events-none' : 'cursor-pointer';
      const check = wasAnswered && isCorrect ? `<div class="ml-3 flex items-center justify-center text-secondary mt-1"><span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">check_circle</span></div>` : '';
      return `<label class="answer-option answer-idle group relative flex items-start p-5 rounded-xl bg-surface-container-low hover:bg-surface-container-lowest transition-all ${pointerClass} border border-transparent ${answeredClass}" onclick="selectAnswer(${idx})"><div class="flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-lg bg-surface text-on-surface-variant font-headline font-bold mr-4 group-hover:bg-primary-fixed group-hover:text-primary transition-colors">${letter}</div><div class="flex-1 pt-1 text-on-surface leading-relaxed">${escapeHtml(opt)}</div>${check}</label>`;
    }).join('') + `<div id="study-explanation" class="${wasAnswered ? '' : 'hidden'} bg-surface-container-low rounded-xl p-6 relative overflow-hidden"><div class="absolute -right-8 -top-8 w-32 h-32 bg-tertiary-fixed/20 rounded-full blur-3xl pointer-events-none"></div><div class="flex items-center gap-2 mb-3"><span class="material-symbols-outlined text-tertiary text-lg">school</span><h3 class="text-xs font-bold text-primary uppercase tracking-widest">Clinical Rationale</h3></div><p class="text-sm text-on-surface-variant leading-relaxed mb-3">${escapeHtml(q.explanation || 'No explanation added yet.')}</p></div>`;
  }

  updateSaveButtonState();
  const noteBtn = document.getElementById('note-btn');
  const noteExists = !!(appState.notesByQuestion?.[q.id]?.note);
  if (noteBtn) {
    noteBtn.classList.toggle('text-tertiary', noteExists);
    noteBtn.classList.toggle('text-on-surface-variant', !noteExists);
  }

  document.getElementById('study-prev-btn')?.toggleAttribute('disabled', appState.currentQuestionIndex === 0);
  document.getElementById('study-prev-btn')?.classList.toggle('opacity-50', appState.currentQuestionIndex === 0);
  document.getElementById('study-next-btn') && (document.getElementById('study-next-btn').innerHTML = `${appState.currentQuestionIndex === total - 1 ? 'Finish Set' : 'Next Question'} <span class="material-symbols-outlined text-sm">arrow_forward</span>`);
}

function selectAnswer(optionIndex) {
  const meta = appState.currentTopicMeta;
  const q = getActiveStudyQuestions()[appState.currentQuestionIndex];
  if (!meta || !q) return;
  appState.studyResults = appState.studyResults || {};
  appState.studyResults[meta.id] = appState.studyResults[meta.id] || {};
  if (getStudyResultCorrect(meta.id, q.id) === undefined) {
    const isCorrect = Number(optionIndex) === Number(q.correctAnswer);
    appState.studyResults[meta.id][q.id] = { correct: isCorrect, choice: Number(optionIndex) };
    q.userChoice = Number(optionIndex);
    saveState();
    renderStudyQuestion();
  }
}
window.selectAnswer = selectAnswer;

function nextQuestion() {
  const setQuestions = getActiveStudyQuestions();
  if (appState.currentQuestionIndex < setQuestions.length - 1) {
    appState.currentQuestionIndex += 1;
    saveState();
    renderStudyQuestion();
  } else {
    appState.reviewContext = 'study';
    logCurrentAttempt();
    saveState();
    renderReviewPage();
    navigateTo('review');
  }
}
window.nextQuestion = nextQuestion;

function retryWrongQuestions() {
  const meta = appState.currentTopicMeta;
  const setQuestions = getCurrentSetQuestions();
  if (!meta || !setQuestions.length) return;
  const wrongIds = setQuestions.filter(q => getStudyResultCorrect(meta.id, q.id) === false).map(q => q.id);
  if (!wrongIds.length) {
    window.alert('No wrong questions in this set.');
    return;
  }
  resetQuestionsAttempt(wrongIds);
  appState.retryQuestionIds = wrongIds;
  beginStudySession('wrong');
  saveState();
  navigateTo('study');
  renderStudyQuestion();
}
window.retryWrongQuestions = retryWrongQuestions;

function clearFinalExamRuntime() {
  clearInterval(examTimerRef);
  appState.currentExamSession = null;
  if (appState.reviewContext === 'finalExam') appState.reviewContext = 'study';
}
window.clearFinalExamRuntime = clearFinalExamRuntime;


function retakeCurrentSet() {
  const setQuestions = getCurrentSetQuestions();
  if (!setQuestions.length) return;
  resetQuestionsAttempt(setQuestions.map(q => q.id));
  appState.retryQuestionIds = [];
  beginStudySession('set');
  saveState();
  navigateTo('study');
  renderStudyQuestion();
}
window.retakeCurrentSet = retakeCurrentSet;

function renderReviewPage() {
  const page = document.getElementById('page-review');
  const meta = appState.currentTopicMeta;
  if (!page || !meta) return;
  const questions = getActiveStudyQuestions();
  const total = questions.length;
  const correct = questions.filter(q => getStudyResultCorrect(meta.id, q.id) === true).length;
  const wrong = questions.filter(q => getStudyResultCorrect(meta.id, q.id) === false).length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const modeLabel = appState.studyMode === 'wrong' ? 'Wrong Questions Retry' : `Set ${appState.currentSetIndex + 1}`;
  const reviewCards = questions.map((q, idx) => {
    const storedChoice = getStudyResultChoice(meta.id, q.id);
    const userChoiceIndex = Number.isFinite(Number(storedChoice)) ? Number(storedChoice) : (Number.isFinite(Number(q.userChoice)) ? Number(q.userChoice) : null);
    const correctIndex = Number(q.correctAnswer);
    const userAnswer = userChoiceIndex !== null && Array.isArray(q.options) ? q.options[userChoiceIndex] : (userChoiceIndex !== null ? String(userChoiceIndex) : 'Not answered');
    const correctAnswer = Array.isArray(q.options) ? (q.options[correctIndex] ?? '—') : '—';
    const isCorrect = getStudyResultCorrect(meta.id, q.id) === true;
    const statusPill = isCorrect
      ? '<span class="px-2.5 py-1 bg-secondary-container/40 text-secondary text-xs font-bold uppercase tracking-wider rounded-md">Correct</span>'
      : '<span class="px-2.5 py-1 bg-error-container/40 text-on-error-container text-xs font-bold uppercase tracking-wider rounded-md">Wrong</span>';
    const caseBlock = q.caseText ? `<div class="mb-4 p-4 rounded-xl bg-surface-container-low text-sm text-on-surface-variant leading-relaxed"><span class="font-bold text-primary block mb-1">Case</span>${escapeHtml(q.caseText)}</div>` : '';
    const imageBlock = q.imageUrl ? `<div class="mb-4"><img src="${escapeHtml(q.imageUrl)}" alt="Question image" class="w-full max-h-72 object-contain rounded-xl border border-outline-variant/15 bg-surface-container-low"></div>` : '';
    return `<article class="bg-surface-container-lowest rounded-xl p-7 md:p-8 ambient-shadow relative">
      <div class="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary text-sm">${idx + 1}</span>
          <span class="px-2.5 py-1 bg-surface-container-low text-on-surface-variant text-xs font-bold uppercase tracking-wider rounded-md">${escapeHtml(formatType(q.type || 'mcq'))}</span>
          <span class="px-2.5 py-1 ${difficultyBadgeClass(q.difficulty)} text-xs font-bold uppercase tracking-wider rounded-md">${escapeHtml(String(q.difficulty || 'easy'))}</span>
          ${statusPill}
        </div>
      </div>
      ${caseBlock}
      ${imageBlock}
      <p class="text-base leading-relaxed text-primary font-medium mb-6 max-w-4xl">${escapeHtml(q.questionText || 'No question text')}</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div class="p-5 rounded-xl bg-error-container/15 border border-error/20">
          <span class="text-xs font-bold uppercase tracking-widest text-error block mb-2">Student Answer</span>
          <p class="text-sm text-primary font-medium">${escapeHtml(userAnswer)}</p>
        </div>
        <div class="p-5 rounded-xl bg-secondary-container/20 border border-secondary/20">
          <span class="text-xs font-bold uppercase tracking-widest text-secondary block mb-2">Correct Answer</span>
          <p class="text-sm text-primary font-medium">${escapeHtml(correctAnswer)}</p>
        </div>
      </div>
      <div class="bg-surface-container-low rounded-xl p-5">
        <span class="text-xs font-bold uppercase tracking-widest text-primary block mb-2">Explanation</span>
        <p class="text-sm text-on-surface-variant leading-relaxed">${escapeHtml(q.explanation || 'No explanation added yet.')}</p>
      </div>
    </article>`;
  }).join('');

  page.innerHTML = `<div class="max-w-5xl mx-auto px-6 md:px-12 py-10">
    <div class="absolute top-0 left-0 w-full h-80 bg-gradient-to-br from-primary-container/15 via-surface to-surface -z-10 pointer-events-none"></div>
    <header class="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-5">
      <div>
        <span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Post-Assessment Analysis</span>
        <h1 class="text-4xl md:text-5xl font-extrabold text-primary tracking-tight" style="letter-spacing:-0.02em">Performance Review<br/><span class="text-on-surface-variant font-medium text-2xl">${escapeHtml(meta.name)} • ${escapeHtml(modeLabel)}</span></h1>
      </div>
      <p class="text-sm text-on-surface-variant max-w-sm">A detailed breakdown of your session performance with your selected answer, the correct answer, and the explanation for each question.</p>
    </header>
    <section class="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10">
      <div class="bg-surface-container-lowest rounded-xl p-6 flex flex-col ambient-shadow relative overflow-hidden group">
        <div class="absolute -right-3 -top-3 w-16 h-16 bg-tertiary/10 rounded-full blur-xl"></div>
        <span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-tertiary text-base">workspace_premium</span>Score</span>
        <div class="flex items-baseline gap-1"><span class="text-5xl font-black text-primary">${correct}</span><span class="text-xl text-on-surface-variant">/${total}</span></div>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-6 flex flex-col ambient-shadow">
        <span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-primary text-base">percent</span>Accuracy</span>
        <div class="text-5xl font-black text-primary">${accuracy}<span class="text-2xl text-on-surface-variant font-medium">%</span></div>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-6 flex flex-col ambient-shadow border-l-4 border-secondary">
        <span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-secondary text-base">check_circle</span>Correct</span>
        <div class="text-5xl font-black text-secondary">${correct}</div>
      </div>
      <div class="bg-surface-container-lowest rounded-xl p-6 flex flex-col ambient-shadow border-l-4 border-error">
        <span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-error text-base">cancel</span>Wrong</span>
        <div class="text-5xl font-black text-error">${wrong}</div>
      </div>
    </section>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-10 p-5 bg-surface-container-low rounded-xl">
      <button onclick="retryWrongQuestions()" class="py-4 bg-primary text-on-primary rounded-xl font-bold text-base hover:scale-[0.98] transition-transform flex items-center justify-center gap-2 ${wrong === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${wrong === 0 ? 'disabled' : ''}><span class="material-symbols-outlined">restart_alt</span> Retry Wrong Questions</button>
      <button onclick="retakeCurrentSet()" class="py-4 bg-surface-container-lowest text-primary rounded-xl font-bold text-base hover:bg-surface-variant transition-colors border border-outline-variant/15 flex items-center justify-center gap-2"><span class="material-symbols-outlined">replay</span> Retake Full Set</button>
      <button onclick="navigateTo('home')" class="py-4 bg-surface-container-lowest text-primary rounded-xl font-bold text-base hover:bg-surface-variant transition-colors border border-outline-variant/15 flex items-center justify-center gap-2"><span class="material-symbols-outlined">home</span> Back to Home</button>
      <button onclick="navigateTo('dashboard')" class="py-4 bg-surface-container-lowest text-primary rounded-xl font-bold text-base hover:bg-surface-variant transition-colors border border-outline-variant/15 flex items-center justify-center gap-2"><span class="material-symbols-outlined">dashboard</span> Go to Dashboard</button>
    </div>
    <h2 class="text-xl font-bold text-primary mb-6 tracking-tight">Question Analysis</h2>
    <div class="space-y-8">${reviewCards || '<div class="bg-surface-container-lowest rounded-xl p-8 ambient-shadow text-on-surface-variant">No review data available yet.</div>'}</div>
  </div>`;
}
window.renderReviewPage = renderReviewPage;

function previousQuestion() {
  if (appState.currentQuestionIndex > 0) {
    appState.currentQuestionIndex -= 1;
    saveState();
    renderStudyQuestion();
  }
}
window.previousQuestion = previousQuestion;


function getCurrentQuestionRecord() {
  if (appState.currentPage === 'examlive' && appState.currentExamSession?.questions?.length) {
    const session = appState.currentExamSession;
    const q = session.questions[session.currentIndex];
    if (!q) return null;
    return {
      id: q.id,
      subjectId: q.subjectId || '',
      subjectName: q.subjectName || '',
      topicId: q.topicId || '',
      topicName: q.topicName || '',
      type: q.type || 'mcq',
      difficulty: q.difficulty || 'easy',
      questionText: q.questionText || '',
      caseText: q.caseText || '',
      imageUrl: q.imageUrl || '',
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: Number(q.correctAnswer),
      explanation: q.explanation || '',
      userChoice: session.answers?.[q.id],
      savedAt: new Date().toISOString()
    };
  }
  if (appState.currentTopicMeta && Array.isArray(appState.currentTopicQuestions) && appState.currentTopicQuestions.length) {
    const active = getActiveStudyQuestions();
    const q = active[appState.currentQuestionIndex];
    if (!q) return null;
    return {
      id: q.id,
      subjectId: appState.currentTopicMeta.subjectId || '',
      subjectName: appState.currentTopicMeta.subjectName || '',
      topicId: appState.currentTopicMeta.id || '',
      topicName: appState.currentTopicMeta.name || '',
      type: q.type || 'mcq',
      difficulty: q.difficulty || 'easy',
      questionText: q.questionText || '',
      caseText: q.caseText || '',
      imageUrl: q.imageUrl || '',
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: Number(q.correctAnswer),
      explanation: q.explanation || '',
      userChoice: Number.isFinite(Number(q.userChoice)) ? Number(q.userChoice) : undefined,
      savedAt: new Date().toISOString()
    };
  }
  return null;
}

function isQuestionSaved(questionId) {
  return !!(appState.savedItems || {})[questionId];
}

function updateSaveButtonState() {
  const btn = document.getElementById('save-btn');
  const icon = btn?.querySelector('.material-symbols-outlined');
  const record = getCurrentQuestionRecord();
  const saved = record ? isQuestionSaved(record.id) : false;
  appState.savedQuestion = saved;
  if (btn && icon) {
    icon.style.fontVariationSettings = saved ? "'FILL' 1" : "'FILL' 0";
    btn.classList.toggle('text-tertiary', saved);
    btn.classList.toggle('text-on-surface-variant', !saved);
  }
}

function toggleSave() {
  const record = getCurrentQuestionRecord();
  if (!record) return;
  appState.savedItems = appState.savedItems || {};
  if (appState.savedItems[record.id]) {
    delete appState.savedItems[record.id];
  } else {
    const existingNote = appState.notesByQuestion?.[record.id]?.note || '';
    appState.savedItems[record.id] = {
      ...record,
      savedAt: new Date().toISOString(),
      hasNote: !!existingNote,
      note: existingNote
    };
  }
  updateSaveButtonState();
  saveState();
  renderPersistentStats();
  if (appState.currentPage === 'saved') renderSavedPage();
}
window.toggleSave = toggleSave;

function setSavedTab(tab) {
  appState.savedView = appState.savedView || { tab: 'all', search: '', subject: 'all' };
  appState.savedView.tab = tab;
  saveState();
  renderSavedPage();
}
window.setSavedTab = setSavedTab;

function setSavedSubjectFilter(value) {
  appState.savedView = appState.savedView || { tab: 'all', search: '', subject: 'all' };
  appState.savedView.subject = value || 'all';
  saveState();
  renderSavedPage();
}
window.setSavedSubjectFilter = setSavedSubjectFilter;

function removeSavedQuestion(questionId) {
  if (appState.savedItems?.[questionId]) delete appState.savedItems[questionId];
  saveState();
  renderPersistentStats();
  renderSavedPage();
  updateSaveButtonState();
}
window.removeSavedQuestion = removeSavedQuestion;

function deleteQuestionNote(questionId) {
  if (appState.notesByQuestion?.[questionId]) delete appState.notesByQuestion[questionId];
  if (appState.savedItems?.[questionId]) {
    appState.savedItems[questionId].hasNote = false;
    appState.savedItems[questionId].note = '';
  }
  saveState();
  renderPersistentStats();
  renderSavedPage();
}
window.deleteQuestionNote = deleteQuestionNote;

function saveNoteForRecord(record) {
  if (!record) return;
  const current = appState.notesByQuestion?.[record.id]?.note || '';
  const note = window.prompt('Add or edit your personal note for this question:', current);
  if (note === null) return;
  appState.notesByQuestion = appState.notesByQuestion || {};
  const trimmed = note.trim();
  if (!trimmed) {
    delete appState.notesByQuestion[record.id];
    if (appState.savedItems?.[record.id]) {
      appState.savedItems[record.id].hasNote = false;
      appState.savedItems[record.id].note = '';
    }
  } else {
    appState.notesByQuestion[record.id] = {
      questionId: record.id,
      note: trimmed,
      updatedAt: new Date().toISOString(),
      subjectId: record.subjectId,
      subjectName: record.subjectName,
      topicId: record.topicId,
      topicName: record.topicName,
      questionText: record.questionText
    };
    appState.savedItems = appState.savedItems || {};
    if (!appState.savedItems[record.id]) {
      appState.savedItems[record.id] = { ...record, savedAt: new Date().toISOString() };
    }
    appState.savedItems[record.id].hasNote = true;
    appState.savedItems[record.id].note = trimmed;
  }
  saveState();
  renderPersistentStats();
  if (appState.currentPage === 'saved') renderSavedPage();
}
window.saveNoteForRecord = saveNoteForRecord;

function editQuestionNote(questionId) {
  const base = appState.savedItems?.[questionId] || appState.notesByQuestion?.[questionId];
  if (!base) return;
  saveNoteForRecord({
    id: questionId,
    subjectId: base.subjectId,
    subjectName: base.subjectName,
    topicId: base.topicId,
    topicName: base.topicName,
    questionText: base.questionText,
    type: base.type,
    difficulty: base.difficulty,
    caseText: base.caseText || '',
    imageUrl: base.imageUrl || '',
    options: base.options || [],
    correctAnswer: base.correctAnswer,
    explanation: base.explanation || '',
    userChoice: base.userChoice
  });
}
window.editQuestionNote = editQuestionNote;

function bindNotes() {
  const noteBtn = document.getElementById('note-btn');
  if (noteBtn && !noteBtn.dataset.bound) {
    noteBtn.dataset.bound = 'true';
    noteBtn.addEventListener('click', () => saveNoteForRecord(getCurrentQuestionRecord()));
  }
}

function openSavedQuestion(questionId) {
  const item = appState.savedItems?.[questionId] || appState.notesByQuestion?.[questionId];
  if (!item) return;
  const meta = item.topicId ? (PN_DATA.topicsMap.get(item.subjectId)?.topics || []).find(t => (t.id || slugify(t.name)) === item.topicId) : null;
  if (meta?.file) {
    loadTopicQuestions(item.subjectId, item.topicId).then(() => {
      const idx = (appState.currentTopicQuestions || []).findIndex(q => q.id === questionId);
      appState.currentSetIndex = idx >= 0 ? Math.floor(idx / 30) : 0;
      appState.currentQuestionIndex = idx >= 0 ? idx % 30 : 0;
      saveState();
      renderStudyQuestion();
      navigateTo('study');
    });
  }
}
window.openSavedQuestion = openSavedQuestion;

function buildSavedCard(item) {
  const noteObj = appState.notesByQuestion?.[item.id];
  const noteText = noteObj?.note || item.note || '';
  const hasNote = !!noteText;
  const userAnswer = item.userChoice !== undefined ? (item.options?.[Number(item.userChoice)] ?? '—') : '';
  const correctAnswer = item.options?.[Number(item.correctAnswer)] ?? '—';
  const isCorrect = item.userChoice !== undefined ? Number(item.userChoice) === Number(item.correctAnswer) : null;
  const answerBlock = userAnswer ? `<div class="bg-surface-container-low rounded-[1.5rem] p-4 border-l-4 ${isCorrect ? 'border-secondary/50' : 'border-error/30'}"><p class="text-xs font-bold ${isCorrect ? 'text-secondary' : 'text-on-surface-variant'} uppercase tracking-widest mb-1">Your Answer ${isCorrect === false ? '(Incorrect)' : ''}</p><p class="text-sm text-primary">${escapeHtml(userAnswer)}</p></div>` : '';
  return `<article class="bg-surface-container-lowest rounded-[2rem] p-7 md:p-10 relative overflow-hidden flex flex-col lg:flex-row gap-8 group ambient-shadow ghost-border"><div class="lg:w-[220px] flex flex-col gap-4"><div><span class="inline-block px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-bold text-xs uppercase tracking-widest mb-2">${escapeHtml(item.topicName || item.subjectName || 'Question')}</span>${hasNote ? '<span class="block px-3 py-1 rounded-full bg-tertiary/10 text-tertiary font-bold text-xs uppercase tracking-widest w-fit">Has Note</span>' : ''}<p class="text-xs font-bold text-outline uppercase tracking-widest mt-2">ID: ${escapeHtml(item.id)}</p><p class="text-xs font-bold text-outline uppercase tracking-widest mt-0.5">Saved: ${escapeHtml(formatShortDate(item.savedAt || item.updatedAt || new Date().toISOString()))}</p></div><div class="flex gap-2"><button onclick="removeSavedQuestion('${escapeHtml(item.id)}')" class="p-2 text-tertiary hover:text-tertiary-container transition-colors"><span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">bookmark</span></button><button onclick="editQuestionNote('${escapeHtml(item.id)}')" class="p-2 text-outline hover:text-primary transition-colors"><span class="material-symbols-outlined">edit_note</span></button><button onclick="openSavedQuestion('${escapeHtml(item.id)}')" class="p-2 text-outline hover:text-primary transition-colors"><span class="material-symbols-outlined">open_in_new</span></button></div></div><div class="flex-1 flex flex-col gap-5"><h2 class="font-extrabold text-xl md:text-2xl text-primary leading-tight tracking-tight">${escapeHtml(item.questionText || '')}</h2>${answerBlock}<div class="bg-surface-container-low rounded-[1.5rem] p-4 border-l-4 border-tertiary"><p class="text-xs font-bold text-tertiary uppercase tracking-widest mb-1">Correct Answer</p><p class="text-sm text-primary font-bold">${escapeHtml(correctAnswer)}</p></div><div class="pl-5 border-l-2 border-surface-variant"><h3 class="font-bold text-base text-primary mb-2">Clinical Rationale</h3><p class="text-sm text-on-surface-variant leading-relaxed">${escapeHtml(item.explanation || 'No explanation added yet.')}</p></div>${hasNote ? `<div class="bg-primary-container rounded-[1.75rem] p-5 relative overflow-hidden"><div class="text-xs font-bold text-primary-fixed uppercase tracking-widest mb-2 flex items-center gap-1"><span class="material-symbols-outlined text-sm">edit</span>Personal Note</div><p class="text-on-primary-container text-sm leading-relaxed italic">${escapeHtml(noteText)}</p></div>` : `<button onclick="editQuestionNote('${escapeHtml(item.id)}')" class="border-2 border-dashed border-outline-variant/50 rounded-[1.5rem] p-5 hover:bg-surface-container-low transition-colors cursor-pointer flex items-center justify-center text-outline gap-2"><span class="material-symbols-outlined">add_circle</span><span class="text-sm font-bold uppercase tracking-widest">Add Clinical Insight Note</span></button>`}</div></article>`;
}

function renderSavedPage() {
  const page = document.getElementById('page-saved');
  if (!page) return;
  appState.savedView = appState.savedView || { tab: 'all', search: '', subject: 'all' };
  const savedItems = getSavedItemsList();
  const notesMap = appState.notesByQuestion || {};
  const mergedIds = new Set([...savedItems.map(i => i.id), ...Object.keys(notesMap)]);
  const allItems = [...mergedIds].map(id => {
    const base = savedItems.find(i => i.id === id) || {};
    const note = notesMap[id];
    return {
      ...base,
      id,
      subjectId: base.subjectId || note?.subjectId || '',
      subjectName: base.subjectName || note?.subjectName || '',
      topicId: base.topicId || note?.topicId || '',
      topicName: base.topicName || note?.topicName || '',
      questionText: base.questionText || note?.questionText || '',
      note: note?.note || base.note || '',
      savedAt: base.savedAt || note?.updatedAt,
      updatedAt: note?.updatedAt || base.savedAt
    };
  }).sort((a,b)=> new Date(b.updatedAt || b.savedAt || 0) - new Date(a.updatedAt || a.savedAt || 0));
  const subjects = Array.from(new Set(allItems.map(i => i.subjectName).filter(Boolean)));
  const q = String(appState.savedView.search || '').trim().toLowerCase();
  let filtered = allItems.filter(item => {
    const hasSaved = !!(appState.savedItems || {})[item.id];
    const hasNote = !!(notesMap[item.id]?.note || item.note);
    const tab = appState.savedView.tab;
    if (tab === 'starred' && !hasSaved) return false;
    if (tab === 'notes' && !hasNote) return false;
    if (tab === 'both' && !(hasSaved && hasNote)) return false;
    if (appState.savedView.subject !== 'all' && item.subjectName !== appState.savedView.subject) return false;
    if (q && !`${item.questionText} ${item.subjectName} ${item.topicName} ${item.note || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const tabBtn = (id, label) => `<button onclick="setSavedTab('${id}')" class="px-5 py-3 rounded-full font-bold text-sm transition-colors ${appState.savedView.tab===id ? 'bg-primary text-on-primary' : 'text-primary hover:bg-white/50'}">${label}</button>`;
  page.innerHTML = `<div class="max-w-6xl mx-auto px-6 md:px-12 py-10"><div class="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-8"><div class="flex gap-2 bg-surface-container-low rounded-full p-1 flex-wrap w-fit">${tabBtn('all','All')}${tabBtn('starred','Starred')}${tabBtn('notes','Notes')}${tabBtn('both','Starred + Notes')}</div><div class="relative w-full lg:max-w-xl"><span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-sm">search</span><input id="saved-search-dynamic" value="${escapeHtml(appState.savedView.search || '')}" class="w-full pl-11 pr-4 py-4 bg-surface-container-low border-none rounded-full focus:ring-0 focus:bg-surface-container-lowest transition-all text-sm font-medium" placeholder="Search saved questions..." type="text"></div></div><div class="flex flex-wrap gap-4 mb-8"><span class="px-4 py-3 bg-surface-container-lowest rounded-full ghost-border text-xs font-bold text-on-surface-variant uppercase tracking-widest">${getSavedItemsList().length} Saved Questions</span><span class="px-4 py-3 bg-surface-container-lowest rounded-full ghost-border text-xs font-bold text-on-surface-variant uppercase tracking-widest">${getNotesList().length} Personal Notes</span><select onchange="setSavedSubjectFilter(this.value)" class="px-4 py-3 bg-surface-container-lowest rounded-full ghost-border text-sm font-bold text-primary border-none focus:ring-0"><option value="all">All Subjects</option>${subjects.map(s=>`<option value="${escapeHtml(s)}" ${appState.savedView.subject===s?'selected':''}>${escapeHtml(s)}</option>`).join('')}</select></div><div class="space-y-8">${filtered.length ? filtered.map(buildSavedCard).join('') : `<div class="bg-surface-container-lowest rounded-[2rem] p-10 ambient-shadow ghost-border text-center"><p class="text-2xl font-bold text-primary mb-2">Nothing here yet</p><p class="text-on-surface-variant">Save a question or add a personal note during study or final exam to build your review bank.</p></div>`}</div></div>`;
  const input = document.getElementById('saved-search-dynamic');
  if (input && !input.dataset.bound) {
    input.dataset.bound = 'true';
    input.addEventListener('input', e => {
      appState.savedView.search = e.target.value;
      saveState();
      renderSavedPage();
    });
  }
}
window.renderSavedPage = renderSavedPage;

function filterSaved() {}
window.filterSaved = filterSaved;

function bindSavedSearch() {}
function openHiddenAdmin() {
  const pw = window.prompt('Enter admin password');
  const configured = window.PN_ADMIN_CONFIG?.adminPassword || 'changeme';
  if (pw === configured) window.location.href = 'admin.html';
  else if (pw !== null) window.alert('Wrong password');
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === '9' || e.code === 'Digit9')) {
    e.preventDefault();
    openHiddenAdmin();
  }
});


async function buildDailyChallenge(forceRefresh = false) {
  const existing = getDailyChallengeState();
  if (existing && !forceRefresh) return existing;
  const subjects = PN_DATA.subjectsIndex?.subjects || [];
  if (!subjects.length) return null;
  const dateKey = getTodayKey();
  const seededSubjects = shuffleWithSeed(subjects.filter(s => Number(s.questionsCount || 0) > 0), `sub-${dateKey}`);
  for (const subject of seededSubjects) {
    const subjectData = PN_DATA.topicsMap.get(subject.id) || { topics: [] };
    const topics = shuffleWithSeed((subjectData.topics || []).filter(t => t.file), `topic-${dateKey}-${subject.id}`);
    for (const topic of topics) {
      const questions = await getTopicQuestionsForExam(subject.id, topic);
      if (!questions.length) continue;
      const picked = shuffleWithSeed(questions, `q-${dateKey}-${subject.id}-${topic.id || slugify(topic.name)}`).slice(0, Math.min(5, questions.length));
      const daily = {
        dateKey,
        subjectId: subject.id,
        subjectName: subject.name,
        topicId: topic.id || slugify(topic.name),
        topicName: topic.name,
        topicFile: topic.file,
        questionIds: picked.map(q => q.id),
        previewQuestion: picked[0]?.questionText || '',
        luckyNumber: (picked[0]?.id || '').split('').reduce((s,ch)=>s+ch.charCodeAt(0),0)%97 + 3
      };
      appState.dailyChallenge = daily;
      saveState();
      return daily;
    }
  }
  return null;
}

async function renderDailyChallenge(forceRefresh = false) {
  const daily = await buildDailyChallenge(forceRefresh);
  const subjectEl = document.getElementById('daily-subject');
  const previewEl = document.getElementById('daily-question-preview');
  const luckyEl = document.getElementById('lucky-n');
  if (!subjectEl || !previewEl) return;
  if (!daily) {
    subjectEl.textContent = 'No challenge available yet';
    previewEl.textContent = 'Add more topic data to unlock the daily challenge.';
    if (luckyEl) luckyEl.textContent = '—';
    return;
  }
  subjectEl.textContent = `${daily.subjectName.toUpperCase()} • ${daily.topicName.toUpperCase()}`;
  previewEl.textContent = daily.previewQuestion || 'Your daily challenge is ready.';
  if (luckyEl) luckyEl.textContent = String(daily.luckyNumber || 7);
}
window.renderDailyChallenge = renderDailyChallenge;

async function spinWheel() {
  const wheel = document.getElementById('daily-wheel');
  wheel?.classList.remove('spin-animation');
  void wheel?.offsetWidth;
  wheel?.classList.add('spin-animation');
  await renderDailyChallenge(true);
  setTimeout(() => wheel?.classList.remove('spin-animation'), 2100);
}
window.spinWheel = spinWheel;

async function startDailyChallenge() {
  const daily = await buildDailyChallenge(false);
  if (!daily) return;
  await loadTopicQuestions(daily.subjectId, daily.topicId);
  appState.retryQuestionIds = [...daily.questionIds];
  beginStudySession('daily');
  saveState();
  navigateTo('study');
  renderStudyQuestion();
}
window.startDailyChallenge = startDailyChallenge;

function selectSubject(subjectId) {
  appState.selectedSubjectId = subjectId;
  appState.selectedTopicId = null;
  saveState();
  renderTopicsPage();
  navigateTo('topics');
}
window.selectSubject = selectSubject;

async function selectTopic(subjectId, topicId) {
  await loadTopicQuestions(subjectId, topicId);
  renderSetsPage();
  navigateTo('sets');
}
window.selectTopic = selectTopic;


function getTopicQuestionCountByDifficulty(topic, difficulty = 'all') {
  if (!topic) return 0;
  if (difficulty === 'easy') return Number(topic.difficultyBreakdown?.easy || 0);
  if (difficulty === 'medium') return Number(topic.difficultyBreakdown?.medium || 0);
  if (difficulty === 'hard') return Number(topic.difficultyBreakdown?.hard || 0);
  return Number(topic.questionsCount || 0);
}

function ensureExamBuilderDefaults() {
  appState.examBuilder = appState.examBuilder || {};
  const eb = appState.examBuilder;
  eb.mode = eb.mode || 'multiple';
  eb.scope = eb.scope || 'all';
  eb.difficulty = eb.difficulty || 'all';
  eb.questionCount = Number(eb.questionCount || 20);
  eb.timeLimit = Number(eb.timeLimit || 30);
  eb.flags = { timed: true, hidden: true, review: true, retry: true, ...(eb.flags || {}) };

  const subjects = PN_DATA.subjectsIndex?.subjects || [];
  if (!eb.subjectId) eb.subjectId = subjects[0]?.id || null;
  if (!eb.topicSubjectId) eb.topicSubjectId = eb.subjectId || subjects[0]?.id || null;

  const topicSubject = PN_DATA.topicsMap.get(eb.topicSubjectId) || { topics: [] };
  const allTopicIds = (topicSubject.topics || []).map(t => t.id || slugify(t.name));
  if (!Array.isArray(eb.selectedTopicIds) || !eb.selectedTopicIds.length) eb.selectedTopicIds = allTopicIds;
  else eb.selectedTopicIds = eb.selectedTopicIds.filter(id => allTopicIds.includes(id));
  if (!eb.selectedTopicIds.length) eb.selectedTopicIds = allTopicIds;
}

function getExamPoolMeta() {
  ensureExamBuilderDefaults();
  const eb = appState.examBuilder;
  let pool = 0;
  let selectionTitle = 'All subjects';
  let selectionTopics = 'All available topics are eligible.';

  if (eb.mode === 'single_topics') {
    const subject = PN_DATA.subjectsMap.get(eb.topicSubjectId);
    const subjectData = PN_DATA.topicsMap.get(eb.topicSubjectId) || { topics: [] };
    const selected = (subjectData.topics || []).filter(t => eb.selectedTopicIds.includes(t.id || slugify(t.name)));
    pool = selected.reduce((sum, t) => sum + getTopicQuestionCountByDifficulty(t, eb.difficulty), 0);
    selectionTitle = subject?.name || 'Single subject';
    selectionTopics = selected.length ? `${selected.map(t => t.name).join(' • ')}` : 'Select at least one topic.';
  } else if (eb.scope === 'single') {
    const subject = PN_DATA.subjectsMap.get(eb.subjectId);
    const subjectData = PN_DATA.topicsMap.get(eb.subjectId) || { topics: [] };
    pool = (subjectData.topics || []).reduce((sum, t) => sum + getTopicQuestionCountByDifficulty(t, eb.difficulty), 0);
    selectionTitle = subject?.name || 'Single subject';
    selectionTopics = 'All topics inside this subject are eligible.';
  } else {
    pool = (PN_DATA.subjectsIndex?.subjects || []).reduce((sum, s) => {
      const sd = PN_DATA.topicsMap.get(s.id) || { topics: [] };
      return sum + (sd.topics || []).reduce((acc, t) => acc + getTopicQuestionCountByDifficulty(t, eb.difficulty), 0);
    }, 0);
    selectionTitle = 'All subjects';
    selectionTopics = 'Questions are pulled from the whole available bank.';
  }

  return { pool, selectionTitle, selectionTopics };
}


function getExamModeTheme(mode) {
  return mode === 'single_topics'
    ? {
        badge: 'bg-emerald-100 text-emerald-800',
        activeCard: 'bg-emerald-50 border-emerald-300',
        activeDotBorder: 'border-emerald-600',
        activeDot: 'bg-emerald-600',
        focus: ['border-emerald-400', 'ring-emerald-200'],
        poolCard: 'bg-emerald-50/80',
        flag: 'bg-emerald-50 border-emerald-300'
      }
    : {
        badge: 'bg-tertiary-fixed/35 text-on-tertiary-fixed',
        activeCard: 'bg-secondary-container/10 border-tertiary/30',
        activeDotBorder: 'border-secondary',
        activeDot: 'bg-secondary',
        focus: ['border-tertiary', 'ring-tertiary/20'],
        poolCard: 'bg-secondary-container/20',
        flag: 'bg-secondary-container/10 border-tertiary/30'
      };
}

function applyExamModeTheme() {
  const eb = appState.examBuilder;
  const theme = getExamModeTheme(eb.mode);
  const badge = document.getElementById('exam-mode-badge');
  if (badge) {
    badge.className = `inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] ${theme.badge}`;
    badge.textContent = eb.mode === 'single_topics' ? 'Single subject + selected topics' : 'Multiple subjects';
  }
  const modeSelect = document.getElementById('exam-mode-select');
  if (modeSelect) {
    modeSelect.classList.remove('focus:border-tertiary','focus:ring-tertiary/20','focus:border-emerald-400','focus:ring-emerald-200');
    modeSelect.classList.add(`focus:${theme.focus[0]}`, `focus:${theme.focus[1]}`);
  }
  const topicSearch = document.getElementById('exam-topic-search');
  if (topicSearch) {
    topicSearch.classList.remove('focus:border-tertiary','focus:ring-tertiary/20','focus:border-emerald-400','focus:ring-emerald-200');
    topicSearch.classList.add(`focus:${theme.focus[0]}`, `focus:${theme.focus[1]}`);
  }
  const poolCard = document.getElementById('exam-pool-title')?.parentElement;
  if (poolCard) {
    poolCard.classList.remove('bg-secondary-container/20','bg-primary-container/10');
    poolCard.classList.add(theme.poolCard);
  }
}

function updateExamScopeButtons() {
  const eb = appState.examBuilder;
  const allBtn = document.getElementById('exam-scope-all');
  const singleBtn = document.getElementById('exam-scope-single');
  const config = [
    [allBtn, eb.scope === 'all'],
    [singleBtn, eb.scope === 'single']
  ];
  config.forEach(([btn, active]) => {
    if (!btn) return;
    const theme = getExamModeTheme(appState.examBuilder.mode);
    btn.classList.toggle('bg-surface-container-low', !active);
    btn.classList.toggle('bg-secondary-container/10', active && appState.examBuilder.mode !== 'single_topics');
    btn.classList.toggle('border-tertiary/30', active && appState.examBuilder.mode !== 'single_topics');
    btn.classList.toggle('bg-primary-container/10', active && appState.examBuilder.mode === 'single_topics');
    btn.classList.toggle('border-secondary/35', active && appState.examBuilder.mode === 'single_topics');
    btn.querySelector('span')?.classList.toggle('border-outline', !active);
    btn.querySelector('span')?.classList.toggle('border-secondary', active && appState.examBuilder.mode !== 'single_topics');
    btn.querySelector('span')?.classList.toggle('border-secondary', active && appState.examBuilder.mode === 'single_topics');
    const dot = btn.querySelector('span span');
    if (dot) dot.className = `w-2 h-2 rounded-full ${active ? 'bg-secondary' : 'bg-transparent'}`;
  });
}

function renderExamTopicsGrid() {
  const grid = document.getElementById('exam-topics-grid');
  if (!grid) return;
  const eb = appState.examBuilder;
  const searchTerm = (eb.topicSearch || '').trim().toLowerCase();
  const subjectData = PN_DATA.topicsMap.get(eb.topicSubjectId) || { topics: [] };
  const topics = (subjectData.topics || [])
    .sort((a,b)=>(a.order||999)-(b.order||999))
    .filter(topic => !searchTerm || String(topic.name || '').toLowerCase().includes(searchTerm));
  const isGreen = eb.mode === 'single_topics';
  grid.innerHTML = topics.map(topic => {
    const id = topic.id || slugify(topic.name);
    const checked = eb.selectedTopicIds.includes(id);
    const count = getTopicQuestionCountByDifficulty(topic, eb.difficulty || 'all');
    return `<label class="rounded-[1.75rem] border ${checked ? (isGreen ? 'bg-primary-container/10 border-secondary/35' : 'bg-secondary-container/10 border-tertiary/30') : 'border-outline-variant/20 bg-surface-container-low'} px-5 py-5 flex items-start gap-4 cursor-pointer hover:border-tertiary/30 transition-colors"><input type="checkbox" class="mt-1 w-4 h-4" ${checked ? 'checked' : ''} onchange="toggleExamTopic('${escapeHtml(id)}')"><div><div class="font-extrabold text-primary text-sm md:text-base">${escapeHtml(topic.name)}</div><div class="text-on-surface-variant text-sm">${count} questions</div></div></label>`;
  }).join('') || `<div class="text-on-surface-variant text-sm rounded-[1.5rem] border border-dashed border-outline-variant/30 bg-surface-container-low px-5 py-6">${searchTerm ? 'No topics matched your search in this subject.' : 'No topics available for this subject yet.'}</div>`;
}

function renderExamFlagButtons() {
  const flags = appState.examBuilder.flags || {};
  [
    ['exam-flag-timed','timed'],
    ['exam-flag-hidden','hidden'],
    ['exam-flag-review','review'],
    ['exam-flag-retry','retry']
  ].forEach(([id,key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const active = !!flags[key];
    el.classList.toggle('bg-secondary-container/10', active && appState.examBuilder.mode !== 'single_topics');
    el.classList.toggle('bg-primary-container/10', active && appState.examBuilder.mode === 'single_topics');
    el.classList.toggle('bg-surface-container-low', !active);
    el.classList.toggle('border-tertiary/30', active && appState.examBuilder.mode !== 'single_topics');
    el.classList.toggle('border-secondary/35', active && appState.examBuilder.mode === 'single_topics');
  });
}

function refreshExamBuilderPreview() {
  ensureExamBuilderDefaults();
  const eb = appState.examBuilder;
  const modeEl = document.getElementById('exam-mode-select');
  const diffEl = document.getElementById('exam-difficulty-select');
  const qEl = document.getElementById('exam-question-count');
  const tEl = document.getElementById('exam-time-limit');
  const subjectEl = document.getElementById('exam-subject-select');
  const topicSubjectEl = document.getElementById('exam-topic-subject-select');
  if (modeEl) eb.mode = modeEl.value;
  if (diffEl) eb.difficulty = diffEl.value;
  if (qEl) eb.questionCount = Math.max(5, Number(qEl.value || 20));
  if (tEl) eb.timeLimit = Math.max(5, Number(tEl.value || 30));
  if (subjectEl) eb.subjectId = subjectEl.value || eb.subjectId;
  if (topicSubjectEl) eb.topicSubjectId = topicSubjectEl.value || eb.topicSubjectId;

  const multiplePanel = document.getElementById('exam-multiple-subjects-panel');
  const topicPanel = document.getElementById('exam-topic-mode-panel');
  if (multiplePanel) multiplePanel.classList.toggle('hidden', eb.mode !== 'multiple');
  if (topicPanel) topicPanel.classList.toggle('hidden', eb.mode !== 'single_topics');

  applyExamModeTheme();
  updateExamScopeButtons();
  renderExamTopicsGrid();
  renderExamFlagButtons();

  const { pool, selectionTitle, selectionTopics } = getExamPoolMeta();
  const secPerQuestion = Math.round((eb.timeLimit * 60) / Math.max(1, eb.questionCount));
  const humanDifficulty = eb.difficulty === 'all' ? 'All difficulties' : `${eb.difficulty[0].toUpperCase()}${eb.difficulty.slice(1)} only`;
  document.getElementById('exam-pool-title') && (document.getElementById('exam-pool-title').textContent = `Available pool: ${pool} questions`);
  document.getElementById('exam-pool-subtitle') && (document.getElementById('exam-pool-subtitle').textContent = `You will get ${eb.questionCount} questions with about ${secPerQuestion} sec/question based on your current time limit.`);
  document.getElementById('exam-preview-title') && (document.getElementById('exam-preview-title').textContent = eb.mode === 'single_topics' ? 'Focused subject exam' : 'Mixed final exam');
  document.getElementById('exam-preview-desc') && (document.getElementById('exam-preview-desc').textContent = pool ? 'The builder is ready with a live pool based on your current filters.' : 'Your current selection has no available questions yet.');
  document.getElementById('exam-preview-mode') && (document.getElementById('exam-preview-mode').textContent = eb.mode === 'single_topics' ? 'Single Subject + Topics' : (eb.scope === 'single' ? 'One Subject Only' : 'Multiple Subjects'));
  document.getElementById('exam-preview-difficulty') && (document.getElementById('exam-preview-difficulty').textContent = humanDifficulty);
  document.getElementById('exam-preview-questions') && (document.getElementById('exam-preview-questions').textContent = String(eb.questionCount));
  document.getElementById('exam-preview-time') && (document.getElementById('exam-preview-time').textContent = `${eb.timeLimit} min`);
  document.getElementById('exam-preview-selection') && (document.getElementById('exam-preview-selection').textContent = selectionTitle);
  document.getElementById('exam-preview-topics') && (document.getElementById('exam-preview-topics').textContent = selectionTopics);

  const flagsWrap = document.getElementById('exam-preview-flags');
  if (flagsWrap) {
    const labels = [];
    if (eb.flags.timed) labels.push('Timed exam experience');
    if (eb.flags.hidden) labels.push('Hidden answers until submission');
    if (eb.flags.review) labels.push('Detailed review after finishing');
    if (eb.flags.retry) labels.push('Retry wrong questions later');
    flagsWrap.innerHTML = labels.map(item => `<li class="flex items-center gap-2"><span class="material-symbols-outlined text-tertiary-fixed text-base">check_small</span><span>${escapeHtml(item)}</span></li>`).join('');
  }

  saveState();
}
window.refreshExamBuilderPreview = refreshExamBuilderPreview;

function toggleExamTopic(topicId) {
  ensureExamBuilderDefaults();
  const selected = new Set(appState.examBuilder.selectedTopicIds || []);
  if (selected.has(topicId)) selected.delete(topicId);
  else selected.add(topicId);
  appState.examBuilder.selectedTopicIds = [...selected];
  refreshExamBuilderPreview();
}
window.toggleExamTopic = toggleExamTopic;

function initFinalExamBuilder() {
  if (!PN_DATA.subjectsIndex?.subjects?.length) return;
  ensureExamBuilderDefaults();
  const eb = appState.examBuilder;
  const subjects = PN_DATA.subjectsIndex.subjects;
  const subjectOptions = subjects.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');
  const subjectEl = document.getElementById('exam-subject-select');
  const topicSubjectEl = document.getElementById('exam-topic-subject-select');
  if (subjectEl && !subjectEl.dataset.bound) {
    subjectEl.innerHTML = subjectOptions;
    topicSubjectEl.innerHTML = subjectOptions;
    subjectEl.dataset.bound = 'true';
    document.getElementById('exam-mode-select')?.addEventListener('change', refreshExamBuilderPreview);
    document.getElementById('exam-difficulty-select')?.addEventListener('change', refreshExamBuilderPreview);
    document.getElementById('exam-question-count')?.addEventListener('input', refreshExamBuilderPreview);
    document.getElementById('exam-time-limit')?.addEventListener('input', refreshExamBuilderPreview);
    subjectEl.addEventListener('change', refreshExamBuilderPreview);
    topicSubjectEl?.addEventListener('change', () => {
      appState.examBuilder.topicSubjectId = topicSubjectEl.value;
      appState.examBuilder.topicSearch = '';
      const searchEl = document.getElementById('exam-topic-search');
      if (searchEl) searchEl.value = '';
      const subjectData = PN_DATA.topicsMap.get(appState.examBuilder.topicSubjectId) || { topics: [] };
      appState.examBuilder.selectedTopicIds = (subjectData.topics || []).map(t => t.id || slugify(t.name));
      refreshExamBuilderPreview();
    });
    document.getElementById('exam-scope-all')?.addEventListener('click', () => { appState.examBuilder.scope = 'all'; refreshExamBuilderPreview(); });
    document.getElementById('exam-scope-single')?.addEventListener('click', () => { appState.examBuilder.scope = 'single'; refreshExamBuilderPreview(); });
    document.getElementById('exam-topic-search')?.addEventListener('input', (e) => {
      appState.examBuilder.topicSearch = e.target.value || '';
      renderExamTopicsGrid();
      saveState();
    });
    ['timed','hidden','review','retry'].forEach(key => {
      document.getElementById(`exam-flag-${key}`)?.addEventListener('click', () => {
        appState.examBuilder.flags[key] = !appState.examBuilder.flags[key];
        refreshExamBuilderPreview();
      });
    });
  } else if (subjectEl) {
    subjectEl.innerHTML = subjectOptions;
    topicSubjectEl.innerHTML = subjectOptions;
  }
  if (subjectEl) subjectEl.value = eb.subjectId || subjects[0]?.id || '';
  if (topicSubjectEl) topicSubjectEl.value = eb.topicSubjectId || subjects[0]?.id || '';
  document.getElementById('exam-mode-select') && (document.getElementById('exam-mode-select').value = eb.mode);
  document.getElementById('exam-difficulty-select') && (document.getElementById('exam-difficulty-select').value = eb.difficulty);
  document.getElementById('exam-question-count') && (document.getElementById('exam-question-count').value = eb.questionCount);
  document.getElementById('exam-time-limit') && (document.getElementById('exam-time-limit').value = eb.timeLimit);
  document.getElementById('exam-topic-search') && (document.getElementById('exam-topic-search').value = eb.topicSearch || '');
  refreshExamBuilderPreview();
}

async function loadSubjectsIndex() {
  const index = await fetchJson('data/index.json');
  const rawSubjects = [...(index.subjects || [])].sort((a, b) => (a.order || 999) - (b.order || 999));

  const validSubjects = [];

  await Promise.all(rawSubjects.map(async subject => {
    try {
      const metaPath = `data/${subject.id}/meta.json`;
      const subjectJson = await fetchJson(metaPath);

      const cleanTopics = Array.isArray(subjectJson.topics) ? subjectJson.topics.filter(topic =>
        topic &&
        (topic.id || topic.name) &&
        topic.file &&
        String(topic.file).includes(`data/${subject.id}/`)
      ) : [];

      PN_DATA.topicsMap.set(subject.id, {
        ...subjectJson,
        topics: cleanTopics
      });

      subject.metaFile = metaPath;
      subject.topicsCount = cleanTopics.length;
      subject.questionsCount = cleanTopics.reduce((sum, topic) => sum + Number(topic.questionsCount || 0), 0);

      validSubjects.push(subject);
    } catch {
      // تجاهل أي مادة قديمة أو broken
    }
  }));

  validSubjects.sort((a, b) => (a.order || 999) - (b.order || 999));

  PN_DATA.subjectsIndex = {
    ...index,
    subjects: validSubjects
  };

  PN_DATA.subjectsMap.clear();
  validSubjects.forEach(subject => PN_DATA.subjectsMap.set(subject.id, subject));

  setSubjectStats(validSubjects);
  renderHomeSubjects(validSubjects);
  renderSubjectsPage(validSubjects);
  bindTopicSearch();
  renderTopicsPage();
}
window.addEventListener('DOMContentLoaded', async () => {
  renderPersistentStats();
  bindNotes();
  bindSavedSearch();
  applyTheme(appState.themeMode || 'light');
  document.getElementById('study-prev-btn')?.addEventListener('click', previousQuestion);
  document.addEventListener('copy', (e) => {
    if (!canGuardExamInteractions()) return;
    e.preventDefault();
    showGuardMessage();
  });
  document.addEventListener('cut', (e) => {
    if (!canGuardExamInteractions()) return;
    e.preventDefault();
    showGuardMessage();
  });
  document.addEventListener('paste', (e) => {
    if (!canGuardExamInteractions()) return;
    const t = e.target;
    if (t && ['INPUT','TEXTAREA'].includes(t.tagName)) return;
    e.preventDefault();
    showGuardMessage();
  });
  document.addEventListener('contextmenu', (e) => {
    if (!canGuardExamInteractions()) return;
    e.preventDefault();
    showGuardMessage();
  });
  document.addEventListener('keydown', (e) => {
    if (!canGuardExamInteractions()) return;
    if ((e.ctrlKey || e.metaKey) && ['c','x','v'].includes(String(e.key).toLowerCase())) {
      e.preventDefault();
      showGuardMessage();
    }
  });
  if (appState.savedQuestion) {
    const btn = document.getElementById('save-btn');
    const icon = btn?.querySelector('.material-symbols-outlined');
    if (btn && icon) {
      icon.style.fontVariationSettings = "'FILL' 1";
      btn.classList.add('text-tertiary');
      btn.classList.remove('text-on-surface-variant');
    }
  }
  try {
    await loadSubjectsIndex();
    await renderDailyChallenge();
    if (appState.selectedSubjectId && appState.selectedTopicId) {
      try {
        await loadTopicQuestions(appState.selectedSubjectId, appState.selectedTopicId);
      } catch {}
    }
  } catch (error) {
    console.error(error);
  }
  navigateTo(appState.currentPage || 'home');
  if (appState.currentPage === 'sets') renderSetsPage();
  if (appState.currentPage === 'study') renderStudyQuestion();
  if (appState.currentPage === 'review') renderReviewPage();
  if (appState.currentPage === 'dashboard') renderDashboardPage();
});


function normalizeQuestionForExam(q, topicMeta = {}, subjectMeta = {}) {
  const type = String(q.type || (Array.isArray(q.options) && q.options.length === 2 ? 'true_false' : 'mcq')).toLowerCase();
  let options = Array.isArray(q.options) ? [...q.options] : [];
  if (!options.length && (type === 'true_false' || type === 'truefalse' || type === 'tf')) options = ['True', 'False'];
  return {
    ...q,
    id: q.id || `${topicMeta.id || slugify(topicMeta.name || 'topic')}-${Math.random().toString(36).slice(2,8)}`,
    type,
    options,
    questionText: q.questionText || q.question || q.text || '',
    caseText: q.caseText || q.case || '',
    imageUrl: q.imageUrl || q.image || '',
    explanation: q.explanation || '',
    difficulty: String(q.difficulty || 'easy').toLowerCase(),
    includeInFinal: q.includeInFinal !== false,
    subjectId: subjectMeta.id || q.subjectId,
    subjectName: subjectMeta.name || q.subjectName || '',
    topicId: topicMeta.id || q.topicId,
    topicName: topicMeta.name || q.topicName || ''
  };
}

async function getTopicQuestionsForExam(subjectId, topicMeta) {
  if (!topicMeta?.file) return [];
  if (!PN_DATA.topicFilesCache.has(topicMeta.file)) {
    PN_DATA.topicFilesCache.set(topicMeta.file, await fetchJson(topicMeta.file));
  }
  const raw = PN_DATA.topicFilesCache.get(topicMeta.file) || {};
  const subjectMeta = PN_DATA.subjectsMap.get(subjectId) || {};
  return Array.isArray(raw.questions) ? raw.questions.map(q => normalizeQuestionForExam(q, { ...topicMeta, id: topicMeta.id || slugify(topicMeta.name) }, subjectMeta)) : [];
}

function shuffleArray(arr = []) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function buildConfiguredExamQuestions() {
  ensureExamBuilderDefaults();
  const eb = appState.examBuilder;
  const subjects = PN_DATA.subjectsIndex?.subjects || [];
  let subjectIds = [];
  if (eb.mode === 'single_topics') subjectIds = eb.topicSubjectId ? [eb.topicSubjectId] : [];
  else if (eb.scope === 'single') subjectIds = eb.subjectId ? [eb.subjectId] : [];
  else subjectIds = subjects.map(s => s.id);

  let pool = [];
  for (const subjectId of subjectIds) {
    const subjectData = PN_DATA.topicsMap.get(subjectId) || { topics: [] };
    let topicList = [...(subjectData.topics || [])];
    if (eb.mode === 'single_topics') {
      const allowed = new Set(eb.selectedTopicIds || []);
      topicList = topicList.filter(t => allowed.has(t.id || slugify(t.name)));
    }
    for (const topic of topicList) {
      const questions = await getTopicQuestionsForExam(subjectId, topic);
      pool.push(...questions);
    }
  }

  pool = pool.filter(q => q.includeInFinal !== false);
  if (eb.difficulty !== 'all') pool = pool.filter(q => String(q.difficulty || '').toLowerCase() === eb.difficulty);
  pool = shuffleArray(pool);
  return pool.slice(0, Math.min(pool.length, Number(eb.questionCount || 20)));
}

function getExamSession() {
  return appState.currentExamSession || null;
}

function getExamRemainingMs(session) {
  if (!session) return 0;
  return Math.max(0, Number(session.endsAt || 0) - Date.now());
}

let examTimerRef = null;
function startExamTimer() {
  clearInterval(examTimerRef);
  examTimerRef = setInterval(() => {
    const session = getExamSession();
    if (!session) return clearInterval(examTimerRef);
    const remaining = getExamRemainingMs(session);
    const el = document.getElementById('exam-time-value');
    if (el) el.textContent = formatExamTime(remaining);
    if (remaining <= 0) {
      clearInterval(examTimerRef);
      submitCurrentExam(true);
    }
  }, 1000);
}

function formatExamTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return [hrs, mins, secs].map(v => String(v).padStart(2, '0')).join(':');
}

async function startConfiguredExam() {
  refreshExamBuilderPreview();
  const questions = await buildConfiguredExamQuestions();
  if (!questions.length) {
    window.alert('No questions are available for the current exam selection yet.');
    return;
  }
  const eb = appState.examBuilder;
  appState.currentExamSession = {
    id: createSessionId(),
    title: eb.mode === 'single_topics' ? 'Focused Final Exam' : 'Mixed Final Exam',
    mode: eb.mode,
    scope: eb.scope,
    difficulty: eb.difficulty,
    questionCount: questions.length,
    requestedQuestionCount: eb.questionCount,
    timeLimit: eb.timeLimit,
    questions,
    answers: {},
    flagged: [],
    currentIndex: 0,
    startedAt: Date.now(),
    endsAt: Date.now() + Number(eb.timeLimit || 30) * 60 * 1000,
    hidden: !!eb.flags.hidden,
    review: !!eb.flags.review,
    retry: !!eb.flags.retry,
    subjectLabel: eb.mode === 'single_topics' ? (PN_DATA.subjectsMap.get(eb.topicSubjectId)?.name || 'Single Subject') : (eb.scope === 'single' ? (PN_DATA.subjectsMap.get(eb.subjectId)?.name || 'One Subject') : 'Multiple Subjects'),
    topicIds: [...(eb.selectedTopicIds || [])]
  };
  appState.reviewContext = 'finalExam';
  saveState();
  renderExamLivePage();
  navigateTo('examlive');
}
window.startConfiguredExam = startConfiguredExam;

function examSelectAnswer(optionIndex) {
  const session = getExamSession();
  if (!session) return;
  const question = session.questions?.[session.currentIndex];
  if (!question) return;
  session.answers[question.id] = Number(optionIndex);
  appState.currentExamSession = session;
  saveState();
  renderExamLivePage();
}
window.examSelectAnswer = examSelectAnswer;

function examGoTo(index) {
  const session = getExamSession();
  if (!session) return;
  if (index < 0 || index >= session.questions.length) return;
  session.currentIndex = index;
  appState.currentExamSession = session;
  saveState();
  renderExamLivePage();
}
window.examGoTo = examGoTo;

function examNextQuestion() {
  const session = getExamSession();
  if (!session) return;
  if (session.currentIndex < session.questions.length - 1) session.currentIndex += 1;
  saveState();
  renderExamLivePage();
}
window.examNextQuestion = examNextQuestion;

function examPreviousQuestion() {
  const session = getExamSession();
  if (!session) return;
  if (session.currentIndex > 0) session.currentIndex -= 1;
  saveState();
  renderExamLivePage();
}
window.examPreviousQuestion = examPreviousQuestion;

function toggleExamFlagCurrent() {
  const session = getExamSession();
  if (!session) return;
  const q = session.questions?.[session.currentIndex];
  if (!q) return;
  const flagged = new Set(session.flagged || []);
  if (flagged.has(q.id)) flagged.delete(q.id); else flagged.add(q.id);
  session.flagged = [...flagged];
  saveState();
  renderExamLivePage();
}
window.toggleExamFlagCurrent = toggleExamFlagCurrent;

function renderExamLivePage() {
  const page = document.getElementById('page-examlive');
  const session = getExamSession();
  if (!page || !session) return;
  const q = session.questions[session.currentIndex];
  if (!q) return;
  const answeredCount = Object.keys(session.answers || {}).length;
  const remainingCount = Math.max(0, session.questions.length - answeredCount);
  const currentNumber = session.currentIndex + 1;
  const remainingMs = getExamRemainingMs(session);
  const options = Array.isArray(q.options) && q.options.length ? q.options : ['True', 'False'];
  const selected = session.answers[q.id];
  const flagSet = new Set(session.flagged || []);
  const palette = session.questions.map((item, idx) => {
    const answered = session.answers[item.id] !== undefined;
    const current = idx === session.currentIndex;
    const flagged = flagSet.has(item.id);
    const base = current ? 'bg-primary text-on-primary scale-110' : (answered ? 'bg-primary-fixed text-primary' : 'bg-surface-container-highest text-on-surface-variant');
    return `<button onclick="examGoTo(${idx})" class="w-10 h-10 rounded-lg ${base} font-bold text-xs flex items-center justify-center hover:opacity-90 relative transition-all">${idx + 1}${flagged ? '<span class="absolute top-0 right-0 w-2 h-2 bg-tertiary rounded-full -mt-0.5 -mr-0.5"></span>' : ''}</button>`;
  }).join('');
  const optionCards = options.map((opt, idx) => {
    const active = Number(selected) === idx;
    return `<label class="flex items-start gap-4 p-4 rounded-xl ${active ? 'bg-primary-fixed/20 border-2 border-primary' : 'bg-surface-container-lowest border border-outline-variant/15 hover:bg-surface'} cursor-pointer transition-colors"><input ${active ? 'checked' : ''} class="mt-1 text-primary focus:ring-primary" name="exam-q-${currentNumber}" type="radio" onchange="examSelectAnswer(${idx})"/><span class="text-sm ${active ? 'text-primary font-bold' : 'text-on-surface'}">${escapeHtml(opt)}</span></label>`;
  }).join('');
  const caseBlock = q.caseText ? `<div class="text-sm text-on-surface leading-relaxed mb-7 space-y-2"><p>${escapeHtml(q.caseText)}</p></div>` : '';
  const imageBlock = q.imageUrl ? `<div class="mb-7"><img src="${escapeHtml(q.imageUrl)}" alt="Question image" class="w-full max-h-80 object-contain rounded-xl border border-outline-variant/15 bg-surface-container-low"></div>` : '';
  page.innerHTML = `<div class="max-w-7xl mx-auto px-5 md:px-10 py-8">
    <div class="flex justify-between items-center mb-8 bg-surface-container-lowest rounded-xl p-4 ambient-shadow">
      <div class="flex items-center gap-3"><span class="material-symbols-outlined text-primary">school</span><span class="font-bold text-primary">${escapeHtml(session.title)} — ${escapeHtml(session.subjectLabel)}</span></div>
      <div class="flex items-center gap-6">
        <div class="text-center"><p class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Answered</p><p class="font-black text-primary text-lg">${answeredCount}</p></div>
        <div class="text-center"><p class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Remaining</p><p class="font-black text-on-surface-variant text-lg">${remainingCount}</p></div>
        <div class="bg-surface-container-low px-4 py-2 rounded-xl"><p class="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Time</p><p id="exam-time-value" class="font-mono font-black text-primary text-lg">${formatExamTime(remainingMs)}</p></div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div class="lg:col-span-8">
        <div class="bg-surface-container-lowest rounded-xl p-8 md:p-10 relative ambient-shadow">
          <div class="absolute top-0 left-0 w-2 h-full bg-tertiary rounded-l-xl"></div>
          <div class="flex justify-between items-start mb-7 gap-4">
            <div>
              <span class="uppercase tracking-widest text-xs font-bold text-tertiary bg-tertiary/10 px-3 py-1 rounded-full mb-3 inline-block">${escapeHtml(formatType(q.type || 'mcq'))} • ${currentNumber}</span>
              <h2 class="text-2xl font-bold text-primary mb-1">${escapeHtml(q.topicName || 'Topic')}</h2>
              <p class="text-sm text-on-surface-variant uppercase tracking-wider font-semibold">${escapeHtml(q.subjectName || '')} • ${escapeHtml(String(q.difficulty || 'easy'))}</p>
            </div>
            <div class="flex items-center gap-2"><button onclick="toggleSave()" id="save-btn" class="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors"><span class="material-symbols-outlined">bookmark</span></button><button onclick="saveNoteForRecord(getCurrentQuestionRecord())" id="note-btn" class="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors"><span class="material-symbols-outlined">edit_note</span></button><button onclick="toggleExamFlagCurrent()" class="text-primary hover:bg-surface-container-low p-2 rounded-full transition-colors ${flagSet.has(q.id) ? 'text-tertiary' : ''}"><span class="material-symbols-outlined">flag</span></button></div>
          </div>
          ${caseBlock}
          ${imageBlock}
          <div class="bg-surface-container-low p-5 rounded-xl mb-7">
            <h3 class="text-base font-bold text-primary mb-3">Question ${currentNumber} of ${session.questions.length}</h3>
            <p class="text-sm font-medium text-on-surface">${escapeHtml(q.questionText || 'No question text')}</p>
          </div>
          <div class="space-y-3" id="exam-options">${optionCards}</div>
          <div class="flex justify-between items-center mt-8 gap-4">
            <button onclick="examPreviousQuestion()" class="flex items-center gap-2 text-on-surface-variant hover:text-primary font-bold text-sm ${session.currentIndex === 0 ? 'opacity-50 pointer-events-none' : ''}"><span class="material-symbols-outlined">arrow_back</span> Previous</button>
            <button onclick="${session.currentIndex === session.questions.length - 1 ? 'submitCurrentExam()' : 'examNextQuestion()'}" class="bg-primary text-on-primary px-7 py-3 rounded-xl font-bold text-sm hover:scale-[0.98] transition-transform flex items-center gap-2">${session.currentIndex === session.questions.length - 1 ? 'Submit Exam' : 'Next Question'} <span class="material-symbols-outlined text-sm">arrow_forward</span></button>
          </div>
        </div>
      </div>
      <div class="lg:col-span-4"><div class="bg-surface-container-low rounded-xl p-7 sticky top-24"><div class="flex justify-between items-center mb-5"><h3 class="font-bold text-primary">Question Palette</h3><span class="text-xs font-bold text-primary bg-primary-fixed px-2 py-1 rounded">${currentNumber} / ${session.questions.length}</span></div><div class="grid grid-cols-5 gap-2 mb-5">${palette}</div><div class="flex flex-col gap-2 text-xs font-semibold text-on-surface-variant mb-6"><div class="flex items-center gap-2"><span class="w-3 h-3 rounded bg-primary-fixed inline-block"></span> Answered</div><div class="flex items-center gap-2"><span class="w-3 h-3 rounded bg-surface-container-highest inline-block"></span> Unanswered</div><div class="flex items-center gap-2"><span class="w-3 h-3 rounded bg-primary inline-block"></span> Current</div><div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-tertiary inline-block"></span> Flagged</div></div><button onclick="submitCurrentExam()" class="w-full bg-tertiary text-on-tertiary py-4 rounded-xl font-extrabold text-sm tracking-widest uppercase hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_10px_20px_rgba(115,92,0,0.2)]">Submit Exam</button></div></div>
    </div>
  </div>`;
  updateSaveButtonState();
  const noteBtn = document.getElementById('note-btn');
  const noteExists = !!(appState.notesByQuestion?.[q.id]?.note);
  if (noteBtn) {
    noteBtn.classList.toggle('text-tertiary', noteExists);
    noteBtn.classList.toggle('text-on-surface-variant', !noteExists);
  }
  startExamTimer();
}
window.renderExamLivePage = renderExamLivePage;

function buildFinalExamReviewPage() {
  const page = document.getElementById('page-review');
  const session = getExamSession();
  if (!page || !session) return;
  clearInterval(examTimerRef);
  const results = session.questions.map(q => ({ q, userChoice: session.answers[q.id], isCorrect: Number(session.answers[q.id]) === Number(q.correctAnswer) }));
  const total = results.length;
  const correct = results.filter(r => r.isCorrect).length;
  const wrong = total - correct;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const reviewCards = results.map((item, idx) => {
    const q = item.q;
    const userAnswer = item.userChoice !== undefined ? (q.options?.[item.userChoice] ?? '—') : 'Not answered';
    const correctAnswer = q.options?.[Number(q.correctAnswer)] ?? '—';
    return `<article class="bg-surface-container-lowest rounded-xl p-7 md:p-8 ambient-shadow relative"><div class="flex items-center justify-between mb-5 gap-3 flex-wrap"><div class="flex items-center gap-3 flex-wrap"><span class="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary text-sm">${idx + 1}</span><span class="px-2.5 py-1 bg-surface-container-low text-on-surface-variant text-xs font-bold uppercase tracking-wider rounded-md">${escapeHtml(formatType(q.type || 'mcq'))}</span><span class="px-2.5 py-1 ${difficultyBadgeClass(q.difficulty)} text-xs font-bold uppercase tracking-wider rounded-md">${escapeHtml(String(q.difficulty || 'easy'))}</span>${item.isCorrect ? '<span class="px-2.5 py-1 bg-secondary-container/40 text-secondary text-xs font-bold uppercase tracking-wider rounded-md">Correct</span>' : '<span class="px-2.5 py-1 bg-error-container/40 text-on-error-container text-xs font-bold uppercase tracking-wider rounded-md">Wrong</span>'}</div></div>${q.caseText ? `<div class="mb-4 p-4 rounded-xl bg-surface-container-low text-sm text-on-surface-variant leading-relaxed"><span class="font-bold text-primary block mb-1">Case</span>${escapeHtml(q.caseText)}</div>` : ''}${q.imageUrl ? `<div class="mb-4"><img src="${escapeHtml(q.imageUrl)}" class="w-full max-h-72 object-contain rounded-xl border border-outline-variant/15 bg-surface-container-low"></div>` : ''}<p class="text-base leading-relaxed text-primary font-medium mb-6 max-w-4xl">${escapeHtml(q.questionText || '')}</p><div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5"><div class="p-5 rounded-xl bg-error-container/15 border border-error/20"><span class="text-xs font-bold uppercase tracking-widest text-error block mb-2">Student Answer</span><p class="text-sm text-primary font-medium">${escapeHtml(userAnswer)}</p></div><div class="p-5 rounded-xl bg-secondary-container/20 border border-secondary/20"><span class="text-xs font-bold uppercase tracking-widest text-secondary block mb-2">Correct Answer</span><p class="text-sm text-primary font-medium">${escapeHtml(correctAnswer)}</p></div></div><div class="bg-surface-container-low rounded-xl p-5"><span class="text-xs font-bold uppercase tracking-widest text-primary block mb-2">Explanation</span><p class="text-sm text-on-surface-variant leading-relaxed">${escapeHtml(q.explanation || 'No explanation added yet.')}</p></div></article>`;
  }).join('');
  page.innerHTML = `<div class="max-w-5xl mx-auto px-6 md:px-12 py-10"><div class="absolute top-0 left-0 w-full h-80 bg-gradient-to-br from-primary-container/15 via-surface to-surface -z-10 pointer-events-none"></div><header class="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-5"><div><span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 block">Post-Assessment Analysis</span><h1 class="text-4xl md:text-5xl font-extrabold text-primary tracking-tight" style="letter-spacing:-0.02em">Performance Review<br/><span class="text-on-surface-variant font-medium text-2xl">Final Exam • ${escapeHtml(session.subjectLabel)}</span></h1></div><p class="text-sm text-on-surface-variant max-w-sm">A detailed breakdown of your final exam performance with your selected answer, the correct answer, and the explanation for each question.</p></header><section class="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10"><div class="bg-surface-container-lowest rounded-xl p-6 flex flex-col ambient-shadow relative overflow-hidden group"><div class="absolute -right-3 -top-3 w-16 h-16 bg-tertiary/10 rounded-full blur-xl"></div><span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-tertiary text-base">workspace_premium</span>Score</span><div class="flex items-baseline gap-1"><span class="text-5xl font-black text-primary">${correct}</span><span class="text-xl text-on-surface-variant">/${total}</span></div></div><div class="bg-surface-container-lowest rounded-xl p-6 flex flex-col ambient-shadow"><span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-primary text-base">percent</span>Accuracy</span><div class="text-5xl font-black text-primary">${accuracy}<span class="text-2xl text-on-surface-variant font-medium">%</span></div></div><div class="bg-surface-container-lowest rounded-xl p-6 flex flex-col ambient-shadow border-l-4 border-secondary"><span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-secondary text-base">check_circle</span>Correct</span><div class="text-5xl font-black text-secondary">${correct}</div></div><div class="bg-surface-container-lowest rounded-xl p-6 flex flex-col ambient-shadow border-l-4 border-error"><span class="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-1"><span class="material-symbols-outlined text-error text-base">cancel</span>Wrong</span><div class="text-5xl font-black text-error">${wrong}</div></div></section><div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-10 p-5 bg-surface-container-low rounded-xl"><button onclick="retryWrongFinalExam()" class="py-4 bg-primary text-on-primary rounded-xl font-bold text-base hover:scale-[0.98] transition-transform flex items-center justify-center gap-2 ${wrong === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${wrong === 0 ? 'disabled' : ''}><span class="material-symbols-outlined">restart_alt</span> Retry Wrong Questions</button><button onclick="retakeFinalExam()" class="py-4 bg-surface-container-lowest text-primary rounded-xl font-bold text-base hover:bg-surface-variant transition-colors border border-outline-variant/15 flex items-center justify-center gap-2"><span class="material-symbols-outlined">replay</span> Retake Full Exam</button><button onclick="navigateTo('home')" class="py-4 bg-surface-container-lowest text-primary rounded-xl font-bold text-base hover:bg-surface-variant transition-colors border border-outline-variant/15 flex items-center justify-center gap-2"><span class="material-symbols-outlined">home</span> Back to Home</button><button onclick="navigateTo('dashboard')" class="py-4 bg-surface-container-lowest text-primary rounded-xl font-bold text-base hover:bg-surface-variant transition-colors border border-outline-variant/15 flex items-center justify-center gap-2"><span class="material-symbols-outlined">dashboard</span> Go to Dashboard</button></div><h2 class="text-xl font-bold text-primary mb-6 tracking-tight">Question Analysis</h2><div class="space-y-8">${reviewCards}</div></div>`;
}

function submitCurrentExam(autoSubmitted = false) {
  const session = getExamSession();
  if (!session) return;
  clearInterval(examTimerRef);
  const total = session.questions.length;
  const correct = session.questions.filter(q => Number(session.answers[q.id]) === Number(q.correctAnswer)).length;
  const wrong = total - correct;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  appState.attemptHistory = Array.isArray(appState.attemptHistory) ? appState.attemptHistory : [];
  appState.attemptHistory.unshift({
    id: session.id,
    type: 'finalExam',
    subjectName: session.subjectLabel,
    topicName: session.mode === 'single_topics' ? 'Selected topics' : 'Mixed pool',
    total,
    correct,
    wrong,
    accuracy,
    createdAt: new Date().toISOString(),
    autoSubmitted
  });
  appState.attemptHistory = appState.attemptHistory.slice(0, 60);
  appState.finalExamsDone = Number(appState.finalExamsDone || 0) + 1;
  appState.reviewContext = 'finalExam';
  saveState();
  buildFinalExamReviewPage();
  navigateTo('review');
}
window.submitCurrentExam = submitCurrentExam;

async function retryWrongFinalExam() {
  const session = getExamSession();
  if (!session) return;
  const wrongQuestions = session.questions.filter(q => Number(session.answers[q.id]) !== Number(q.correctAnswer));
  if (!wrongQuestions.length) return;
  appState.currentExamSession = {
    ...session,
    type: 'finalExam',
    id: createSessionId(),
    title: 'Final Exam Wrong Questions Retry',
    questions: wrongQuestions,
    questionCount: wrongQuestions.length,
    requestedQuestionCount: wrongQuestions.length,
    answers: {},
    flagged: [],
    currentIndex: 0,
    startedAt: Date.now(),
    endsAt: Date.now() + Number(session.timeLimit || 30) * 60 * 1000
  };
  saveState();
  renderExamLivePage();
  navigateTo('examlive');
}
window.retryWrongFinalExam = retryWrongFinalExam;

async function retakeFinalExam() {
  const questions = await buildConfiguredExamQuestions();
  if (!questions.length) return;
  const old = getExamSession() || {};
  appState.currentExamSession = {
    ...old,
    type: 'finalExam',
    id: createSessionId(),
    questions,
    questionCount: questions.length,
    requestedQuestionCount: questions.length,
    answers: {},
    flagged: [],
    currentIndex: 0,
    startedAt: Date.now(),
    endsAt: Date.now() + Number(old.timeLimit || appState.examBuilder.timeLimit || 30) * 60 * 1000
  };
  saveState();
  renderExamLivePage();
  navigateTo('examlive');
}
window.retakeFinalExam = retakeFinalExam;

const __oldRenderReviewPage = renderReviewPage;
renderReviewPage = function() {
  if (appState.reviewContext === 'finalExam' && appState.currentExamSession && appState.currentExamSession.type === 'finalExam') return buildFinalExamReviewPage();
  return __oldRenderReviewPage();
};
window.renderReviewPage = renderReviewPage;

const __oldNavigateTo = navigateTo;
navigateTo = function(pageId) {
  __oldNavigateTo(pageId);
  document.body.classList.toggle('exam-guard', canGuardExamInteractions());
  if (pageId === 'examlive') renderExamLivePage();
  if (pageId === 'saved') renderSavedPage();
  if (pageId === 'home') renderDailyChallenge();
  if ((pageId === 'study' || pageId === 'sets') && appState.reviewContext === 'study') {
    clearInterval(examTimerRef);
  }
};
window.navigateTo = navigateTo;
