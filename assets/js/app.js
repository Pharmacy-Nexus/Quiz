const pages = ['home','subjects','topics','sets','study','review','dashboard','finalexam','examlive','saved'];
const navIds = ['home','subjects','dashboard','saved','finalexam'];
const STORAGE_KEY = 'pharmacyNexusState';
const DEFAULT_STATE = {
  currentPage: 'home',
  savedQuestion: false,
  notes: [],
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
  studyResults: {}
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

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch {}
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

function renderPersistentStats() {
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
  appState.currentQuestionIndex = 0;
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
  appState.currentQuestionIndex = 0;
  saveState();
  renderStudyQuestion();
  navigateTo('study');
}
window.startSet = startSet;

function getCurrentSetQuestions() {
  const chunks = getCurrentTopicQuestionChunks();
  return chunks[appState.currentSetIndex] || [];
}

function renderStudyQuestion() {
  const meta = appState.currentTopicMeta;
  const setQuestions = getCurrentSetQuestions();
  const q = setQuestions[appState.currentQuestionIndex];
  if (!meta || !q) {
    navigateTo('sets');
    return;
  }
  const total = setQuestions.length;
  const humanIndex = appState.currentQuestionIndex + 1;
  const pct = Math.round((humanIndex / total) * 100);
  const results = appState.studyResults?.[meta.id] || {};
  const correctCount = Object.values(results).filter(Boolean).length;
  const wrongCount = Object.values(results).filter(v => v === false).length;

  document.getElementById('study-header-topic') && (document.getElementById('study-header-topic').textContent = `${meta.name} • Set ${appState.currentSetIndex + 1}`);
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
  const wasAnswered = results[q.id] !== undefined;
  const optionsWrap = document.getElementById('study-options');
  if (optionsWrap) {
    optionsWrap.innerHTML = options.map((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const isCorrect = idx === Number(q.correctAnswer);
      const answeredClass = !wasAnswered ? '' : (isCorrect ? 'answer-correct' : (results[q.id] === false && idx === Number(q.userChoice) ? 'answer-wrong' : ''));
      const pointerClass = wasAnswered ? 'pointer-events-none' : 'cursor-pointer';
      const check = wasAnswered && isCorrect ? `<div class="ml-3 flex items-center justify-center text-secondary mt-1"><span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">check_circle</span></div>` : '';
      return `<label class="answer-option answer-idle group relative flex items-start p-5 rounded-xl bg-surface-container-low hover:bg-surface-container-lowest transition-all ${pointerClass} border border-transparent ${answeredClass}" onclick="selectAnswer(${idx})"><div class="flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-lg bg-surface text-on-surface-variant font-headline font-bold mr-4 group-hover:bg-primary-fixed group-hover:text-primary transition-colors">${letter}</div><div class="flex-1 pt-1 text-on-surface leading-relaxed">${escapeHtml(opt)}</div>${check}</label>`;
    }).join('') + `<div id="study-explanation" class="${wasAnswered ? '' : 'hidden'} bg-surface-container-low rounded-xl p-6 relative overflow-hidden"><div class="absolute -right-8 -top-8 w-32 h-32 bg-tertiary-fixed/20 rounded-full blur-3xl pointer-events-none"></div><div class="flex items-center gap-2 mb-3"><span class="material-symbols-outlined text-tertiary text-lg">school</span><h3 class="text-xs font-bold text-primary uppercase tracking-widest">Clinical Rationale</h3></div><p class="text-sm text-on-surface-variant leading-relaxed mb-3">${escapeHtml(q.explanation || 'No explanation added yet.')}</p></div>`;
  }

  document.getElementById('study-prev-btn')?.toggleAttribute('disabled', appState.currentQuestionIndex === 0);
  document.getElementById('study-prev-btn')?.classList.toggle('opacity-50', appState.currentQuestionIndex === 0);
  document.getElementById('study-next-btn') && (document.getElementById('study-next-btn').innerHTML = `${appState.currentQuestionIndex === total - 1 ? 'Finish Set' : 'Next Question'} <span class="material-symbols-outlined text-sm">arrow_forward</span>`);
}

function selectAnswer(optionIndex) {
  const meta = appState.currentTopicMeta;
  const q = getCurrentSetQuestions()[appState.currentQuestionIndex];
  if (!meta || !q) return;
  appState.studyResults = appState.studyResults || {};
  appState.studyResults[meta.id] = appState.studyResults[meta.id] || {};
  if (appState.studyResults[meta.id][q.id] === undefined) {
    const isCorrect = Number(optionIndex) === Number(q.correctAnswer);
    appState.studyResults[meta.id][q.id] = isCorrect;
    q.userChoice = Number(optionIndex);
    saveState();
    renderStudyQuestion();
  }
}
window.selectAnswer = selectAnswer;

function nextQuestion() {
  const setQuestions = getCurrentSetQuestions();
  if (appState.currentQuestionIndex < setQuestions.length - 1) {
    appState.currentQuestionIndex += 1;
    saveState();
    renderStudyQuestion();
  } else {
    window.alert('Set complete. Returning to topic sets.');
    renderSetsPage();
    navigateTo('sets');
  }
}
window.nextQuestion = nextQuestion;

function previousQuestion() {
  if (appState.currentQuestionIndex > 0) {
    appState.currentQuestionIndex -= 1;
    saveState();
    renderStudyQuestion();
  }
}
window.previousQuestion = previousQuestion;

function toggleSave() {
  appState.savedQuestion = !appState.savedQuestion;
  appState.savedQuestions = appState.savedQuestion ? Math.max(appState.savedQuestions, DEFAULT_STATE.savedQuestions + 1) : Math.max(DEFAULT_STATE.savedQuestions, appState.savedQuestions - 1);
  saveState();
  const btn = document.getElementById('save-btn');
  const icon = btn?.querySelector('.material-symbols-outlined');
  if (btn && icon) {
    icon.style.fontVariationSettings = appState.savedQuestion ? "'FILL' 1" : "'FILL' 0";
    btn.classList.toggle('text-tertiary', appState.savedQuestion);
    btn.classList.toggle('text-on-surface-variant', !appState.savedQuestion);
  }
  renderPersistentStats();
}
window.toggleSave = toggleSave;

function filterSaved(type, btn) {
  const buttons = btn.parentElement.querySelectorAll('button');
  buttons.forEach(b => { b.className = 'px-4 py-2 rounded-lg text-on-surface-variant font-bold text-sm hover:bg-white/50 transition-colors'; });
  btn.className = 'px-4 py-2 rounded-lg bg-primary text-on-primary font-bold text-sm';
}
window.filterSaved = filterSaved;

function bindNotes() {
  const noteBtn = document.getElementById('note-btn');
  if (noteBtn && !noteBtn.dataset.bound) {
    noteBtn.dataset.bound = 'true';
    noteBtn.addEventListener('click', () => {
      const note = window.prompt('Add a quick note for this question:');
      if (!note || !note.trim()) return;
      appState.notes.push({ text: note.trim(), createdAt: new Date().toISOString() });
      appState.personalNotes = Math.max(DEFAULT_STATE.personalNotes, appState.notes.length + DEFAULT_STATE.personalNotes);
      saveState();
      renderPersistentStats();
      noteBtn.classList.add('text-tertiary');
      noteBtn.classList.remove('text-on-surface-variant');
    });
  }
}

function bindSavedSearch() {
  const input = document.getElementById('saved-search');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = 'true';
  input.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('[data-saved-item="true"]').forEach(card => {
      const show = !q || card.textContent.toLowerCase().includes(q);
      card.style.display = show ? '' : 'none';
    });
  });
}

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

async function loadSubjectsIndex() {
  const index = await fetchJson('data/subjects/index.json');
  const subjects = [...(index.subjects || [])].sort((a, b) => (a.order || 999) - (b.order || 999));
  PN_DATA.subjectsIndex = { ...index, subjects };
  subjects.forEach(subject => PN_DATA.subjectsMap.set(subject.id, subject));

  await Promise.all(subjects.map(async subject => {
    try {
      const subjectJson = await fetchJson(subject.file);
      PN_DATA.topicsMap.set(subject.id, subjectJson);
      subject.topicsCount = (subjectJson.topics || []).length;
      subject.questionsCount = (subjectJson.topics || []).reduce((sum, topic) => sum + Number(topic.questionsCount || 0), 0);
    } catch {
      PN_DATA.topicsMap.set(subject.id, { topics: [] });
    }
  }));

  setSubjectStats(subjects);
  renderHomeSubjects(subjects);
  renderSubjectsPage(subjects);
  bindTopicSearch();
  renderTopicsPage();
}

window.addEventListener('DOMContentLoaded', async () => {
  renderPersistentStats();
  bindNotes();
  bindSavedSearch();
  document.getElementById('study-prev-btn')?.addEventListener('click', previousQuestion);
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
});
