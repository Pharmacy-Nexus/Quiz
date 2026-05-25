/* =========================================================
   Pharmacy Nexus — Pharmacy Duel Arcade V2
   Single-file game module based on the uploaded arcade concept.
   Upload to: assets/js/pn-pharmacy-duel-arcade-v2.js
   Add before </body>:
   <script src="./assets/js/pn-pharmacy-duel-arcade-v2.js"></script>
   ========================================================= */

(function () {
  "use strict";

  const CONFIG = {
    questionsCount: 10,
    secondsPerQuestion: 15,
    storageKey: "pn_pharmacy_duel_arcade_history_v2",
    minBotScore: 4,
    maxBotScore: 9
  };

  const FALLBACK_QUESTIONS = [
    {
      question: "Which drug is a proton pump inhibitor used to reduce stomach acid?",
      options: ["Ranitidine", "Omeprazole", "Metoclopramide", "Ondansetron"],
      correct: 1
    },
    {
      question: "What is the antidote for paracetamol (acetaminophen) overdose?",
      options: ["Naloxone", "Acetylcysteine", "Flumazenil", "Atropine"],
      correct: 1
    },
    {
      question: "Which antibiotic belongs to the fluoroquinolone class?",
      options: ["Amoxicillin", "Ciprofloxacin", "Azithromycin", "Clindamycin"],
      correct: 1
    },
    {
      question: "The first-pass effect primarily occurs in which organ?",
      options: ["Kidney", "Liver", "Lung", "Heart"],
      correct: 1
    },
    {
      question: "Which drug is used to treat hyperthyroidism?",
      options: ["Levothyroxine", "Methimazole", "Insulin", "Prednisone"],
      correct: 1
    },
    {
      question: "What is the mechanism of action of aspirin?",
      options: ["COX inhibition", "ACE inhibition", "Beta blockade", "H2 blockade"],
      correct: 0
    },
    {
      question: "Which drug class does metformin belong to?",
      options: ["Sulfonylureas", "Biguanides", "Thiazolidinediones", "DPP-4 inhibitors"],
      correct: 1
    },
    {
      question: "What is the therapeutic INR range for warfarin for most indications?",
      options: ["1.0 - 1.5", "2.0 - 3.0", "3.0 - 4.5", "4.5 - 6.0"],
      correct: 1
    },
    {
      question: "Which receptor does atropine block?",
      options: ["Nicotinic receptors", "Muscarinic receptors", "Alpha-1 receptors", "Beta-2 receptors"],
      correct: 1
    },
    {
      question: "What is the primary use of nitroglycerin?",
      options: ["Hypertension", "Angina pectoris", "Arrhythmia", "Heart failure"],
      correct: 1
    }
  ];

  let duelQuestions = [];

  let state = {
    currentQuestion: 0,
    playerScore: 0,
    botScore: 0,
    botFinalScore: 7,
    botWrongIndices: [],
    answered: false,
    timeLeft: CONFIG.secondsPerQuestion,
    timerInterval: null,
    botTimeout: null,
    confettiActive: false,
    confettiAnimationId: null,
    confettiParticles: []
  };


  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function normalizeCorrectAnswer(value, options) {
    if (typeof value === "number") {
      if (value >= 0 && value < options.length) return value;
      if (value >= 1 && value <= options.length) return value - 1;
    }

    const text = String(value ?? "").trim();
    const asNumber = Number(text);
    if (!Number.isNaN(asNumber)) {
      if (asNumber >= 0 && asNumber < options.length) return asNumber;
      if (asNumber >= 1 && asNumber <= options.length) return asNumber - 1;
    }

    const byText = options.findIndex(opt => String(opt).trim().toLowerCase() === text.toLowerCase());
    return byText >= 0 ? byText : 0;
  }

  function normalizeQuestion(raw, source = "Site Data", index = 0) {
    if (!raw || typeof raw !== "object") return null;

    const question = raw.question || raw.questionText || raw.question_text || raw.text || raw.prompt || raw.title || "";
    const options = Array.isArray(raw.options) ? raw.options
      : Array.isArray(raw.answers) ? raw.answers
      : Array.isArray(raw.choices) ? raw.choices
      : [raw.option_1, raw.option_2, raw.option_3, raw.option_4].filter(Boolean);

    if (!question || !Array.isArray(options) || options.length < 2) return null;

    const cleanOptions = options.map(opt => {
      if (typeof opt === "object") return String(opt.text || opt.label || opt.value || "");
      return String(opt);
    }).filter(Boolean);

    if (cleanOptions.length < 2) return null;

    const correctRaw = raw.correct ?? raw.correctAnswer ?? raw.correct_answer ?? raw.correct_option ?? raw.answerIndex ?? raw.answer ?? 0;

    return {
      id: String(raw.id || raw.questionId || raw.question_id || `${source}-${index}-${question.slice(0, 20)}`),
      question: String(question),
      options: cleanOptions.slice(0, 6),
      correct: normalizeCorrectAnswer(correctRaw, cleanOptions),
      source
    };
  }

  function shuffleOptions(question) {
    const mapped = question.options.map((text, index) => ({ text, index }));
    const shuffled = shuffle(mapped);
    const correct = shuffled.findIndex(item => item.index === question.correct);
    return {
      ...question,
      options: shuffled.map(item => item.text),
      correct: correct >= 0 ? correct : question.correct
    };
  }

  function collectSiteQuestions() {
    const collected = [];

    try {
      if (Array.isArray(window.appState?.currentTopicQuestions)) {
        collected.push(...window.appState.currentTopicQuestions.map(q => ({ ...q, __source: "Current Topic" })));
      }
    } catch (_) {}

    try {
      if (Array.isArray(window.appState?.currentSetSessionQuestions)) {
        collected.push(...window.appState.currentSetSessionQuestions.map(q => ({ ...q, __source: "Current Set" })));
      }
    } catch (_) {}

    try {
      if (Array.isArray(window.appState?.currentExamSession?.questions)) {
        collected.push(...window.appState.currentExamSession.questions.map(q => ({ ...q, __source: "Exam Session" })));
      }
    } catch (_) {}

    try {
      const cache = window.PN_DATA?.topicFilesCache;
      if (cache && typeof cache.forEach === "function") {
        cache.forEach(topicFile => {
          const possible = topicFile?.questions || topicFile?.items || topicFile?.data || [];
          if (Array.isArray(possible)) collected.push(...possible.map(q => ({ ...q, __source: "Loaded Data" })));
        });
      }
    } catch (_) {}

    const normalized = collected.map((q, i) => normalizeQuestion(q, q.__source || "Site Data", i)).filter(Boolean);
    const seen = new Set();
    return normalized.filter(q => {
      const key = `${q.id}::${q.question}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function prepareDuelQuestions() {
    const siteQuestions = collectSiteQuestions();
    const fallback = FALLBACK_QUESTIONS.map((q, i) => normalizeQuestion(q, "Demo Backup", i)).filter(Boolean);
    const pool = siteQuestions.length >= CONFIG.questionsCount ? siteQuestions : [...siteQuestions, ...fallback];
    return shuffle(pool).slice(0, CONFIG.questionsCount).map(shuffleOptions);
  }

  function calculateBotScore(questions) {
    let score = 5 + Math.floor(Math.random() * 4); // 5 to 8 most rounds

    const difficultCount = questions.filter(q => /case|clinical|patient|calculate|dose|renal|hepatic|interaction|contraindicat|monitor/i.test(q.question)).length;
    if (difficultCount >= 4 && Math.random() < 0.55) score -= 1;
    if (difficultCount <= 1 && Math.random() < 0.45) score += 1;
    if (Math.random() < 0.12) score = 9;
    if (Math.random() < 0.08) score = 4;

    return Math.max(CONFIG.minBotScore, Math.min(CONFIG.maxBotScore, score));
  }

  function makeBotWrongIndices(botScore) {
    const wrongCount = Math.max(0, CONFIG.questionsCount - botScore);
    return shuffle(Array.from({ length: CONFIG.questionsCount }, (_, i) => i)).slice(0, wrongCount);
  }

  function randomBotThinkingTime() {
    return 900 + Math.random() * 2300;
  }

  function updateDuelDataLabel() {
    const label = document.getElementById("pn-duel-data-label");
    if (!label) return;
    const count = collectSiteQuestions().length;
    label.textContent = count >= CONFIG.questionsCount
      ? `Using your loaded data • ${count} questions available`
      : count > 0
        ? `Using ${count} site questions + demo backup`
        : "Open a subject/topic first to pull from your own data";
  }

  function injectStyles() {
    if (document.getElementById("pn-duel-arcade-style")) return;

    const style = document.createElement("style");
    style.id = "pn-duel-arcade-style";
    style.textContent = `
      .pn-duel-launch-arcade {
        position: relative;
        overflow: hidden;
        margin: 2rem auto;
        max-width: 1120px;
        border-radius: 2rem;
        background: linear-gradient(135deg, #0a0e27 0%, #1a1f4b 50%, #0d1235 100%);
        color: #fff;
        padding: clamp(1.4rem, 3vw, 2.4rem);
        box-shadow: 0 28px 80px rgba(0, 21, 27, .22);
        isolation: isolate;
      }
      .pn-duel-launch-arcade::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 20% 20%, rgba(0,212,255,.25), transparent 32%),
          radial-gradient(circle at 82% 28%, rgba(255,0,110,.18), transparent 34%),
          radial-gradient(circle at 50% 100%, rgba(255,215,0,.12), transparent 38%);
        pointer-events: none;
      }
      .pn-duel-launch-grid {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(280px, .78fr);
        gap: 1.5rem;
        align-items: center;
      }
      .pn-duel-kicker {
        display: inline-flex;
        align-items: center;
        gap: .55rem;
        border-radius: 999px;
        padding: .5rem .85rem;
        border: 1px solid rgba(0,212,255,.28);
        background: rgba(0,212,255,.10);
        color: #00d4ff;
        font-size: .75rem;
        font-weight: 900;
        letter-spacing: .15em;
        text-transform: uppercase;
      }
      .pn-duel-launch-title {
        margin: .95rem 0 .7rem;
        font-size: clamp(2rem, 4.2vw, 4.3rem);
        line-height: .92;
        letter-spacing: -.065em;
        font-weight: 1000;
        background: linear-gradient(90deg, #00d4ff, #b66bff, #ff006e);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .pn-duel-launch-copy {
        max-width: 650px;
        color: rgba(255,255,255,.74);
        font-size: 1rem;
        line-height: 1.75;
        font-weight: 650;
      }
      .pn-duel-actions {
        display: flex;
        gap: .8rem;
        flex-wrap: wrap;
        margin-top: 1.15rem;
      }
      .pn-duel-btn {
        border: 0;
        cursor: pointer;
        border-radius: 999px;
        padding: .9rem 1.35rem;
        min-height: 3rem;
        font-weight: 950;
        letter-spacing: -.02em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: .5rem;
        transition: transform .2s ease, box-shadow .2s ease, opacity .2s ease;
      }
      .pn-duel-btn:hover { transform: translateY(-2px); }
      .pn-duel-btn:active { transform: translateY(0) scale(.98); }
      .pn-duel-btn[disabled] { opacity: .55; cursor: not-allowed; transform: none !important; }
      .pn-duel-btn-primary {
        background: linear-gradient(90deg, #00d4ff, #7b2cbf);
        color: white;
        box-shadow: 0 16px 34px rgba(0,212,255,.25);
      }
      .pn-duel-btn-soft {
        background: rgba(255,255,255,.10);
        color: #fff;
        border: 1px solid rgba(255,255,255,.15);
      }
      .pn-duel-btn-dark {
        background: #0a0e27;
        color: #fff;
      }
      .pn-duel-vs-preview {
        position: relative;
        min-height: 260px;
        border-radius: 1.75rem;
        border: 1px solid rgba(255,255,255,.15);
        background: linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,.045));
        backdrop-filter: blur(12px);
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: .85rem;
        align-items: center;
        padding: 1rem;
        transform: perspective(900px) rotateY(-5deg) rotateX(4deg);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 22px 60px rgba(0,0,0,.22);
      }
      .pn-duel-player-card {
        border-radius: 1.4rem;
        padding: 1rem;
        text-align: center;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.07);
      }
      .pn-duel-avatar {
        width: 70px;
        height: 70px;
        margin: 0 auto .8rem;
        border-radius: 999px;
        display: grid;
        place-items: center;
        font-size: 2rem;
        background: linear-gradient(135deg, #00d4ff, #0099cc);
        box-shadow: 0 0 25px rgba(0,212,255,.35);
      }
      .pn-duel-avatar.bot {
        background: linear-gradient(135deg, #ff006e, #cc0058);
        box-shadow: 0 0 25px rgba(255,0,110,.35);
      }
      .pn-duel-vs {
        font-size: 2.2rem;
        font-weight: 1000;
        color: #ffd700;
        text-shadow: 0 0 22px rgba(255,215,0,.45);
        animation: pnDuelVsPulse 1.2s ease-in-out infinite;
      }
      @keyframes pnDuelVsPulse { 50% { transform: scale(1.15); } }
      .pn-duel-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(0, 21, 27, .64);
        backdrop-filter: blur(14px);
      }
      .pn-duel-modal.is-open { display: flex; }
      .pn-duel-shell {
        position: relative;
        width: min(860px, 100%);
        max-height: 94vh;
        overflow: auto;
        border-radius: 2rem;
        color: #fff;
        background: linear-gradient(135deg, #0a0e27 0%, #1a1f4b 50%, #0d1235 100%);
        box-shadow: 0 40px 120px rgba(0,0,0,.38);
        border: 1px solid rgba(255,255,255,.14);
      }
      .pn-duel-shell::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 18% 12%, rgba(0,212,255,.22), transparent 30%),
          radial-gradient(circle at 90% 14%, rgba(255,0,110,.16), transparent 28%);
        pointer-events: none;
      }
      .pn-duel-topbar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.2rem;
        background: rgba(10,14,39,.84);
        backdrop-filter: blur(14px);
        border-bottom: 1px solid rgba(255,255,255,.10);
      }
      .pn-duel-topbar strong {
        display: block;
        font-size: 1rem;
      }
      .pn-duel-topbar span {
        display: block;
        color: rgba(255,255,255,.62);
        font-size: .78rem;
        font-weight: 800;
      }
      .pn-duel-close {
        width: 42px;
        height: 42px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.08);
        color: #fff;
        cursor: pointer;
        font-size: 1.3rem;
        font-weight: 900;
      }
      .pn-duel-body {
        position: relative;
        z-index: 2;
        padding: clamp(1rem, 3vw, 2rem);
      }
      .pn-duel-screen { display: none; animation: pnDuelFade .45s ease both; }
      .pn-duel-screen.active { display: block; }
      @keyframes pnDuelFade { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
      .pn-duel-start { text-align: center; padding: 1.4rem .4rem 2rem; }
      .pn-duel-game-title {
        margin: 0 0 .5rem;
        font-size: clamp(2.1rem, 6vw, 4rem);
        line-height: .95;
        letter-spacing: -.06em;
        font-weight: 1000;
        background: linear-gradient(90deg, #00d4ff, #7b2cbf, #ff006e);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .pn-duel-subtitle {
        color: rgba(255,255,255,.65);
        margin-bottom: 1.7rem;
      }
      .pn-duel-live-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
      }
      .pn-duel-score-board { display: flex; gap: .8rem; flex-wrap: wrap; }
      .pn-duel-score-item {
        min-width: 105px;
        padding: .75rem 1rem;
        border-radius: 1.1rem;
        background: rgba(255,255,255,.09);
        border: 1px solid rgba(255,255,255,.13);
      }
      .pn-duel-score-item span {
        display: block;
        color: rgba(255,255,255,.56);
        font-size: .72rem;
        text-transform: uppercase;
        letter-spacing: .12em;
        font-weight: 900;
      }
      .pn-duel-score-item strong {
        display: block;
        margin-top: .15rem;
        font-size: 1.55rem;
        font-weight: 1000;
      }
      .pn-duel-player-score { color: #00d4ff; }
      .pn-duel-bot-score { color: #ff006e; }
      .pn-duel-counter {
        font-size: 1.05rem;
        font-weight: 950;
        color: #ffd700;
      }
      .pn-duel-progress {
        height: 8px;
        border-radius: 999px;
        background: rgba(255,255,255,.10);
        overflow: hidden;
        margin-bottom: 1.2rem;
      }
      .pn-duel-progress-fill {
        height: 100%;
        width: 10%;
        background: linear-gradient(90deg, #00d4ff, #7b2cbf);
        box-shadow: 0 0 12px rgba(0,212,255,.45);
        transition: width .4s ease;
      }
      .pn-duel-timer-wrap { text-align: center; margin-bottom: 1rem; }
      .pn-duel-timer {
        font-size: 2rem;
        font-weight: 1000;
        color: #00d4ff;
      }
      .pn-duel-timer.warning { color: #ffd700; }
      .pn-duel-timer.danger {
        color: #ef4444;
        animation: pnDuelTimerPulse .55s ease-in-out infinite;
      }
      @keyframes pnDuelTimerPulse { 50% { opacity: .45; transform: scale(1.08); } }
      .pn-duel-question-card {
        border-radius: 1.5rem;
        padding: clamp(1rem, 3vw, 1.65rem);
        margin-bottom: 1rem;
        background: linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,.045));
        border: 1px solid rgba(255,255,255,.15);
        backdrop-filter: blur(12px);
      }
      .pn-duel-question-text {
        font-size: clamp(1.1rem, 2.4vw, 1.55rem);
        line-height: 1.55;
        font-weight: 850;
      }
      .pn-duel-options {
        display: grid;
        gap: .8rem;
      }
      .pn-duel-option {
        width: 100%;
        display: flex;
        align-items: center;
        gap: .8rem;
        text-align: left;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 1.15rem;
        background: rgba(255,255,255,.06);
        color: #fff;
        padding: .95rem 1rem;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 750;
        transition: transform .2s ease, border-color .2s ease, background .2s ease;
      }
      .pn-duel-option:hover:not(.disabled) {
        transform: translateX(8px);
        border-color: rgba(0,212,255,.48);
        background: rgba(255,255,255,.13);
      }
      .pn-duel-letter {
        flex: 0 0 auto;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(255,255,255,.18);
        font-size: .82rem;
        font-weight: 950;
      }
      .pn-duel-option.correct {
        background: linear-gradient(135deg, rgba(34,197,94,.30), rgba(34,197,94,.10));
        border-color: #22c55e;
      }
      .pn-duel-option.wrong {
        background: linear-gradient(135deg, rgba(239,68,68,.30), rgba(239,68,68,.10));
        border-color: #ef4444;
        animation: pnDuelShake .38s ease;
      }
      .pn-duel-option.timeout {
        background: linear-gradient(135deg, rgba(245,158,11,.30), rgba(245,158,11,.10));
        border-color: #f59e0b;
      }
      .pn-duel-option.disabled { opacity: .82; cursor: not-allowed; }
      @keyframes pnDuelShake {
        20% { transform: translateX(-8px); }
        40% { transform: translateX(8px); }
        60% { transform: translateX(-6px); }
        80% { transform: translateX(6px); }
      }
      .pn-duel-bot-thinking {
        min-height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: .4rem;
        margin-top: .9rem;
        color: #ff6b9d;
        opacity: 0;
        transition: opacity .25s ease;
      }
      .pn-duel-bot-thinking.active { opacity: 1; }
      .pn-duel-dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: #ff006e;
        animation: pnDuelDot .6s infinite alternate;
      }
      .pn-duel-dot:nth-child(3) { animation-delay: .18s; }
      .pn-duel-dot:nth-child(4) { animation-delay: .36s; }
      @keyframes pnDuelDot { to { transform: translateY(-8px); } }
      .pn-duel-result { text-align: center; padding: 1.4rem .4rem 2rem; }
      .pn-duel-result-title {
        margin: 0 0 1.4rem;
        font-size: clamp(2rem, 5vw, 3.3rem);
        line-height: 1;
        letter-spacing: -.055em;
        font-weight: 1000;
      }
      .pn-duel-win {
        background: linear-gradient(90deg, #ffd700, #ffed4e);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .pn-duel-lose {
        background: linear-gradient(90deg, #ff006e, #ff4d4d);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .pn-duel-final-scores {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin: 1.5rem 0;
        flex-wrap: wrap;
      }
      .pn-duel-final-card {
        min-width: 190px;
        position: relative;
        overflow: hidden;
        border-radius: 1.35rem;
        border: 2px solid rgba(255,255,255,.16);
        padding: 1.2rem;
        background: rgba(255,255,255,.075);
      }
      .pn-duel-final-card.winner {
        border-color: #ffd700;
        box-shadow: 0 0 32px rgba(255,215,0,.24);
      }
      .pn-duel-final-avatar { font-size: 2.5rem; margin-bottom: .5rem; }
      .pn-duel-final-name { font-weight: 900; margin-bottom: .4rem; }
      .pn-duel-final-score { font-size: 2.6rem; font-weight: 1000; }
      .pn-duel-winner-badge {
        position: absolute;
        top: .65rem;
        right: -.55rem;
        background: #ffd700;
        color: #000;
        padding: .25rem .7rem;
        border-radius: 999px;
        font-weight: 950;
        font-size: .68rem;
        transform: rotate(14deg);
        display: none;
      }
      .pn-duel-winner-badge.show { display: block; }
      .pn-duel-message {
        color: rgba(255,255,255,.70);
        font-size: 1.05rem;
        line-height: 1.7;
        margin: 0 0 1.2rem;
      }
      .pn-duel-confetti-canvas {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 100000;
      }
      @media (max-width: 850px) {
        .pn-duel-launch-grid { grid-template-columns: 1fr; }
        .pn-duel-vs-preview { transform: none; min-height: 220px; }
      }
      @media (max-width: 600px) {
        .pn-duel-vs-preview { grid-template-columns: 1fr; }
        .pn-duel-vs { font-size: 1.5rem; }
        .pn-duel-live-header { align-items: stretch; }
        .pn-duel-score-board { width: 100%; }
        .pn-duel-score-item { flex: 1; min-width: 0; }
        .pn-duel-final-card { min-width: 150px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .pn-duel-vs, .pn-duel-dot, .pn-duel-timer.danger { animation: none !important; }
        .pn-duel-option, .pn-duel-btn { transition: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function mountLaunch() {
    if (document.getElementById("pn-duel-launch-arcade")) return;

    const section = document.createElement("section");
    section.id = "pn-duel-launch-arcade";
    section.className = "pn-duel-launch-arcade";
    section.innerHTML = `
      <div class="pn-duel-launch-grid">
        <div>
          <span class="pn-duel-kicker">⚔ Pharmacy Duel</span>
          <h2 class="pn-duel-launch-title">Beat Nexus Bot.</h2>
          <p class="pn-duel-launch-copy">
            A fast solo duel mode. Answer 10 pharmacy questions, race the timer, and beat the bot's fixed target score of 7/10.
          </p>
          <div class="pn-duel-actions">
            <button type="button" class="pn-duel-btn pn-duel-btn-primary" data-pn-duel-open>Start Duel</button>
            <button type="button" class="pn-duel-btn pn-duel-btn-soft" data-pn-duel-open>Quick Challenge</button>
          </div>
        </div>

        <div class="pn-duel-vs-preview" aria-hidden="true">
          <div class="pn-duel-player-card">
            <div class="pn-duel-avatar">👨‍⚕️</div>
            <strong>You</strong>
            <div style="color:rgba(255,255,255,.58);font-size:.85rem;">Pharmacy Student</div>
          </div>
          <div class="pn-duel-vs">VS</div>
          <div class="pn-duel-player-card">
            <div class="pn-duel-avatar bot">🤖</div>
            <strong>Nexus Bot</strong>
            <div style="color:#ff6b9d;font-size:.85rem;">Dynamic score</div>
          </div>
        </div>
      </div>
    `;

    const home = document.getElementById("page-home");
    const container = home?.querySelector(".max-w-7xl, .mx-auto") || home || document.querySelector("main") || document.body;
    container.appendChild(section);

    section.querySelectorAll("[data-pn-duel-open]").forEach(btn => {
      btn.addEventListener("click", openGame);
    });

    setTimeout(updateDuelDataLabel, 300);
    setInterval(updateDuelDataLabel, 5000);
  }

  function mountModal() {
    if (document.getElementById("pn-duel-modal")) return;

    const modal = document.createElement("div");
    modal.id = "pn-duel-modal";
    modal.className = "pn-duel-modal";
    modal.innerHTML = `
      <canvas class="pn-duel-confetti-canvas" id="pn-duel-confetti-canvas"></canvas>
      <div class="pn-duel-shell" role="dialog" aria-modal="true" aria-label="Pharmacy Duel">
        <div class="pn-duel-topbar">
          <div>
            <strong>Pharmacy Duel</strong>
            <span>Beat the Bot Challenge</span>
          </div>
          <button type="button" class="pn-duel-close" data-pn-duel-close aria-label="Close">×</button>
        </div>

        <div class="pn-duel-body">
          <div class="pn-duel-screen active" id="pn-duel-start-screen">
            <div class="pn-duel-start">
              <h2 class="pn-duel-game-title">PHARMACY DUEL</h2>
              <p class="pn-duel-subtitle">Answer 10 questions. Beat Nexus Bot's changing score.</p>
              <div class="pn-duel-vs-preview" style="max-width:620px;margin:0 auto 1.4rem;transform:none;">
                <div class="pn-duel-player-card">
                  <div class="pn-duel-avatar">👨‍⚕️</div>
                  <strong>You</strong>
                  <div style="color:rgba(255,255,255,.58);font-size:.85rem;">Pharmacy Student</div>
                </div>
                <div class="pn-duel-vs">VS</div>
                <div class="pn-duel-player-card">
                  <div class="pn-duel-avatar bot">🤖</div>
                  <strong>Nexus Bot</strong>
                  <div style="color:#ff6b9d;font-size:.85rem;">Dynamic score</div>
                </div>
              </div>
              <button type="button" class="pn-duel-btn pn-duel-btn-primary" data-pn-duel-start>Start Duel</button>
            </div>
          </div>

          <div class="pn-duel-screen" id="pn-duel-game-screen">
            <div class="pn-duel-live-header">
              <div class="pn-duel-score-board">
                <div class="pn-duel-score-item">
                  <span>You</span>
                  <strong class="pn-duel-player-score" id="pn-duel-player-score">0</strong>
                </div>
                <div class="pn-duel-score-item">
                  <span>Nexus Bot</span>
                  <strong class="pn-duel-bot-score" id="pn-duel-bot-score">0</strong>
                </div>
                <div class="pn-duel-score-item">
                  <span>Bot Target</span>
                  <strong class="pn-duel-bot-score" id="pn-duel-bot-target">?</strong>
                </div>
              </div>
              <div class="pn-duel-counter"><span id="pn-duel-current-q">1</span> / 10</div>
            </div>

            <div class="pn-duel-progress">
              <div class="pn-duel-progress-fill" id="pn-duel-progress-fill"></div>
            </div>

            <div class="pn-duel-timer-wrap">
              <div class="pn-duel-timer" id="pn-duel-timer">15</div>
            </div>

            <div class="pn-duel-question-card">
              <div class="pn-duel-question-text" id="pn-duel-question-text">Loading...</div>
            </div>

            <div class="pn-duel-options" id="pn-duel-options"></div>

            <div class="pn-duel-bot-thinking" id="pn-duel-bot-thinking">
              <span>Nexus Bot is thinking</span>
              <div class="pn-duel-dot"></div>
              <div class="pn-duel-dot"></div>
              <div class="pn-duel-dot"></div>
            </div>
          </div>

          <div class="pn-duel-screen" id="pn-duel-result-screen">
            <div class="pn-duel-result">
              <h2 class="pn-duel-result-title" id="pn-duel-result-title">Duel Complete</h2>

              <div class="pn-duel-final-scores">
                <div class="pn-duel-final-card" id="pn-duel-player-final-card">
                  <div class="pn-duel-winner-badge" id="pn-duel-player-badge">WINNER</div>
                  <div class="pn-duel-final-avatar">👨‍⚕️</div>
                  <div class="pn-duel-final-name">You</div>
                  <div class="pn-duel-final-score pn-duel-player-score" id="pn-duel-player-final-score">0/10</div>
                </div>
                <div class="pn-duel-final-card" id="pn-duel-bot-final-card">
                  <div class="pn-duel-winner-badge" id="pn-duel-bot-badge">WINNER</div>
                  <div class="pn-duel-final-avatar">🤖</div>
                  <div class="pn-duel-final-name">Nexus Bot</div>
                  <div class="pn-duel-final-score pn-duel-bot-score" id="pn-duel-bot-final-score">7/10</div>
                </div>
              </div>

              <p class="pn-duel-message" id="pn-duel-result-message"></p>
              <button type="button" class="pn-duel-btn pn-duel-btn-primary" data-pn-duel-restart>Play Again</button>
              <button type="button" class="pn-duel-btn pn-duel-btn-soft" data-pn-duel-close style="margin-left:.5rem;">Back to Site</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll("[data-pn-duel-close]").forEach(btn => btn.addEventListener("click", closeGame));
    modal.querySelector("[data-pn-duel-start]")?.addEventListener("click", startGame);
    modal.querySelector("[data-pn-duel-restart]")?.addEventListener("click", restartGame);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeGame();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && modal.classList.contains("is-open")) closeGame();
    });

    resizeConfetti();
    window.addEventListener("resize", resizeConfetti);
  }

  function showScreen(id) {
    document.querySelectorAll(".pn-duel-screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");
  }

  function openGame() {
    mountModal();
    updateDuelDataLabel();
    document.getElementById("pn-duel-modal")?.classList.add("is-open");
    document.body.style.overflow = "hidden";
    showScreen("pn-duel-start-screen");
  }

  function closeGame() {
    clearGameTimers();
    stopConfetti();
    document.getElementById("pn-duel-modal")?.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function clearGameTimers() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    if (state.botTimeout) clearTimeout(state.botTimeout);
    state.timerInterval = null;
    state.botTimeout = null;
  }

  function startGame() {
    clearGameTimers();
    stopConfetti();

    duelQuestions = prepareDuelQuestions();
    state.botFinalScore = calculateBotScore(duelQuestions);
    state.botWrongIndices = makeBotWrongIndices(state.botFinalScore);

    state.currentQuestion = 0;
    state.playerScore = 0;
    state.botScore = 0;
    state.answered = false;
    state.timeLeft = CONFIG.secondsPerQuestion;

    const subtitle = document.querySelector(".pn-duel-topbar span");
    if (subtitle) subtitle.textContent = `Nexus Bot target this duel: ${state.botFinalScore}/10`;

    updateScoreBoard();
    showScreen("pn-duel-game-screen");
    setTimeout(loadQuestion, 80);
  }

  function restartGame() {
    startGame();
  }

  function loadQuestion() {
    clearGameTimers();
    state.answered = false;

    const q = duelQuestions[state.currentQuestion];

    document.getElementById("pn-duel-question-text").textContent = q.question;
    document.getElementById("pn-duel-current-q").textContent = String(state.currentQuestion + 1);
    document.getElementById("pn-duel-progress-fill").style.width = ((state.currentQuestion + 1) / CONFIG.questionsCount * 100) + "%";

    const optionsContainer = document.getElementById("pn-duel-options");
    optionsContainer.innerHTML = "";

    const letters = ["A", "B", "C", "D", "E", "F"];
    q.options.forEach((opt, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pn-duel-option";
      btn.innerHTML = `<span class="pn-duel-letter">${letters[index] || String(index + 1)}</span><span>${escapeHtml(opt)}</span>`;
      btn.addEventListener("click", () => selectAnswer(index));
      optionsContainer.appendChild(btn);
    });

    document.getElementById("pn-duel-bot-thinking").classList.add("active");

    state.timeLeft = CONFIG.secondsPerQuestion;
    updateTimer();

    state.timerInterval = setInterval(() => {
      state.timeLeft -= 1;
      updateTimer();
      if (state.timeLeft <= 0) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        if (!state.answered) selectAnswer(-1);
      }
    }, 1000);

    const botTime = BOT_TIME_PER_QUESTION[state.currentQuestion] * 1000;
    state.botTimeout = setTimeout(() => {
      document.getElementById("pn-duel-bot-thinking").classList.remove("active");
      const botCorrect = !BOT_WRONG_INDICES.includes(state.currentQuestion);
      if (botCorrect) {
        state.botScore += 1;
        updateScoreBoard();
      }
    }, botTime);
  }

  function updateTimer() {
    const timer = document.getElementById("pn-duel-timer");
    timer.textContent = String(state.timeLeft);
    timer.classList.remove("warning", "danger");
    if (state.timeLeft <= 5) timer.classList.add("danger");
    else if (state.timeLeft <= 10) timer.classList.add("warning");
  }

  function updateScoreBoard() {
    const player = document.getElementById("pn-duel-player-score");
    const bot = document.getElementById("pn-duel-bot-score");
    const target = document.getElementById("pn-duel-bot-target");
    if (player) player.textContent = String(state.playerScore);
    if (bot) bot.textContent = String(state.botScore);
    if (target) target.textContent = String(state.botFinalScore);
  }

  function selectAnswer(selectedIndex) {
    if (state.answered) return;
    state.answered = true;
    clearGameTimers();

    const q = duelQuestions[state.currentQuestion];
    const options = document.querySelectorAll(".pn-duel-option");

    options.forEach((btn, index) => {
      btn.classList.add("disabled");
      btn.disabled = true;
      if (index === q.correct) btn.classList.add("correct");
      if (index === selectedIndex && selectedIndex !== q.correct) btn.classList.add("wrong");
      if (selectedIndex === -1 && index === q.correct) btn.classList.add("timeout");
    });

    if (selectedIndex === q.correct) {
      state.playerScore += 1;
      updateScoreBoard();
    }

    document.getElementById("pn-duel-bot-thinking").classList.remove("active");

    setTimeout(() => {
      state.currentQuestion += 1;
      if (state.currentQuestion < QUESTIONS.length) loadQuestion();
      else setTimeout(showResults, 350);
    }, 1250);
  }

  function showResults() {
    showScreen("pn-duel-result-screen");

    state.botScore = state.botFinalScore;

    document.getElementById("pn-duel-player-final-score").textContent = state.playerScore + "/10";
    document.getElementById("pn-duel-bot-final-score").textContent = state.botScore + "/10";

    const playerCard = document.getElementById("pn-duel-player-final-card");
    const botCard = document.getElementById("pn-duel-bot-final-card");
    const playerBadge = document.getElementById("pn-duel-player-badge");
    const botBadge = document.getElementById("pn-duel-bot-badge");
    const resultTitle = document.getElementById("pn-duel-result-title");
    const resultMessage = document.getElementById("pn-duel-result-message");

    [playerCard, botCard].forEach(card => card.classList.remove("winner"));
    [playerBadge, botBadge].forEach(badge => badge.classList.remove("show"));

    let outcome = "lose";

    if (state.playerScore > state.botScore) {
      outcome = "win";
      playerCard.classList.add("winner");
      playerBadge.classList.add("show");
      resultTitle.innerHTML = `<span class="pn-duel-win">YOU BEAT NEXUS BOT!</span>`;
      resultMessage.innerHTML = `🎉 You beat a dynamic bot score of ${state.botScore}/10. Your pharmacy knowledge is looking sharp.`;
      startConfetti();
    } else if (state.playerScore === state.botScore) {
      outcome = "draw";
      playerCard.classList.add("winner");
      botCard.classList.add("winner");
      resultTitle.innerHTML = `<span class="pn-duel-win">IT'S A TIE!</span>`;
      resultMessage.innerHTML = `⚖️ You matched Nexus Bot at ${state.botScore}/10. One more correct answer next time and you win.`;
      startConfetti();
    } else {
      botCard.classList.add("winner");
      botBadge.classList.add("show");
      resultTitle.innerHTML = `<span class="pn-duel-lose">NEXUS BOT WINS</span>`;
      resultMessage.innerHTML = `🤖 Nexus Bot scored ${state.botScore}/10 this round. Study up and try again.`;
    }

    saveHistory({ score: state.playerScore, botScore: state.botScore, outcome, date: new Date().toISOString() });
  }

  function saveHistory(entry) {
    try {
      const history = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "[]");
      history.unshift(entry);
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(history.slice(0, 20)));
    } catch (_) {}
  }

  function getCanvas() {
    return document.getElementById("pn-duel-confetti-canvas");
  }

  function resizeConfetti() {
    const canvas = getCanvas();
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function startConfetti() {
    const canvas = getCanvas();
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || state.confettiActive) return;

    state.confettiActive = true;
    state.confettiParticles = [];
    const colors = ["#00d4ff", "#7b2cbf", "#ff006e", "#ffd700", "#22c55e", "#ff4d4d"];

    for (let i = 0; i < 130; i++) {
      state.confettiParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * 3 + 2,
        speedX: Math.random() * 2 - 1,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 4 - 2
      });
    }

    animateConfetti();
  }

  function animateConfetti() {
    const canvas = getCanvas();
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !state.confettiActive) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    state.confettiParticles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      if (p.y > canvas.height) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    state.confettiAnimationId = requestAnimationFrame(animateConfetti);
  }

  function stopConfetti() {
    const canvas = getCanvas();
    const ctx = canvas?.getContext("2d");

    state.confettiActive = false;
    if (state.confettiAnimationId) cancelAnimationFrame(state.confettiAnimationId);
    state.confettiAnimationId = null;

    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function exposeApi() {
    window.PharmacyDuelArcade = {
      open: openGame,
      start: () => {
        openGame();
        startGame();
      },
      close: closeGame,
      collectSiteQuestions,
      prepareDuelQuestions
    };
  }

  function init() {
    injectStyles();
    mountModal();
    mountLaunch();
    exposeApi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
