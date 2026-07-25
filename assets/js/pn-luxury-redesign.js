/* Pharmacy Nexus luxury presentation layer.
   Safe by design: it never edits app state, data files, admin tools, questions,
   answers, scoring, storage, or the navigateTo implementation. */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia?.('(pointer:fine)').matches;

  const pageIntros = {
    subjects: {
      kicker: 'Learning Library',
      title: 'Choose a path. Build real pharmacy mastery.',
      text: 'Move from subject to topic to focused question sets through a cleaner, calmer learning experience.',
      icon: 'menu_book',
      primary: ['Browse subjects', 'subjects'],
      secondary: ['Open final exam', 'finalexam']
    },
    dashboard: {
      kicker: 'Performance Intelligence',
      title: 'Turn every attempt into your next smart move.',
      text: 'Accuracy, activity, weak areas, and saved insights come together in one focused performance cockpit.',
      icon: 'monitoring',
      primary: ['Continue studying', 'subjects'],
      secondary: ['Build an exam', 'finalexam']
    },
    finalexam: {
      kicker: 'Exam Studio',
      title: 'Design the pressure. Control the challenge.',
      text: 'Build a focused or mixed exam, choose the difficulty and timing, then review every decision with clarity.',
      icon: 'school',
      primary: ['Configure exam', 'finalexam'],
      secondary: ['Review subjects', 'subjects']
    },
    saved: {
      kicker: 'Knowledge Bank',
      title: 'Your personal bank of clinical pearls.',
      text: 'Keep difficult questions, explanations, and personal notes in one premium review space built for fast recall.',
      icon: 'bookmark_added',
      primary: ['Explore subjects', 'subjects'],
      secondary: ['View dashboard', 'dashboard']
    },
    profile: {
      kicker: 'Student Identity',
      title: 'A study profile that grows with your progress.',
      text: 'Set your goals, shape your learning preferences, and keep the platform centered around your pharmacy journey.',
      icon: 'person',
      primary: ['View dashboard', 'dashboard'],
      secondary: ['Start studying', 'subjects']
    },
    about: {
      kicker: 'The Mission',
      title: 'Built for the long road from lecture to license.',
      text: 'Pharmacy Nexus brings structured learning, exam practice, saved knowledge, and progress insight into one student-first platform.',
      icon: 'health_and_safety',
      primary: ['Explore the platform', 'subjects'],
      secondary: ['Try final exam', 'finalexam']
    }
  };

  const safeNavigate = (page) => {
    if (typeof window.navigateTo === 'function') window.navigateTo(page);
  };

  function addGlobalLayers() {
    if (!document.querySelector('.pnx-noise')) {
      const noise = document.createElement('div');
      noise.className = 'pnx-noise';
      noise.setAttribute('aria-hidden', 'true');
      document.body.appendChild(noise);
    }

    if (!document.querySelector('.pnx-scroll-line')) {
      const line = document.createElement('div');
      line.className = 'pnx-scroll-line';
      Object.assign(line.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '0%',
        height: '3px',
        zIndex: '10000',
        pointerEvents: 'none',
        background: 'linear-gradient(90deg,#cba72f,#ffe39a,#9bd9ea)',
        boxShadow: '0 0 18px rgba(203,167,47,.45)',
        transition: reduceMotion ? 'none' : 'width .12s linear'
      });
      document.body.appendChild(line);
      const update = () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        line.style.width = `${max > 0 ? Math.min(100, (scrollY / max) * 100) : 0}%`;
      };
      addEventListener('scroll', update, { passive: true });
      update();
    }
  }

  function enhanceBrand() {
    const brand = document.querySelector('#sidebar > .mb-6');
    if (!brand || brand.querySelector('.pnx-brand-mark')) return;
    const mark = document.createElement('span');
    mark.className = 'pnx-brand-mark';
    mark.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('span');
    copy.className = 'pnx-brand-copy';
    copy.innerHTML = '<strong style="display:block;font-size:.92rem;color:#00151b;line-height:1.1">Pharmacy Nexus</strong><small style="display:block;margin-top:5px;font-size:.58rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#987b16">Clinical Mastery</small>';

    brand.prepend(copy);
    brand.prepend(mark);
  }

  function addCommandDock() {
    if (document.querySelector('.pnx-command-dock')) return;
    const dock = document.createElement('div');
    dock.className = 'pnx-command-dock';
    dock.setAttribute('aria-label', 'Quick navigation');
    dock.innerHTML = `
      <button type="button" data-page="subjects" title="Study subjects"><span class="material-symbols-outlined">menu_book</span><span>Study</span></button>
      <button type="button" data-page="saved" title="Saved questions"><span class="material-symbols-outlined">bookmark</span></button>
      <button type="button" data-page="finalexam" data-accent="gold" title="Build final exam"><span class="material-symbols-outlined">school</span><span>Exam</span></button>
    `;
    dock.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-page]');
      if (button) safeNavigate(button.dataset.page);
    });
    document.body.appendChild(dock);
  }

  function buildIntro(pageId, config) {
    const page = document.getElementById(`page-${pageId}`);
    if (!page || page.querySelector(':scope > .pnx-page-intro')) return;

    const intro = document.createElement('section');
    intro.className = 'pnx-page-intro';
    intro.dataset.page = pageId;
    intro.innerHTML = `
      <div class="pnx-page-intro-copy">
        <div class="pnx-page-kicker"><span class="material-symbols-outlined" style="font-size:17px">${config.icon}</span>${config.kicker}</div>
        <h1>${config.title}</h1>
        <p>${config.text}</p>
        <div class="pnx-page-intro-actions">
          <button type="button" data-page="${config.primary[1]}">${config.primary[0]} <span class="material-symbols-outlined" style="font-size:18px">arrow_forward</span></button>
          <button type="button" data-page="${config.secondary[1]}">${config.secondary[0]}</button>
        </div>
      </div>
      <div class="pnx-page-intro-visual" aria-hidden="true">
        <img src="./assets/images/hero-learning.svg" alt="">
      </div>
    `;
    intro.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-page]');
      if (button) safeNavigate(button.dataset.page);
    });
    page.prepend(intro);
  }

  function enhanceHome() {
    const hero = document.querySelector('.pn-v6-hero');
    if (!hero || hero.dataset.pnxEnhanced === 'true') return;
    hero.dataset.pnxEnhanced = 'true';
    hero.classList.add('pnx-spotlight');
    hero.addEventListener('mousemove', spotlightMove);

    const stage = hero.querySelector('.pn-v6-product-stage');
    if (stage) {
      stage.dataset.pnxTilt = 'hero';
      stage.style.transformStyle = 'preserve-3d';
    }
  }

  function spotlightMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }

  function candidates() {
    return [
      ...document.querySelectorAll('#subjects-grid > article, #subjects-grid > div'),
      ...document.querySelectorAll('#topics-list > article, #topics-list > div'),
      ...document.querySelectorAll('#sets-grid > article, #sets-grid > div'),
      ...document.querySelectorAll('[data-saved-item="true"]'),
      ...document.querySelectorAll('#page-dashboard article, #page-dashboard section'),
      ...document.querySelectorAll('#page-about .about-card-hover')
    ];
  }

  function markCards() {
    candidates().forEach((card, index) => {
      if (card.dataset.pnxCard === 'true') return;
      card.dataset.pnxCard = 'true';
      card.classList.add('pnx-reveal-item', 'pnx-spotlight');
      card.style.transitionDelay = `${Math.min(index % 8, 7) * 45}ms`;
      card.addEventListener('mousemove', spotlightMove);
      if (finePointer && !reduceMotion && index % 3 === 0) card.dataset.pnxTilt = 'card';
    });
    observeReveal();
  }

  let revealObserver;
  function observeReveal() {
    const pending = [...document.querySelectorAll('.pnx-reveal-item:not(.pnx-visible)')];
    if (!pending.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      pending.forEach(el => el.classList.add('pnx-visible'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('pnx-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: .08, rootMargin: '0px 0px -4% 0px' });
    }
    pending.forEach(el => revealObserver.observe(el));
  }

  function setupTilt() {
    if (!finePointer || reduceMotion || document.body.dataset.pnxTiltReady === 'true') return;
    document.body.dataset.pnxTiltReady = 'true';

    document.addEventListener('mousemove', (event) => {
      const target = event.target.closest('[data-pnx-tilt]');
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - .5;
      const py = (event.clientY - rect.top) / rect.height - .5;
      const strength = target.dataset.pnxTilt === 'hero' ? 5 : 2.5;
      target.style.transform = `perspective(1100px) rotateX(${(-py * strength).toFixed(2)}deg) rotateY(${(px * strength).toFixed(2)}deg) translateY(-2px)`;
    });

    document.addEventListener('mouseout', (event) => {
      const target = event.target.closest?.('[data-pnx-tilt]');
      if (!target || target.contains(event.relatedTarget)) return;
      target.style.transform = '';
    });
  }

  function activePageChanged() {
    const active = document.querySelector('.page.active');
    if (!active) return;
    active.querySelectorAll('.pnx-reveal-item').forEach((el, i) => {
      el.classList.remove('pnx-visible');
      el.style.transitionDelay = `${Math.min(i, 7) * 40}ms`;
    });
    requestAnimationFrame(observeReveal);
    markCards();
  }

  function watchDynamicUi() {
    const observer = new MutationObserver((mutations) => {
      let needsRefresh = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) needsRefresh = true;
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const node = mutation.target;
          if (node.classList?.contains('page')) activePageChanged();
        }
      }
      if (needsRefresh) requestAnimationFrame(markCards);
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function init() {
    document.body.classList.add('pnx-luxury-ui');
    addGlobalLayers();
    enhanceBrand();
    addCommandDock();
    Object.entries(pageIntros).forEach(([id, config]) => buildIntro(id, config));
    enhanceHome();
    markCards();
    setupTilt();
    watchDynamicUi();
    activePageChanged();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();