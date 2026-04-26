(function () {
  'use strict';

  const practiceState = {
    topics: [],
    questions: [],
    answers: {},
    currentIndex: 0,
    flaggedQuestionIds: [],
    autoNextEnabled: false,
    autoNextSeconds: 3,
    autoNextTimerId: null
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

  function getSelectedPracticeTopics() {
    return practiceState.topics.filter((topic) => topic.selected);
  }

  function getPracticeSearchTerm() {
    return InternCore.qs('#topicSearchInput')?.value?.trim() || '';
  }

  function getPracticeFilteredTopics(searchTerm) {
    const term = String(searchTerm || '').trim().toLowerCase();
    if (!term) return practiceState.topics;

    return practiceState.topics.filter((topic) => {
      const haystack = `${topic.title || ''} ${topic.description || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }

  function getPracticeTopicGroups(searchTerm) {
    const filtered = getPracticeFilteredTopics(searchTerm);
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

    practiceState.topics.forEach((topic) => {
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

  function renderPracticeSectionSidebar(searchTerm) {
    const groups = getPracticeTopicGroups(searchTerm);

    return groups.map((section) => `
      <button type="button" class="topic-section-nav-btn" data-section-target="${section.key}">
        <span>${section.label}</span>
        <span class="topic-section-nav-count">${section.selectedCount}/${section.totalCount}</span>
      </button>
    `).join('');
  }

  function renderPracticeSelectedTopicsBox() {
    const selected = getSelectedPracticeTopics();

    return `
      <div class="selected-topics-box-head">
        <div>
          <h4>Selected Topics</h4>
          <p>${selected.length} topic${selected.length === 1 ? '' : 's'} chosen across sections.</p>
        </div>
        ${selected.length ? '<button type="button" class="btn btn-light btn-sm" id="clearSelectedTopicsBtn">Clear</button>' : ''}
      </div>

      <div class="selected-topics-summary">
        <span class="badge" id="selectedTopicsCountBadge">${selected.length} Selected</span>
        <span class="tag" id="availableTopicsCountBadge">${practiceState.topics.length} Topics Available</span>
      </div>

      <div class="selected-topics-chip-list">
        ${selected.length ? selected.map((topic) => `
          <button type="button" class="selected-topic-chip" data-remove-topic-id="${topic.id}" title="Remove ${topic.title}">
            <span>${topic.title}</span>
            <strong>×</strong>
          </button>
        `).join('') : '<div class="intern-empty compact">No topics selected yet.</div>'}
      </div>
    `;
  }

  function scrollToPracticeSection(sectionKey) {
    const target = InternCore.qs(`[data-topic-section="${sectionKey}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderSetupPage() {
    const root = InternCore.qs('#internPageRoot');

    root.innerHTML = `
      <section class="section-header">
        <div>
          <h2>Intern Practice Mode</h2>
          <p>Select topics from any section, build a mixed practice set, and keep your chosen topics visible while you browse.</p>
        </div>
      </section>

      <section class="topic-setup-shell">
        <aside class="topic-setup-sidebar">
          <div class="sidebar-card topic-sections-card">
            <div class="topic-sections-card-head">
              <h3>Sections</h3>
              <p>Jump between topic groups quickly.</p>
            </div>
            <div id="practiceSectionSidebarNav" class="topic-sections-nav"></div>
          </div>

          <div class="sidebar-card selected-topics-panel" id="practiceSelectedTopicsBox"></div>
        </aside>

        <div class="topic-setup-main">
          <section class="card topic-setup-card">
            <div class="input-row two">
              <div>
                <label class="muted">Search topics</label>
                <input class="input" id="topicSearchInput" placeholder="Search title or description..." />
              </div>
              <div>
                <label class="muted">Number of questions</label>
                <input class="input" id="questionCountInput" type="number" min="1" value="10" />
              </div>
            </div>

            <div class="action-row" style="justify-content:flex-start; margin-top:16px;">
              <button class="btn btn-light" id="selectAllTopicsBtn" type="button">Select All</button>
              <button class="btn btn-light" id="clearAllTopicsBtn" type="button">Clear All</button>
              <button class="btn btn-primary" id="startPracticeBtn" type="button">Start Practice Exam</button>
              <a class="btn btn-light" href="../index.html">Back</a>
            </div>
          </section>

          <div id="practiceSetupMessage"></div>
          <div id="practiceTopicsArea" class="topic-sections-wrap"></div>
        </div>
      </section>
    `;

    bindSetupEvents();
    drawTopics('');
  }

  function drawTopics(searchTerm) {
    const area = InternCore.qs('#practiceTopicsArea');
    const sidebarNav = InternCore.qs('#practiceSectionSidebarNav');
    const selectedBox = InternCore.qs('#practiceSelectedTopicsBox');
    const groups = getPracticeTopicGroups(searchTerm);

    if (selectedBox) selectedBox.innerHTML = renderPracticeSelectedTopicsBox();
    if (sidebarNav) sidebarNav.innerHTML = renderPracticeSectionSidebar(searchTerm);

    if (!groups.length) {
      area.innerHTML = `<div class="intern-empty">No topics matched your search.</div>`;
    } else {
      area.innerHTML = groups.map((section) => `
        <section class="topic-section-block" data-topic-section="${section.key}" id="section-${slugifyTopicSection(section.key)}">
          <div class="topic-section-header-row">
            <div>
              <h3>${section.label}</h3>
              <p>${section.description}</p>
            </div>
            <div class="topic-section-header-actions">
              <span class="tag">${section.selectedCount}/${section.totalCount} selected</span>
              <button type="button" class="btn btn-light btn-sm" data-select-section="${section.key}">Select section</button>
              <button type="button" class="btn btn-light btn-sm" data-clear-section="${section.key}">Clear</button>
            </div>
          </div>

          <div class="topic-choice-grid grouped-topics-grid">
            ${section.topics.map((topic) => `
              <label class="topic-choice-card topic-card-${section.key} ${topic.selected ? 'is-selected' : ''}">
                <input type="checkbox" class="practice-topic-checkbox" value="${topic.id}" ${topic.selected ? 'checked' : ''} />

                <div class="topic-choice-main">
                  <div class="topic-choice-top">
                    <strong class="topic-choice-title">${topic.title}</strong>
                    <span class="topic-choice-count">${InternCore.formatNumber(topic.questions_count)} Qs</span>
                  </div>

                  <p class="topic-choice-desc">${topic.description || 'No description available yet.'}</p>
                </div>
              </label>
            `).join('')}
          </div>
        </section>
      `).join('');
    }

    InternCore.qsa('.practice-topic-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (event) => {
        const topic = practiceState.topics.find((item) => item.id === event.target.value);
        if (topic) topic.selected = event.target.checked;
        drawTopics(getPracticeSearchTerm());
      });
    });

    InternCore.qsa('[data-remove-topic-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const topic = practiceState.topics.find((item) => item.id === button.dataset.removeTopicId);
        if (topic) topic.selected = false;
        drawTopics(getPracticeSearchTerm());
      });
    });

    InternCore.qsa('[data-section-target]').forEach((button) => {
      button.addEventListener('click', () => scrollToPracticeSection(button.dataset.sectionTarget));
    });

    InternCore.qsa('[data-select-section]').forEach((button) => {
      button.addEventListener('click', () => {
        practiceState.topics.forEach((topic) => {
          if (topic.sectionKey === button.dataset.selectSection) topic.selected = true;
        });
        drawTopics(getPracticeSearchTerm());
      });
    });

    InternCore.qsa('[data-clear-section]').forEach((button) => {
      button.addEventListener('click', () => {
        practiceState.topics.forEach((topic) => {
          if (topic.sectionKey === button.dataset.clearSection) topic.selected = false;
        });
        drawTopics(getPracticeSearchTerm());
      });
    });

    InternCore.qs('#clearSelectedTopicsBtn')?.addEventListener('click', () => {
      practiceState.topics.forEach((topic) => { topic.selected = false; });
      drawTopics(getPracticeSearchTerm());
    });
  }

  function bindSetupEvents() {
    InternCore.qs('#topicSearchInput').addEventListener('input', (event) => {
      drawTopics(event.target.value);
    });

    InternCore.qs('#selectAllTopicsBtn').addEventListener('click', () => {
      practiceState.topics.forEach((topic) => {
        topic.selected = true;
      });
      drawTopics(getPracticeSearchTerm());
    });

    InternCore.qs('#clearAllTopicsBtn').addEventListener('click', () => {
      practiceState.topics.forEach((topic) => {
        topic.selected = false;
      });
      drawTopics(getPracticeSearchTerm());
    });

    InternCore.qs('#startPracticeBtn').addEventListener('click', startPracticeSession);
  }

  async function startPracticeSession() {
    const selectedTopicIds = practiceState.topics
      .filter((topic) => topic.selected)
      .map((topic) => topic.id);

    const count = Number(InternCore.qs('#questionCountInput').value || '10');
    const msg = InternCore.qs('#practiceSetupMessage');

    if (!selectedTopicIds.length) {
      msg.innerHTML = `<div class="message error">Please select at least one topic.</div>`;
      return;
    }

    if (!count || count < 1) {
      msg.innerHTML = `<div class="message error">Please enter a valid number of questions.</div>`;
      return;
    }

    try {
      const questions = await InternAPI.getPracticeQuestions({
        topicIds: selectedTopicIds,
        count
      });

      if (!questions.length) {
        msg.innerHTML = `<div class="message error">No questions were found for the selected topics.</div>`;
        return;
      }

      const session = await InternAPI.createExamSession({
        mode: 'practice',
        selectedTopicIds,
        questionCount: questions.length,
        timerMinutes: null
      });

      InternCore.setSession({
        type: 'practice',
        sessionId: session.id
      });

      practiceState.questions = questions;
      practiceState.answers = {};
      practiceState.currentIndex = 0;

      renderQuestionScreen();
    } catch (error) {
      console.error(error);
      msg.innerHTML = `<div class="message error">Failed to start practice session.</div>`;
    }
  }

  function loadRetrySessionIfExists() {
    const params = new URLSearchParams(window.location.search);
    const isRetryMode = params.get('retry') === '1';

    if (!isRetryMode) return false;

    const retryData = InternCore.readStore(InternCore.config.storageKeys.practiceRetry, null);
    if (!retryData || !Array.isArray(retryData.questions) || !retryData.questions.length) {
      return false;
    }

    practiceState.questions = retryData.questions;
    practiceState.answers = {};
    practiceState.currentIndex = 0;

    renderQuestionScreen();
    return true;
  }

  function getCorrectOption(question) {
    return question.options.find((option) => option.is_correct) || null;
  }

  function clearAutoNextTimer() {
    if (practiceState.autoNextTimerId) {
      clearTimeout(practiceState.autoNextTimerId);
      practiceState.autoNextTimerId = null;
    }
  }

  function getAnsweredCount() {
    return practiceState.questions.filter((question) => !!practiceState.answers[question.id]).length;
  }

  function isFlagged(questionId) {
    return practiceState.flaggedQuestionIds.includes(questionId);
  }

  function toggleFlag(questionId) {
    if (isFlagged(questionId)) {
      practiceState.flaggedQuestionIds = practiceState.flaggedQuestionIds.filter((id) => id !== questionId);
    } else {
      practiceState.flaggedQuestionIds.push(questionId);
    }
    persistFlaggedSnapshot();
  }

  function persistFlaggedSnapshot() {
    const rows = practiceState.questions
      .filter((question) => isFlagged(question.id))
      .map((question) => {
        const answer = practiceState.answers[question.id] || null;
        const correctOption = getCorrectOption(question);
        return {
          question,
          selected: answer ? answer.selectedText : 'No answer selected',
          selectedOptionId: answer ? answer.selectedOptionId : null,
          correct: correctOption ? correctOption.text : '',
          isCorrect: answer ? answer.isCorrect : false,
          explanation: question.explanation,
          summary: question.summary,
          isFlagged: true
        };
      });

    InternCore.writeStore(InternCore.config.storageKeys.practiceFlagged, {
      title: 'Flagged Questions',
      total: rows.length,
      rows,
      createdAt: new Date().toISOString()
    });
  }

  function getQuestionVisualStatus(question, index) {
    const answer = practiceState.answers[question.id];
    const current = index === practiceState.currentIndex;

    if (current && answer?.isCorrect) return 'current-correct';
    if (current && answer && !answer.isCorrect) return 'current-wrong';
    if (current) return 'current';

    if (!answer) return 'unanswered';
    return answer.isCorrect ? 'correct' : 'wrong';
  }

  function renderQuestionStatusMap() {
    const answeredCount = getAnsweredCount();

    return `
      <div class="question-status-card">
        <div class="question-status-head">
          <div>
            <h4>Question Status</h4>
            <p>${answeredCount} of ${practiceState.questions.length} answered</p>
          </div>
        </div>

        <div class="question-status-legend">
          <span class="status-legend-item"><span class="status-dot current"></span> Current</span>
          <span class="status-legend-item"><span class="status-dot correct"></span> Correct</span>
          <span class="status-legend-item"><span class="status-dot wrong"></span> Wrong</span>
          <span class="status-legend-item"><span class="status-dot unanswered"></span> Unanswered</span>
          <span class="status-legend-item"><span class="status-dot flagged"></span> Flagged</span>
        </div>

        <div class="question-status-grid">
          ${practiceState.questions.map((item, index) => {
            const visualStatus = getQuestionVisualStatus(item, index);
            const flagged = isFlagged(item.id) ? 'is-flagged' : '';

            return `
              <button
                type="button"
                class="question-status-pill ${visualStatus} ${flagged}"
                data-question-index="${index}"
                title="Question ${index + 1}"
              >
                ${index + 1}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderAutoNextCountdown() {
    const question = practiceState.questions[practiceState.currentIndex];
    const answer = practiceState.answers[question.id];

    if (!practiceState.autoNextEnabled || !answer) return '';

    const seconds = Math.min(10, Math.max(1, Number(practiceState.autoNextSeconds || 3)));

    return `
      <div class="auto-next-countdown" id="autoNextCountdownBox">
        <span>Next in ${seconds}s</span>
        <button type="button" class="btn btn-light btn-sm" id="cancelAutoNextBtn">Cancel</button>
      </div>
    `;
  }

  function scheduleAutoNext() {
    clearAutoNextTimer();

    const question = practiceState.questions[practiceState.currentIndex];
    const answer = practiceState.answers[question.id];
    if (!practiceState.autoNextEnabled || !answer) return;

    const seconds = Math.min(10, Math.max(1, Number(practiceState.autoNextSeconds || 3)));
    let remaining = seconds;

    const countdownBox = () => InternCore.qs('#autoNextCountdownBox');
    const updateCountdownText = () => {
      const box = countdownBox();
      if (!box) return;
      const label = box.querySelector('span');
      if (label) label.textContent = `Next in ${remaining}s`;
    };

    updateCountdownText();

    const intervalId = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(intervalId);
        return;
      }
      updateCountdownText();
    }, 1000);

    practiceState.autoNextTimerId = window.setTimeout(async () => {
      clearInterval(intervalId);

      if (practiceState.currentIndex === practiceState.questions.length - 1) {
        await finishPracticeSession();
      } else {
        practiceState.currentIndex += 1;
        renderQuestionScreen();
      }
    }, seconds * 1000);
  }

  function getUnansweredQuestions() {
    return practiceState.questions.filter((question) => !practiceState.answers[question.id]);
  }

  function renderQuestionScreen() {
    clearAutoNextTimer();

    const root = InternCore.qs('#internPageRoot');
    const question = practiceState.questions[practiceState.currentIndex];
    const answer = practiceState.answers[question.id];
    const answeredCount = getAnsweredCount();
    const progressPercent = ((practiceState.currentIndex + 1) / practiceState.questions.length) * 100;
    const safeAutoNextSeconds = Math.min(10, Math.max(1, Number(practiceState.autoNextSeconds || 3)));
    const flagged = isFlagged(question.id);

    root.innerHTML = `
      <div class="study-shell">
        <aside class="side-panel">
          <div class="sidebar-card">
            <div class="tag">Practice Mode</div>
            <h3 style="margin:10px 0 12px;">Question ${practiceState.currentIndex + 1}</h3>

            <div class="progress-bar">
              <div class="progress-fill" style="width:${progressPercent}%"></div>
            </div>

            <div class="muted" style="margin-top:10px;">
              ${practiceState.currentIndex + 1} of ${practiceState.questions.length}
            </div>

            <div class="meta-row" style="margin-top:14px;">
              <span class="badge">${question.difficulty.toUpperCase()}</span>
              <span class="tag">${question.type}</span>
            </div>

            <div class="practice-progress-meta">
              <div class="practice-progress-row">
                <span>Answered</span>
                <strong>${answeredCount}/${practiceState.questions.length}</strong>
              </div>
              <div class="practice-progress-row">
                <span>Remaining</span>
                <strong>${practiceState.questions.length - answeredCount}</strong>
              </div>
              <div class="practice-progress-row">
                <span>Flagged</span>
                <strong>${practiceState.flaggedQuestionIds.length}</strong>
              </div>
            </div>
          </div>

          ${renderQuestionStatusMap()}

          <div class="sidebar-card">
            <h4 style="margin-top:0;">Auto-next</h4>

            <label class="auto-next-toggle">
              <input type="checkbox" id="autoNextEnabledInput" ${practiceState.autoNextEnabled ? 'checked' : ''} />
              <span>Enable auto-next after answering</span>
            </label>

            <div class="auto-next-row">
              <label for="autoNextSecondsInput" class="muted">Seconds</label>
              <input
                id="autoNextSecondsInput"
                class="input auto-next-seconds-input"
                type="number"
                min="1"
                max="10"
                value="${safeAutoNextSeconds}"
              />
            </div>

            <div class="muted auto-next-help">Choose from 1 to 10 seconds.</div>
          </div>

          <div class="sidebar-card">
            <h4 style="margin-top:0;">Topic</h4>
            <p class="muted">${question.topic_title}</p>
            <a class="btn btn-light" href="./practice.html">Back to setup</a>
          </div>
        </aside>

        <section class="question-card">
          <div class="question-top">
            <div>
              <div class="meta-row">
                <span class="badge">${question.topic_title}</span>
                <span class="tag">${question.type}</span>
                ${flagged ? '<span class="flag-chip">Flagged</span>' : ''}
              </div>
              <h2 class="question-title">${question.question_text}</h2>
            </div>

            <div class="question-top-actions">
              <button class="btn btn-light" id="toggleFlagBtn" type="button">
                ${flagged ? 'Unflag' : 'Flag'}
              </button>
            </div>
          </div>

          ${question.case_text ? `
            <div class="case-box">
              <strong>Case</strong>
              <div class="muted" style="margin-top:8px;">${question.case_text}</div>
            </div>
          ` : ''}

          ${question.image_url ? `
            <div style="margin-top:18px;">
              <img src="${question.image_url}" alt="Question visual" style="border-radius:22px; border:1px solid var(--border);" />
            </div>
          ` : ''}

          <div class="option-list" id="practiceOptionList"></div>

          <div class="explanation-box ${answer ? 'is-visible' : ''}" id="practiceExplanationBox">
            <strong>Explanation</strong>
            <div class="muted" style="margin-top:8px;">${answer ? question.explanation : ''}</div>
          </div>

          <div class="note-panel" id="summaryPanel" style="display:${answer && answer.showSummary ? 'block' : 'none'}; margin-top:18px;">
            <strong>Summary</strong>
            <div class="muted" style="margin-top:8px;">${question.summary}</div>
          </div>

          ${renderAutoNextCountdown()}

          <div class="action-row">
            <button class="btn btn-light" id="prevQuestionBtn" ${practiceState.currentIndex === 0 ? 'disabled' : ''}>Previous</button>

            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <button class="btn btn-secondary" id="toggleSummaryBtn" ${answer ? '' : 'disabled'}>Summary</button>
              <button class="btn btn-dark" id="nextQuestionBtn">${practiceState.currentIndex === practiceState.questions.length - 1 ? 'Finish Practice' : 'Next'}</button>
            </div>
          </div>
        </section>
      </div>
    `;

    const optionList = InternCore.qs('#practiceOptionList');

    question.options.forEach((option) => {
      const button = InternCore.el('button', 'option-btn');
      button.type = 'button';
      button.textContent = option.text;

      if (answer) {
        button.classList.add('locked');

        if (option.is_correct) {
          button.classList.add('correct');
        }

        if (answer.selectedOptionId === option.id && !option.is_correct) {
          button.classList.add('wrong');
        }
      }

      button.addEventListener('click', () => {
        if (practiceState.answers[question.id]) return;

        practiceState.answers[question.id] = {
          selectedOptionId: option.id,
          selectedText: option.text,
          isCorrect: !!option.is_correct,
          showSummary: false
        };

        renderQuestionScreen();
        scheduleAutoNext();
      });

      optionList.appendChild(button);
    });

    InternCore.qsa('.question-status-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        clearAutoNextTimer();
        practiceState.currentIndex = Number(btn.dataset.questionIndex);
        renderQuestionScreen();
      });
    });

    InternCore.qs('#toggleFlagBtn')?.addEventListener('click', () => {
      toggleFlag(question.id);
      renderQuestionScreen();
    });

    InternCore.qs('#cancelAutoNextBtn')?.addEventListener('click', () => {
      clearAutoNextTimer();
      practiceState.autoNextEnabled = false;
      renderQuestionScreen();
    });

    const autoNextEnabledInput = InternCore.qs('#autoNextEnabledInput');
    const autoNextSecondsInput = InternCore.qs('#autoNextSecondsInput');

    autoNextEnabledInput?.addEventListener('change', (event) => {
      practiceState.autoNextEnabled = !!event.target.checked;

      if (!practiceState.autoNextEnabled) {
        clearAutoNextTimer();
        renderQuestionScreen();
      } else if (practiceState.answers[question.id]) {
        renderQuestionScreen();
        scheduleAutoNext();
      }
    });

    autoNextSecondsInput?.addEventListener('input', (event) => {
      let value = Number(event.target.value || 3);
      if (!Number.isFinite(value)) value = 3;
      value = Math.min(10, Math.max(1, value));

      practiceState.autoNextSeconds = value;
      event.target.value = value;

      if (practiceState.autoNextEnabled && practiceState.answers[question.id]) {
        renderQuestionScreen();
        scheduleAutoNext();
      }
    });

    InternCore.qs('#prevQuestionBtn').addEventListener('click', () => {
      clearAutoNextTimer();

      if (practiceState.currentIndex > 0) {
        practiceState.currentIndex -= 1;
        renderQuestionScreen();
      }
    });

    InternCore.qs('#nextQuestionBtn').addEventListener('click', async () => {
      clearAutoNextTimer();

      if (practiceState.currentIndex === practiceState.questions.length - 1) {
        const unanswered = getUnansweredQuestions();

        if (unanswered.length) {
          const ok = window.confirm(
            `You still have ${unanswered.length} unanswered question${unanswered.length > 1 ? 's' : ''}. Finish anyway?`
          );
          if (!ok) return;
        }

        await finishPracticeSession();
      } else {
        practiceState.currentIndex += 1;
        renderQuestionScreen();
      }
    });

    InternCore.qs('#toggleSummaryBtn').addEventListener('click', () => {
      if (!practiceState.answers[question.id]) return;
      practiceState.answers[question.id].showSummary = !practiceState.answers[question.id].showSummary;
      renderQuestionScreen();
    });
  }

  async function finishPracticeSession() {
    const rows = practiceState.questions.map((question) => {
      const answer = practiceState.answers[question.id] || null;
      const correctOption = getCorrectOption(question);

      return {
        question,
        selected: answer ? answer.selectedText : 'No answer selected',
        selectedOptionId: answer ? answer.selectedOptionId : null,
        correct: correctOption ? correctOption.text : '',
        isCorrect: answer ? answer.isCorrect : false,
        explanation: question.explanation,
        summary: question.summary,
        isFlagged: isFlagged(question.id)
      };
    });

    const score = rows.filter((row) => row.isCorrect).length;
    InternCore.updateDashboardFromSession({
      mode: 'practice',
      rows,
      score,
      total: rows.length
    });

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
      console.error('Failed to save practice session to Supabase:', error);
    }

    InternCore.writeStore(InternCore.config.storageKeys.practiceReview, {
      title: 'Intern Practice Review',
      score,
      total: rows.length,
      rows,
      createdAt: new Date().toISOString()
    });

    InternCore.writeStore(InternCore.config.storageKeys.practiceFlagged, {
      title: 'Flagged Questions',
      total: rows.filter((row) => row.isFlagged).length,
      rows: rows.filter((row) => row.isFlagged),
      createdAt: new Date().toISOString()
    });

    window.location.href = './practice-review.html';
  }

  async function initPracticePage() {
    InternCore.createShell();

    if (loadRetrySessionIfExists()) return;

    try {
      const topics = await InternAPI.getTopics();
      practiceState.topics = topics.map((topic) => {
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

  document.addEventListener('DOMContentLoaded', initPracticePage);
})();
