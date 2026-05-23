
(function () {
  function esc(value) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function niceName(name) {
    const value = String(name || '').trim();
    const compact = value.toLowerCase().replace(/[\s_-]+/g, '');
    if (compact === 'biochemictry' || compact === 'biochemstry' || compact === 'biochemitry') return 'Biochemistry';
    return value || 'Subject';
  }

  function totalQuestions(subjects) {
    return subjects.reduce((sum, s) => sum + Number(s.questionsCount || 0), 0);
  }

  function getSubjectProgress(subject) {
    try {
      const subjectTopics = window.PN_DATA?.topicsMap?.get(subject.id)?.topics || [];
      const topicIds = subjectTopics.map(t => t.id || (window.slugify ? window.slugify(t.name || '') : String(t.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')));
      let answered = 0;
      let correct = 0;
      topicIds.forEach(id => {
        const map = window.appState?.studyResults?.[id] || {};
        Object.values(map).forEach(v => {
          answered += 1;
          if ((v && typeof v === 'object' && v.correct === true) || v === true) correct += 1;
        });
      });
      const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
      const questionCount = Number(subject.questionsCount || 0);
      const progress = questionCount ? Math.min(100, Math.round((answered / questionCount) * 100)) : 0;
      return { answered, correct, accuracy, progress };
    } catch (_) {
      return { answered: 0, correct: 0, accuracy: 0, progress: 0 };
    }
  }

  function themeLabel(subject, index) {
    const labels = ['Core module', 'Exam route', 'Knowledge bank', 'Applied practice', 'Foundational'];
    if (subject.theme === 'secondary') return 'Applied track';
    if (subject.theme === 'surface') return 'Reference track';
    return labels[index % labels.length];
  }

  function subjectCard(subject, index) {
    const name = niceName(subject.name);
    const topics = Number(subject.topicsCount || 0);
    const questions = Number(subject.questionsCount || 0);
    const stats = getSubjectProgress(subject);
    const featured = index === 0;
    const icon = esc(subject.icon || (index % 2 ? 'biotech' : 'science'));
    const desc = esc(subject.description || 'Structured exam-style practice with topic sets, review, and saved knowledge.');
    return `
      <article class="pn-v8-subject-card ${featured ? 'featured' : 'compact'}" data-subject-name="${esc(name.toLowerCase())}" onclick="selectSubject('${esc(subject.id)}')">
        <div class="pn-v8-card-art" aria-hidden="true"></div>
        <div class="pn-v8-card-inner">
          <div class="pn-v8-card-head">
            <div class="pn-v8-icon"><span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">${icon}</span></div>
            <span class="pn-v8-chip">${esc(themeLabel(subject, index))}</span>
          </div>
          <div>
            <h2 class="pn-v8-card-title">${esc(name)}</h2>
            <p class="pn-v8-card-copy">${desc}</p>
            <div class="pn-v8-progress-wrap">
              <div class="pn-v8-progress-info"><span>${stats.answered} answered</span><span>${stats.accuracy}% accuracy</span></div>
              <div class="pn-v8-progress"><i style="--w:${stats.progress}%"></i></div>
            </div>
          </div>
          <div class="pn-v8-card-footer">
            <div class="pn-v8-metrics">
              <div class="pn-v8-metric"><b>${topics}</b><span>Topics</span></div>
              <div class="pn-v8-metric"><b>${questions}</b><span>Questions</span></div>
              <div class="pn-v8-metric"><b>${stats.progress}%</b><span>Progress</span></div>
            </div>
            <div class="pn-v8-open" aria-hidden="true"><span class="material-symbols-outlined">arrow_forward</span></div>
          </div>
        </div>
      </article>`;
  }

  function renderSubjectsHero(subjects) {
    const oldHero = document.querySelector('#page-subjects section');
    if (!oldHero || oldHero.classList.contains('pn-v8-subjects-hero')) return;
    const subjectCount = subjects.length;
    const qCount = totalQuestions(subjects);
    oldHero.className = 'pn-v8-subjects-hero';
    oldHero.innerHTML = `
      <div class="pn-v8-hero-grid">
        <div>
          <span class="pn-v8-eyebrow"><span class="material-symbols-outlined text-sm">view_in_ar</span> Curriculum command center</span>
          <h1 class="pn-v8-hero-title">Choose the module. Build the mastery.</h1>
          <p class="pn-v8-hero-copy">A cleaner subject library for Pharmacy Nexus: every subject feels like a focused learning route with topics, progress, saved knowledge, and final-exam readiness.</p>
          <div class="pn-v8-hero-actions">
            <button class="pn-v8-btn-primary" onclick="document.getElementById('subject-search')?.focus()">Search subjects <span class="material-symbols-outlined text-base">search</span></button>
            <button class="pn-v8-btn-ghost" onclick="navigateTo('finalexam')">Build final exam <span class="material-symbols-outlined text-base">school</span></button>
          </div>
          <div class="pn-v8-hero-stats">
            <span class="pn-v8-hero-stat"><strong>${subjectCount}</strong>subjects</span>
            <span class="pn-v8-hero-stat"><strong>${qCount}</strong>questions</span>
            <span class="pn-v8-hero-stat"><strong>local</strong>progress</span>
          </div>
        </div>
        <div class="pn-v8-hero-stage" aria-hidden="true">
          <div class="pn-v8-orbit-ring"></div>
          <div class="pn-v8-float-card one">Smart routing<span>weak topics first</span></div>
          <div class="pn-v8-float-card two">Exam-ready<span>sets → review → final</span></div>
          <div class="pn-v8-product-board">
            <div class="pn-v8-board-top"><div class="pn-v8-lights"><i></i><i></i><i></i></div><div class="pn-v8-board-label">Pharmacy Nexus · Subjects</div></div>
            <div class="pn-v8-board-body">
              <div class="pn-v8-board-panel"><small>Current route</small><h3>${esc(niceName(subjects[0]?.name || 'Pharmacology'))}</h3><div class="pn-v8-board-lines"><span></span><span></span><span></span></div></div>
              <div class="pn-v8-board-side"><div class="pn-v8-board-mini"><small>Topics</small><b>${Number(subjects[0]?.topicsCount || 0)}</b></div><div class="pn-v8-board-mini"><small>Questions</small><b>${Number(subjects[0]?.questionsCount || 0)}</b></div></div>
              <div class="pn-v8-board-wide"><p>Open a subject, move through focused sets, then rescue weak points before the final exam.</p><button>Continue</button></div>
            </div>
          </div>
        </div>
      </div>`;

    const wrap = document.createElement('div');
    wrap.className = 'pn-v8-toolbelt';
    wrap.innerHTML = `
      <article class="pn-v8-tool"><span class="material-symbols-outlined">route</span><div><h3>Learning routes</h3><p>Subject → topic → set</p></div></article>
      <article class="pn-v8-tool"><span class="material-symbols-outlined">analytics</span><div><h3>Progress signals</h3><p>Accuracy and answered count</p></div></article>
      <article class="pn-v8-tool"><span class="material-symbols-outlined">bookmark</span><div><h3>Saved knowledge</h3><p>Notes and flagged ideas</p></div></article>
      <article class="pn-v8-tool"><span class="material-symbols-outlined">school</span><div><h3>Exam bridge</h3><p>Practice feeds final readiness</p></div></article>`;
    oldHero.insertAdjacentElement('afterend', wrap);
  }

  function renderSubjectsPageV8(subjects = []) {
    const grid = document.getElementById('subjects-grid');
    if (!grid) return;
    const sorted = [...subjects].sort((a, b) => (a.order || 999) - (b.order || 999));
    renderSubjectsHero(sorted);
    if (!sorted.length) {
      grid.innerHTML = '<div class="pn-v8-roadmap-panel" style="grid-column:1/-1"><span class="pn-v8-panel-kicker">Empty library</span><h2>No subjects found yet.</h2><p>Add subjects to your JSON index and they will appear here automatically.</p></div>';
      return;
    }
    const cards = sorted.map(subjectCard).join('');
    grid.innerHTML = `
      ${cards}
      <section class="pn-v8-library-panel">
        <span class="pn-v8-panel-kicker">Library engine</span>
        <h2>Content can grow without redesigning the UI.</h2>
        <p>Keep adding subjects, topics, and JSON question files. This page stays modular and automatically adapts to your available content.</p>
        <div class="pn-v8-code-pill">data/index.json → subject/meta.json → topic question pools</div>
      </section>
      <section class="pn-v8-roadmap-panel">
        <span class="pn-v8-panel-kicker">Student flow</span>
        <h2>Make every subject feel like a plan, not a list.</h2>
        <p>The subject page now guides students toward the right action: open a module, continue sets, save notes, and then go to final exam mode.</p>
        <div class="pn-v8-steps">
          <div class="pn-v8-step"><b>01</b><span>Pick a subject</span></div>
          <div class="pn-v8-step"><b>02</b><span>Complete focused sets</span></div>
          <div class="pn-v8-step"><b>03</b><span>Review mistakes</span></div>
          <div class="pn-v8-step"><b>04</b><span>Simulate final exam</span></div>
        </div>
      </section>`;
  }

  function filterSubjectsV8(q) {
    const query = String(q || '').trim().toLowerCase();
    document.querySelectorAll('#subjects-grid .pn-v8-subject-card').forEach(card => {
      const show = !query || card.textContent.toLowerCase().includes(query) || (card.dataset.subjectName || '').includes(query);
      card.style.display = show ? '' : 'none';
    });
  }

  window.renderSubjectsPage = renderSubjectsPageV8;
  window.filterSubjects = filterSubjectsV8;
})();
