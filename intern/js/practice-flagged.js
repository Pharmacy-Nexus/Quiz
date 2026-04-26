(function () {
  'use strict';

  function renderEmptyState(root) {
    root.innerHTML = `
      <section class="card center">
        <div class="meta-row" style="justify-content:center;">
          <span class="badge">No Flagged Questions</span>
        </div>
        <h2>No flagged questions are available yet.</h2>
        <p class="muted">Flag questions during practice, then come back here to review or retry them.</p>
        <div class="action-row" style="justify-content:center; margin-top:24px;">
          <a class="btn btn-primary" href="./practice.html">Open Practice Mode</a>
          <a class="btn btn-light" href="../index.html">Back</a>
        </div>
      </section>
    `;
  }

  function renderFlaggedPage(root, flaggedData) {
    const rows = flaggedData.rows || [];

    root.innerHTML = `
      <section class="section-header">
        <div>
          <h2>${InternCore.escapeHtml(flaggedData.title || 'Flagged Questions')}</h2>
          <p>Review every flagged question, retry them as a focused set, or clear the flagged list.</p>
        </div>
      </section>

      <section class="summary-grid three" style="margin-bottom:24px;">
        <div class="card summary-card">
          <div class="muted">Flagged</div>
          <div class="big">${rows.length}</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Answered</div>
          <div class="big">${rows.filter((row) => row.selected !== 'No answer selected').length}</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Correct</div>
          <div class="big">${rows.filter((row) => row.isCorrect).length}</div>
        </div>
      </section>

      <section class="card" style="margin-bottom:24px;">
        <div class="question-top">
          <div>
            <h3 style="margin:0 0 8px;">Flagged Actions</h3>
            <p class="muted" style="margin:0;">Retry your flagged questions or clear the list.</p>
          </div>
          <div class="action-row" style="justify-content:flex-end; margin-top:0;">
            <button class="btn btn-primary" id="retryFlaggedSetBtn" type="button">Retry Flagged</button>
            <button class="btn btn-light" id="clearFlaggedSetBtn" type="button">Clear Flagged</button>
            <a class="btn btn-dark" href="./practice.html">Open Practice Mode</a>
          </div>
        </div>
      </section>

      <section class="review-list" id="flaggedReviewList"></section>
    `;

    const list = InternCore.qs('#flaggedReviewList');

    rows.forEach((row, index) => {
      const reviewCard = InternCore.el('article', 'review-card');
      reviewCard.innerHTML = `
        <div class="question-top">
          <div>
            <div class="meta-row">
              <span class="flag-chip">Flagged</span>
              <span class="tag">${InternCore.escapeHtml(row.question.topic_title)}</span>
              <span class="tag">${InternCore.escapeHtml(row.question.type)}</span>
              <span class="badge">${InternCore.escapeHtml((row.question.difficulty || '').toUpperCase())}</span>
              ${row.selected !== 'No answer selected'
                ? `<span class="review-status ${row.isCorrect ? 'correct' : 'wrong'}">${row.isCorrect ? 'Correct' : 'Incorrect'}</span>`
                : '<span class="review-status">Unanswered</span>'}
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

    InternCore.qs('#retryFlaggedSetBtn')?.addEventListener('click', () => {
      const flaggedQuestions = rows.map((row) => row.question);

      InternCore.writeStore(InternCore.config.storageKeys.practiceRetry, {
        title: 'Retry Flagged Questions',
        questions: flaggedQuestions,
        createdAt: new Date().toISOString()
      });

      window.location.href = './practice.html?retry=1';
    });

    InternCore.qs('#clearFlaggedSetBtn')?.addEventListener('click', () => {
      InternCore.writeStore(InternCore.config.storageKeys.practiceFlagged, {
        title: 'Flagged Questions',
        rows: [],
        createdAt: new Date().toISOString()
      });

      window.location.reload();
    });
  }

  function initPracticeFlaggedPage() {
    InternCore.createShell();

    const root = InternCore.qs('#internPageRoot');
    const flaggedData = InternCore.readStore(InternCore.config.storageKeys.practiceFlagged, null);

    if (!flaggedData || !Array.isArray(flaggedData.rows) || !flaggedData.rows.length) {
      renderEmptyState(root);
      return;
    }

    renderFlaggedPage(root, flaggedData);
  }

  document.addEventListener('DOMContentLoaded', initPracticeFlaggedPage);
})();
