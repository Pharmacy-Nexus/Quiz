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



  function openSubject(subjectId, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const id = String(subjectId || '').trim();
    if (!id) return;

    // Prefer the original app logic. This keeps all Pharmacy Nexus state, JSON loading,
    // topic rendering, and navigation behavior untouched.
    if (typeof window.selectSubject === 'function') {
      window.selectSubject(id);
      return;
    }

    // Safe fallback in case the visual layer loads before app.js finishes exposing globals.
    try {
      if (window.appState) {
        window.appState.selectedSubjectId = id;
        window.appState.selectedSectionId = 'all';
        window.appState.selectedTopicId = null;
        if (typeof window.saveState === 'function') window.saveState();
      }
      if (typeof window.renderTopicsPage === 'function') window.renderTopicsPage();
      if (typeof window.navigateTo === 'function') window.navigateTo('topics');
    } catch (err) {
      console.error('Could not open subject:', err);
    }
  }

  function bindSubjectOpenHandlers() {
    const cards = Array.from(document.querySelectorAll('#subjects-grid [data-subject-id]'));
    cards.forEach(card => {
      if (card.dataset.openBound === 'true') return;
      card.dataset.openBound = 'true';
      card.style.cursor = 'pointer';
      card.addEventListener('click', function (event) {
        openSubject(this.dataset.subjectId, event);
      });
      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          openSubject(this.dataset.subjectId, event);
        }
      });
    });
  }

  window.pnOpenSubject = openSubject;

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
      <article class="pn-v11-subject-card ${featured ? 'featured' : ''}" data-filter-card="true" data-name="${esc(name.toLowerCase())}" data-has-content="${questions > 0 ? '1' : '0'}" data-progress="${stats.answered > 0 ? '1' : '0'}" data-subject-id=${id} role="button" tabindex="0" onclick="pnOpenSubject(${id}, event)">
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
        <div class="pn-subject-mini-tree" aria-hidden="true"><i></i><b></b><i></i><b></b><i></i></div>
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
    bindSubjectOpenHandlers();
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

  document.addEventListener('DOMContentLoaded', () => setTimeout(bindSubjectOpenHandlers, 300));
  const observer = new MutationObserver(() => bindSubjectOpenHandlers());
  document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('subjects-grid');
    if (grid) observer.observe(grid, { childList: true, subtree: true });
  });

  window.renderSubjectsPage = renderSubjectsPageV11;
  window.filterSubjects = filterSubjectsV11;
  window.pnSubjectQuickFilter = quickFilter;

  /* ===================== Skill Tree V13 ===================== */
  function readPnState() {
    try { return JSON.parse(localStorage.getItem('pharmacyNexusState') || '{}') || {}; }
    catch (_) { return {}; }
  }

  function statusForTopic(topicId, total) {
    const state = readPnState();
    const map = state.studyResults?.[topicId] || {};
    let answered = 0;
    let correct = 0;
    Object.values(map).forEach(item => {
      answered += 1;
      if (item === true || (item && typeof item === 'object' && item.correct === true)) correct += 1;
    });
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
    const progress = total ? Math.min(100, Math.round((answered / total) * 100)) : (answered ? 35 : 0);
    let status = 'available';
    if (answered > 0 && accuracy < 50) status = 'weak';
    else if (progress >= 70 && accuracy >= 70) status = 'mastered';
    else if (answered > 0) status = 'progress';
    return { status, answered, correct, accuracy, progress };
  }

  function skillPath(points, complete) {
    if (!points.length) return '';
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i];
      const [px, py] = points[i - 1];
      const mid = (px + x) / 2;
      d += ` C ${mid} ${py}, ${mid} ${y}, ${x} ${y}`;
    }
    return `<path class="${complete ? 'is-complete' : ''}" d="${d}"/>`;
  }

  function renderStaticHomeSkillTree() {
    const page = document.getElementById('page-home');
    if (!page || document.getElementById('pn-home-skill-tree')) return;
    const host = page.querySelector('.max-w-7xl') || page;
    const hero = host.querySelector('section');
    const section = document.createElement('section');
    section.id = 'pn-home-skill-tree';
    section.className = 'pn-skill-shell pn-skill-home';
    section.innerHTML = `
      <div class="pn-skill-copy">
        <span class="kicker"><span class="material-symbols-outlined">account_tree</span> Skill Tree Preview</span>
        <h2>Turn every subject into a visible learning path.</h2>
        <p>Each node can reflect your progress, accuracy, weak areas, and the next recommended topic — so studying feels like a structured journey, not a random question list.</p>
        <div class="pn-skill-legend">
          <span><i class="pn-skill-dot available"></i>Available</span>
          <span><i class="pn-skill-dot progress"></i>In progress</span>
          <span><i class="pn-skill-dot mastered"></i>Mastered</span>
          <span><i class="pn-skill-dot weak"></i>Weak area</span>
        </div>
        <div class="pn-skill-actions">
          <button type="button" onclick="navigateTo('subjects')">Open Subject Library</button>
          <button type="button" class="secondary" onclick="navigateTo('dashboard')">View Progress</button>
        </div>
      </div>
      <div class="pn-skill-map" aria-hidden="true">
        <div class="pn-skill-map-inner">
          <svg class="pn-tree-svg" viewBox="0 0 700 430" preserveAspectRatio="none">
            ${skillPath([[350,70],[205,175],[165,305]], true)}
            ${skillPath([[350,70],[350,185],[350,315]], true)}
            ${skillPath([[350,70],[505,175],[555,305]], false)}
            ${skillPath([[350,185],[270,270]], true)}
            ${skillPath([[350,185],[430,270]], false)}
          </svg>
          <div class="pn-tree-node root mastered" style="left:50%;top:16%"><strong>Pharmacology</strong><small>Root module</small></div>
          <div class="pn-tree-node mastered" style="left:29%;top:41%"><strong>Autonomic Basics</strong><small>92% accuracy</small></div>
          <div class="pn-tree-node progress recommended" style="left:50%;top:44%"><strong>CNS</strong><small>Recommended</small></div>
          <div class="pn-tree-node available" style="left:72%;top:41%"><strong>Cardiovascular</strong><small>Available</small></div>
          <div class="pn-tree-node mastered" style="left:23%;top:72%"><strong>Sedatives</strong><small>Completed</small></div>
          <div class="pn-tree-node weak" style="left:39%;top:64%"><strong>Antidepressants</strong><small>Needs review</small></div>
          <div class="pn-tree-node available" style="left:61%;top:64%"><strong>Antipsychotics</strong><small>Next branch</small></div>
          <div class="pn-tree-node" style="left:80%;top:72%"><strong>Heart Failure</strong><small>Locked later</small></div>
        </div>
      </div>`;
    if (hero && hero.nextSibling) hero.parentNode.insertBefore(section, hero.nextSibling);
    else host.appendChild(section);
  }

  function extractTopicCards() {
    return Array.from(document.querySelectorAll('#topics-list article[onclick*="selectTopic"]')).map((card, index) => {
      const title = card.querySelector('h3')?.textContent?.trim() || `Topic ${index + 1}`;
      const onclick = card.getAttribute('onclick') || '';
      const match = onclick.match(/selectTopic\('([^']+)'\s*,\s*'([^']+)'\)/);
      const subjectId = match?.[1] || '';
      const topicId = match?.[2] || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const questionText = card.textContent.match(/(\d+)\s+Questions/i)?.[1] || '0';
      const total = Number(questionText || 0);
      const sectionBadge = Array.from(card.querySelectorAll('span')).map(x => x.textContent.trim()).find(t => t && !/available|topic|questions|easy|medium|hard/i.test(t)) || 'General';
      return { card, index, title, subjectId, topicId, total, section: sectionBadge, ...statusForTopic(topicId, total) };
    });
  }

  function layoutTopicNodes(items) {
    const count = Math.max(items.length, 1);
    const mobile = window.matchMedia('(max-width: 640px)').matches;
    return items.map((item, i) => {
      if (mobile) {
        return { ...item, x: 50, y: 13 + i * Math.min(13, 70 / Math.max(count - 1, 1)) };
      }
      const branch = i % 3;
      const row = Math.floor(i / 3);
      const y = 25 + row * 23;
      const x = branch === 0 ? 25 : branch === 1 ? 50 : 75;
      return { ...item, x, y: Math.min(88, y) };
    });
  }

  function renderTopicSkillTree() {
    const topicsList = document.getElementById('topics-list');
    const page = document.getElementById('page-topics');
    if (!topicsList || !page) return;
    const items = extractTopicCards();
    if (!items.length) return;
    let existing = document.getElementById('pn-topic-skill-tree');
    if (existing) existing.remove();
    const subjectName = document.querySelector('#page-topics h1')?.textContent?.trim() || 'Subject';
    const mastered = items.filter(i => i.status === 'mastered').length;
    const progress = items.filter(i => i.status === 'progress').length;
    const weak = items.filter(i => i.status === 'weak').length;
    const recommended = items.find(i => i.status === 'weak') || items.find(i => i.status === 'progress') || items.find(i => i.status === 'available') || items[0];
    const laid = layoutTopicNodes(items.slice(0, 12));
    const root = [50, 10];
    const paths = laid.map((item, idx) => skillPath([root, [item.x, item.y]], item.status === 'mastered' || item.status === 'progress')).join('');
    const nodes = laid.map(item => `
      <button type="button" class="pn-tree-node pn-topic-node ${item.status} ${item.topicId === recommended.topicId ? 'recommended' : ''}" style="left:${item.x}%;top:${item.y}%" data-title="${esc(item.title)}" data-tip="${item.answered} answered · ${item.accuracy}% accuracy · ${item.total} questions" onclick="selectTopic('${esc(item.subjectId)}','${esc(item.topicId)}')">
        <strong>${esc(item.title)}</strong><small>${item.status === 'mastered' ? 'Mastered' : item.status === 'weak' ? 'Needs review' : item.status === 'progress' ? 'In progress' : 'Available'}</small>
      </button>`).join('');
    existing = document.createElement('section');
    existing.id = 'pn-topic-skill-tree';
    existing.className = 'pn-skill-shell pn-topic-tree';
    existing.innerHTML = `
      <div class="pn-topic-tree-head">
        <div><span class="kicker"><span class="material-symbols-outlined">account_tree</span> Skill Tree</span><h2>${esc(subjectName)} roadmap</h2><p>Follow the subject visually. Completed nodes glow green, weak topics are marked clearly, and the recommended node is highlighted for your next move.</p></div>
        <div class="pn-topic-tree-meta"><span>${items.length} topics</span><span>${mastered} mastered</span><span>${progress} in progress</span><span>${weak} weak</span></div>
      </div>
      <div class="pn-topic-tree-board">
        <svg class="pn-tree-svg" viewBox="0 0 100 100" preserveAspectRatio="none">${paths}</svg>
        <div class="pn-tree-node root mastered" style="left:50%;top:10%"><strong>${esc(subjectName)}</strong><small>Subject root</small></div>
        ${nodes}
        <div class="pn-tree-tooltip" id="pn-tree-tooltip"></div>
      </div>`;
    topicsList.insertBefore(existing, topicsList.firstChild);
    bindTreeTooltip(existing);
  }

  function bindTreeTooltip(scope) {
    const tip = scope.querySelector('#pn-tree-tooltip');
    if (!tip) return;
    scope.querySelectorAll('.pn-topic-node').forEach(node => {
      node.addEventListener('mouseenter', () => {
        tip.innerHTML = `<strong>${esc(node.dataset.title || '')}</strong><span>${esc(node.dataset.tip || '')}</span>`;
        const board = node.closest('.pn-topic-tree-board');
        const left = Math.min(72, Math.max(8, parseFloat(node.style.left || '50') + 4));
        const top = Math.min(82, Math.max(8, parseFloat(node.style.top || '50') + 5));
        tip.style.left = left + '%';
        tip.style.top = top + '%';
        tip.classList.add('is-visible');
      });
      node.addEventListener('mouseleave', () => tip.classList.remove('is-visible'));
    });
  }

  let topicEnhanceTimer = null;
  function scheduleTopicTree() {
    clearTimeout(topicEnhanceTimer);
    topicEnhanceTimer = setTimeout(renderTopicSkillTree, 120);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderStaticHomeSkillTree();
    scheduleTopicTree();
    const topicsList = document.getElementById('topics-list');
    if (topicsList) new MutationObserver(scheduleTopicTree).observe(topicsList, { childList: true, subtree: false });
  });

  const oldNavigateForSkill = window.navigateTo;
  if (typeof oldNavigateForSkill === 'function') {
    window.navigateTo = function(pageId) {
      const result = oldNavigateForSkill.apply(this, arguments);
      if (pageId === 'home') setTimeout(renderStaticHomeSkillTree, 80);
      if (pageId === 'topics') setTimeout(renderTopicSkillTree, 180);
      return result;
    };
  }

})();
