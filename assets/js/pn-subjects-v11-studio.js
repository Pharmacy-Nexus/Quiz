(function () {
  function esc(value) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cleanName(name) {
    const value = String(name || '').trim();
    const compact = value.toLowerCase().replace(/[\s_-]+/g, '');
    if (['biochemictry','biochemstry','biochemitry'].includes(compact)) return 'Biochemistry';
    return value || 'Subject';
  }

  function totalQuestions(subjects) {
    return subjects.reduce((sum, s) => sum + Number(s.questionsCount || 0), 0);
  }

  function totalTopics(subjects) {
    return subjects.reduce((sum, s) => sum + Number(s.topicsCount || 0), 0);
  }

  function iconFor(subject, index) {
    if (subject.icon) return subject.icon;
    const name = cleanName(subject.name).toLowerCase();
    if (name.includes('pharmaco')) return 'science';
    if (name.includes('bio')) return 'biotech';
    if (name.includes('clinical')) return 'medical_services';
    if (name.includes('pharmaceut')) return 'medication_liquid';
    return ['experiment','menu_book','psychology','school'][index % 4];
  }

  function routeLabel(subject, index) {
    const name = cleanName(subject.name).toLowerCase();
    if (name.includes('clinical')) return 'Applied patient-care track';
    if (name.includes('pharmaco')) return 'Core mechanism track';
    if (name.includes('bio')) return 'Foundation science track';
    if (name.includes('pharmaceut')) return 'Formulation science track';
    return ['Licensure route', 'Core study route', 'Reference route'][index % 3];
  }

  function subjectProgress(subject) {
    try {
      const subjectTopics = window.PN_DATA?.topicsMap?.get(subject.id)?.topics || [];
      let answered = 0;
      let correct = 0;
      subjectTopics.forEach(topic => {
        const topicId = topic.id || (window.slugify ? window.slugify(topic.name || '') : String(topic.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        const map = window.appState?.studyResults?.[topicId] || {};
        Object.values(map).forEach(item => {
          answered += 1;
          if (item === true || (item && typeof item === 'object' && item.correct === true)) correct += 1;
        });
      });
      const questions = Number(subject.questionsCount || 0);
      const progress = questions ? Math.min(100, Math.round((answered / questions) * 100)) : 0;
      const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
      return { answered, correct, progress, accuracy };
    } catch (_) {
      return { answered: 0, correct: 0, progress: 0, accuracy: 0 };
    }
  }

  function renderHero(subjects) {
    const host = document.querySelector('#page-subjects section');
    if (!host || host.classList.contains('pn-v11-subjects-hero')) return;
    const count = subjects.length;
    const qCount = totalQuestions(subjects);
    const tCount = totalTopics(subjects);
    const first = subjects[0] || {};
    host.className = 'pn-v11-subjects-hero';
    host.innerHTML = `
      <div class="pn-v11-hero-copy">
        <span class="pn-v11-eyebrow"><span class="material-symbols-outlined">auto_awesome</span> Subject Library</span>
        <h1>Pick a module. Start a real study route.</h1>
        <p>Browse your pharmacy subjects, search instantly, then move into topic sets, saved notes, weak-area review, and final exam practice.</p>
        <div class="pn-v11-searchbar">
          <span class="material-symbols-outlined">search</span>
          <input id="subject-search" type="text" placeholder="Search Pharmacology, Biochemistry, Clinical..." oninput="filterSubjects(this.value)" autocomplete="off" />
          <button type="button" onclick="document.getElementById('subject-search')?.focus()">Search</button>
        </div>
        <div class="pn-v11-filter-row" aria-label="Subject quick filters">
          <button type="button" class="active" data-pn-filter="all" onclick="pnSubjectQuickFilter('all', this)">All modules</button>
          <button type="button" data-pn-filter="content" onclick="pnSubjectQuickFilter('content', this)">Has content</button>
          <button type="button" data-pn-filter="progress" onclick="pnSubjectQuickFilter('progress', this)">In progress</button>
        </div>
        <p id="subjects-available-count" class="pn-v11-count">${count} subjects · ${tCount} topics · ${qCount} questions</p>
      </div>
      <div class="pn-v11-hero-visual" aria-hidden="true">
        <div class="pn-v11-route-map">
          <div class="pn-v11-route-top"><span>Curriculum map</span><b>${count} modules</b></div>
          <div class="pn-v11-route-main">
            <div class="pn-v11-route-node active"><span class="material-symbols-outlined">${esc(iconFor(first, 0))}</span></div>
            <div class="pn-v11-route-line"></div>
            <div class="pn-v11-route-node"><span class="material-symbols-outlined">quiz</span></div>
            <div class="pn-v11-route-line"></div>
            <div class="pn-v11-route-node gold"><span class="material-symbols-outlined">school</span></div>
          </div>
          <div class="pn-v11-route-card big"><small>Open now</small><strong>${esc(cleanName(first.name || 'Pharmacology'))}</strong><span>${Number(first.topicsCount || 0)} topics · ${Number(first.questionsCount || 0)} questions</span></div>
          <div class="pn-v11-route-grid">
            <div><small>Review</small><strong>Weak areas</strong></div>
            <div><small>Output</small><strong>Exam-ready</strong></div>
          </div>
        </div>
      </div>`;
  }

  function card(subject, index) {
    const name = cleanName(subject.name);
    const desc = subject.description || 'Structured subject route with topic-based practice, explanations, and progress tracking.';
    const topics = Number(subject.topicsCount || 0);
    const questions = Number(subject.questionsCount || 0);
    const stats = subjectProgress(subject);
    const featured = index === 0 && questions > 0;
    const id = JSON.stringify(String(subject.id || ''));
    return `
      <article class="pn-v11-subject-card ${featured ? 'featured' : ''}" data-filter-card="true" data-name="${esc(name.toLowerCase())}" data-has-content="${questions > 0 ? '1' : '0'}" data-progress="${stats.answered > 0 ? '1' : '0'}" onclick="selectSubject(${id})">
        <div class="pn-v11-card-glow" aria-hidden="true"></div>
        <div class="pn-v11-card-top">
          <div class="pn-v11-icon"><span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">${esc(iconFor(subject, index))}</span></div>
          <span class="pn-v11-track">${esc(routeLabel(subject, index))}</span>
        </div>
        <div class="pn-v11-card-body">
          <h2>${esc(name)}</h2>
          <p>${esc(desc)}</p>
        </div>
        <div class="pn-v11-progress-block">
          <div class="pn-v11-progress-label"><span>${stats.answered} answered</span><span>${stats.accuracy}% accuracy</span></div>
          <div class="pn-v11-progress"><i style="--progress:${stats.progress}%"></i></div>
        </div>
        <div class="pn-v11-card-bottom">
          <div class="pn-v11-stat"><strong>${topics}</strong><span>Topics</span></div>
          <div class="pn-v11-stat"><strong>${questions}</strong><span>Questions</span></div>
          <div class="pn-v11-action"><span>${questions > 0 ? 'Open module' : 'Coming soon'}</span><span class="material-symbols-outlined">arrow_forward</span></div>
        </div>
      </article>`;
  }

  function sidePanels(subjects) {
    const qCount = totalQuestions(subjects);
    const tCount = totalTopics(subjects);
    return `
      <section class="pn-v11-panel dark">
        <span class="pn-v11-panel-kicker">Library signal</span>
        <h2>A clean subject shelf that can scale.</h2>
        <p>As you add more JSON topics and question pools, the page keeps the same premium layout without becoming a messy list.</p>
        <div class="pn-v11-mini-stats">
          <div><strong>${subjects.length}</strong><span>Subjects</span></div>
          <div><strong>${tCount}</strong><span>Topics</span></div>
          <div><strong>${qCount}</strong><span>Questions</span></div>
        </div>
      </section>
      <section class="pn-v11-panel light">
        <span class="pn-v11-panel-kicker">Student path</span>
        <h2>Make the route obvious.</h2>
        <div class="pn-v11-path-steps">
          <div><b>01</b><span>Choose module</span></div>
          <div><b>02</b><span>Open topics</span></div>
          <div><b>03</b><span>Finish sets</span></div>
          <div><b>04</b><span>Review weak areas</span></div>
        </div>
      </section>`;
  }

  function renderSubjectsPageV11(subjects = []) {
    const grid = document.getElementById('subjects-grid');
    if (!grid) return;
    const sorted = [...subjects].sort((a, b) => (a.order || 999) - (b.order || 999));
    renderHero(sorted);
    if (!sorted.length) {
      grid.innerHTML = `<section class="pn-v11-panel light full"><span class="pn-v11-panel-kicker">Empty library</span><h2>No subjects found yet.</h2><p>Add subjects to data/index.json and they will appear here automatically.</p></section>`;
      return;
    }
    grid.innerHTML = sorted.map(card).join('') + sidePanels(sorted);
    filterSubjectsV11(document.getElementById('subject-search')?.value || '');
  }

  function currentFilter() {
    return document.querySelector('[data-pn-filter].active')?.dataset?.pnFilter || 'all';
  }

  function filterSubjectsV11(q) {
    const query = String(q || '').trim().toLowerCase();
    const filter = currentFilter();
    const cards = Array.from(document.querySelectorAll('#subjects-grid [data-filter-card="true"]'));
    let visible = 0;
    cards.forEach(el => {
      const text = el.textContent.toLowerCase() + ' ' + (el.dataset.name || '');
      const queryMatch = !query || text.includes(query);
      const filterMatch = filter === 'all' || (filter === 'content' && el.dataset.hasContent === '1') || (filter === 'progress' && el.dataset.progress === '1');
      const show = queryMatch && filterMatch;
      el.hidden = !show;
      if (show) visible += 1;
    });
    const count = document.getElementById('subjects-available-count');
    if (count) count.textContent = query || filter !== 'all' ? `${visible} matching module${visible === 1 ? '' : 's'}` : `${cards.length} subjects available`;
  }

  function quickFilter(value, btn) {
    document.querySelectorAll('[data-pn-filter]').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    filterSubjectsV11(document.getElementById('subject-search')?.value || '');
  }

  window.renderSubjectsPage = renderSubjectsPageV11;
  window.filterSubjects = filterSubjectsV11;
  window.pnSubjectQuickFilter = quickFilter;
})();
