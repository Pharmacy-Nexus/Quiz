(function () {
  'use strict';

  function renderEmptyState(root) {
    root.innerHTML = `
      <section class="card center">
        <div class="meta-row" style="justify-content:center;">
          <span class="badge">No Exam Review Found</span>
        </div>
        <h2>No real exam review data is available yet.</h2>
        <p class="muted">Start a real exam first, then come back to review your analytics.</p>
        <div class="action-row" style="justify-content:center; margin-top:24px;">
          <a class="btn btn-primary" href="./exam.html">Start Real Exam</a>
          <a class="btn btn-light" href="../index.html">Back</a>
        </div>
      </section>
    `;
  }

  function renderTopicStats(stats) {
    if (!stats.length) {
      return `<div class="intern-empty">No topic analytics found.</div>`;
    }

    return `
      <div class="review-list">
        ${stats.map((item) => `
          <article class="review-card">
            <div class="question-top">
              <div>
                <h3 style="margin:0 0 8px;">${InternCore.escapeHtml(item.topic)}</h3>
                <div class="meta-row">
                  <span class="badge">${item.accuracy}% Accuracy</span>
                  <span class="tag">${item.total} Questions</span>
                  <span class="tag">${item.correct} Correct</span>
                  <span class="tag">${item.wrong} Wrong</span>
                </div>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderQuestionReview(rows) {
    return `
      <div class="review-list">
        ${rows.map((row, index) => `
          <article class="review-card">
            <div class="question-top">
              <div>
                <div class="meta-row">
                  <span class="review-status ${row.isCorrect ? 'correct' : 'wrong'}">${row.isCorrect ? 'Correct' : 'Incorrect'}</span>
                  <span class="tag">${InternCore.escapeHtml(row.question.topic_title)}</span>
                  <span class="tag">${InternCore.escapeHtml(row.question.type)}</span>
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
            <div class="review-answer"><strong>Explanation:</strong> ${InternCore.escapeHtml(row.explanation)}</div>
            <div class="review-answer"><strong>Summary:</strong> ${InternCore.escapeHtml(row.summary)}</div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderReviewPage(root, reviewData) {
    const rows = reviewData.rows || [];
    const score = reviewData.score || 0;
    const total = reviewData.total || 0;
    const percent = total ? Math.round((score / total) * 100) : 0;
    const wrongRows = rows.filter((row) => !row.isCorrect);

    root.innerHTML = `
      <section class="section-header">
        <div>
          <h2>${InternCore.escapeHtml(reviewData.title || 'Real Exam Review')}</h2>
          <p>Detailed score report with topic-by-topic analysis, strengths, weaknesses, and full answer review.</p>
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
          <div class="big">${score}</div>
        </div>
        <div class="card summary-card">
          <div class="muted">Incorrect</div>
          <div class="big">${total - score}</div>
        </div>
      </section>

      <section class="card" style="margin-bottom:24px;">
        <div class="question-top">
          <div>
            <h3 style="margin:0 0 8px;">Exam Actions</h3>
            <p class="muted" style="margin:0;">Retry only wrong questions or launch a new real exam session.</p>
          </div>
          <div class="action-row" style="justify-content:flex-end; margin-top:0;">
            ${wrongRows.length ? '<button class="btn btn-primary" id="retryWrongExamBtn" type="button">Retry Wrong Questions</button>' : ''}
            <a class="btn btn-light" href="./exam.html">Back to Real Exam</a>
            <a class="btn btn-dark" href="./exam.html">Start New Real Exam</a>
          </div>
        </div>
      </section>

      <section class="intern-section">
        <div class="section-header">
          <div>
            <h2>Topic Performance</h2>
            <p>How you performed across the selected topics in this exam.</p>
          </div>
        </div>
        ${renderTopicStats(reviewData.topicStats || [])}
      </section>

      <section class="intern-section">
        <div class="analysis-grid">
          <div class="card">
            <h3 style="margin-top:0;">Strongest Topics</h3>
            ${reviewData.strongest?.length ? reviewData.strongest.map((item) => `
              <div class="metric-row">
                <span>${InternCore.escapeHtml(item.topic)}</span>
                <strong>${item.accuracy}%</strong>
              </div>
            `).join('') : '<div class="muted">No data found.</div>'}
          </div>

          <div class="card">
            <h3 style="margin-top:0;">Weakest Topics</h3>
            ${reviewData.weakest?.length ? reviewData.weakest.map((item) => `
              <div class="metric-row">
                <span>${InternCore.escapeHtml(item.topic)}</span>
                <strong>${item.accuracy}%</strong>
              </div>
            `).join('') : '<div class="muted">No data found.</div>'}
          </div>
        </div>
      </section>

      <section class="intern-section">
        <div class="section-header">
          <div>
            <h2>Question Review</h2>
            <p>Full question-by-question review with explanations and summaries.</p>
          </div>
        </div>
        ${renderQuestionReview(rows)}
      </section>
    `;

    const retryBtn = InternCore.qs('#retryWrongExamBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        const wrongQuestions = wrongRows.map((row) => row.question);

        InternCore.writeStore(InternCore.config.storageKeys.examRetry, {
          title: 'Retry Wrong Real Exam Questions',
          questions: wrongQuestions,
          createdAt: new Date().toISOString()
        });

        window.location.href = './exam.html?retry=1';
      });
    }
  }

  function initExamReviewPage() {
    InternCore.createShell();

    const root = InternCore.qs('#internPageRoot');
    const reviewData = InternCore.readStore(InternCore.config.storageKeys.examReview, null);

    if (!reviewData || !Array.isArray(reviewData.rows) || !reviewData.rows.length) {
      renderEmptyState(root);
      return;
    }

    renderReviewPage(root, reviewData);
  }

  document.addEventListener('DOMContentLoaded', initExamReviewPage);
})();
