// ─────────────────────────────────────────────────────────────────────────────
// Pharmacy Nexus frontend logic
// Subjects + topics now read from JSON files without changing the public design
// ─────────────────────────────────────────────────────────────────────────────

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
  selectedTopicId: null
};

const PN_DATA = {
  subjectsIndex: null,
  subjectsMap: new Map(),
  topicsMap: new Map()
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
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
      return {
        iconWrap: 'bg-secondary-container/60 text-on-secondary-container',
        stat: 'text-secondary',
        accent: 'text-secondary',
        pill: 'bg-secondary-container text-on-secondary-container'
      };
    case 'surface':
      return {
        iconWrap: 'bg-surface-container-high text-on-surface',
        stat: 'text-primary',
        accent: 'text-outline',
        pill: 'bg-surface-container text-on-surface-variant'
      };
    default:
      return {
        iconWrap: 'bg-primary-container text-primary-fixed',
        stat: 'text-tertiary',
        accent: 'text-tertiary',
        pill: 'bg-secondary-container text-on-secondary-container'
      };
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
  const heroCount = document.getElementById('hero-subject-count');
  const pageCount = document.getElementById('subjects-available-count');
  const heroQ = document.getElementById('hero-question-count');
  if (heroCount) heroCount.textContent = count;
  if (pageCount) pageCount.textContent = `${count} Subjects Available`;
  if (heroQ) heroQ.textContent = totalQuestions;
}

function selectSubject(subjectId) {
  appState.selectedSubjectId = subjectId;
  appState.selectedTopicId = null;
  saveState();
  renderTopicsPage();
  navigateTo('topics');
}

function selectTopic(subjectId, topicId) {
  appState.selectedSubjectId = subjectId;
  appState.selectedTopicId = topicId;
  saveState();
  navigateTo('sets');
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
        <div class="${badge} px-4 py-1.5 rounded-full">
          <span class="text-xs font-bold tracking-widest uppercase">Foundational</span>
        </div>
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
        <button class="flex items-center gap-2 text-tertiary font-bold hover:text-tertiary-container transition-colors group-hover:translate-x-1 duration-300">
          Open Topics <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </article>`;
}

function buildCompactSubjectCard(subject) {
  const theme = getThemeClasses(subject.theme);
  return `
    <article class="md:col-span-4 bg-surface-container-lowest rounded-xl p-8 relative overflow-hidden group cursor-pointer ambient-shadow ghost-border min-h-[360px] flex flex-col justify-between" onclick="selectSubject('${escapeHtml(subject.id)}')">
      <div class="flex items-start justify-between mb-5">
        <div class="w-11 h-11 rounded-full ${theme.iconWrap} flex items-center justify-center">
          <span class="material-symbols-outlined">${escapeHtml(subject.icon || 'science')}</span>
        </div>
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
  rest.forEach(subject => {
    html += buildCompactSubjectCard(subject);
  });
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

function renderTopicsPage() {
  const subjectId = appState.selectedSubjectId || PN_DATA.subjectsIndex?.subjects?.[0]?.id;
  if (!subjectId) return;
  const subjectMeta = PN_DATA.subjectsMap.get(subjectId);
  if (!subjectMeta) return;
  const subjectData = PN_DATA.topicsMap.get(subjectId) || { topics: [] };
  const topics = [...(subjectData.topics || [])].sort((a, b) => (a.order || 999) - (b.order || 999));

  const breadcrumb = document.querySelector('#page-topics nav');
  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <button onclick="navigateTo('subjects')" class="hover:text-on-primary transition-colors">Subjects</button>
      <span class="material-symbols-outlined text-base">chevron_right</span>
      <span class="text-on-primary font-bold">${escapeHtml(subjectMeta.name)}</span>`;
  }

  const heroTitle = document.querySelector('#page-topics h1');
  const heroDesc = document.querySelector('#page-topics h1 + p');
  const stats = document.querySelectorAll('#page-topics .grid.grid-cols-2.gap-4 .text-3xl.font-black');
  if (heroTitle) heroTitle.textContent = subjectMeta.name;
  if (heroDesc) heroDesc.textContent = subjectMeta.description || '';
  if (stats[0]) stats[0].textContent = topics.length;
  if (stats[1]) stats[1].textContent = Number(subjectMeta.questionsCount || 0);
  if (stats[2]) stats[2].textContent = `${appState.accuracy}%`;

  const topicsWrapper = document.querySelector('#page-topics .flex.flex-col.gap-5');
  if (topicsWrapper) {
    if (!topics.length) {
      topicsWrapper.innerHTML = `
        <article class="group bg-surface-container-lowest rounded-xl p-6 md:p-8 flex flex-col gap-4 items-start relative overflow-hidden">
          <div class="flex items-center gap-3 mb-1">
            <span class="material-symbols-outlined text-outline text-base">info</span>
            <span class="text-xs font-bold uppercase tracking-widest text-outline">No topics yet</span>
          </div>
          <h3 class="text-xl font-extrabold text-primary mb-1">This subject is ready for content</h3>
          <p class="text-on-surface-variant text-sm leading-relaxed">Use the admin page to add the first topic, then it will appear here automatically.</p>
        </article>`;
    } else {
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
              <div class="flex items-center gap-3 mb-3">
                <span class="material-symbols-outlined ${index === 0 ? 'text-secondary' : 'text-outline'} text-base" style="font-variation-settings:'FILL' 1">${index === 0 ? 'check_circle' : 'menu_book'}</span>
                <span class="text-xs font-bold uppercase tracking-widest ${statusAccent}">${statusLabel}</span>
                <span class="px-2.5 py-0.5 bg-surface-container rounded-full text-xs font-bold text-primary">${total} Questions</span>
              </div>
              <h3 class="text-xl font-extrabold text-primary mb-2">${escapeHtml(topic.name)}</h3>
              <p class="text-on-surface-variant text-sm leading-relaxed mb-4">${escapeHtml(topic.description || '')}</p>
              <div class="flex flex-wrap gap-2">
                <span class="px-3 py-1 bg-surface-container-low text-primary rounded-lg text-xs font-bold border border-outline-variant/15">Easy ${easy}</span>
                <span class="px-3 py-1 bg-surface-container-low text-primary rounded-lg text-xs font-bold border border-outline-variant/15">Medium ${medium}</span>
                <span class="px-3 py-1 bg-surface-container-low text-primary rounded-lg text-xs font-bold border border-outline-variant/15">Hard ${hard}</span>
              </div>
            </div>
            <div class="w-full md:w-auto flex items-center md:items-end gap-4 pl-2">
              <button class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-on-primary-fixed transition-colors flex items-center gap-2">
                Open Topic <span class="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          </article>`;
      }).join('');
    }
  }
}

function spinWheel() {
  const list = PN_DATA.subjectsIndex?.subjects || [];
  if (!list.length || spinWheel.spinning) return;
  spinWheel.spinning = true;
  const wheel = document.getElementById('daily-wheel');
  const label = document.getElementById('daily-subject');
  wheel?.classList.add('spin-animation');
  let tick = 0;
  const interval = setInterval(() => {
    if (label) label.textContent = list[tick % list.length].name;
    tick += 1;
  }, 120);
  setTimeout(() => {
    clearInterval(interval);
    const chosen = list[Math.floor(Math.random() * list.length)];
    if (label) label.textContent = `🎯 ${chosen.name} — Today's Focus`;
    document.getElementById('lucky-n') && (document.getElementById('lucky-n').textContent = String(Math.floor(Math.random() * 15) + 3));
    wheel?.classList.remove('spin-animation');
    spinWheel.spinning = false;
  }, 2000);
}
window.spinWheel = spinWheel;

let answered = false;
let correctCount = 0;
let wrongCount = 7;
let questionIndex = 8;

function selectAnswer(label, isCorrect) {
  if (answered) return;
  answered = true;
  document.querySelectorAll('.answer-option').forEach(o => {
    o.onclick = null;
    o.classList.remove('answer-idle');
    o.style.pointerEvents = 'none';
  });
  if (isCorrect) {
    label.classList.add('answer-correct');
    document.getElementById('correct-check')?.classList.remove('opacity-0');
    document.getElementById('correct-count') && (document.getElementById('correct-count').textContent = ++correctCount);
  } else {
    label.classList.add('answer-wrong');
    document.querySelectorAll('.answer-option').forEach(o => {
      if (o.querySelector('div')?.textContent.trim() === 'B') o.classList.add('answer-correct');
    });
    document.getElementById('wrong-count') && (document.getElementById('wrong-count').textContent = ++wrongCount);
  }
  document.getElementById('study-explanation')?.classList.remove('hidden');
}
window.selectAnswer = selectAnswer;

function nextQuestion() {
  answered = false;
  questionIndex += 1;
  if (questionIndex > 30) {
    navigateTo('review');
    return;
  }
  document.getElementById('study-q-counter') && (document.getElementById('study-q-counter').textContent = `${questionIndex} of 30`);
  const pct = Math.round((questionIndex / 30) * 100);
  document.getElementById('study-progress') && (document.getElementById('study-progress').style.width = `${pct}%`);
  const allOptions = document.querySelectorAll('.answer-option');
  allOptions.forEach(o => {
    o.classList.remove('answer-correct', 'answer-wrong');
    o.classList.add('answer-idle');
    o.style.pointerEvents = '';
  });
  document.getElementById('study-explanation')?.classList.add('hidden');
  document.getElementById('correct-check')?.classList.add('opacity-0');
  bindStudyOptions();
}
window.nextQuestion = nextQuestion;

function bindStudyOptions() {
  const opts = document.querySelectorAll('.answer-option');
  if (opts.length < 4) return;
  opts.forEach(o => {
    const clone = o.cloneNode(true);
    o.parentNode.replaceChild(clone, o);
  });
  const fresh = document.querySelectorAll('.answer-option');
  fresh[0]?.addEventListener('click', function() { selectAnswer(this, false); });
  fresh[1]?.addEventListener('click', function() { selectAnswer(this, true); });
  fresh[2]?.addEventListener('click', function() { selectAnswer(this, false); });
  fresh[3]?.addEventListener('click', function() { selectAnswer(this, false); });
}

function toggleSave() {
  appState.savedQuestion = !appState.savedQuestion;
  appState.savedQuestions = appState.savedQuestion
    ? Math.max(appState.savedQuestions, DEFAULT_STATE.savedQuestions + 1)
    : Math.max(DEFAULT_STATE.savedQuestions, appState.savedQuestions - 1);
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
  if (pw === configured) {
    window.location.href = 'admin.html';
  } else if (pw !== null) {
    window.alert('Wrong password');
  }
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === '9' || e.code === 'Digit9')) {
    e.preventDefault();
    openHiddenAdmin();
  }
});

async function loadSubjectsIndex() {
  try {
    const index = await fetchJson('data/subjects/index.json');
    const subjects = [...(index.subjects || [])].sort((a, b) => (a.order || 999) - (b.order || 999));
    PN_DATA.subjectsIndex = { ...index, subjects };
    subjects.forEach(subject => PN_DATA.subjectsMap.set(subject.id, subject));

    await Promise.all(subjects.map(async subject => {
      try {
        const subjectJson = await fetchJson(subject.file);
        PN_DATA.topicsMap.set(subject.id, subjectJson);
        if (!subject.topicsCount) subject.topicsCount = (subjectJson.topics || []).length;
        if (!subject.questionsCount) {
          subject.questionsCount = (subjectJson.topics || []).reduce((sum, topic) => sum + Number(topic.questionsCount || 0), 0);
        }
      } catch {
        PN_DATA.topicsMap.set(subject.id, { topics: [] });
      }
    }));

    setSubjectStats(subjects);
    renderHomeSubjects(subjects);
    renderSubjectsPage(subjects);
    renderTopicsPage();
  } catch (error) {
    console.error(error);
  }
}

window.selectSubject = selectSubject;
window.selectTopic = selectTopic;

window.addEventListener('DOMContentLoaded', async () => {
  renderPersistentStats();
  bindNotes();
  bindSavedSearch();
  bindStudyOptions();
  if (appState.savedQuestion) {
    const btn = document.getElementById('save-btn');
    const icon = btn?.querySelector('.material-symbols-outlined');
    if (btn && icon) {
      icon.style.fontVariationSettings = "'FILL' 1";
      btn.classList.add('text-tertiary');
      btn.classList.remove('text-on-surface-variant');
    }
  }
  await loadSubjectsIndex();
  navigateTo(appState.currentPage || 'home');
});
