/* =========================================================
   Pharmacy Nexus — Pharmacy Duel: Beat the Bot
   Single-file drop-in game module
   File: pn-duel-game.js

   How to use:
   1) Upload this file to: assets/js/pn-duel-game.js
   2) Add before </body>:
      <script src="./assets/js/pn-duel-game.js"></script>

   This module does NOT change your quiz/exam logic.
   It injects a standalone fake solo duel game:
   Student answers 10 questions vs Nexus Bot default score 7/10.
   ========================================================= */

(function () {
  "use strict";

  const DUEL_CONFIG = {
    questionCount: 10,
    botScore: 7,
    botName: "Nexus Bot",
    storageKey: "pn_duel_history_v1",
    mountedAttr: "data-pn-duel-mounted"
  };

  const DEMO_QUESTIONS = [
    {
      id: "duel_demo_1",
      questionText: "Which receptor is primarily blocked by atropine?",
      options: ["Nicotinic receptor", "Muscarinic receptor", "Alpha-1 receptor", "Beta-2 receptor"],
      correctAnswer: 1,
      explanation: "Atropine is a competitive antagonist at muscarinic acetylcholine receptors."
    },
    {
      id: "duel_demo_2",
      questionText: "Which class is most associated with dry cough as an adverse effect?",
      options: ["ACE inhibitors", "ARBs", "Calcium channel blockers", "Thiazide diuretics"],
      correctAnswer: 0,
      explanation: "ACE inhibitors increase bradykinin, which may cause persistent dry cough."
    },
    {
      id: "duel_demo_3",
      questionText: "Which antibiotic class is classically associated with tendon rupture risk?",
      options: ["Macrolides", "Fluoroquinolones", "Tetracyclines", "Penicillins"],
      correctAnswer: 1,
      explanation: "Fluoroquinolones carry warnings for tendinitis and tendon rupture."
    },
    {
      id: "duel_demo_4",
      questionText: "Which drug is a loop diuretic?",
      options: ["Hydrochlorothiazide", "Furosemide", "Spironolactone", "Acetazolamide"],
      correctAnswer: 1,
      explanation: "Furosemide inhibits the Na-K-2Cl transporter in the thick ascending limb."
    },
    {
      id: "duel_demo_5",
      questionText: "Which medication is commonly used as rescue therapy for acute asthma symptoms?",
      options: ["Salmeterol", "Montelukast", "Albuterol", "Budesonide"],
      correctAnswer: 2,
      explanation: "Albuterol is a short-acting beta-2 agonist used for rapid bronchodilation."
    },
    {
      id: "duel_demo_6",
      questionText: "Which anticoagulant requires routine INR monitoring?",
      options: ["Warfarin", "Apixaban", "Rivaroxaban", "Dabigatran"],
      correctAnswer: 0,
      explanation: "Warfarin requires INR monitoring because of its narrow therapeutic index and interactions."
    },
    {
      id: "duel_demo_7",
      questionText: "Which antidiabetic drug class is associated with genital mycotic infections?",
      options: ["DPP-4 inhibitors", "SGLT2 inhibitors", "Sulfonylureas", "Meglitinides"],
      correctAnswer: 1,
      explanation: "SGLT2 inhibitors increase urinary glucose excretion, raising genital infection risk."
    },
    {
      id: "duel_demo_8",
      questionText: "Which adverse effect is classically linked to statins?",
      options: ["Ototoxicity", "Myopathy", "Gingival hyperplasia", "Hypokalemia"],
      correctAnswer: 1,
      explanation: "Statins may cause muscle symptoms and rarely rhabdomyolysis."
    },
    {
      id: "duel_demo_9",
      questionText: "Which drug is a proton pump inhibitor?",
      options: ["Famotidine", "Omeprazole", "Sucralfate", "Calcium carbonate"],
      correctAnswer: 1,
      explanation: "Omeprazole irreversibly inhibits the gastric proton pump."
    },
    {
      id: "duel_demo_10",
      questionText: "Which drug is contraindicated in pregnancy due to teeth discoloration and bone effects?",
      options: ["Amoxicillin", "Azithromycin", "Tetracycline", "Cephalexin"],
      correctAnswer: 2,
      explanation: "Tetracyclines can affect fetal bone growth and discolor teeth."
    },
    {
      id: "duel_demo_11",
      questionText: "Which beta-blocker is cardioselective?",
      options: ["Propranolol", "Nadolol", "Metoprolol", "Timolol"],
      correctAnswer: 2,
      explanation: "Metoprolol is relatively beta-1 selective."
    },
    {
      id: "duel_demo_12",
      questionText: "Which drug is used for opioid overdose reversal?",
      options: ["Flumazenil", "Naloxone", "N-acetylcysteine", "Protamine"],
      correctAnswer: 1,
      explanation: "Naloxone is an opioid receptor antagonist used in opioid overdose."
    }
  ];

  let duelState = {
    active: false,
    questions: [],
    index: 0,
    score: 0,
    locked: false,
    answers: [],
    startedAt: null
  };

  function injectStyles() {
    if (document.getElementById("pn-duel-style")) return;

    const css = `
      :root {
        --pn-duel-primary: #00151b;
        --pn-duel-primary-2: #07313a;
        --pn-duel-gold: #ffe088;
        --pn-duel-gold-2: #cba72f;
        --pn-duel-teal: #38b9c9;
        --pn-duel-green: #22c55e;
        --pn-duel-red: #ef4444;
        --pn-duel-surface: #f8f9fa;
        --pn-duel-text: #08181d;
        --pn-duel-muted: #5b686c;
        --pn-duel-line: rgba(0, 21, 27, .12);
      }

      .pn-duel-launch-section {
        position: relative;
        overflow: hidden;
        margin: 2rem auto;
        max-width: 1120px;
        border-radius: 2rem;
        background:
          radial-gradient(circle at 85% 20%, rgba(255, 224, 136, .22), transparent 32%),
          radial-gradient(circle at 10% 90%, rgba(56, 185, 201, .16), transparent 34%),
          linear-gradient(135deg, #00151b 0%, #082b33 54%, #123b3b 100%);
        color: white;
        padding: clamp(1.4rem, 3vw, 2.3rem);
        box-shadow: 0 26px 70px rgba(0, 21, 27, .20);
        isolation: isolate;
      }

      .pn-duel-launch-section::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
        background-size: 34px 34px;
        mask-image: linear-gradient(90deg, black, transparent 82%);
        pointer-events: none;
      }

      .pn-duel-launch-grid {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr);
        gap: 1.6rem;
        align-items: center;
      }

      .pn-duel-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: .5rem;
        border: 1px solid rgba(255,224,136,.26);
        background: rgba(255,224,136,.09);
        color: var(--pn-duel-gold);
        border-radius: 999px;
        padding: .48rem .75rem;
        font-size: .72rem;
        font-weight: 900;
        letter-spacing: .18em;
        text-transform: uppercase;
      }

      .pn-duel-launch-title {
        margin: 1rem 0 .7rem;
        max-width: 650px;
        font-size: clamp(2rem, 4vw, 4.2rem);
        line-height: .93;
        letter-spacing: -.06em;
        font-weight: 950;
      }

      .pn-duel-launch-copy {
        max-width: 620px;
        color: rgba(255,255,255,.76);
        font-size: clamp(.95rem, 1.35vw, 1.12rem);
        line-height: 1.8;
      }

      .pn-duel-launch-actions {
        display: flex;
        align-items: center;
        gap: .8rem;
        flex-wrap: wrap;
        margin-top: 1.2rem;
      }

      .pn-duel-btn {
        appearance: none;
        border: 0;
        border-radius: 999px;
        min-height: 3rem;
        padding: .8rem 1.25rem;
        font-weight: 950;
        letter-spacing: -.02em;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: .55rem;
        cursor: pointer;
        transition: transform .2s ease, box-shadow .2s ease, background .2s ease, opacity .2s ease;
        user-select: none;
      }

      .pn-duel-btn:hover { transform: translateY(-2px); }
      .pn-duel-btn:active { transform: translateY(0) scale(.98); }

      .pn-duel-btn-primary {
        background: var(--pn-duel-gold);
        color: #231a00;
        box-shadow: 0 18px 32px rgba(255,224,136,.18);
      }

      .pn-duel-btn-dark {
        background: var(--pn-duel-primary);
        color: white;
      }

      .pn-duel-btn-soft {
        background: rgba(255,255,255,.11);
        color: white;
        border: 1px solid rgba(255,255,255,.16);
      }

      .pn-duel-btn-light {
        background: white;
        color: var(--pn-duel-primary);
        box-shadow: 0 14px 34px rgba(0,21,27,.12);
      }

      .pn-duel-btn[disabled] {
        opacity: .55;
        cursor: not-allowed;
        transform: none !important;
      }

      .pn-duel-arena-card {
        position: relative;
        min-height: 270px;
        border-radius: 1.8rem;
        background:
          linear-gradient(145deg, rgba(255,255,255,.13), rgba(255,255,255,.04)),
          rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 24px 60px rgba(0,0,0,.18);
        overflow: hidden;
        transform: perspective(900px) rotateY(-7deg) rotateX(4deg);
      }

      .pn-duel-arena-card::before {
        content: "";
        position: absolute;
        inset: 20px;
        border-radius: 1.3rem;
        border: 1px dashed rgba(255,224,136,.24);
        pointer-events: none;
      }

      .pn-duel-versus {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        padding: 2rem;
        gap: 1rem;
      }

      .pn-duel-player {
        border-radius: 1.4rem;
        background: rgba(0,21,27,.36);
        border: 1px solid rgba(255,255,255,.12);
        padding: 1rem;
      }

      .pn-duel-avatar {
        width: 54px;
        height: 54px;
        border-radius: 1.1rem;
        display: grid;
        place-items: center;
        background: rgba(255,255,255,.12);
        color: var(--pn-duel-gold);
        font-weight: 950;
        margin-bottom: .75rem;
      }

      .pn-duel-player strong {
        display: block;
        font-size: 1.08rem;
      }

      .pn-duel-player span {
        display: block;
        color: rgba(255,255,255,.63);
        font-size: .78rem;
        font-weight: 800;
        letter-spacing: .11em;
        text-transform: uppercase;
        margin-top: .25rem;
      }

      .pn-duel-vs-badge {
        width: 62px;
        height: 62px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--pn-duel-gold);
        color: var(--pn-duel-primary);
        font-weight: 1000;
        box-shadow: 0 18px 40px rgba(255,224,136,.22);
      }

      .pn-duel-pulse-orb {
        position: absolute;
        width: 220px;
        height: 220px;
        right: -80px;
        bottom: -80px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(255,224,136,.24), transparent 68%);
        animation: pnDuelPulse 3.2s ease-in-out infinite;
      }

      @keyframes pnDuelPulse {
        0%, 100% { transform: scale(.96); opacity: .72; }
        50% { transform: scale(1.08); opacity: 1; }
      }

      .pn-duel-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(0, 21, 27, .54);
        backdrop-filter: blur(14px);
      }

      .pn-duel-modal.is-open { display: flex; }

      .pn-duel-shell {
        width: min(1060px, 100%);
        max-height: min(92vh, 860px);
        overflow: auto;
        border-radius: 2rem;
        background:
          radial-gradient(circle at 88% 16%, rgba(255,224,136,.20), transparent 28%),
          linear-gradient(180deg, #fbfcfc, #edf3f4);
        color: var(--pn-duel-text);
        border: 1px solid rgba(255,255,255,.72);
        box-shadow: 0 40px 100px rgba(0,0,0,.32);
      }

      .pn-duel-topbar {
        position: sticky;
        top: 0;
        z-index: 3;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.2rem;
        background: rgba(251,252,252,.82);
        backdrop-filter: blur(16px);
        border-bottom: 1px solid rgba(0,21,27,.08);
      }

      .pn-duel-title-mini {
        display: flex;
        align-items: center;
        gap: .7rem;
        min-width: 0;
      }

      .pn-duel-title-icon {
        width: 42px;
        height: 42px;
        border-radius: 1rem;
        display: grid;
        place-items: center;
        background: var(--pn-duel-primary);
        color: var(--pn-duel-gold);
        font-weight: 950;
        flex: 0 0 auto;
      }

      .pn-duel-title-mini h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 950;
        letter-spacing: -.03em;
      }

      .pn-duel-title-mini p {
        margin: .12rem 0 0;
        color: var(--pn-duel-muted);
        font-size: .76rem;
        font-weight: 800;
      }

      .pn-duel-close {
        width: 42px;
        height: 42px;
        border-radius: 999px;
        border: 1px solid rgba(0,21,27,.10);
        background: white;
        color: var(--pn-duel-primary);
        cursor: pointer;
        font-size: 1.25rem;
        font-weight: 900;
      }

      .pn-duel-body {
        padding: clamp(1rem, 3vw, 2rem);
      }

      .pn-duel-scoreboard {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 1rem;
        align-items: stretch;
        margin-bottom: 1.2rem;
      }

      .pn-duel-score-card {
        border-radius: 1.5rem;
        background: white;
        border: 1px solid rgba(0,21,27,.08);
        padding: 1rem;
        box-shadow: 0 12px 30px rgba(0,21,27,.06);
      }

      .pn-duel-score-label {
        color: var(--pn-duel-muted);
        font-size: .72rem;
        font-weight: 900;
        letter-spacing: .14em;
        text-transform: uppercase;
        margin-bottom: .4rem;
      }

      .pn-duel-score-value {
        font-size: clamp(1.9rem, 4vw, 3.2rem);
        font-weight: 1000;
        line-height: 1;
        letter-spacing: -.06em;
      }

      .pn-duel-live-vs {
        align-self: center;
        width: 64px;
        height: 64px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--pn-duel-primary);
        color: var(--pn-duel-gold);
        font-weight: 1000;
        box-shadow: 0 18px 40px rgba(0,21,27,.16);
      }

      .pn-duel-progress-track {
        height: 10px;
        border-radius: 999px;
        background: rgba(0,21,27,.08);
        overflow: hidden;
        margin-bottom: 1.1rem;
      }

      .pn-duel-progress-fill {
        height: 100%;
        width: 0%;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--pn-duel-gold), var(--pn-duel-teal));
        transition: width .35s ease;
      }

      .pn-duel-question-card {
        position: relative;
        overflow: hidden;
        border-radius: 1.7rem;
        background: var(--pn-duel-primary);
        color: white;
        padding: clamp(1.1rem, 3vw, 2rem);
        box-shadow: 0 26px 70px rgba(0,21,27,.18);
      }

      .pn-duel-question-card::after {
        content: "";
        position: absolute;
        inset: auto -70px -120px auto;
        width: 240px;
        height: 240px;
        background: radial-gradient(circle, rgba(255,224,136,.20), transparent 70%);
        border-radius: 999px;
      }

      .pn-duel-q-meta {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
        color: rgba(255,255,255,.65);
        font-size: .75rem;
        font-weight: 900;
        letter-spacing: .13em;
        text-transform: uppercase;
      }

      .pn-duel-question-text {
        position: relative;
        z-index: 1;
        font-size: clamp(1.28rem, 2.4vw, 2.25rem);
        line-height: 1.18;
        letter-spacing: -.045em;
        font-weight: 950;
        max-width: 860px;
      }

      .pn-duel-options {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: .9rem;
        margin-top: 1rem;
      }

      .pn-duel-option {
        border: 1px solid rgba(0,21,27,.10);
        background: white;
        color: var(--pn-duel-primary);
        border-radius: 1.25rem;
        padding: 1rem;
        text-align: left;
        font-weight: 850;
        line-height: 1.4;
        cursor: pointer;
        min-height: 72px;
        transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
      }

      .pn-duel-option:hover {
        transform: translateY(-2px);
        border-color: rgba(203,167,47,.45);
        box-shadow: 0 14px 28px rgba(0,21,27,.08);
      }

      .pn-duel-option.is-correct {
        border-color: rgba(34,197,94,.65);
        background: rgba(34,197,94,.12);
        color: #0f3b21;
      }

      .pn-duel-option.is-wrong {
        border-color: rgba(239,68,68,.65);
        background: rgba(239,68,68,.10);
        color: #5c1414;
      }

      .pn-duel-feedback {
        display: none;
        margin-top: 1rem;
        border-radius: 1.25rem;
        padding: 1rem;
        background: white;
        border: 1px solid rgba(0,21,27,.08);
        color: var(--pn-duel-primary);
        box-shadow: 0 12px 30px rgba(0,21,27,.06);
      }

      .pn-duel-feedback.is-visible { display: block; }

      .pn-duel-feedback strong {
        display: block;
        margin-bottom: .25rem;
        font-size: .95rem;
      }

      .pn-duel-feedback p {
        margin: 0;
        color: var(--pn-duel-muted);
        line-height: 1.65;
        font-weight: 650;
      }

      .pn-duel-footer-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: .8rem;
        margin-top: 1rem;
        flex-wrap: wrap;
      }

      .pn-duel-result {
        display: none;
        margin-top: 1rem;
        border-radius: 1.8rem;
        padding: clamp(1.2rem, 3vw, 2rem);
        background:
          radial-gradient(circle at 85% 16%, rgba(255,224,136,.22), transparent 28%),
          var(--pn-duel-primary);
        color: white;
        box-shadow: 0 26px 70px rgba(0,21,27,.18);
        overflow: hidden;
        position: relative;
      }

      .pn-duel-result.is-visible { display: block; }

      .pn-duel-result-badge {
        display: inline-flex;
        align-items: center;
        gap: .5rem;
        border-radius: 999px;
        padding: .48rem .75rem;
        background: rgba(255,224,136,.11);
        color: var(--pn-duel-gold);
        border: 1px solid rgba(255,224,136,.20);
        font-size: .75rem;
        font-weight: 950;
        letter-spacing: .13em;
        text-transform: uppercase;
      }

      .pn-duel-result h2 {
        margin: 1rem 0 .65rem;
        font-size: clamp(2rem, 5vw, 4.4rem);
        line-height: .92;
        letter-spacing: -.065em;
        font-weight: 1000;
      }

      .pn-duel-result p {
        max-width: 720px;
        color: rgba(255,255,255,.74);
        line-height: 1.75;
        margin: 0;
      }

      .pn-duel-mini-history {
        margin-top: 1rem;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: .8rem;
      }

      .pn-duel-history-chip {
        border-radius: 1.1rem;
        padding: .8rem;
        background: rgba(255,255,255,.10);
        border: 1px solid rgba(255,255,255,.12);
      }

      .pn-duel-history-chip span {
        display: block;
        color: rgba(255,255,255,.62);
        font-size: .7rem;
        font-weight: 900;
        letter-spacing: .13em;
        text-transform: uppercase;
      }

      .pn-duel-history-chip strong {
        display: block;
        margin-top: .25rem;
        font-size: 1.4rem;
        font-weight: 1000;
      }

      .pn-duel-confetti {
        position: fixed;
        top: -20px;
        width: 10px;
        height: 18px;
        border-radius: 3px;
        pointer-events: none;
        z-index: 100000;
        animation: pnDuelConfettiFall 1.9s ease-in forwards;
      }

      @keyframes pnDuelConfettiFall {
        to {
          transform: translateY(110vh) rotate(720deg);
          opacity: 0;
        }
      }

      @media (max-width: 860px) {
        .pn-duel-launch-grid,
        .pn-duel-scoreboard {
          grid-template-columns: 1fr;
        }

        .pn-duel-arena-card {
          transform: none;
          min-height: 230px;
        }

        .pn-duel-versus {
          grid-template-columns: 1fr;
        }

        .pn-duel-vs-badge,
        .pn-duel-live-vs {
          width: 48px;
          height: 48px;
          margin: auto;
        }

        .pn-duel-options {
          grid-template-columns: 1fr;
        }

        .pn-duel-mini-history {
          grid-template-columns: 1fr;
        }
      }

      html.dark .pn-duel-shell {
        background:
          radial-gradient(circle at 88% 16%, rgba(255,224,136,.13), transparent 28%),
          linear-gradient(180deg, #11171a, #172023);
        color: #f0f1f2;
        border-color: rgba(255,255,255,.08);
      }

      html.dark .pn-duel-topbar,
      html.dark .pn-duel-score-card,
      html.dark .pn-duel-option,
      html.dark .pn-duel-feedback {
        background: #172023;
        color: #f0f1f2;
        border-color: rgba(255,255,255,.10);
      }

      html.dark .pn-duel-title-mini p,
      html.dark .pn-duel-score-label,
      html.dark .pn-duel-feedback p {
        color: rgba(240,241,242,.65);
      }

      @media (prefers-reduced-motion: reduce) {
        .pn-duel-pulse-orb,
        .pn-duel-confetti {
          animation: none !important;
        }

        .pn-duel-btn,
        .pn-duel-option,
        .pn-duel-progress-fill {
          transition: none !important;
        }
      }
    `;

    const style = document.createElement("style");
    style.id = "pn-duel-style";
    style.textContent = css;
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

  function normalizeQuestion(raw, index = 0) {
    if (!raw || typeof raw !== "object") return null;

    const questionText =
      raw.questionText ||
      raw.question_text ||
      raw.question ||
      raw.text ||
      raw.title ||
      "";

    const options =
      Array.isArray(raw.options) ? raw.options :
      Array.isArray(raw.answers) ? raw.answers :
      [raw.option_1, raw.option_2, raw.option_3, raw.option_4].filter(Boolean);

    if (!questionText || !Array.isArray(options) || options.length < 2) return null;

    let correctAnswer =
      raw.correctAnswer ??
      raw.correct_answer ??
      raw.correct_option ??
      raw.answerIndex ??
      raw.correct ??
      0;

    if (typeof correctAnswer === "string") {
      const trimmed = correctAnswer.trim();
      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) {
        correctAnswer = numeric;
      } else {
        const found = options.findIndex(opt => String(opt).trim().toLowerCase() === trimmed.toLowerCase());
        correctAnswer = found >= 0 ? found : 0;
      }
    }

    correctAnswer = Number(correctAnswer);
    if (correctAnswer >= 1 && correctAnswer <= options.length) {
      correctAnswer = correctAnswer - 1;
    }
    if (!Number.isFinite(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
      correctAnswer = 0;
    }

    return {
      id: String(raw.id || raw.questionId || raw.question_id || `duel_q_${index}_${Date.now()}`),
      questionText: String(questionText),
      options: options.map(String),
      correctAnswer,
      explanation: String(raw.explanation || raw.summary || raw.rationale || "")
    };
  }

  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function shuffleQuestionOptions(question) {
    const mapped = question.options.map((value, index) => ({ value, index }));
    const shuffled = shuffle(mapped);
    const correctAnswer = shuffled.findIndex(item => item.index === question.correctAnswer);
    return {
      ...question,
      options: shuffled.map(item => item.value),
      correctAnswer: correctAnswer >= 0 ? correctAnswer : question.correctAnswer
    };
  }

  function collectQuestionsFromSite() {
    const collected = [];

    try {
      if (Array.isArray(window.appState?.currentTopicQuestions)) {
        collected.push(...window.appState.currentTopicQuestions);
      }
    } catch (_) {}

    try {
      if (Array.isArray(window.appState?.currentSetSessionQuestions)) {
        collected.push(...window.appState.currentSetSessionQuestions);
      }
    } catch (_) {}

    try {
      if (Array.isArray(window.appState?.currentExamSession?.questions)) {
        collected.push(...window.appState.currentExamSession.questions);
      }
    } catch (_) {}

    try {
      const cache = window.PN_DATA?.topicFilesCache;
      if (cache && typeof cache.forEach === "function") {
        cache.forEach(topicFile => {
          const possible =
            topicFile?.questions ||
            topicFile?.items ||
            topicFile?.data ||
            [];
          if (Array.isArray(possible)) collected.push(...possible);
        });
      }
    } catch (_) {}

    const normalized = collected
      .map(normalizeQuestion)
      .filter(Boolean);

    const seen = new Set();
    return normalized.filter(q => {
      const key = q.id + "::" + q.questionText;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getDuelQuestions() {
    const siteQuestions = collectQuestionsFromSite();
    const pool = siteQuestions.length >= DUEL_CONFIG.questionCount
      ? siteQuestions
      : [...siteQuestions, ...DEMO_QUESTIONS.map(normalizeQuestion).filter(Boolean)];

    return shuffle(pool)
      .slice(0, DUEL_CONFIG.questionCount)
      .map(shuffleQuestionOptions);
  }

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(DUEL_CONFIG.storageKey) || "[]");
    } catch (_) {
      return [];
    }
  }

  function saveHistory(entry) {
    try {
      const history = loadHistory();
      history.unshift(entry);
      localStorage.setItem(DUEL_CONFIG.storageKey, JSON.stringify(history.slice(0, 20)));
    } catch (_) {}
  }

  function getBestHistory() {
    const history = loadHistory();
    const best = history.reduce((max, item) => Math.max(max, Number(item.score || 0)), 0);
    const wins = history.filter(item => item.outcome === "win").length;
    return { history, best, wins };
  }

  function mountLaunchSection() {
    if (document.body.hasAttribute(DUEL_CONFIG.mountedAttr)) return;
    document.body.setAttribute(DUEL_CONFIG.mountedAttr, "true");

    const section = document.createElement("section");
    section.className = "pn-duel-launch-section";
    section.id = "pn-duel-launch";
    section.innerHTML = `
      <div class="pn-duel-launch-grid">
        <div>
          <span class="pn-duel-eyebrow">⚔ Pharmacy Duel</span>
          <h2 class="pn-duel-launch-title">Beat the Bot in a 10-question pharmacy duel.</h2>
          <p class="pn-duel-launch-copy">
            A fast solo battle mode for quick revision. Answer 10 questions, challenge Nexus Bot's default score,
            and turn boring practice into a small daily win.
          </p>
          <div class="pn-duel-launch-actions">
            <button type="button" class="pn-duel-btn pn-duel-btn-primary" data-pn-duel-start>
              Start Duel <span aria-hidden="true">→</span>
            </button>
            <button type="button" class="pn-duel-btn pn-duel-btn-soft" data-pn-duel-open-history>
              View streak
            </button>
          </div>
        </div>

        <div class="pn-duel-arena-card" aria-hidden="true">
          <div class="pn-duel-pulse-orb"></div>
          <div class="pn-duel-versus">
            <div class="pn-duel-player">
              <div class="pn-duel-avatar">YOU</div>
              <strong>Student</strong>
              <span>Live score</span>
            </div>
            <div class="pn-duel-vs-badge">VS</div>
            <div class="pn-duel-player">
              <div class="pn-duel-avatar">NB</div>
              <strong>Nexus Bot</strong>
              <span>Target 7/10</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const homePage = document.getElementById("page-home");
    const main = document.querySelector("main");

    if (homePage) {
      const container = homePage.querySelector(".max-w-7xl, .mx-auto") || homePage;
      container.appendChild(section);
    } else if (main) {
      main.prepend(section);
    } else {
      document.body.appendChild(section);
    }

    section.querySelector("[data-pn-duel-start]")?.addEventListener("click", startDuel);
    section.querySelector("[data-pn-duel-open-history]")?.addEventListener("click", openHistoryView);
  }

  function mountModal() {
    if (document.getElementById("pn-duel-modal")) return;

    const modal = document.createElement("div");
    modal.id = "pn-duel-modal";
    modal.className = "pn-duel-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="pn-duel-shell">
        <div class="pn-duel-topbar">
          <div class="pn-duel-title-mini">
            <div class="pn-duel-title-icon">⚔</div>
            <div>
              <h3>Pharmacy Duel</h3>
              <p>Beat ${escapeHtml(DUEL_CONFIG.botName)} • ${DUEL_CONFIG.questionCount} questions</p>
            </div>
          </div>
          <button type="button" class="pn-duel-close" data-pn-duel-close aria-label="Close duel">×</button>
        </div>

        <div class="pn-duel-body">
          <div id="pn-duel-game-view"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("[data-pn-duel-close]")?.addEventListener("click", closeDuel);
    modal.addEventListener("click", event => {
      if (event.target === modal) closeDuel();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && modal.classList.contains("is-open")) closeDuel();
    });
  }

  function openDuel() {
    mountModal();
    document.getElementById("pn-duel-modal")?.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeDuel() {
    document.getElementById("pn-duel-modal")?.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function startDuel() {
    duelState = {
      active: true,
      questions: getDuelQuestions(),
      index: 0,
      score: 0,
      locked: false,
      answers: [],
      startedAt: Date.now()
    };

    openDuel();
    renderQuestion();
  }

  function openHistoryView() {
    openDuel();
    renderStartScreen(true);
  }

  function renderStartScreen(showHistory = false) {
    const root = document.getElementById("pn-duel-game-view");
    if (!root) return;

    const { history, best, wins } = getBestHistory();
    const last = history[0];

    root.innerHTML = `
      <div class="pn-duel-result is-visible">
        <span class="pn-duel-result-badge">⚔ Duel Arena</span>
        <h2>Ready to beat Nexus Bot?</h2>
        <p>
          Nexus Bot starts with a fixed target of <strong>${DUEL_CONFIG.botScore}/${DUEL_CONFIG.questionCount}</strong>.
          Score higher to win the duel. Draw equals sudden respect, but not a win.
        </p>

        <div class="pn-duel-mini-history">
          <div class="pn-duel-history-chip">
            <span>Best score</span>
            <strong>${best}/${DUEL_CONFIG.questionCount}</strong>
          </div>
          <div class="pn-duel-history-chip">
            <span>Total wins</span>
            <strong>${wins}</strong>
          </div>
          <div class="pn-duel-history-chip">
            <span>Last duel</span>
            <strong>${last ? `${last.score}/${DUEL_CONFIG.questionCount}` : "—"}</strong>
          </div>
        </div>

        <div class="pn-duel-footer-actions">
          <button type="button" class="pn-duel-btn pn-duel-btn-primary" data-pn-duel-start-modal>
            Start Duel →
          </button>
          <button type="button" class="pn-duel-btn pn-duel-btn-soft" data-pn-duel-close-inside>
            Close
          </button>
        </div>
      </div>
    `;

    root.querySelector("[data-pn-duel-start-modal]")?.addEventListener("click", startDuel);
    root.querySelector("[data-pn-duel-close-inside]")?.addEventListener("click", closeDuel);
  }

  function renderQuestion() {
    const root = document.getElementById("pn-duel-game-view");
    if (!root) return;

    const q = duelState.questions[duelState.index];
    const questionNumber = duelState.index + 1;
    const progress = ((duelState.index) / DUEL_CONFIG.questionCount) * 100;

    root.innerHTML = `
      <div class="pn-duel-scoreboard">
        <div class="pn-duel-score-card">
          <div class="pn-duel-score-label">Your score</div>
          <div class="pn-duel-score-value" id="pn-duel-player-score">${duelState.score}/${DUEL_CONFIG.questionCount}</div>
        </div>
        <div class="pn-duel-live-vs">VS</div>
        <div class="pn-duel-score-card">
          <div class="pn-duel-score-label">${escapeHtml(DUEL_CONFIG.botName)}</div>
          <div class="pn-duel-score-value">${DUEL_CONFIG.botScore}/${DUEL_CONFIG.questionCount}</div>
        </div>
      </div>

      <div class="pn-duel-progress-track" aria-label="Duel progress">
        <div class="pn-duel-progress-fill" style="width:${progress}%"></div>
      </div>

      <div class="pn-duel-question-card">
        <div class="pn-duel-q-meta">
          <span>Question ${questionNumber} of ${DUEL_CONFIG.questionCount}</span>
          <span>Beat target: ${DUEL_CONFIG.botScore + 1}/${DUEL_CONFIG.questionCount}</span>
        </div>
        <div class="pn-duel-question-text">${escapeHtml(q.questionText)}</div>
      </div>

      <div class="pn-duel-options">
        ${q.options.map((option, index) => `
          <button type="button" class="pn-duel-option" data-pn-duel-option="${index}">
            ${escapeHtml(option)}
          </button>
        `).join("")}
      </div>

      <div class="pn-duel-feedback" id="pn-duel-feedback"></div>

      <div class="pn-duel-footer-actions">
        <button type="button" class="pn-duel-btn pn-duel-btn-light" data-pn-duel-restart>
          Restart
        </button>
        <button type="button" class="pn-duel-btn pn-duel-btn-dark" data-pn-duel-next disabled>
          ${questionNumber === DUEL_CONFIG.questionCount ? "Show Result" : "Next Question"} →
        </button>
      </div>
    `;

    root.querySelectorAll("[data-pn-duel-option]").forEach(button => {
      button.addEventListener("click", () => chooseAnswer(Number(button.getAttribute("data-pn-duel-option"))));
    });

    root.querySelector("[data-pn-duel-next]")?.addEventListener("click", nextQuestion);
    root.querySelector("[data-pn-duel-restart]")?.addEventListener("click", startDuel);
  }

  function chooseAnswer(choice) {
    if (duelState.locked) return;

    const q = duelState.questions[duelState.index];
    const isCorrect = choice === q.correctAnswer;
    duelState.locked = true;
    if (isCorrect) duelState.score += 1;

    duelState.answers.push({
      questionId: q.id,
      correct: isCorrect,
      choice,
      correctAnswer: q.correctAnswer
    });

    document.querySelectorAll("[data-pn-duel-option]").forEach(button => {
      const idx = Number(button.getAttribute("data-pn-duel-option"));
      button.disabled = true;
      if (idx === q.correctAnswer) button.classList.add("is-correct");
      if (idx === choice && !isCorrect) button.classList.add("is-wrong");
    });

    const score = document.getElementById("pn-duel-player-score");
    if (score) score.textContent = `${duelState.score}/${DUEL_CONFIG.questionCount}`;

    const feedback = document.getElementById("pn-duel-feedback");
    if (feedback) {
      feedback.classList.add("is-visible");
      feedback.innerHTML = `
        <strong>${isCorrect ? "Correct hit. Nice one." : "Not this time."}</strong>
        <p>${escapeHtml(q.explanation || `Correct answer: ${q.options[q.correctAnswer]}`)}</p>
      `;
    }

    const next = document.querySelector("[data-pn-duel-next]");
    if (next) next.disabled = false;
  }

  function nextQuestion() {
    if (!duelState.locked) return;

    if (duelState.index >= DUEL_CONFIG.questionCount - 1) {
      renderResult();
      return;
    }

    duelState.index += 1;
    duelState.locked = false;
    renderQuestion();
  }

  function renderResult() {
    const root = document.getElementById("pn-duel-game-view");
    if (!root) return;

    const score = duelState.score;
    const botScore = DUEL_CONFIG.botScore;
    const outcome = score > botScore ? "win" : score === botScore ? "draw" : "lose";
    const durationSec = Math.round((Date.now() - duelState.startedAt) / 1000);

    saveHistory({
      score,
      botScore,
      outcome,
      createdAt: new Date().toISOString(),
      durationSec
    });

    const title =
      outcome === "win"
        ? "You beat Nexus Bot."
        : outcome === "draw"
          ? "Draw with Nexus Bot."
          : "Nexus Bot wins this round.";

    const copy =
      outcome === "win"
        ? "Clean victory. This is exactly the kind of quick challenge that keeps revision alive."
        : outcome === "draw"
          ? "You matched the bot. One more correct answer next time and you take the win."
          : "Good attempt. Review the missed points and run it again — the bot is beatable.";

    root.innerHTML = `
      <div class="pn-duel-result is-visible">
        <span class="pn-duel-result-badge">${outcome === "win" ? "🏆 Victory" : outcome === "draw" ? "🤝 Draw" : "⚔ Try again"}</span>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(copy)}</p>

        <div class="pn-duel-mini-history">
          <div class="pn-duel-history-chip">
            <span>Your score</span>
            <strong>${score}/${DUEL_CONFIG.questionCount}</strong>
          </div>
          <div class="pn-duel-history-chip">
            <span>Nexus Bot</span>
            <strong>${botScore}/${DUEL_CONFIG.questionCount}</strong>
          </div>
          <div class="pn-duel-history-chip">
            <span>Time</span>
            <strong>${durationSec}s</strong>
          </div>
        </div>

        <div class="pn-duel-footer-actions">
          <button type="button" class="pn-duel-btn pn-duel-btn-primary" data-pn-duel-play-again>
            Play again →
          </button>
          <button type="button" class="pn-duel-btn pn-duel-btn-soft" data-pn-duel-close-inside>
            Back to site
          </button>
        </div>
      </div>
    `;

    if (outcome === "win") launchConfetti();

    root.querySelector("[data-pn-duel-play-again]")?.addEventListener("click", startDuel);
    root.querySelector("[data-pn-duel-close-inside]")?.addEventListener("click", closeDuel);
  }

  function launchConfetti() {
    const colors = ["#ffe088", "#38b9c9", "#22c55e", "#ffffff", "#cba72f"];
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement("div");
      piece.className = "pn-duel-confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * .35}s`;
      piece.style.transform = `rotate(${Math.random() * 220}deg)`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 2400);
    }
  }

  function exposeApi() {
    window.PharmacyDuel = {
      start: startDuel,
      openHistory: openHistoryView,
      close: closeDuel,
      getQuestions: getDuelQuestions,
      getHistory: loadHistory
    };
  }

  function init() {
    injectStyles();
    mountModal();
    mountLaunchSection();
    exposeApi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
