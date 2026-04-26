(function () {
  'use strict';

  const InternCore = {
    config: {
      appName: 'Pharmacy Nexus Intern',
      setSizeDefault: 20,
      allowedAdminEmail: 'pharmacynexusofficial@gmail.com',
      storageKeys: {
        config: 'pn_intern_config_v1',
        topicsCache: 'pn_intern_topics_cache_v1',
        session: 'pn_intern_session_v1',
        practiceReview: 'pn_intern_practice_review_v1',
        practiceRetry: 'pn_intern_practice_retry_v1',
        practiceFlagged: 'pn_intern_practice_flagged_v1',
        examReview: 'pn_intern_exam_review_v1',
        examRetry: 'pn_intern_exam_retry_v1',
        internDashboard: 'pn_intern_dashboard_v1',
        theme: 'pn_intern_theme_v1'
      }
    },

    state: {
      topics: [],
      topicMap: new Map(),
      selectedTopics: [],
      currentSession: null
    },

    el(tag, cls, html) {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (html !== undefined) node.innerHTML = html;
      return node;
    },

    qs(selector, scope = document) {
      return scope.querySelector(selector);
    },

    qsa(selector, scope = document) {
      return [...scope.querySelectorAll(selector)];
    },

    readStore(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch (_) {
        return fallback;
      }
    },

    writeStore(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },

    removeStore(key) {
      localStorage.removeItem(key);
    },

    formatNumber(value) {
      return new Intl.NumberFormat('en-US').format(value || 0);
    },
    
    escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
},

    setTopics(topics) {
      this.state.topics = Array.isArray(topics) ? topics : [];
      this.state.topicMap.clear();
      this.state.topics.forEach((topic) => {
        this.state.topicMap.set(topic.id, topic);
      });
    },

    getTopicById(id) {
      return this.state.topicMap.get(id) || null;
    },

    setSession(data) {
      this.state.currentSession = data || null;
      this.writeStore(this.config.storageKeys.session, data || null);
    },

    getSession() {
      if (this.state.currentSession) return this.state.currentSession;
      const saved = this.readStore(this.config.storageKeys.session, null);
      this.state.currentSession = saved;
      return saved;
    },

    getInternHomeLink() {
      return window.location.pathname.includes('/intern/pages/') ? '../index.html' : './index.html';
    },

    getMainHomeLink() {
      return window.location.pathname.includes('/intern/pages/') ? '../../index.html' : '../index.html';
    },

    getMainDashboardLink() {
      return window.location.pathname.includes('/intern/pages/') ? '../../dashboard.html' : '../dashboard.html';
    },

    getMainSavedLink() {
      return window.location.pathname.includes('/intern/pages/') ? '../../saved.html' : '../saved.html';
    },

    getAdminLink() {
      return window.location.pathname.includes('/intern/pages/') ? './admin.html' : './pages/admin.html';
    },

    getAdminLoginLink() {
      return window.location.pathname.includes('/intern/pages/') ? './admin-login.html' : './pages/admin-login.html';
    },

    getInternDashboardLink() {
      return window.location.pathname.includes('/intern/pages/') ? './dashboard.html' : './pages/dashboard.html';
    },

    getPracticeFlaggedLink() {
      return window.location.pathname.includes('/intern/pages/') ? './practice-flagged.html' : './pages/practice-flagged.html';
    },

    async getCurrentUser() {
      try {
        const { data, error } = await InternSupabase.auth.getUser();
        if (error) return null;
        return data?.user || null;
      } catch (_) {
        return null;
      }
    },

    async isAllowedAdmin() {
      const user = await this.getCurrentUser();
      if (!user?.email) return false;
      return user.email.toLowerCase() === this.config.allowedAdminEmail.toLowerCase();
    },

    bindAdminShortcut() {
      document.addEventListener('keydown', async (event) => {
        const shortcut =
          event.ctrlKey &&
          event.shiftKey &&
          (event.code === 'Digit9' || event.code === 'Numpad9');

        if (!shortcut) return;

        event.preventDefault();

        const isAdmin = await this.isAllowedAdmin();
        window.location.href = isAdmin ? this.getAdminLink() : this.getAdminLoginLink();
      });
    },


    getTheme() {
      const saved = this.readStore(this.config.storageKeys.theme, null);
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    },

    applyTheme(theme) {
      const safeTheme = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', safeTheme);
      this.writeStore(this.config.storageKeys.theme, safeTheme);

      const toggleBtn = this.qs('#themeToggleBtn');
      if (toggleBtn) {
        toggleBtn.innerHTML = safeTheme === 'dark'
          ? '<span class="theme-toggle-icon">☀</span><span>Light</span>'
          : '<span class="theme-toggle-icon">☾</span><span>Dark</span>';
        toggleBtn.setAttribute('aria-label', safeTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      }
    },

    initTheme() {
      this.applyTheme(this.getTheme());
    },

    bindThemeToggle() {
      const toggleBtn = this.qs('#themeToggleBtn');
      if (!toggleBtn) return;
      toggleBtn.addEventListener('click', () => {
        const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        this.applyTheme(nextTheme);
      });
    },

bindInteractionProtection() {
  const protectedPages = new Set([
    'intern-practice',
    'intern-exam',
    'intern-practice-review',
    'intern-exam-review',
    'intern-recall-bank',
    'intern-practice-flagged'
  ]);

  const getPage = () => document.body?.dataset?.page || '';
  const isProtectedPage = () => protectedPages.has(getPage());

  const blockedEvents = ['copy', 'cut', 'paste', 'contextmenu', 'dragstart'];

  blockedEvents.forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      if (!isProtectedPage()) return;

      const target = event.target;
      const tag = target?.tagName ? target.tagName.toLowerCase() : '';
      const editable =
        target?.isContentEditable ||
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select';

      if (editable) return;
      event.preventDefault();
    }, { capture: true });
  });

  document.addEventListener('keydown', (event) => {
    if (!isProtectedPage()) return;

    const key = String(event.key || '').toLowerCase();
    const hasModifier = event.ctrlKey || event.metaKey;
    if (!hasModifier) return;

    const target = event.target;
    const tag = target?.tagName ? target.tagName.toLowerCase() : '';
    const editable =
      target?.isContentEditable ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select';

    if (editable) return;

    if (['c', 'x', 'v', 'u', 's', 'p'].includes(key)) {
      event.preventDefault();
    }
  }, { capture: true });
},

createShell() {
  const root = document.getElementById('intern-shell');
  root.innerHTML = `
    <header class="site-header">
      <div class="container navbar">
        <a class="brand" href="${this.getMainHomeLink()}">
          <span class="brand-mark">PN</span>
          <span>Pharmacy Nexus</span>
        </a>

        <nav class="nav-menu" style="display:flex;">
          <a class="nav-link" href="${this.getMainHomeLink()}">Home</a>
          <a class="nav-link is-active" href="${this.getInternHomeLink()}">Intern</a>
          <a class="nav-link" href="${this.getInternDashboardLink()}">Intern Dashboard</a>
          <a class="nav-link" href="${this.getMainDashboardLink()}">Dashboard</a>
          <a class="nav-link" href="${this.getMainSavedLink()}">Saved</a>
        </nav>
      </div>
    </header>

    <main class="main-section">
      <div class="container">
        <div class="intern-topbar" style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
          <a class="intern-back-link" href="${this.getMainHomeLink()}">← Back to main platform</a>
          <div class="intern-topbar-actions" style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-light theme-toggle-btn" id="themeToggleBtn" type="button"></button>
            <a class="btn btn-light" href="${this.getPracticeFlaggedLink()}">Flagged</a>
            <a class="btn btn-light" href="${this.getInternDashboardLink()}">Intern Dashboard</a>
            <button class="btn btn-light" id="adminLogoutBtn" type="button">Logout</button>
          </div>
        </div>
        <div id="internPageRoot"></div>
      </div>
    </main>
  `;
      this.initTheme();
      this.bindThemeToggle();
      this.bindInteractionProtection();

      const logoutBtn = this.qs('#adminLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            await InternSupabase.auth.signOut();
          } catch (_) {}
          window.location.href = this.getAdminLoginLink();
        });
      }

      this.bindAdminShortcut();
    }
  };

  InternCore.getEmptyDashboard = function () {
    return {
      version: 2,
      totalAttempts: 0,
      practiceAttempts: 0,
      realExamAttempts: 0,
      totalSolved: 0,
      totalCorrect: 0,
      totalWrong: 0,
      practiceSolved: 0,
      practiceCorrect: 0,
      practiceWrong: 0,
      realSolved: 0,
      realCorrect: 0,
      realWrong: 0,
      topicStats: {},
      recentSessions: []
    };
  };

  InternCore.normalizeDashboardData = function (rawDashboard) {
    const base = this.getEmptyDashboard();
    const dashboard = rawDashboard && typeof rawDashboard === 'object'
      ? { ...base, ...rawDashboard }
      : { ...base };

    dashboard.version = 2;
    dashboard.topicStats = dashboard.topicStats && typeof dashboard.topicStats === 'object'
      ? dashboard.topicStats
      : {};
    dashboard.recentSessions = Array.isArray(dashboard.recentSessions)
      ? dashboard.recentSessions
      : [];

    dashboard.practiceSolved = Number(dashboard.practiceSolved || 0);
    dashboard.practiceCorrect = Number(dashboard.practiceCorrect || 0);
    dashboard.practiceWrong = Number(dashboard.practiceWrong || 0);
    dashboard.realSolved = Number(dashboard.realSolved || 0);
    dashboard.realCorrect = Number(dashboard.realCorrect || 0);
    dashboard.realWrong = Number(dashboard.realWrong || 0);

    Object.keys(dashboard.topicStats).forEach((topic) => {
      const stat = dashboard.topicStats[topic] || {};
      dashboard.topicStats[topic] = {
        topic: stat.topic || topic,
        total: Number(stat.total || 0),
        correct: Number(stat.correct || 0),
        wrong: Number(stat.wrong || 0),
        practice_total: Number(stat.practice_total || 0),
        practice_correct: Number(stat.practice_correct || 0),
        practice_wrong: Number(stat.practice_wrong || 0),
        real_total: Number(stat.real_total || 0),
        real_correct: Number(stat.real_correct || 0),
        real_wrong: Number(stat.real_wrong || 0),
        last_practiced_at: stat.last_practiced_at || null
      };
    });

    return dashboard;
  };

  InternCore.getDashboardData = function () {
    return this.normalizeDashboardData(
      this.readStore(this.config.storageKeys.internDashboard, this.getEmptyDashboard())
    );
  };

  InternCore.saveDashboardData = function (data) {
    this.writeStore(this.config.storageKeys.internDashboard, this.normalizeDashboardData(data));
  };

  InternCore.updateDashboardFromSession = function ({ mode, rows, score, total }) {
    const dashboard = this.getDashboardData();
    const safeRows = Array.isArray(rows) ? rows : [];
    const sessionPercent = total ? Math.round((score / total) * 100) : 0;
    const now = new Date().toISOString();

    dashboard.totalAttempts += 1;
    dashboard.totalSolved += total;
    dashboard.totalCorrect += score;
    dashboard.totalWrong += (total - score);

    if (mode === 'practice') {
      dashboard.practiceAttempts += 1;
      dashboard.practiceSolved += total;
      dashboard.practiceCorrect += score;
      dashboard.practiceWrong += (total - score);
    } else if (mode === 'real') {
      dashboard.realExamAttempts += 1;
      dashboard.realSolved += total;
      dashboard.realCorrect += score;
      dashboard.realWrong += (total - score);
    }

    safeRows.forEach((row) => {
      const topic = row?.question?.topic_title || 'Unknown Topic';

      if (!dashboard.topicStats[topic]) {
        dashboard.topicStats[topic] = {
          topic,
          total: 0,
          correct: 0,
          wrong: 0,
          practice_total: 0,
          practice_correct: 0,
          practice_wrong: 0,
          real_total: 0,
          real_correct: 0,
          real_wrong: 0,
          last_practiced_at: null
        };
      }

      const topicRow = dashboard.topicStats[topic];
      topicRow.total += 1;
      if (row.isCorrect) topicRow.correct += 1;
      else topicRow.wrong += 1;

      if (mode === 'practice') {
        topicRow.practice_total += 1;
        if (row.isCorrect) topicRow.practice_correct += 1;
        else topicRow.practice_wrong += 1;
      } else if (mode === 'real') {
        topicRow.real_total += 1;
        if (row.isCorrect) topicRow.real_correct += 1;
        else topicRow.real_wrong += 1;
      }

      topicRow.last_practiced_at = now;
    });

    dashboard.recentSessions.unshift({
      mode,
      score,
      total,
      percent: sessionPercent,
      createdAt: now
    });

    dashboard.recentSessions = dashboard.recentSessions.slice(0, 20);

    this.saveDashboardData(dashboard);
  };

  window.InternCore = InternCore;
})();
