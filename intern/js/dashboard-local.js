(function () {
  'use strict';

  function percent(correct, total) {
    if (!total) return 0;
    return Math.round((correct / total) * 100);
  }

  function safeDate(value) {
    try {
      return value ? new Date(value) : null;
    } catch (_) {
      return null;
    }
  }

  function formatDateTime(value) {
    const date = safeDate(value);
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Unknown time';
  }

  function getTopicStatus(total, accuracy) {
    if (total < 5) return { label: 'Low data', tone: 'tag', note: 'Need more attempts' };
    if (total < 12) return { label: 'In progress', tone: 'tag', note: 'Still building coverage' };
    if (accuracy >= 80) return { label: 'Strong', tone: 'badge', note: 'Ready for mixed review' };
    if (accuracy >= 60) return { label: 'Fair', tone: 'tag', note: 'Needs focused revision' };
    return { label: 'Weak', tone: 'badge', note: 'Review this soon' };
  }

  function getTrendInfo(recentSessions) {
    const latest = recentSessions.slice(0, 5).map((session) => Number(session.percent || 0));
    const previous = recentSessions.slice(5, 10).map((session) => Number(session.percent || 0));

    const avg = (items) => items.length ? Math.round(items.reduce((sum, item) => sum + item, 0) / items.length) : 0;
    const latestAvg = avg(latest);
    const previousAvg = avg(previous);
    const delta = latestAvg - previousAvg;

    let label = 'Stable';
    let note = 'Keep your current pace.';
    if (!latest.length) {
      label = 'Not enough data';
      note = 'Finish a few sessions to unlock trend insights.';
    } else if (!previous.length) {
      label = 'Early trend';
      note = 'One more week of sessions will improve the signal.';
    } else if (delta >= 5) {
      label = 'Improving';
      note = 'Your latest sessions are trending upward.';
    } else if (delta <= -5) {
      label = 'Declining';
      note = 'Slow down and revisit weak topics before another mixed exam.';
    }

    return { latestAvg, previousAvg, delta, label, note };
  }

  function getModeSummary(dashboard) {
    return {
      practice: {
        attempts: Number(dashboard.practiceAttempts || 0),
        solved: Number(dashboard.practiceSolved || 0),
        correct: Number(dashboard.practiceCorrect || 0),
        wrong: Number(dashboard.practiceWrong || 0),
        accuracy: percent(dashboard.practiceCorrect, dashboard.practiceSolved)
      },
      real: {
        attempts: Number(dashboard.realExamAttempts || 0),
        solved: Number(dashboard.realSolved || 0),
        correct: Number(dashboard.realCorrect || 0),
        wrong: Number(dashboard.realWrong || 0),
        accuracy: percent(dashboard.realCorrect, dashboard.realSolved)
      }
    };
  }

  function buildTopicStats(dashboard) {
    return Object.values(dashboard.topicStats || {})
      .map((row) => {
        const accuracy = percent(row.correct, row.total);
        const practiceAccuracy = percent(row.practice_correct, row.practice_total);
        const realAccuracy = percent(row.real_correct, row.real_total);
        return {
          ...row,
          accuracy,
          practiceAccuracy,
          realAccuracy,
          status: getTopicStatus(row.total, accuracy)
        };
      })
      .sort((a, b) => {
        if (a.status.label === 'Low data' && b.status.label !== 'Low data') return 1;
        if (b.status.label === 'Low data' && a.status.label !== 'Low data') return -1;
        if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
        return b.total - a.total;
      });
  }

  function buildFocusPlan(topicStats) {
    const lowDataTopics = topicStats.filter((row) => row.total < 5).slice(0, 2);
    const weakTopics = topicStats.filter((row) => row.total >= 5 && row.accuracy < 60).slice(0, 3);
    const fairTopics = topicStats.filter((row) => row.total >= 12 && row.accuracy >= 60 && row.accuracy < 80).slice(0, 2);

    const actions = [];

    weakTopics.forEach((topic) => {
      actions.push({
        title: `Review ${topic.topic}`,
        note: `${topic.accuracy}% accuracy across ${topic.total} questions. Revisit this before your next mixed exam.`
      });
    });

    lowDataTopics.forEach((topic) => {
      actions.push({
        title: `Build exposure in ${topic.topic}`,
        note: `Only ${topic.total} questions solved so far. Practice this topic more before judging your level.`
      });
    });

    fairTopics.forEach((topic) => {
      actions.push({
        title: `Push ${topic.topic} into strong range`,
        note: `${topic.accuracy}% accuracy. A short targeted session can likely move this into your strong set.`
      });
    });

    if (!actions.length) {
      actions.push({
        title: 'Keep mixed practice active',
        note: 'You do not have a clear urgent weak point yet. Continue with mixed practice and timed real exams.'
      });
    }

    return actions.slice(0, 4);
  }

  function getRecentActivityInsights(recentSessions) {
    if (!recentSessions.length) {
      return {
        best: null,
        worst: null,
        lastReal: null,
        streak: 0
      };
    }

    const best = [...recentSessions].sort((a, b) => (b.percent || 0) - (a.percent || 0))[0] || null;
    const worst = [...recentSessions].sort((a, b) => (a.percent || 0) - (b.percent || 0))[0] || null;
    const lastReal = recentSessions.find((session) => session.mode === 'real') || null;

    let streak = 0;
    for (const session of recentSessions) {
      if ((session.percent || 0) >= 70) streak += 1;
      else break;
    }

    return { best, worst, lastReal, streak };
  }

  function getAchievements(dashboard, topicStats, trendInfo) {
    const achievements = [];

    if (dashboard.totalSolved >= 100) {
      achievements.push(`Solved ${InternCore.formatNumber(dashboard.totalSolved)} questions overall.`);
    }

    const strongTopics = topicStats.filter((row) => row.total >= 12 && row.accuracy >= 80).length;
    if (strongTopics >= 3) {
      achievements.push(`Built strong performance in ${strongTopics} topics.`);
    }

    if (dashboard.realExamAttempts >= 3) {
      achievements.push(`Completed ${dashboard.realExamAttempts} real exam simulations.`);
    }

    if (trendInfo.delta >= 5) {
      achievements.push(`Latest sessions improved by ${trendInfo.delta}% compared with the previous block.`);
    }

    return achievements.slice(0, 4);
  }

  function renderMetricRows(items, emptyText, formatter) {
    if (!items.length) return `<div class="muted">${emptyText}</div>`;
    return items.map((item) => formatter(item)).join('');
  }

  async function exportDashboardAsPDF() {
    const target = InternCore.qs('#dashboardExportArea');
    if (!target) return;

    const { jsPDF } = window.jspdf;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);
    }

    pdf.save('intern-dashboard.pdf');
  }

  async function exportSummaryAsPDF() {
    const dashboard = InternCore.getDashboardData();
    const topicStats = buildTopicStats(dashboard);
    const trendInfo = getTrendInfo(dashboard.recentSessions || []);
    const modeSummary = getModeSummary(dashboard);
    const focusPlan = buildFocusPlan(topicStats);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    let y = 18;

    const writeLine = (text, size = 11, gap = 7) => {
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(text, 180);
      pdf.text(lines, 15, y);
      y += lines.length * gap;
    };

    pdf.setFontSize(18);
    pdf.text('Pharmacy Nexus Intern Dashboard Summary', 15, y);
    y += 10;

    writeLine(`Generated: ${new Date().toLocaleString()}`, 10, 5);
    y += 2;
    writeLine(`Overall accuracy: ${percent(dashboard.totalCorrect, dashboard.totalSolved)}%`, 12);
    writeLine(`Practice accuracy: ${modeSummary.practice.accuracy}% | Real exam accuracy: ${modeSummary.real.accuracy}%`, 12);
    writeLine(`Trend: ${trendInfo.label}${trendInfo.delta ? ` (${trendInfo.delta > 0 ? '+' : ''}${trendInfo.delta}%)` : ''}`, 12);
    y += 4;

    writeLine('Study Next', 14, 7);
    focusPlan.forEach((item, index) => {
      writeLine(`${index + 1}. ${item.title} — ${item.note}`, 11, 6);
    });

    y += 3;
    writeLine('Weakest Topics', 14, 7);
    topicStats.slice(0, 5).forEach((topic, index) => {
      writeLine(`${index + 1}. ${topic.topic}: ${topic.accuracy}% across ${topic.total} questions`, 11, 6);
    });

    pdf.save('intern-dashboard-summary.pdf');
  }

  function resetDashboard() {
    const ok = window.confirm('Reset all local dashboard data on this browser?');
    if (!ok) return;

    InternCore.saveDashboardData(InternCore.getEmptyDashboard());
    renderDashboard();
  }

  function renderDashboard() {
    const root = InternCore.qs('#internPageRoot');
    const dashboard = InternCore.getDashboardData();
    const topicStats = buildTopicStats(dashboard);
    const strongest = [...topicStats]
      .filter((row) => row.total >= 5)
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5);
    const weakest = [...topicStats]
      .filter((row) => row.total >= 5)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);
    const lowDataTopics = topicStats.filter((row) => row.total < 5).slice(0, 5);
    const averageAccuracy = percent(dashboard.totalCorrect, dashboard.totalSolved);
    const bestAccuracy = topicStats.length ? Math.max(...topicStats.map((x) => x.accuracy)) : 0;
    const worstAccuracy = topicStats.length ? Math.min(...topicStats.map((x) => x.accuracy)) : 0;
    const modeSummary = getModeSummary(dashboard);
    const trendInfo = getTrendInfo(dashboard.recentSessions || []);
    const focusPlan = buildFocusPlan(topicStats);
    const activity = getRecentActivityInsights(dashboard.recentSessions || []);
    const achievements = getAchievements(dashboard, topicStats, trendInfo);
    const fairTopicsCount = topicStats.filter((row) => row.total >= 12 && row.accuracy >= 60 && row.accuracy < 80).length;
    const strongTopicsCount = topicStats.filter((row) => row.total >= 12 && row.accuracy >= 80).length;
    const weakTopicsCount = topicStats.filter((row) => row.total >= 5 && row.accuracy < 60).length;

    root.innerHTML = `
      <section class="section-header">
        <div>
          <h2>Intern Dashboard</h2>
          <p>Track your local progress across practice and real exams.</p>
        </div>
      </section>

      <div class="action-row" style="justify-content:flex-start; margin-bottom:20px; flex-wrap:wrap;">
        <button class="btn btn-primary" id="downloadDashboardPdfBtn" type="button">Download Full Dashboard PDF</button>
        <button class="btn btn-dark" id="downloadSummaryPdfBtn" type="button">Download Summary PDF</button>
        <button class="btn btn-light" id="resetDashboardBtn" type="button">Reset Local Dashboard</button>
      </div>

      <div id="dashboardExportArea">
        <section class="card" style="margin-bottom:24px;">
          <div class="question-top">
            <div>
              <div class="meta-row">
                <span class="badge">Today’s Focus</span>
                <span class="tag">${trendInfo.label}</span>
              </div>
              <h3 style="margin:12px 0 8px;">Use your dashboard as a study guide, not just a report.</h3>
              <p class="muted" style="margin:0;">${trendInfo.note}</p>
            </div>
          </div>

          <div class="analysis-grid" style="margin-top:18px;">
            ${focusPlan.map((item) => `
              <article class="card" style="margin:0; background:#f8fbff; border:1px solid rgba(14,37,73,0.08);">
                <div class="meta-row">
                  <span class="badge">Study Next</span>
                </div>
                <h4 style="margin:12px 0 8px;">${item.title}</h4>
                <div class="muted">${item.note}</div>
              </article>
            `).join('')}
          </div>
        </section>

        <section class="card" style="margin-bottom:24px;">
          <div class="meta-row">
            <span class="badge">Dashboard Notice</span>
          </div>
          <p class="muted" style="margin-top:12px;">
            Your dashboard is stored locally on your browser only.
            This keeps the platform faster and lighter.
            To avoid losing your progress, export your dashboard as a PDF backup from time to time.
          </p>
        </section>

        <section class="summary-grid four" style="margin-bottom:24px;">
          <div class="card summary-card">
            <div class="muted">Total Attempts</div>
            <div class="big">${InternCore.formatNumber(dashboard.totalAttempts)}</div>
          </div>
          <div class="card summary-card">
            <div class="muted">Practice Attempts</div>
            <div class="big">${InternCore.formatNumber(dashboard.practiceAttempts)}</div>
          </div>
          <div class="card summary-card">
            <div class="muted">Real Exam Attempts</div>
            <div class="big">${InternCore.formatNumber(dashboard.realExamAttempts)}</div>
          </div>
          <div class="card summary-card">
            <div class="muted">Average Accuracy</div>
            <div class="big">${averageAccuracy}%</div>
          </div>
        </section>

        <section class="summary-grid four" style="margin-bottom:24px;">
          <div class="card summary-card">
            <div class="muted">Solved Questions</div>
            <div class="big">${InternCore.formatNumber(dashboard.totalSolved)}</div>
          </div>
          <div class="card summary-card">
            <div class="muted">Correct Answers</div>
            <div class="big">${InternCore.formatNumber(dashboard.totalCorrect)}</div>
          </div>
          <div class="card summary-card">
            <div class="muted">Wrong Answers</div>
            <div class="big">${InternCore.formatNumber(dashboard.totalWrong)}</div>
          </div>
          <div class="card summary-card">
            <div class="muted">Tracked Topics</div>
            <div class="big">${InternCore.formatNumber(topicStats.length)}</div>
          </div>
        </section>

        <section class="summary-grid four" style="margin-bottom:24px;">
          <div class="card summary-card">
            <div class="muted">Best Topic Accuracy</div>
            <div class="big">${bestAccuracy}%</div>
          </div>
          <div class="card summary-card">
            <div class="muted">Lowest Topic Accuracy</div>
            <div class="big">${worstAccuracy}%</div>
          </div>
          <div class="card summary-card">
            <div class="muted">Recent Sessions</div>
            <div class="big">${InternCore.formatNumber((dashboard.recentSessions || []).length)}</div>
          </div>
          <div class="card summary-card">
            <div class="muted">High-Score Streak</div>
            <div class="big">${InternCore.formatNumber(activity.streak)}</div>
          </div>
        </section>

        <section class="analysis-grid" style="margin-bottom:24px;">
          <article class="card">
            <h3 style="margin-top:0;">Practice vs Real Exam</h3>
            <div class="metric-row"><span>Practice accuracy</span><strong>${modeSummary.practice.accuracy}%</strong></div>
            <div class="metric-row"><span>Practice solved</span><strong>${InternCore.formatNumber(modeSummary.practice.solved)}</strong></div>
            <div class="metric-row"><span>Real exam accuracy</span><strong>${modeSummary.real.accuracy}%</strong></div>
            <div class="metric-row"><span>Real exam solved</span><strong>${InternCore.formatNumber(modeSummary.real.solved)}</strong></div>
          </article>

          <article class="card">
            <h3 style="margin-top:0;">Progress Trend</h3>
            <div class="metric-row"><span>Latest block average</span><strong>${trendInfo.latestAvg}%</strong></div>
            <div class="metric-row"><span>Previous block average</span><strong>${trendInfo.previousAvg}%</strong></div>
            <div class="metric-row"><span>Change</span><strong>${trendInfo.delta > 0 ? '+' : ''}${trendInfo.delta}%</strong></div>
            <div class="muted" style="margin-top:10px;">${trendInfo.note}</div>
          </article>
        </section>

        <section class="analysis-grid" style="margin-bottom:24px;">
          <article class="card">
            <h3 style="margin-top:0;">Topic Coverage Levels</h3>
            <div class="metric-row"><span>Strong topics</span><strong>${strongTopicsCount}</strong></div>
            <div class="metric-row"><span>Fair topics</span><strong>${fairTopicsCount}</strong></div>
            <div class="metric-row"><span>Weak topics</span><strong>${weakTopicsCount}</strong></div>
            <div class="metric-row"><span>Low-data topics</span><strong>${lowDataTopics.length}</strong></div>
          </article>

          <article class="card">
            <h3 style="margin-top:0;">Recent Activity Highlights</h3>
            <div class="metric-row"><span>Best recent session</span><strong>${activity.best ? `${activity.best.percent}%` : '—'}</strong></div>
            <div class="metric-row"><span>Lowest recent session</span><strong>${activity.worst ? `${activity.worst.percent}%` : '—'}</strong></div>
            <div class="metric-row"><span>Last real exam</span><strong>${activity.lastReal ? `${activity.lastReal.percent}%` : '—'}</strong></div>
            <div class="muted" style="margin-top:10px;">${activity.lastReal ? `Last real exam taken on ${formatDateTime(activity.lastReal.createdAt)}.` : 'No real exam session recorded yet.'}</div>
          </article>
        </section>

        <section class="analysis-grid">
          <article class="card">
            <h3 style="margin-top:0;">Strongest Topics</h3>
            ${renderMetricRows(
              strongest,
              'No strong topics yet.',
              (row) => `<div class="metric-row"><span>${row.topic}</span><strong>${row.accuracy}%</strong></div>`
            )}
          </article>

          <article class="card">
            <h3 style="margin-top:0;">Weakest Topics</h3>
            ${renderMetricRows(
              weakest,
              'No weak topics yet.',
              (row) => `<div class="metric-row"><span>${row.topic}</span><strong>${row.accuracy}%</strong></div>`
            )}
          </article>
        </section>

        <section class="intern-section">
          <div class="section-header">
            <div>
              <h2>Achievements</h2>
              <p>Small wins that show your training is moving.</p>
            </div>
          </div>
          ${achievements.length ? `
            <div class="review-list">
              ${achievements.map((item) => `
                <article class="review-card">
                  <div class="question-top">
                    <div>
                      <div class="meta-row"><span class="badge">Achievement</span></div>
                      <div style="margin-top:10px; font-weight:700;">${item}</div>
                    </div>
                  </div>
                </article>
              `).join('')}
            </div>
          ` : '<div class="intern-empty">Solve more questions to unlock achievement highlights.</div>'}
        </section>

        <section class="intern-section">
          <div class="section-header">
            <div>
              <h2>Topics Needing More Exposure</h2>
              <p>These are not automatically weak topics yet. They simply need more solved questions.</p>
            </div>
          </div>
          ${lowDataTopics.length ? `
            <div class="review-list">
              ${lowDataTopics.map((row) => `
                <article class="review-card">
                  <div class="question-top">
                    <div>
                      <h3 style="margin:0 0 8px;">${row.topic}</h3>
                      <div class="meta-row">
                        <span class="tag">${row.total} Questions</span>
                        <span class="tag">${row.accuracy}% Accuracy</span>
                        <span class="tag">Need more attempts</span>
                      </div>
                    </div>
                  </div>
                </article>
              `).join('')}
            </div>
          ` : '<div class="intern-empty">You have enough exposure data for your tracked topics.</div>'}
        </section>

        <section class="intern-section">
          <div class="section-header">
            <div>
              <h2>Topic Performance</h2>
              <p>Performance is stored on this browser only.</p>
            </div>
          </div>

          ${
            topicStats.length
              ? `
                <div class="review-list">
                  ${topicStats.map((row) => `
                    <article class="review-card">
                      <div class="question-top">
                        <div>
                          <h3 style="margin:0 0 8px;">${row.topic}</h3>
                          <div class="meta-row">
                            <span class="badge">${row.accuracy}% Accuracy</span>
                            <span class="tag">${row.total} Questions</span>
                            <span class="tag">${row.correct} Correct</span>
                            <span class="tag">${row.wrong} Wrong</span>
                            <span class="${row.status.tone}">${row.status.label}</span>
                          </div>
                          <div class="muted" style="margin-top:10px;">${row.status.note}</div>
                        </div>
                      </div>
                      <div class="analysis-grid" style="margin-top:16px;">
                        <div class="card" style="margin:0; background:#f8fbff; border:1px solid rgba(14,37,73,0.08);">
                          <div class="metric-row"><span>Practice accuracy</span><strong>${row.practiceAccuracy}%</strong></div>
                          <div class="metric-row"><span>Practice solved</span><strong>${row.practice_total}</strong></div>
                        </div>
                        <div class="card" style="margin:0; background:#f8fbff; border:1px solid rgba(14,37,73,0.08);">
                          <div class="metric-row"><span>Real exam accuracy</span><strong>${row.realAccuracy}%</strong></div>
                          <div class="metric-row"><span>Real solved</span><strong>${row.real_total}</strong></div>
                        </div>
                      </div>
                    </article>
                  `).join('')}
                </div>
              `
              : '<div class="intern-empty">No topic performance data yet.</div>'
          }
        </section>

        <section class="intern-section">
          <div class="section-header">
            <div>
              <h2>Recent Activity</h2>
              <p>Your latest local sessions on this browser.</p>
            </div>
          </div>

          ${
            dashboard.recentSessions?.length
              ? `
                <div class="review-list">
                  ${dashboard.recentSessions.map((session) => `
                    <article class="review-card">
                      <div class="question-top">
                        <div>
                          <div class="meta-row">
                            <span class="badge">${session.mode}</span>
                            <span class="tag">${session.score}/${session.total}</span>
                            <span class="tag">${session.percent}%</span>
                            <span class="tag">${(session.percent || 0) >= 70 ? 'Strong session' : 'Needs review'}</span>
                          </div>
                          <div class="muted" style="margin-top:10px;">
                            ${formatDateTime(session.createdAt)}
                          </div>
                        </div>
                      </div>
                    </article>
                  `).join('')}
                </div>
              `
              : '<div class="intern-empty">No recent activity yet.</div>'
          }
        </section>
      </div>
    `;

    InternCore.qs('#downloadDashboardPdfBtn')?.addEventListener('click', exportDashboardAsPDF);
    InternCore.qs('#downloadSummaryPdfBtn')?.addEventListener('click', exportSummaryAsPDF);
    InternCore.qs('#resetDashboardBtn')?.addEventListener('click', resetDashboard);
  }

  function initLocalDashboard() {
    InternCore.createShell();
    renderDashboard();
  }

  document.addEventListener('DOMContentLoaded', initLocalDashboard);
})();
