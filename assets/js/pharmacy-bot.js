
(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    knowledgeUrl: './data/bot-knowledge.json',
    storageKey: 'pnBotChatHistory',
    maxHistory: 20,
    showBubbleDelay: 1600,
    autoSpeech: false
  };

  const config = { ...DEFAULT_CONFIG, ...(window.PN_BOT_CONFIG || {}) };

  const fallbackKnowledge = {
    fallback: 'I do not have a saved answer for that yet. Try asking about subjects, sets, wrong questions, final exams, saved notes, dashboard, or study tips.',
    medicalSafety: 'I can help you study pharmacy concepts, but I cannot provide personal medical advice or treatment decisions. Please use trusted references or consult a qualified healthcare professional.',
    pageGreetings: {
      home: 'Welcome to Pharmacy Nexus. I can guide you through subjects, exams, sets, saved notes, and study tips.',
      sets: 'Each set contains 20 questions. Finish the previous set before unlocking the next one.',
      study: 'Focus on the question first, then read the explanation carefully after answering.'
    },
    quickActions: [
      { label: 'Study tips', query: 'Give me study tips' },
      { label: 'How sets work', query: 'How do sets work?' },
      { label: 'Review mistakes', query: 'How do I review wrong questions?' },
      { label: 'Final exam', query: 'How does the final exam work?' }
    ],
    medicalKeywords: ['dose', 'dosage', 'treatment', 'diagnose', 'symptom', 'patient', 'prescription', 'can i take'],
    intents: []
  };

  const pages = ['home','subjects','topics','sets','study','review','dashboard','profile','about','finalexam','examlive','saved'];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenSet(text) {
    return new Set(normalize(text).split(' ').filter(Boolean));
  }

  function getActivePage() {
    for (const p of pages) {
      const el = document.getElementById('page-' + p);
      if (el && el.classList.contains('active')) return p;
    }
    return 'home';
  }

  function isLikelyMedicalAdvice(text, knowledge) {
    const normalized = normalize(text);
    return (knowledge.medicalKeywords || []).some(keyword => normalized.includes(normalize(keyword)));
  }

  function scoreIntent(query, intent, page) {
    const q = normalize(query);
    const qTokens = tokenSet(query);
    const keywords = Array.isArray(intent.keywords) ? intent.keywords : [];
    let score = Number(intent.priority || 0);

    if (intent.page_context && intent.page_context !== 'all') {
      if (intent.page_context === page) score += 4;
      else score -= 1.5;
    }

    for (const rawKeyword of keywords) {
      const keyword = normalize(rawKeyword);
      if (!keyword) continue;
      if (q === keyword) score += 12;
      else if (q.includes(keyword)) score += 8;
      else {
        const kTokens = keyword.split(' ').filter(Boolean);
        const hits = kTokens.filter(t => qTokens.has(t)).length;
        if (hits) score += hits / Math.max(kTokens.length, 1) * 4;
      }
    }

    return score;
  }

  function createBotMarkup() {
    if (document.getElementById('pnBot')) return;
    const wrap = document.createElement('div');
    wrap.className = 'pn-bot-wrapper';
    wrap.id = 'pnBot';
    wrap.innerHTML = `
      <div class="pn-bot-bubble" id="pnBotBubble">
        <button class="pn-bot-bubble-close" type="button" aria-label="Close assistant message">×</button>
        <p class="pn-bot-bubble-text" id="pnBotBubbleText"></p>
      </div>

      <div class="pn-bot-panel" id="pnBotPanel" aria-live="polite">
        <div class="pn-bot-header">
          <div class="pn-bot-header-icon">🥼</div>
          <div class="pn-bot-header-info">
            <h4>Dr. Nexus</h4>
            <span>Pharmacy study assistant</span>
          </div>
          <button class="pn-bot-close-panel" id="pnBotClosePanel" type="button" aria-label="Close assistant">×</button>
        </div>
        <div class="pn-bot-messages" id="pnBotMessages"></div>
        <div class="pn-bot-quick-actions" id="pnBotQuickActions"></div>
        <div class="pn-bot-input-area">
          <input type="text" class="pn-bot-input" id="pnBotInput" placeholder="Ask about sets, exams, saved notes..." />
          <button class="pn-bot-send" id="pnBotSend" type="button" aria-label="Send message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
      </div>

      <div class="pn-bot-character idle" id="pnBotCharacter" role="button" tabindex="0" aria-label="Open Dr. Nexus assistant">
        <div class="pn-bot-badge" id="pnBotBadge">1</div>
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <ellipse cx="50" cy="92" rx="28" ry="6" fill="rgba(0,21,27,0.08)"/>
          <path d="M28 45 Q25 55 26 70 Q26 85 30 88 L70 88 Q74 85 74 70 Q75 55 72 45 Q65 42 50 42 Q35 42 28 45Z" fill="#ffffff" stroke="#c1c7cb" stroke-width="1.5"/>
          <path d="M50 42 L50 88" stroke="#e1e3e4" stroke-width="1"/>
          <circle cx="50" cy="58" r="2" fill="#c1c7cb"/><circle cx="50" cy="70" r="2" fill="#c1c7cb"/>
          <path d="M58 62 L68 62 L67 74 L59 74Z" fill="#f3f4f5" stroke="#e1e3e4" stroke-width="1"/>
          <rect x="42" y="38" width="16" height="8" fill="#f5d0c5"/>
          <ellipse cx="50" cy="30" rx="22" ry="24" fill="#f5d0c5"/>
          <path d="M28 22 Q28 8 50 6 Q72 8 72 22 Q72 16 65 14 Q50 10 35 14 Q28 16 28 22Z" fill="#2d1b0e"/>
          <ellipse cx="42" cy="28" rx="4" ry="5" fill="white"/><ellipse cx="58" cy="28" rx="4" ry="5" fill="white"/>
          <circle cx="43" cy="29" r="2.5" fill="#00151b"/><circle cx="57" cy="29" r="2.5" fill="#00151b"/>
          <circle cx="42" cy="28" r="7" fill="none" stroke="#316574" stroke-width="1.5"/><circle cx="58" cy="28" r="7" fill="none" stroke="#316574" stroke-width="1.5"/>
          <line x1="49" y1="28" x2="51" y2="28" stroke="#316574" stroke-width="1.5"/>
          <path d="M50 32 L48 38 L52 38Z" fill="#e8b4a2"/>
          <path d="M44 44 Q50 50 56 44" fill="none" stroke="#c17a5c" stroke-width="2" stroke-linecap="round"/>
          <path d="M30 50 Q20 55 22 65 Q24 72 30 70" fill="none" stroke="#4a4a4a" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="30" cy="70" r="4" fill="#c1c7cb" stroke="#4a4a4a" stroke-width="1"/>
          <path d="M70 50 Q80 55 78 65 Q76 72 70 70" fill="none" stroke="#4a4a4a" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="70" cy="70" r="4" fill="#c1c7cb" stroke="#4a4a4a" stroke-width="1"/>
          <path d="M30 50 Q50 58 70 50" fill="none" stroke="#4a4a4a" stroke-width="2"/>
          <g class="bot-arm-right"><path d="M72 52 Q85 48 88 38" fill="none" stroke="#f5d0c5" stroke-width="8" stroke-linecap="round"/><circle cx="88" cy="36" r="5" fill="#f5d0c5"/></g>
          <path d="M28 52 Q15 58 18 68" fill="none" stroke="#f5d0c5" stroke-width="8" stroke-linecap="round"/><circle cx="18" cy="70" r="5" fill="#f5d0c5"/>
        </svg>
      </div>`;
    document.body.appendChild(wrap);
  }

  const PNBot = {
    isOpen: false,
    currentPage: 'home',
    knowledge: fallbackKnowledge,
    bubbleTimer: null,

    async init() {
      createBotMarkup();
      this.bindEvents();
      await this.loadKnowledge();
      this.currentPage = getActivePage();
      this.renderQuickActions();
      this.restoreHistory();
      if (!document.querySelector('#pnBotMessages .pn-bot-message')) {
        this.addMessage(this.getGreeting(), 'bot', false);
      }
      setTimeout(() => this.showBubble(this.getGreeting()), config.showBubbleDelay);
      this.observePageChanges();
    },

    async loadKnowledge() {
      try {
        const res = await fetch(config.knowledgeUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('Knowledge file not found');
        const data = await res.json();
        this.knowledge = { ...fallbackKnowledge, ...data };
      } catch (error) {
        console.warn('[PNBot] Using fallback knowledge:', error.message);
        this.knowledge = fallbackKnowledge;
      }
    },

    bindEvents() {
      document.getElementById('pnBotCharacter')?.addEventListener('click', () => this.toggle());
      document.getElementById('pnBotCharacter')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); }
      });
      document.getElementById('pnBotSend')?.addEventListener('click', () => this.send());
      document.getElementById('pnBotInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') this.send();
      });
      document.getElementById('pnBotClosePanel')?.addEventListener('click', () => this.closePanel());
      document.querySelector('#pnBotBubble .pn-bot-bubble-close')?.addEventListener('click', () => this.closeBubble());
    },

    observePageChanges() {
      const observer = new MutationObserver(() => {
        const nextPage = getActivePage();
        if (nextPage !== this.currentPage) {
          this.currentPage = nextPage;
          this.showBubble(this.getGreeting());
        }
      });
      observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    },

    getGreeting() {
      return this.knowledge.pageGreetings?.[this.currentPage] || this.knowledge.pageGreetings?.home || fallbackKnowledge.pageGreetings.home;
    },

    renderQuickActions() {
      const root = document.getElementById('pnBotQuickActions');
      if (!root) return;
      const actions = Array.isArray(this.knowledge.quickActions) ? this.knowledge.quickActions : fallbackKnowledge.quickActions;
      root.innerHTML = actions.map((action, index) => `<button class="pn-bot-quick-btn" type="button" data-pn-bot-action="${index}">${escapeHtml(action.label)}</button>`).join('');
      root.querySelectorAll('[data-pn-bot-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = actions[Number(btn.dataset.pnBotAction)];
          if (action?.query) this.ask(action.query);
        });
      });
    },

    toggle() {
      this.isOpen ? this.closePanel() : this.openPanel();
    },

    openPanel() {
      this.isOpen = true;
      document.getElementById('pnBotPanel')?.classList.add('open');
      document.getElementById('pnBotCharacter')?.classList.remove('idle');
      this.closeBubble();
      this.wave();
      setTimeout(() => document.getElementById('pnBotInput')?.focus(), 80);
    },

    closePanel() {
      this.isOpen = false;
      document.getElementById('pnBotPanel')?.classList.remove('open');
      document.getElementById('pnBotCharacter')?.classList.add('idle');
    },

    showBubble(text) {
      if (this.isOpen) return;
      const bubble = document.getElementById('pnBotBubble');
      const bubbleText = document.getElementById('pnBotBubbleText');
      if (!bubble || !bubbleText) return;
      bubbleText.textContent = text || this.getGreeting();
      bubble.classList.add('visible');
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = setTimeout(() => this.closeBubble(), 6500);
    },

    closeBubble() {
      document.getElementById('pnBotBubble')?.classList.remove('visible');
      clearTimeout(this.bubbleTimer);
    },

    send() {
      const input = document.getElementById('pnBotInput');
      const text = input?.value.trim();
      if (!text) return;
      input.value = '';
      this.ask(text);
    },

    ask(text) {
      if (!this.isOpen) this.openPanel();
      this.addMessage(text, 'user');
      this.showTyping();
      setTimeout(() => {
        this.hideTyping();
        this.addMessage(this.answer(text), 'bot');
      }, 420 + Math.random() * 280);
    },

    answer(text) {
      if (isLikelyMedicalAdvice(text, this.knowledge)) {
        return this.knowledge.medicalSafety || fallbackKnowledge.medicalSafety;
      }

      const intents = Array.isArray(this.knowledge.intents) ? this.knowledge.intents : [];
      let best = null;
      let bestScore = 0;
      for (const intent of intents) {
        if (intent.is_active === false) continue;
        const score = scoreIntent(text, intent, this.currentPage);
        if (score > bestScore) { bestScore = score; best = intent; }
      }
      if (best && bestScore >= 6) return best.answer;

      const lower = normalize(text);
      if (['what should i do now', 'what now', 'now what'].some(q => lower.includes(q))) {
        return this.getGreeting();
      }
      return this.knowledge.fallback || fallbackKnowledge.fallback;
    },

    showTyping() {
      const messages = document.getElementById('pnBotMessages');
      if (!messages) return;
      this.hideTyping();
      const typing = document.createElement('div');
      typing.className = 'pn-bot-typing';
      typing.id = 'pnBotTyping';
      typing.innerHTML = '<span></span><span></span><span></span>';
      messages.appendChild(typing);
      messages.scrollTop = messages.scrollHeight;
    },

    hideTyping() {
      document.getElementById('pnBotTyping')?.remove();
    },

    addMessage(text, sender, save = true) {
      const messages = document.getElementById('pnBotMessages');
      if (!messages) return;
      const msg = document.createElement('div');
      msg.className = `pn-bot-message ${sender}`;
      msg.textContent = text;
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
      if (save) this.saveMessage(text, sender);
    },

    saveMessage(text, sender) {
      try {
        const history = JSON.parse(localStorage.getItem(config.storageKey) || '[]');
        history.push({ text, sender, at: new Date().toISOString() });
        localStorage.setItem(config.storageKey, JSON.stringify(history.slice(-config.maxHistory)));
      } catch {}
    },

    restoreHistory() {
      try {
        const history = JSON.parse(localStorage.getItem(config.storageKey) || '[]');
        history.slice(-8).forEach(item => this.addMessage(item.text, item.sender, false));
      } catch {}
    },

    clearHistory() {
      localStorage.removeItem(config.storageKey);
      const messages = document.getElementById('pnBotMessages');
      if (messages) messages.innerHTML = '';
      this.addMessage(this.getGreeting(), 'bot', false);
    },

    notify(count = 1) {
      const badge = document.getElementById('pnBotBadge');
      if (!badge) return;
      badge.textContent = String(count);
      badge.style.display = 'flex';
    },

    wave() {
      const char = document.getElementById('pnBotCharacter');
      if (!char) return;
      char.classList.add('waving');
      setTimeout(() => char.classList.remove('waving'), 1900);
    }
  };

  window.PNBot = PNBot;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PNBot.init());
  } else {
    PNBot.init();
  }
})();
