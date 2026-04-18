// ─── Router ───────────────────────────────────────────────────────────────────
const pages = ['home','subjects','topics','sets','study','review','dashboard','finalexam','examlive','saved'];
const navIds = ['home','subjects','dashboard','saved','finalexam'];

function navigateTo(pageId) {
  // Hide all pages
  pages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) { el.classList.remove('active'); el.classList.add('page'); }
  });
  // Show target
  const target = document.getElementById('page-' + pageId);
  if (target) { target.classList.add('active', 'fade-in'); target.classList.remove('page'); }
  // Update sidebar active nav
  navIds.forEach(id => {
    const navEl = document.getElementById('nav-' + id);
    if (navEl) navEl.classList.remove('active');
  });
  if (document.getElementById('nav-' + pageId)) {
    document.getElementById('nav-' + pageId).classList.add('active');
  }
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Daily Challenge Spinner ──────────────────────────────────────────────────
const subjects = ['Pharmacology', 'Pharmaceutics', 'Clinical Pharmacy'];
let spinning = false;
function spinWheel() {
  if (spinning) return;
  spinning = true;
  const wheel = document.getElementById('daily-wheel');
  wheel.classList.add('spin-animation');
  let tick = 0, interval = setInterval(() => {
    document.getElementById('daily-subject').textContent = subjects[tick % subjects.length];
    tick++;
  }, 120);
  setTimeout(() => {
    clearInterval(interval);
    const chosen = subjects[Math.floor(Math.random() * subjects.length)];
    document.getElementById('daily-subject').textContent = '🎯 ' + chosen + ' — Today\'s Focus';
    const lucky = Math.floor(Math.random() * 15) + 3;
    document.getElementById('lucky-n').textContent = lucky;
    wheel.classList.remove('spin-animation');
    spinning = false;
  }, 2000);
}

// ─── Study Session Interaction ────────────────────────────────────────────────
let answered = false;
let correctCount = 0;
let wrongCount = 7;
let questionIndex = 8;

function selectAnswer(label, isCorrect) {
  if (answered) return;
  answered = true;
  const allOptions = document.querySelectorAll('.answer-option');
  allOptions.forEach(o => {
    o.onclick = null;
    o.classList.remove('answer-idle');
    o.style.pointerEvents = 'none';
  });
  if (isCorrect) {
    label.classList.add('answer-correct');
    document.getElementById('correct-check').classList.remove('opacity-0');
    document.getElementById('correct-count').textContent = ++correctCount;
  } else {
    label.classList.add('answer-wrong');
    // Highlight correct (option B)
    const opts = document.querySelectorAll('.answer-option');
    opts.forEach(o => {
      if (o.querySelector('div')?.textContent.trim() === 'B') {
        o.classList.add('answer-correct');
      }
    });
    document.getElementById('wrong-count').textContent = ++wrongCount;
  }
  // Show explanation
  const exp = document.getElementById('study-explanation');
  if (exp) { exp.classList.remove('hidden'); }
}

function nextQuestion() {
  answered = false;
  questionIndex++;
  if (questionIndex > 30) { navigateTo('review'); return; }
  document.getElementById('study-q-counter').textContent = questionIndex + ' of 30';
  const pct = Math.round((questionIndex / 30) * 100);
  document.getElementById('study-progress').style.width = pct + '%';
  // Reset options
  const allOptions = document.querySelectorAll('.answer-option');
  allOptions.forEach(o => {
    o.classList.remove('answer-correct', 'answer-wrong');
    o.classList.add('answer-idle');
    o.style.pointerEvents = '';
    o.onclick = function() {};
  });
  const exp = document.getElementById('study-explanation');
  if (exp) exp.classList.add('hidden');
  document.getElementById('correct-check').classList.add('opacity-0');
  // Re-bind
  const opts = document.querySelectorAll('.answer-option');
  opts[0]?.addEventListener('click', function() { selectAnswer(this, false); });
  opts[1]?.addEventListener('click', function() { selectAnswer(this, true); });
  opts[2]?.addEventListener('click', function() { selectAnswer(this, false); });
  opts[3]?.addEventListener('click', function() { selectAnswer(this, false); });
}

// ─── Save Toggle ──────────────────────────────────────────────────────────────
let saved = false;
function toggleSave() {
  saved = !saved;
  const btn = document.getElementById('save-btn');
  if (btn) {
    const icon = btn.querySelector('.material-symbols-outlined');
    if (icon) {
      icon.style.fontVariationSettings = saved ? "'FILL' 1" : "'FILL' 0";
      btn.classList.toggle('text-tertiary', saved);
      btn.classList.toggle('text-on-surface-variant', !saved);
    }
  }
}

// ─── Subject Search ────────────────────────────────────────────────────────────
function filterSubjects(q) {
  // Simple visual filter - in a real app would filter the grid
  const grid = document.getElementById('subjects-grid');
  if (!grid) return;
  const articles = grid.querySelectorAll('article');
  articles.forEach(a => {
    const text = a.textContent.toLowerCase();
    a.style.opacity = (!q || text.includes(q.toLowerCase())) ? '1' : '0.3';
  });
}

// ─── Saved Tabs ───────────────────────────────────────────────────────────────
function filterSaved(type, btn) {
  const buttons = btn.parentElement.querySelectorAll('button');
  buttons.forEach(b => { b.className = 'px-4 py-2 rounded-lg text-on-surface-variant font-bold text-sm hover:bg-white/50 transition-colors'; });
  btn.className = 'px-4 py-2 rounded-lg bg-primary text-on-primary font-bold text-sm';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  navigateTo('home');
  // Bind study options on load
  const opts = document.querySelectorAll('.answer-option');
  if (opts.length >= 4) {
    opts[0].addEventListener('click', function() { selectAnswer(this, false); });
    opts[1].addEventListener('click', function() { selectAnswer(this, true); });
    opts[2].addEventListener('click', function() { selectAnswer(this, false); });
    opts[3].addEventListener('click', function() { selectAnswer(this, false); });
  }
});

// ─── Local persistence layer ─────────────────────────────────────────────────
const STORAGE_KEY = 'pharmacyNexusState';
const DEFAULT_STATE = {
  currentPage: 'home',
  savedQuestion: false,
  notes: [],
  finalExamsDone: 2,
  accuracy: 6,
  savedQuestions: 12,
  personalNotes: 4
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_STATE };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {}
}

let appState = loadState();

function renderPersistentStats() {
  const homeAccuracy = document.getElementById('home-accuracy');
  if (homeAccuracy) homeAccuracy.textContent = `${appState.accuracy}%`;

  const homeSaved = document.getElementById('home-saved-count');
  if (homeSaved) homeSaved.textContent = appState.savedQuestions;

  const homeNotes = document.getElementById('home-notes-count');
  if (homeNotes) homeNotes.textContent = appState.personalNotes;

  const homeExams = document.getElementById('home-final-exams-count');
  if (homeExams) homeExams.textContent = appState.finalExamsDone;

  const savedBadge = document.getElementById('saved-count-badge');
  if (savedBadge) savedBadge.textContent = `${appState.savedQuestions} Saved Questions`;

  const notesBadge = document.getElementById('notes-count-badge');
  if (notesBadge) notesBadge.textContent = `${appState.personalNotes} Personal Notes`;
}

// Patch navigation to persist last page without changing design
const originalNavigateTo = navigateTo;
navigateTo = function(pageId) {
  originalNavigateTo(pageId);
  appState.currentPage = pageId;
  saveState();
};

// Patch save toggle to persist across reloads
const originalToggleSave = toggleSave;
toggleSave = function() {
  originalToggleSave();
  appState.savedQuestion = !appState.savedQuestion;
  appState.savedQuestions = appState.savedQuestion ? Math.max(appState.savedQuestions, 13) : Math.max(DEFAULT_STATE.savedQuestions, appState.savedQuestions - 1);
  saveState();
  renderPersistentStats();
};

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

  document.querySelectorAll('[data-saved-item="true"] .border-2.border-dashed').forEach((btn, idx) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const note = window.prompt('Add a clinical insight note:');
      if (!note || !note.trim()) return;
      appState.notes.push({ text: note.trim(), item: idx + 1, createdAt: new Date().toISOString() });
      appState.personalNotes = Math.max(DEFAULT_STATE.personalNotes, appState.notes.length + DEFAULT_STATE.personalNotes);
      saveState();
      renderPersistentStats();
      btn.querySelector('span.text-sm') && (btn.querySelector('span.text-sm').textContent = 'Note Added');
    });
  });
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

// Re-run our bindings after DOM load
window.addEventListener('DOMContentLoaded', () => {
  renderPersistentStats();
  bindNotes();
  bindSavedSearch();
  if (appState.savedQuestion) {
    const btn = document.getElementById('save-btn');
    const icon = btn?.querySelector('.material-symbols-outlined');
    if (btn && icon) {
      icon.style.fontVariationSettings = "'FILL' 1";
      btn.classList.add('text-tertiary');
      btn.classList.remove('text-on-surface-variant');
    }
  }
  if (appState.currentPage) {
    originalNavigateTo(appState.currentPage);
  }
});


// ─── Hidden admin entry + lightweight data sync ─────────────────────────────
const PN_DATA = {
  subjectsIndex: null
};

async function loadSubjectsIndex() {
  try {
    const res = await fetch('data/subjects/index.json', { cache: 'no-store' });
    if (!res.ok) return;
    PN_DATA.subjectsIndex = await res.json();
    const count = PN_DATA.subjectsIndex.subjects?.length || 0;
    const hero = document.getElementById('hero-subject-count');
    const pageCount = document.getElementById('subjects-available-count');
    if (hero) hero.textContent = count;
    if (pageCount) pageCount.textContent = `${count} Subjects Available`;
  } catch (e) {}
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

window.addEventListener('DOMContentLoaded', () => {
  loadSubjectsIndex();
});
