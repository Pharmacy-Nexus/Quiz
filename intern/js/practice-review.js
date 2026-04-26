(function () {
  'use strict';

  function renderEmptyState(root) {
    root.innerHTML = `
      <section class="card center">
        <div class="meta-row" style="justify-content:center;">
          <span class="badge">No Review Found</span>
        </div>
        <h2>No practice review data is available yet.</h2>
        <p class="muted">Start a practice session first, then come back to review your answers.</p>
        <div class="action-row" style="justify-content:center; margin-top:24px;">
          <a class="btn btn-primary" href="./practice.html">Start Practice</a>
          <a class="btn btn-light" href="../index.html">Back</a>
        </div>
      </section>
    `;
  }

  function renderReviewPage(root, reviewData) {
    const rows = reviewData.rows || [];
    const score = reviewData.score || 0;
    const total = reviewData.total || 0;
    const percent = total ? Math.round((score / total) * 100) : 0;

    const correctRows = rows.filter((row) => row.isCorrect);
    const wrongRows = rows.filter((row) => !row.isCorrect);

    root.innerHTML = `
      <section class="section-header">
        <div>
          <h2>${InternCore.escapeHtml(reviewData.title || 'Practice Review')}</h2>
          <p>Review your selected answers, correct answers, explanations, and summaries.</p>
        </div>
      </section>

      <section class="summary-grid four" style="margin-bottom:24px;">
        <div class="card summary-card">
          <div class="muted">Score</div>
          <div class="big">${score}/${total}</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Percent</div>
          <div class="big">${percent}%</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Correct</div>
          <div class="big">${correctRows.length}</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Incorrect</div>
          <div class="big">${wrongRows.length}</div>
        </div>
      </section>

      <section class="card" style="margin-bottom:24px;">
        <div class="question-top">
          <div>
            <h3 style="margin:0 0 8px;">Review Actions</h3>
            <p class="muted" style="margin:0;">Retry only your wrong questions or start a brand new practice session.</p>
          </div>
          <div class="action-row" style="justify-content:flex-end; margin-top:0;">
            ${wrongRows.length ? '<button class="btn btn-primary" id="retryWrongQuestionsBtn" type="button">Retry Wrong Questions</button>' : ''}
            ${rows.some((row) => row.isFlagged) ? '<button class="btn btn-secondary" id="retryFlaggedQuestionsBtn" type="button">Retry Flagged</button>' : ''}
            <a class="btn btn-light" href="./practice.html">Back to Practice</a>
            <a class="btn btn-dark" href="./practice.html">Start New Practice</a>
          </div>
        </div>
      </section>

      <section class="review-list" id="practiceReviewList"></section>
    `;

    const list = InternCore.qs('#practiceReviewList');

    rows.forEach((row, index) => {
      const reviewCard = InternCore.el('article', 'review-card');
      reviewCard.innerHTML = `
        <div class="question-top">
          <div>
            <div class="meta-row">
              <span class="review-status ${row.isCorrect ? 'correct' : 'wrong'}">${row.isCorrect ? 'Correct' : 'Incorrect'}</span>
              <span class="tag">${InternCore.escapeHtml(row.question.topic_title)}</span>
              <span class="tag">${InternCore.escapeHtml(row.question.type)}</span>
              <span class="badge">${InternCore.escapeHtml((row.question.difficulty || '').toUpperCase())}</span>
              ${row.isFlagged ? '<span class="flag-chip">Flagged</span>' : ''}
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

        ${row.question.image_url ? `
          <div style="margin-top:18px;">
            <img src="${InternCore.escapeHtml(row.question.image_url)}" alt="Question visual" style="border-radius:22px; border:1px solid var(--border);" />
          </div>
        ` : ''}

        <div class="review-answer"><strong>Your answer:</strong> ${InternCore.escapeHtml(row.selected)}</div>
        <div class="review-answer"><strong>Correct answer:</strong> ${InternCore.escapeHtml(row.correct)}</div>
        <div class="review-answer"><strong>Explanation:</strong> ${InternCore.escapeHtml(row.explanation)}</div>
        <div class="review-answer"><strong>Summary:</strong> ${InternCore.escapeHtml(row.summary)}</div>
      `;
      list.appendChild(reviewCard);
    });

    const retryBtn = InternCore.qs('#retryWrongQuestionsBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        const wrongQuestions = wrongRows.map((row) => row.question);

        InternCore.writeStore(InternCore.config.storageKeys.practiceRetry, {
          title: 'Retry Wrong Questions',
          questions: wrongQuestions,
          createdAt: new Date().toISOString()
        });

        window.location.href = './practice.html?retry=1';
      });
    }

    const retryFlaggedBtn = InternCore.qs('#retryFlaggedQuestionsBtn');
    if (retryFlaggedBtn) {
      retryFlaggedBtn.addEventListener('click', () => {
        const flaggedQuestions = rows
          .filter((row) => row.isFlagged)
          .map((row) => row.question);

        InternCore.writeStore(InternCore.config.storageKeys.practiceRetry, {
          title: 'Retry Flagged Questions',
          questions: flaggedQuestions,
          createdAt: new Date().toISOString()
        });

        window.location.href = './practice.html?retry=1';
      });
    }
  }

  function initPracticeReviewPage() {
    InternCore.createShell();

    const root = InternCore.qs('#internPageRoot');
    const reviewData = InternCore.readStore(InternCore.config.storageKeys.practiceReview, null);

    if (!reviewData || !Array.isArray(reviewData.rows) || !reviewData.rows.length) {
      renderEmptyState(root);
      return;
    }

    renderReviewPage(root, reviewData);
  }

  document.addEventListener('DOMContentLoaded', initPracticeReviewPage);
})();
