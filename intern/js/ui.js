(function () {
  'use strict';

  async function renderInternHome() {
    const root = InternCore.qs('#internPageRoot');
    root.innerHTML = `
      <section class="hero intern-hero">
        <div class="hero-grid">
          <div>
            <span class="eyebrow">Intern Section • Pharmacist Licensure</span>
            <h1>Build your <span>intern exam system</span></h1>
            <p>
              Practice by topic, launch real timed exams, review summaries,
              track weak areas, and manage large topic banks for pharmacist licensure preparation.
            </p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="./pages/practice.html">Start Practice Mode</a>
              <a class="btn btn-secondary" href="./pages/exam.html">Start Real Exam</a>
            </div>
          </div>

          <div class="hero-panel">
            <h3>What this section will do</h3>
            <p>
              Large topic bank, two exam modes, instant feedback, real timed exams,
              review analytics, retry wrong questions, and a dedicated admin workflow.
            </p>

            <div class="intern-stat-grid">
              <div class="intern-stat">
                <div class="label">Available Topics</div>
                <div class="value" id="topicsCount">--</div>
              </div>
              <div class="intern-stat">
                <div class="label">Question Types</div>
                <div class="value">4</div>
              </div>
              <div class="intern-stat">
                <div class="label">Modes</div>
                <div class="value">2</div>
              </div>
              <div class="intern-stat">
                <div class="label">Database</div>
                <div class="value">Ready</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="intern-section">
        <div class="section-header">
          <div>
            <h2>Choose your mode</h2>
            <p>Practice with instant feedback, or simulate a real timed exam experience.</p>
          </div>
        </div>

        <div class="mode-grid">
          <article class="mode-card practice">
            <span class="mode-badge">Practice Mode</span>
            <h3>Mock / Training Exam</h3>
            <p class="muted">
              Instant feedback after each answer, explanation, summary button,
              and a detailed review page after finishing.
            </p>

            <div class="mode-features">
              <div class="mode-feature">Correct answer appears immediately</div>
              <div class="mode-feature">Wrong answer highlighted automatically</div>
              <div class="mode-feature">Explanation + Summary for each question</div>
              <div class="mode-feature">Review page + retry wrong questions</div>
            </div>

            <a class="btn btn-dark" href="./pages/practice.html">Open Practice Mode</a>
          </article>

          <article class="mode-card real">
            <span class="mode-badge">Real Exam Mode</span>
            <h3>Timed Licensure Simulation</h3>
            <p>
              Choose number of questions, select many topics, run with a timer,
              then get topic-based analysis and weakness review.
            </p>

            <div class="mode-features">
              <div class="mode-feature">Custom number of questions</div>
              <div class="mode-feature">Multi-topic selection</div>
              <div class="mode-feature">Timer-based real exam flow</div>
              <div class="mode-feature">Weakness analysis by topic</div>
            </div>

            <a class="btn btn-primary" href="./pages/exam.html">Open Real Exam Mode</a>
          </article>
        </div>
      </section>

      <section class="intern-section topic-preview">
        <div class="section-header">
          <div>
            <h2>Topic bank preview</h2>
            <p>This will later be loaded from Supabase and can grow to 100 topics or more.</p>
          </div>
        </div>

        <div id="topicPreviewArea">
          <div class="intern-empty">Loading topics...</div>
        </div>
      </section>

      <section class="intern-section recall-bank-preview">
        <div class="section-header">
          <div>
            <h2>Real Exam Recall Bank</h2>
            <p>Mixed licensure-style recall questions uploaded in one bank, with solved-question hiding and resume support.</p>
          </div>
        </div>

        <article class="recall-bank-feature-card">
          <div class="recall-bank-feature-grid">
            <div class="recall-bank-feature-main">
              <div class="recall-bank-feature-eyebrow">Recall mode • Mixed bank</div>
              <h3>Train on reconstructed and recalled licensure patterns in one focused flow.</h3>
              <p>
                Open one mixed recall bank, hide solved questions automatically, and resume unfinished attempts for up to 24 hours without rebuilding your exam.
              </p>

              <div class="recall-bank-pill-row">
                <span class="badge" id="recallBankCountBadge">-- Questions</span>
                <span class="tag">Mixed recall sets</span>
                <span class="tag">Hide solved questions</span>
                <span class="tag">Resume unfinished exam</span>
              </div>

              <div class="recall-bank-action-row">
                <a class="btn btn-primary" href="./pages/recall-bank.html">Open Recall Bank</a>
                <a class="btn btn-light" href="./pages/recall-bank.html">Resume / Continue</a>
              </div>
            </div>

            <div class="recall-bank-feature-side">
              <div class="recall-bank-stat-grid">
                <div class="recall-bank-stat">
                  <div class="label">Bank Type</div>
                  <div class="value">Mixed</div>
                </div>
                <div class="recall-bank-stat">
                  <div class="label">Resume Window</div>
                  <div class="value">24h</div>
                </div>
                <div class="recall-bank-stat wide">
                  <div class="label">Best for</div>
                  <div class="value small">High-yield recall drills</div>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>
    `;

    const topics = await InternAPI.getTopics();
    InternCore.setTopics(topics);

    const topicsCountEl = InternCore.qs('#topicsCount');
    if (topicsCountEl) {
      topicsCountEl.textContent = InternCore.formatNumber(topics.length);
    }

    const previewArea = InternCore.qs('#topicPreviewArea');
    const recallBankCount = await InternAPI.getRecallQuestionCount().catch(() => 0);
    const recallCountBadge = InternCore.qs('#recallBankCountBadge');

    if (recallCountBadge) {
      recallCountBadge.textContent = `${InternCore.formatNumber(recallBankCount)} Questions`;
    }

    if (!topics.length) {
      previewArea.innerHTML = `<div class="intern-empty">No topics found yet.</div>`;
      return;
    }

    previewArea.innerHTML = `
      <div class="topic-preview-grid">
        ${topics.slice(0, 6).map((topic, index) => `
          <article class="topic-preview-card" style="animation-delay:${0.06 * (index + 1)}s;">
            <h3 class="topic-preview-title">${topic.title}</h3>
            <p class="topic-preview-desc">${topic.description || 'No description available yet.'}</p>

            <div class="topic-preview-meta">
              <span class="topic-preview-badge">${InternCore.formatNumber(topic.questions_count)} Questions</span>
              <span class="topic-preview-link">Explore →</span>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    InternCore.createShell();
    await renderInternHome();
  });
})();
