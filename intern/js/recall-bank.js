(function () {
  'use strict';

  const RECALL_EXPIRY_HOURS = 24;

  const state = {
    questions: [],
    answers: {},
    currentIndex: 0,
    remainingSeconds: 0,
    timerId: null,
    sessionId: null,
    hideSolved: true,
    questionCount: 20,
    timerMinutes: 30,
    startedAt: null,
    expiresAt: null
  };

  function getSolvedIds() {
    return InternCore.readStore('pn_intern_recall_solved_ids_v1', []);
  }

  function saveSolvedIds(ids) {
    InternCore.writeStore('pn_intern_recall_solved_ids_v1', Array.from(new Set(ids)));
  }

  function getSavedExamState() {
    const saved = InternCore.readStore('pn_intern_recall_exam_state_v1', null);
    if (!saved) return null;

    const expiresAt = saved.expiresAt ? new Date(saved.expiresAt) : null;
    if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      InternCore.removeStore('pn_intern_recall_exam_state_v1');
      return null;
    }

    return saved;
  }

  function persistExamState() {
    if (!state.questions.length) return;

    InternCore.writeStore('pn_intern_recall_exam_state_v1', {
      questions: state.questions,
      answers: state.answers,
      currentIndex: state.currentIndex,
      remainingSeconds: state.remainingSeconds,
      sessionId: state.sessionId,
      hideSolved: state.hideSolved,
      questionCount: state.questionCount,
      timerMinutes: state.timerMinutes,
      startedAt: state.startedAt,
      expiresAt: state.expiresAt
    });
  }

  function clearSavedExamState() {
    InternCore.removeStore('pn_intern_recall_exam_state_v1');
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function getAnsweredCount() {
    return state.questions.filter((question) => !!state.answers[question.id]).length;
  }

  function renderSetupPage({ resumeState = null, totalRecallCount = 0 } = {}) {
    const root = InternCore.qs('#internPageRoot');
    const solvedCount = getSolvedIds().length;
    const availableCount = Math.max(0, totalRecallCount - solvedCount);

    root.innerHTML = `
      <section class="section-header">
        <div>
          <h2>Real Exam Recall Bank</h2>
          <p>Launch a mixed recall exam without topics, hide solved questions, and resume unfinished attempts for up to ${RECALL_EXPIRY_HOURS} hours.</p>
        </div>
      </section>

      <section class="summary-grid four" style="margin-bottom:24px;">
        <div class="card summary-card">
          <div class="muted">Total Recall Questions</div>
          <div class="big">${InternCore.formatNumber(totalRecallCount)}</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Solved on This Browser</div>
          <div class="big">${InternCore.formatNumber(solvedCount)}</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Available Unsolved</div>
          <div class="big">${InternCore.formatNumber(availableCount)}</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Resume Window</div>
          <div class="big">${RECALL_EXPIRY_HOURS}h</div>
        </div>
      </section>

      ${resumeState ? `
        <section class="card recall-resume-card" style="margin-bottom:24px;">
          <div class="question-top">
            <div>
              <h3 style="margin:0 0 8px;">Unfinished Recall Exam Found</h3>
              <p class="muted" style="margin:0;">Question ${Number(resumeState.currentIndex || 0) + 1} of ${resumeState.questions.length} • ${getAnsweredCountFromSaved(resumeState)} answered • ${formatTime(Number(resumeState.remainingSeconds || 0))} remaining</p>
            </div>
            <div class="action-row" style="margin-top:0;">
              <button class="btn btn-primary" id="resumeRecallExamBtn" type="button">Resume Exam</button>
              <button class="btn btn-light" id="discardRecallExamBtn" type="button">Discard</button>
            </div>
          </div>
        </section>
      ` : ''}

      <section class="card">
        <div class="input-row three">
          <div>
            <label class="muted">Number of questions</label>
            <input class="input" id="recallQuestionCountInput" type="number" min="1" value="20" />
          </div>
          <div>
            <label class="muted">Timer (minutes)</label>
            <input class="input" id="recallTimerMinutesInput" type="number" min="1" value="30" />
          </div>
          <div>
            <label class="muted">Question visibility</label>
            <label class="toggle-row">
              <input type="checkbox" id="hideSolvedRecallInput" checked />
              <span>Hide solved questions</span>
            </label>
          </div>
        </div>

        <div class="recall-setup-note">
          <strong>CSV upload:</strong> add recall questions from Admin → Real Exam Recall Bulk Upload.
        </div>

        <div id="recallSetupMessage"></div>

        <div class="action-row" style="justify-content:flex-start; margin-top:18px;">
          <button class="btn btn-primary" id="startRecallExamBtn" type="button">Start Recall Exam</button>
          <a class="btn btn-light" href="../index.html">Back</a>
        </div>
      </section>
    `;

    InternCore.qs('#startRecallExamBtn')?.addEventListener('click', startRecallExam);
    InternCore.qs('#resumeRecallExamBtn')?.addEventListener('click', () => {
      restoreSavedExam(resumeState);
      renderExamScreen();
      startTimer();
    });
    InternCore.qs('#discardRecallExamBtn')?.addEventListener('click', () => {
      clearSavedExamState();
      renderSetup();
    });
  }

  function getAnsweredCountFromSaved(saved) {
    const answers = saved?.answers || {};
    const questions = saved?.questions || [];
    return questions.filter((question) => !!answers[question.id]).length;
  }

  async function renderSetup() {
    const totalRecallCount = await InternAPI.getRecallQuestionCount().catch(() => 0);
    const resumeState = getSavedExamState();
    renderSetupPage({ resumeState, totalRecallCount });
  }

  async function startRecallExam() {
    const count = Math.max(1, Number(InternCore.qs('#recallQuestionCountInput')?.value || 20));
    const minutes = Math.max(1, Number(InternCore.qs('#recallTimerMinutesInput')?.value || 30));
    const hideSolved = !!InternCore.qs('#hideSolvedRecallInput')?.checked;
    const msg = InternCore.qs('#recallSetupMessage');
    const solvedIds = hideSolved ? getSolvedIds() : [];

    try {
      msg.innerHTML = `<div class="message">Loading recall questions...</div>`;

      const questions = await InternAPI.getRecallQuestions({
        count,
        excludeQuestionIds: solvedIds
      });

      if (!questions.length) {
        msg.innerHTML = `<div class="message error">No recall questions are available for the current filters.</div>`;
        return;
      }

      const session = await InternAPI.createExamSession({
        mode: 'real',
        selectedTopicIds: [],
        questionCount: questions.length,
        timerMinutes: minutes
      });

      state.questions = questions;
      state.answers = {};
      state.currentIndex = 0;
      state.remainingSeconds = minutes * 60;
      state.sessionId = session.id;
      state.hideSolved = hideSolved;
      state.questionCount = questions.length;
      state.timerMinutes = minutes;
      state.startedAt = new Date().toISOString();
      state.expiresAt = new Date(Date.now() + RECALL_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

      persistExamState();
      renderExamScreen();
      startTimer();
    } catch (error) {
      console.error(error);
      msg.innerHTML = `<div class="message error">Failed to start recall exam.</div>`;
    }
  }

  function restoreSavedExam(saved) {
    state.questions = saved.questions || [];
    state.answers = saved.answers || {};
    state.currentIndex = Number(saved.currentIndex || 0);
    state.remainingSeconds = Number(saved.remainingSeconds || 0);
    state.sessionId = saved.sessionId || null;
    state.hideSolved = !!saved.hideSolved;
    state.questionCount = Number(saved.questionCount || (saved.questions || []).length || 20);
    state.timerMinutes = Number(saved.timerMinutes || 30);
    state.startedAt = saved.startedAt || new Date().toISOString();
    state.expiresAt = saved.expiresAt || new Date(Date.now() + RECALL_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
  }

  function clearTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function startTimer() {
    clearTimer();
    state.timerId = window.setInterval(async () => {
      state.remainingSeconds -= 1;
      if (state.remainingSeconds <= 0) {
        clearTimer();
        state.remainingSeconds = 0;
        persistExamState();
        await finishRecallExam();
        return;
      }
      const timerEl = InternCore.qs('#recallTimerValue');
      if (timerEl) timerEl.textContent = formatTime(state.remainingSeconds);
      persistExamState();
    }, 1000);
  }

  function selectAnswer(optionId, optionText) {
    const question = state.questions[state.currentIndex];
    if (!question) return;

    state.answers[question.id] = {
      selectedOptionId: optionId,
      selectedText: optionText
    };
    persistExamState();
    renderExamScreen();
  }

  function getCorrectOption(question) {
    return (question.options || []).find((option) => option.is_correct) || null;
  }

  function renderExamScreen() {
    const root = InternCore.qs('#internPageRoot');
    const question = state.questions[state.currentIndex];
    const answer = state.answers[question.id];
    const answeredCount = getAnsweredCount();
    const progressPercent = ((state.currentIndex + 1) / state.questions.length) * 100;

    root.innerHTML = `
      <div class="study-shell">
        <aside class="side-panel">
          <div class="sidebar-card">
            <div class="tag">Recall Exam</div>
            <h3 style="margin:10px 0 12px;">Question ${state.currentIndex + 1}</h3>

            <div class="progress-bar">
              <div class="progress-fill" style="width:${progressPercent}%"></div>
            </div>

            <div class="muted" style="margin-top:10px;">${state.currentIndex + 1} of ${state.questions.length}</div>

            <div class="practice-progress-meta">
              <div class="practice-progress-row">
                <span>Answered</span>
                <strong>${answeredCount}/${state.questions.length}</strong>
              </div>
              <div class="practice-progress-row">
                <span>Remaining</span>
                <strong>${state.questions.length - answeredCount}</strong>
              </div>
              <div class="practice-progress-row">
                <span>Timer</span>
                <strong id="recallTimerValue">${formatTime(state.remainingSeconds)}</strong>
              </div>
            </div>
          </div>

          <div class="question-status-card">
            <div class="question-status-head">
              <div>
                <h4>Question Status</h4>
                <p>Jump directly to any question.</p>
              </div>
            </div>

            <div class="question-status-grid">
              ${state.questions.map((item, index) => {
                const current = index === state.currentIndex;
                const answered = !!state.answers[item.id];
                const cls = current ? 'current' : answered ? 'answered' : 'unanswered';
                return `<button type="button" class="question-status-pill ${cls}" data-question-index="${index}">${index + 1}</button>`;
              }).join('')}
            </div>
          </div>

          <div class="sidebar-card">
            <h4 style="margin-top:0;">Session</h4>
            <p class="muted">This unfinished exam stays resumable for ${RECALL_EXPIRY_HOURS} hours unless you discard it.</p>
            <div class="action-row" style="justify-content:flex-start;">
              <button class="btn btn-light" id="saveAndExitRecallBtn" type="button">Save & Exit</button>
            </div>
          </div>
        </aside>

        <section class="question-card">
          <div class="question-top">
            <div>
              <div class="meta-row">
                <span class="badge">Real Exam Recall Bank</span>
                <span class="tag">${InternCore.escapeHtml((question.difficulty || '').toUpperCase())}</span>
                <span class="tag">${InternCore.escapeHtml(question.type)}</span>
              </div>
              <h2 class="question-title">${InternCore.escapeHtml(question.question_text)}</h2>
            </div>
          </div>

          ${question.case_text ? `
            <div class="case-box">
              <strong>Case</strong>
              <div class="muted" style="margin-top:8px;">${InternCore.escapeHtml(question.case_text)}</div>
            </div>
          ` : ''}

          <div class="option-list" id="recallOptionList"></div>

          <div class="action-row">
            <button class="btn btn-light" id="prevRecallQuestionBtn" ${state.currentIndex === 0 ? 'disabled' : ''}>Previous</button>

            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-light" id="exitRecallExamBtn" type="button">Exit</button>
              <button class="btn btn-primary" id="nextRecallQuestionBtn" type="button">${state.currentIndex === state.questions.length - 1 ? 'Finish Recall Exam' : 'Next'}</button>
            </div>
          </div>
        </section>
      </div>
    `;

    const optionList = InternCore.qs('#recallOptionList');

    question.options.forEach((option) => {
      const button = InternCore.el('button', 'option-btn');
      button.type = 'button';
      button.textContent = option.text;

      if (answer?.selectedOptionId === option.id) {
        button.classList.add('selected');
      }

      button.addEventListener('click', () => selectAnswer(option.id, option.text));
      optionList.appendChild(button);
    });

    InternCore.qsa('.question-status-pill').forEach((button) => {
      button.addEventListener('click', () => {
        state.currentIndex = Number(button.dataset.questionIndex);
        persistExamState();
        renderExamScreen();
      });
    });

    InternCore.qs('#prevRecallQuestionBtn')?.addEventListener('click', () => {
      if (state.currentIndex > 0) {
        state.currentIndex -= 1;
        persistExamState();
        renderExamScreen();
      }
    });

    InternCore.qs('#nextRecallQuestionBtn')?.addEventListener('click', async () => {
      if (state.currentIndex === state.questions.length - 1) {
        const unanswered = state.questions.filter((questionItem) => !state.answers[questionItem.id]).length;
        if (unanswered) {
          const ok = window.confirm(`You still have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Finish anyway?`);
          if (!ok) return;
        }
        await finishRecallExam();
      } else {
        state.currentIndex += 1;
        persistExamState();
        renderExamScreen();
      }
    });

    InternCore.qs('#saveAndExitRecallBtn')?.addEventListener('click', () => {
      persistExamState();
      window.location.href = './recall-bank.html';
    });

    InternCore.qs('#exitRecallExamBtn')?.addEventListener('click', () => {
      persistExamState();
      window.location.href = './recall-bank.html';
    });
  }

  async function finishRecallExam() {
    clearTimer();

    const rows = state.questions.map((question) => {
      const answer = state.answers[question.id] || null;
      const correctOption = getCorrectOption(question);

      return {
        question,
        selected: answer ? answer.selectedText : 'No answer selected',
        selectedOptionId: answer ? answer.selectedOptionId : null,
        correct: correctOption ? correctOption.text : '',
        isCorrect: answer ? answer.selectedOptionId === correctOption?.id : false,
        explanation: question.explanation,
        summary: question.summary
      };
    });

    const score = rows.filter((row) => row.isCorrect).length;

    try {
      if (state.sessionId) {
        await InternAPI.saveExamAnswers({
          sessionId: state.sessionId,
          rows
        });

        await InternAPI.completeExamSession({
          sessionId: state.sessionId,
          score,
          totalQuestions: rows.length
        });
      }
    } catch (error) {
      console.error('Failed to save recall exam session to Supabase:', error);
    }

    saveSolvedIds([...getSolvedIds(), ...state.questions.map((question) => question.id)]);
    InternCore.writeStore('pn_intern_recall_review_v1', {
      title: 'Real Exam Recall Review',
      score,
      total: rows.length,
      rows,
      createdAt: new Date().toISOString()
    });
    clearSavedExamState();
    renderResultPage({
      title: 'Real Exam Recall Review',
      score,
      total: rows.length,
      rows
    });
  }

  function renderResultPage(reviewData) {
    const root = InternCore.qs('#internPageRoot');
    const rows = reviewData.rows || [];
    const percent = reviewData.total ? Math.round((reviewData.score / reviewData.total) * 100) : 0;
    const wrongRows = rows.filter((row) => !row.isCorrect);

    root.innerHTML = `
      <section class="section-header">
        <div>
          <h2>${InternCore.escapeHtml(reviewData.title)}</h2>
          <p>Your mixed recall exam remains available in review on this browser until replaced by a newer recall review.</p>
        </div>
      </section>

      <section class="summary-grid four" style="margin-bottom:24px;">
        <div class="card summary-card">
          <div class="muted">Score</div>
          <div class="big">${reviewData.score}/${reviewData.total}</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Percent</div>
          <div class="big">${percent}%</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Correct</div>
          <div class="big">${rows.length - wrongRows.length}</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Wrong</div>
          <div class="big">${wrongRows.length}</div>
        </div>
      </section>

      <section class="card" style="margin-bottom:24px;">
        <div class="action-row" style="justify-content:flex-start;">
          <a class="btn btn-primary" href="./recall-bank.html">Start Another Recall Exam</a>
        </div>
      </section>

      <div class="review-list">
        ${rows.map((row, index) => `
          <article class="review-card">
            <div class="question-top">
              <div>
                <div class="meta-row">
                  <span class="review-status ${row.isCorrect ? 'correct' : 'wrong'}">${row.isCorrect ? 'Correct' : 'Incorrect'}</span>
                  <span class="tag">Recall Bank</span>
                  <span class="badge">${InternCore.escapeHtml((row.question.difficulty || '').toUpperCase())}</span>
                </div>
                <h3 style="margin:10px 0 8px;">${index + 1}. ${InternCore.escapeHtml(row.question.question_text)}</h3>
              </div>
            </div>

            ${row.question.case_text ? `
              <div class="case-box">
                <strong>Case</strong>
                <div class="muted" style="margin-top:8px;">${InternCore.escapeHtml(row.question.case_text)}</div>
              </div>
            ` : ''}

            <div class="review-answer"><strong>Your answer:</strong> ${InternCore.escapeHtml(row.selected)}</div>
            <div class="review-answer"><strong>Correct answer:</strong> ${InternCore.escapeHtml(row.correct)}</div>
            <div class="review-answer"><strong>Explanation:</strong> ${InternCore.escapeHtml(row.explanation || 'No explanation available.')}</div>
            <div class="review-answer"><strong>Summary:</strong> ${InternCore.escapeHtml(row.summary || 'No summary available.')}</div>
          </article>
        `).join('')}
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    InternCore.createShell();
    await renderSetup();
  });

  window.addEventListener('beforeunload', () => {
    if (state.questions.length && state.remainingSeconds > 0) {
      persistExamState();
    }
  });
})();
