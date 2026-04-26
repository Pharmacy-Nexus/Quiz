(function () {
  'use strict';

  const examState = {
    topics: [],
    questions: [],
    answers: {},
    currentIndex: 0,
    remainingSeconds: 0,
    timerId: null
  };

  const SECTION_FALLBACKS = {
    clinical: {
      label: 'Clinical Pharmacy',
      description: 'Disease-focused and patient-centered clinical topics.',
      keywords: [
        'hypertension', 'diabetes', 'heart failure', 'asthma', 'copd', 'renal', 'kidney', 'hepatic', 'liver',
        'thyroid', 'dyslipidemia', 'anemia', 'parkinson', 'alzheimer', 'rheumatoid', 'osteoporosis', 'osteoarthritis',
        'pregnancy', 'gestational', 'cardio', 'infect', 'pneumonia', 'peptic', 'bowel', 'ibd', 'heart', 'coronary'
      ]
    },
    therapeutics: {
      label: 'Therapeutics',
      description: 'Treatment strategies, guidelines, and applied disease management.',
      keywords: [
        'therapy', 'therapeutic', 'treatment', 'management', 'guideline', 'case', 'otc', 'self-care', 'minor ailment',
        'pharmacotherapy', 'practice'
      ]
    },
    pharmacology: {
      label: 'Pharmacology',
      description: 'Drug classes, mechanisms, adverse effects, and pharmacodynamics.',
      keywords: [
        'pharmacology', 'drug class', 'adrenergic', 'cholinergic', 'antibiotic', 'antimicrobial', 'antihypertensive',
        'pharmacodynamics', 'mechanism', 'receptor', 'toxicity', 'adverse'
      ]
    },
    calculations: {
      label: 'Calculations',
      description: 'Dose, infusion, compounding, and pharmaceutical calculations.',
      keywords: [
        'calculation', 'calculations', 'dose', 'dosing', 'infusion', 'dilution', 'iv flow', 'rate', 'math', 'formula',
        'compounding calculation'
      ]
    },
    sciences: {
      label: 'Pharmaceutical Sciences',
      description: 'PK, dosage forms, biopharmaceutics, medicinal chemistry, and core sciences.',
      keywords: [
        'pharmacokinetic', 'pk', 'adme', 'biopharm', 'dosage form', 'delivery', 'chemistry', 'medicinal', 'pharmaceutics',
        'stability', 'sterile', 'formulation', 'bioavailability', 'kinetic'
      ]
    }
  };

  function slugifyTopicSection(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'other';
  }

  function inferLegacySection(topic) {
    const haystack = `${topic.title || ''} ${topic.description || ''}`.toLowerCase();

    for (const [key, section] of Object.entries(SECTION_FALLBACKS)) {
      if (section.keywords.some((keyword) => haystack.includes(keyword))) {
        return {
          key,
          label: section.label,
          description: section.description
        };
      }
    }

    return {
      key: 'other',
      label: 'Other',
      description: 'Topics without a custom section yet.'
    };
  }

  function resolveTopicSection(topic) {
    const rawSection = String(topic.section || '').trim();
    if (rawSection) {
      return {
        key: slugifyTopicSection(rawSection),
        label: rawSection,
        description: `Custom section: ${rawSection}`
      };
    }

    return inferLegacySection(topic);
  }

  function getSelectedExamTopics() {
    return examState.topics.filter((topic) => topic.selected);
  }

  function getExamSearchTerm() {
    return InternCore.qs('#examTopicSearchInput')?.value?.trim() || '';
  }

  function getExamFilteredTopics(searchTerm) {
    const term = String(searchTerm || '').trim().toLowerCase();
    if (!term) return examState.topics;

    return examState.topics.filter((topic) => {
      const haystack = `${topic.title || ''} ${topic.description || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  function getExamTopicGroups(searchTerm) {
    const filtered = getExamFilteredTopics(searchTerm);
    const orderedGroups = [];
    const groupMap = new Map();

    const ensureGroup = (topic) => {
      if (!groupMap.has(topic.sectionKey)) {
        const group = {
          key: topic.sectionKey,
          label: topic.sectionLabel || topic.section || 'Other',
          description: topic.sectionDescription || `Custom section: ${topic.sectionLabel || topic.section || 'Other'}`,
          topics: [],
          selectedCount: 0,
          totalCount: 0
        };
        groupMap.set(topic.sectionKey, group);
        orderedGroups.push(group);
      }
      return groupMap.get(topic.sectionKey);
    };

    examState.topics.forEach((topic) => {
      const group = ensureGroup(topic);
      group.totalCount += 1;
      if (topic.selected) group.selectedCount += 1;
    });

    filtered.forEach((topic) => {
      const group = ensureGroup(topic);
      group.topics.push(topic);
    });

    return orderedGroups.filter((group) => group.topics.length);
  }

  function renderExamSectionSidebar(searchTerm) {
    const groups = getExamTopicGroups(searchTerm);

    return groups.map((section) => `
      <button type="button" class="topic-section-nav-btn" data-section-target="${section.key}">
        <span>${InternCore.escapeHtml(section.label)}</span>
        <span class="topic-section-nav-count">${section.selectedCount}/${section.totalCount}</span>
      </button>
    `).join('');
  }

  function renderExamSelectedTopicsBox() {
    const selected = getSelectedExamTopics();

    return `
      <div class="selected-topics-box-head">
        <div>
          <h4>Selected Topics</h4>
          <p>${selected.length} topic${selected.length === 1 ? '' : 's'} chosen across sections.</p>
        </div>
        ${selected.length ? '<button type="button" class="btn btn-light btn-sm" id="clearSelectedExamTopicsBtn">Clear</button>' : ''}
      </div>

      <div class="selected-topics-summary">
        <span class="badge" id="examSelectedTopicsCountBadge">${selected.length} Selected</span>
        <span class="tag" id="examAvailableTopicsCountBadge">${examState.topics.length} Topics Available</span>
      </div>

      <div class="selected-topics-chip-list">
        ${selected.length ? selected.map((topic) => `
          <button type="button" class="selected-topic-chip" data-remove-exam-topic-id="${topic.id}" title="Remove ${InternCore.escapeHtml(topic.title)}">
            <span>${InternCore.escapeHtml(topic.title)}</span>
            <strong>×</strong>
          </button>
        `).join('') : '<div class="intern-empty compact">No topics selected yet.</div>'}
      </div>
    `;
  }

  function scrollToExamSection(sectionKey) {
    const target = InternCore.qs(`[data-topic-section="${sectionKey}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderSetupPage() {
    const root = InternCore.qs('#internPageRoot');

    root.innerHTML = `
      <section class="section-header">
        <div>
          <h2>Intern Real Exam Mode</h2>
          <p>Select topics freely from different sections, then build one timed exam around your chosen mix.</p>
        </div>
      </section>

      <section class="topic-setup-shell">
        <aside class="topic-setup-sidebar">
          <div class="sidebar-card topic-sections-card">
            <div class="topic-sections-card-head">
              <h3>Sections</h3>
              <p>Jump between topic groups quickly.</p>
            </div>
            <div id="examSectionSidebarNav" class="topic-sections-nav"></div>
          </div>

          <div class="sidebar-card selected-topics-panel" id="examSelectedTopicsBox"></div>
        </aside>

        <div class="topic-setup-main">
          <section class="card topic-setup-card">
            <div class="input-row three">
              <div>
                <label class="muted">Search topics</label>
                <input class="input" id="examTopicSearchInput" placeholder="Search title or description..." />
              </div>
              <div>
                <label class="muted">Number of questions</label>
                <input class="input" id="examQuestionCountInput" type="number" min="1" value="10" />
              </div>
              <div>
                <label class="muted">Timer (minutes)</label>
                <input class="input" id="examTimerMinutesInput" type="number" min="1" value="20" />
              </div>
            </div>

            <div class="action-row" style="justify-content:flex-start; margin-top:16px;">
              <button class="btn btn-light" id="examSelectAllTopicsBtn" type="button">Select All</button>
              <button class="btn btn-light" id="examClearAllTopicsBtn" type="button">Clear All</button>
              <button class="btn btn-primary" id="startRealExamBtn" type="button">Start Real Exam</button>
              <a class="btn btn-light" href="../index.html">Back</a>
            </div>
          </section>

          <div id="examSetupMessage"></div>
          <div id="examTopicsArea" class="topic-sections-wrap"></div>
        </div>
      </section>
    `;

    bindSetupEvents();
    drawTopics('');
  }

  function drawTopics(searchTerm) {
    const area = InternCore.qs('#examTopicsArea');
    const sidebarNav = InternCore.qs('#examSectionSidebarNav');
    const selectedBox = InternCore.qs('#examSelectedTopicsBox');
    const groups = getExamTopicGroups(searchTerm);

    if (selectedBox) selectedBox.innerHTML = renderExamSelectedTopicsBox();
    if (sidebarNav) sidebarNav.innerHTML = renderExamSectionSidebar(searchTerm);

    if (!groups.length) {
      area.innerHTML = `<div class="intern-empty">No topics matched your search.</div>`;
    } else {
      area.innerHTML = groups.map((section) => `
        <section class="topic-section-block" data-topic-section="${section.key}" id="exam-section-${slugifyTopicSection(section.key)}">
          <div class="topic-section-header-row">
            <div>
              <h3>${InternCore.escapeHtml(section.label)}</h3>
              <p>${InternCore.escapeHtml(section.description)}</p>
            </div>
            <div class="topic-section-header-actions">
              <span class="tag">${section.selectedCount}/${section.totalCount} selected</span>
              <button type="button" class="btn btn-light btn-sm" data-select-exam-section="${section.key}">Select section</button>
              <button type="button" class="btn btn-light btn-sm" data-clear-exam-section="${section.key}">Clear</button>
            </div>
          </div>

          <div class="topic-choice-grid grouped-topics-grid">
            ${section.topics.map((topic) => `
              <label class="topic-choice-card topic-card-${section.key} ${topic.selected ? 'is-selected' : ''}">
                <input type="checkbox" class="exam-topic-checkbox" value="${topic.id}" ${topic.selected ? 'checked' : ''} />
                <div class="topic-choice-main">
                  <div class="topic-choice-top">
                    <strong class="topic-choice-title">${InternCore.escapeHtml(topic.title)}</strong>
                    <span class="topic-choice-count">${InternCore.formatNumber(topic.questions_count)} Qs</span>
                  </div>
                  <p class="topic-choice-desc">${InternCore.escapeHtml(topic.description || 'No description available yet.')}</p>
                </div>
              </label>
            `).join('')}
          </div>
        </section>
      `).join('');
    }

    InternCore.qsa('.exam-topic-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (event) => {
        const topic = examState.topics.find((item) => item.id === event.target.value);
        if (topic) topic.selected = event.target.checked;
        drawTopics(getExamSearchTerm());
      });
    });

    InternCore.qsa('[data-remove-exam-topic-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const topic = examState.topics.find((item) => item.id === button.dataset.removeExamTopicId);
        if (topic) topic.selected = false;
        drawTopics(getExamSearchTerm());
      });
    });

    InternCore.qsa('[data-section-target]').forEach((button) => {
      button.addEventListener('click', () => scrollToExamSection(button.dataset.sectionTarget));
    });

    InternCore.qsa('[data-select-exam-section]').forEach((button) => {
      button.addEventListener('click', () => {
        examState.topics.forEach((topic) => {
          if (topic.sectionKey === button.dataset.selectExamSection) topic.selected = true;
        });
        drawTopics(getExamSearchTerm());
      });
    });

    InternCore.qsa('[data-clear-exam-section]').forEach((button) => {
      button.addEventListener('click', () => {
        examState.topics.forEach((topic) => {
          if (topic.sectionKey === button.dataset.clearExamSection) topic.selected = false;
        });
        drawTopics(getExamSearchTerm());
      });
    });

    InternCore.qs('#clearSelectedExamTopicsBtn')?.addEventListener('click', () => {
      examState.topics.forEach((topic) => { topic.selected = false; });
      drawTopics(getExamSearchTerm());
    });
  }

  function bindSetupEvents() {
    InternCore.qs('#examTopicSearchInput').addEventListener('input', (event) => {
      drawTopics(event.target.value);
    });

    InternCore.qs('#examSelectAllTopicsBtn').addEventListener('click', () => {
      examState.topics.forEach((topic) => { topic.selected = true; });
      drawTopics(getExamSearchTerm());
    });

    InternCore.qs('#examClearAllTopicsBtn').addEventListener('click', () => {
      examState.topics.forEach((topic) => { topic.selected = false; });
      drawTopics(getExamSearchTerm());
    });

    InternCore.qs('#startRealExamBtn').addEventListener('click', startRealExam);
  }

  async function startRealExam() {
    const selectedTopicIds = examState.topics
      .filter((topic) => topic.selected)
      .map((topic) => topic.id);

    const count = Number(InternCore.qs('#examQuestionCountInput').value || '10');
    const minutes = Number(InternCore.qs('#examTimerMinutesInput').value || '20');
    const msg = InternCore.qs('#examSetupMessage');

    if (!selectedTopicIds.length) {
      msg.innerHTML = `<div class="message error">Please select at least one topic.</div>`;
      return;
    }

    if (!count || count < 1) {
      msg.innerHTML = `<div class="message error">Please enter a valid number of questions.</div>`;
      return;
    }

    if (!minutes || minutes < 1) {
      msg.innerHTML = `<div class="message error">Please enter a valid timer in minutes.</div>`;
      return;
    }

    try {
      const questions = await InternAPI.getExamQuestions({
        topicIds: selectedTopicIds,
        count
      });

      if (!questions.length) {
        msg.innerHTML = `<div class="message error">No questions were found for the selected topics.</div>`;
        return;
      }

      const session = await InternAPI.createExamSession({
        mode: 'real',
        selectedTopicIds,
        questionCount: questions.length,
        timerMinutes: minutes
      });

      InternCore.setSession({
        type: 'real',
        sessionId: session.id
      });

      examState.questions = questions;
      examState.answers = {};
      examState.currentIndex = 0;
      examState.remainingSeconds = minutes * 60;

      renderExamScreen();
      startTimer();
    } catch (error) {
      console.error(error);
      msg.innerHTML = `<div class="message error">Failed to start real exam session.</div>`;
    }
  }

  function loadRetryExamIfExists() {
    const params = new URLSearchParams(window.location.search);
    const isRetryMode = params.get('retry') === '1';
    if (!isRetryMode) return false;

    const retryData = InternCore.readStore(InternCore.config.storageKeys.examRetry, null);
    if (!retryData || !Array.isArray(retryData.questions) || !retryData.questions.length) {
      return false;
    }

    examState.questions = retryData.questions;
    examState.answers = {};
    examState.currentIndex = 0;
    examState.remainingSeconds = 15 * 60;

    renderExamScreen();
    startTimer();
    return true;
  }

  function formatTimer(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  function startTimer() {
    clearInterval(examState.timerId);

    examState.timerId = setInterval(() => {
      examState.remainingSeconds -= 1;
      const timerEl = InternCore.qs('#examTimerValue');
      if (timerEl) {
        timerEl.textContent = formatTimer(Math.max(examState.remainingSeconds, 0));
        timerEl.classList.toggle('is-warning', examState.remainingSeconds <= 300 && examState.remainingSeconds > 60);
        timerEl.classList.toggle('is-danger', examState.remainingSeconds <= 60);
      }

      if (examState.remainingSeconds <= 0) {
        clearInterval(examState.timerId);
        finishExam();
      }
    }, 1000);
  }

  function getExamAnsweredCount() {
    return examState.questions.filter((question) => !!examState.answers[question.id]).length;
  }

  function getExamQuestionState(question, index) {
    const isCurrent = index === examState.currentIndex;
    const isAnswered = !!examState.answers[question.id];

    if (isCurrent && isAnswered) return 'current-answered';
    if (isCurrent) return 'current';
    if (isAnswered) return 'answered';
    return 'unanswered';
  }

  function renderExamQuestionRail() {
    return `
      <div class="exam-question-rail" id="examQuestionRail">
        ${examState.questions.map((question, index) => `
          <button
            type="button"
            class="exam-question-pill ${getExamQuestionState(question, index)}"
            data-exam-index="${index}"
            title="Question ${index + 1}"
          >
            ${index + 1}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderExamScreen() {
    const root = InternCore.qs('#internPageRoot');
    const question = examState.questions[examState.currentIndex];
    const selectedOptionId = examState.answers[question.id] || null;
    const answeredCount = getExamAnsweredCount();
    const unansweredCount = examState.questions.length - answeredCount;
    const progressPercent = ((examState.currentIndex + 1) / examState.questions.length) * 100;

    root.innerHTML = `
      <div class="study-shell exam-luxe-shell">
        <aside class="side-panel exam-luxe-sidebar">
          <div class="sidebar-card exam-hero-card">
            <div class="exam-hero-top">
              <span class="tag">Real Exam</span>
              <span class="exam-hero-status">Focused Mode</span>
            </div>

            <div class="exam-timer-card">
              <div class="exam-timer-label">Time remaining</div>
              <div class="timer exam-timer-value" id="examTimerValue">${formatTimer(examState.remainingSeconds)}</div>
            </div>

            <div class="exam-progress-copy">Stay calm, finish every question, then submit when ready.</div>
          </div>

          <div class="sidebar-card exam-progress-card">
            <div class="exam-progress-head">
              <h4>Progress</h4>
              <span class="badge">${examState.currentIndex + 1}/${examState.questions.length}</span>
            </div>

            <div class="progress-bar exam-progress-bar">
              <div class="progress-fill" style="width:${progressPercent}%"></div>
            </div>

            <div class="exam-progress-stats">
              <div class="exam-progress-stat">
                <span>Answered</span>
                <strong>${answeredCount}</strong>
              </div>
              <div class="exam-progress-stat">
                <span>Remaining</span>
                <strong>${unansweredCount}</strong>
              </div>
            </div>

            <div class="meta-row exam-meta-row">
              <span class="badge">${InternCore.escapeHtml(question.topic_title)}</span>
              <span class="tag">${InternCore.escapeHtml(question.type)}</span>
            </div>
          </div>

          <div class="sidebar-card exam-rail-card">
            <div class="exam-progress-head">
              <h4>Question Navigator</h4>
              <span class="tag">Jump</span>
            </div>
            ${renderExamQuestionRail()}
          </div>

          <div class="sidebar-card exam-submit-card">
            <div class="action-row" style="margin-top:0; justify-content:flex-start;">
              <button class="btn btn-danger" id="submitExamNowBtn" type="button">Submit Exam</button>
            </div>
          </div>
        </aside>

        <section class="question-card exam-luxe-card">
          <div class="question-top exam-question-top">
            <div>
              <div class="meta-row exam-question-meta">
                <span class="badge">${InternCore.escapeHtml(question.topic_title)}</span>
                <span class="tag">${InternCore.escapeHtml(question.type)}</span>
                <span class="tag">${InternCore.escapeHtml(question.difficulty)}</span>
              </div>
              <h2 class="question-title exam-question-title">${InternCore.escapeHtml(question.question_text)}</h2>
            </div>
          </div>

          ${question.case_text ? `
            <div class="case-box exam-case-box">
              <strong>Case</strong>
              <div class="muted" style="margin-top:8px;">${InternCore.escapeHtml(question.case_text)}</div>
            </div>
          ` : ''}

          ${question.image_url ? `
            <div class="exam-image-wrap" style="margin-top:18px;">
              <img src="${InternCore.escapeHtml(question.image_url)}" alt="Question visual" style="border-radius:22px; border:1px solid var(--outline-variant);" />
            </div>
          ` : ''}

          <div class="option-list exam-option-list" id="examOptionList"></div>

          <div class="action-row exam-bottom-actions">
            <button class="btn btn-light" id="examPrevBtn" ${examState.currentIndex === 0 ? 'disabled' : ''}>Previous</button>
            <button class="btn btn-dark" id="examNextBtn">${examState.currentIndex === examState.questions.length - 1 ? 'Review Last Question' : 'Next Question'}</button>
          </div>
        </section>
      </div>
    `;

    const optionList = InternCore.qs('#examOptionList');

    question.options.forEach((option, optionIndex) => {
      const button = InternCore.el(
        'button',
        `option-btn exam-option-btn ${selectedOptionId === option.id ? 'ghost-correct is-selected' : ''}`
      );
      button.type = 'button';

      const letter = InternCore.el('span', 'exam-option-letter');
      letter.textContent = String.fromCharCode(65 + optionIndex);

      const text = InternCore.el('span', 'exam-option-text');
      text.textContent = option.text || '';

      button.appendChild(letter);
      button.appendChild(text);

      button.addEventListener('click', () => {
        examState.answers[question.id] = option.id;
        renderExamScreen();
      });

      optionList.appendChild(button);
    });

    InternCore.qsa('[data-exam-index]').forEach((button) => {
      button.addEventListener('click', () => {
        examState.currentIndex = Number(button.dataset.examIndex);
        renderExamScreen();
      });
    });

    InternCore.qs('#examPrevBtn')?.addEventListener('click', () => {
      if (examState.currentIndex > 0) {
        examState.currentIndex -= 1;
        renderExamScreen();
      }
    });

    InternCore.qs('#examNextBtn')?.addEventListener('click', () => {
      if (examState.currentIndex < examState.questions.length - 1) {
        examState.currentIndex += 1;
        renderExamScreen();
      }
    });

    InternCore.qs('#submitExamNowBtn')?.addEventListener('click', async () => {
      const ok = window.confirm(`Submit the exam now? You still have ${unansweredCount} unanswered question${unansweredCount === 1 ? '' : 's'}.`);
      if (ok) await finishExam();
    });
  }

  async function finishExam() {
    clearInterval(examState.timerId);

    const rows = examState.questions.map((question) => {
      const selectedOptionId = examState.answers[question.id] || null;
      const selectedOption = question.options.find((option) => option.id === selectedOptionId) || null;
      const correctOption = question.options.find((option) => option.is_correct) || null;

      return {
        question,
        selected: selectedOption ? selectedOption.text : 'No answer selected',
        selectedOptionId,
        correct: correctOption ? correctOption.text : '',
        isCorrect: selectedOption ? !!selectedOption.is_correct : false,
        explanation: question.explanation,
        summary: question.summary
      };
    });

    const score = rows.filter((row) => row.isCorrect).length;

    InternCore.updateDashboardFromSession({
      mode: 'real',
      rows,
      score,
      total: rows.length
    });

    const byTopic = {};
    rows.forEach((row) => {
      const key = row.question.topic_title;
      byTopic[key] = byTopic[key] || { total: 0, correct: 0, wrong: 0 };
      byTopic[key].total += 1;
      if (row.isCorrect) byTopic[key].correct += 1;
      else byTopic[key].wrong += 1;
    });

    const topicStats = Object.entries(byTopic).map(([topic, stats]) => ({
      topic,
      total: stats.total,
      correct: stats.correct,
      wrong: stats.wrong,
      accuracy: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0
    }));

    const strongest = [...topicStats].sort((a, b) => b.accuracy - a.accuracy).slice(0, 3);
    const weakest = [...topicStats].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

    const currentSession = InternCore.getSession();

    try {
      if (currentSession?.sessionId) {
        await InternAPI.saveExamAnswers({
          sessionId: currentSession.sessionId,
          rows: rows.map((row) => ({
            question: row.question,
            selectedOptionId: row.selectedOptionId,
            selected: row.selected,
            isCorrect: row.isCorrect
          }))
        });

        await InternAPI.completeExamSession({
          sessionId: currentSession.sessionId,
          score,
          totalQuestions: rows.length
        });
      }
    } catch (error) {
      console.error('Failed to save real exam session to Supabase:', error);
    }

    InternCore.writeStore(InternCore.config.storageKeys.examReview, {
      title: 'Intern Real Exam Review',
      score,
      total: rows.length,
      rows,
      topicStats,
      strongest,
      weakest,
      createdAt: new Date().toISOString()
    });

    window.location.href = './exam-review.html';
  }

  async function initExamPage() {
    InternCore.createShell();

    if (loadRetryExamIfExists()) return;

    try {
      const topics = await InternAPI.getTopics();
      examState.topics = topics.map((topic) => {
        const resolvedSection = resolveTopicSection(topic);
        return {
          ...topic,
          selected: false,
          sectionKey: resolvedSection.key,
          sectionLabel: resolvedSection.label,
          sectionDescription: resolvedSection.description
        };
      });

      renderSetupPage();
    } catch (error) {
      console.error(error);
      const root = InternCore.qs('#internPageRoot');
      root.innerHTML = `
        <section class="card center">
          <div class="meta-row" style="justify-content:center;">
            <span class="badge">Error</span>
          </div>
          <h2>Failed to load topics.</h2>
          <p class="muted">Please check your Supabase connection and try again.</p>
          <div class="action-row" style="justify-content:center; margin-top:24px;">
            <a class="btn btn-light" href="../index.html">Back</a>
          </div>
        </section>
      `;
    }
  }

  document.addEventListener('DOMContentLoaded', initExamPage);
})();
