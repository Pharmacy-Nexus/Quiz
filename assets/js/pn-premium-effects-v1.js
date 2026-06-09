(function () {
  'use strict';

  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function finishLoader() {
    const loader = qs('#pn-premium-loader');
    if (!loader) return;
    if (prefersReduced) {
      loader.remove();
      return;
    }
    const done = () => {
      loader.classList.add('is-done');
      setTimeout(() => loader.remove(), 900);
    };
    window.addEventListener('load', () => setTimeout(done, 450), { once: true });
    setTimeout(done, 1900);
  }

  function enhanceHeroText() {
    const title = qs('#pn-v6-title');
    if (!title || title.dataset.premiumSplit === 'true') return;
    const raw = title.textContent.trim();
    const hotWords = new Set(['question', 'bank.', 'pharmacy', 'cockpit.', 'exam']);
    title.innerHTML = raw.split(/\s+/).map((word) => {
      const clean = word.toLowerCase();
      const rendered = hotWords.has(clean) ? `<em>${word}</em>` : word;
      return `<span class="pn-word"><i>${rendered}</i></span>`;
    }).join(' ');
    title.dataset.premiumSplit = 'true';
  }

  function addHeroParticles() {
    const heroBg = qs('.pn-v6-hero-bg');
    if (!heroBg || heroBg.dataset.particles === 'true' || prefersReduced) return;
    heroBg.dataset.particles = 'true';
    const positions = [
      [12, 22, 14, -18], [24, 72, -20, -12], [46, 17, 22, 18], [68, 66, -18, 24],
      [83, 28, 16, -24], [91, 76, -22, 16], [36, 48, 18, -18], [58, 86, 20, -20]
    ];
    positions.forEach(([left, top, dx, dy], index) => {
      const dot = document.createElement('span');
      dot.className = 'pn-premium-particle';
      dot.style.left = `${left}%`;
      dot.style.top = `${top}%`;
      dot.style.setProperty('--dx', `${dx}px`);
      dot.style.setProperty('--dy', `${dy}px`);
      dot.style.animationDelay = `${index * -0.45}s`;
      heroBg.appendChild(dot);
    });
  }

  function initGsapMotion() {
    if (prefersReduced || !window.gsap) {
      qsa('.pn-reveal').forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    gsap.set('.pn-v6-hero-copy', { opacity: 1 });
    gsap.from('.pn-v6-eyebrow', { y: 20, opacity: 0, duration: 0.75, ease: 'power3.out', delay: 0.15 });
    gsap.from('.pn-v6-hero h1 .pn-word > i', {
      yPercent: 105,
      opacity: 0,
      duration: 0.95,
      ease: 'power4.out',
      stagger: 0.035,
      delay: 0.22
    });
    gsap.from('.pn-v6-lead, .pn-v6-actions, .pn-v6-proof-row', {
      y: 24,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.13,
      delay: 0.55
    });
    gsap.from('.pn-v6-product-stage', {
      x: 40,
      y: 20,
      rotateY: -8,
      opacity: 0,
      duration: 1,
      ease: 'power4.out',
      delay: 0.35
    });

    if (window.ScrollTrigger) {
      qsa('.pn-reveal').forEach((section) => {
        gsap.fromTo(section,
          { y: 52, opacity: 0, filter: 'blur(8px)' },
          {
            y: 0,
            opacity: 1,
            filter: 'blur(0px)',
            duration: 0.85,
            ease: 'power3.out',
            scrollTrigger: { trigger: section, start: 'top 84%', once: true }
          }
        );
      });

      qsa('.pn-v6-feature-grid, .pn-v6-steps, .pn-v6-stat-strip, .pn-v6-subject-grid').forEach((grid) => {
        const children = Array.from(grid.children).filter(Boolean);
        if (!children.length) return;
        gsap.from(children, {
          y: 36,
          opacity: 0,
          duration: 0.72,
          ease: 'power3.out',
          stagger: 0.08,
          scrollTrigger: { trigger: grid, start: 'top 86%', once: true }
        });
      });
    }

    gsap.to('.pn-v6-orb-a', { x: 28, y: -18, duration: 5.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('.pn-v6-orb-b', { x: -22, y: 22, duration: 6.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    gsap.to('[data-float-card]', { y: -12, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.45 });
  }

  function initTiltCards() {
    if (prefersReduced) return;
    const cards = qsa('[data-tilt-card], .pn-v6-feature-card, .pn-v6-stat-strip article, .pn-v6-command-card, .pn-v6-activity-card, .pn-subjects-clean-card, .pn-subjects-clean-stat, .pn-topic-card, .pn-r-story-grid article, .pn-r-feature-grid article, .pn-r-metrics article');
    cards.forEach((card) => {
      if (card.dataset.tiltReady === 'true') return;
      card.dataset.tiltReady = 'true';
      let raf = null;
      const reset = () => {
        cancelAnimationFrame(raf);
        card.style.transform = '';
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
      };
      const move = (event) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const rotateY = (px - 0.5) * 7;
        const rotateX = (0.5 - py) * 7;
        card.style.setProperty('--mx', `${px * 100}%`);
        card.style.setProperty('--my', `${py * 100}%`);
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-3px)`;
        });
      };
      card.addEventListener('mousemove', move);
      card.addEventListener('mouseleave', reset);
    });
  }

  function initMagneticButtons() {
    if (prefersReduced || !window.matchMedia('(pointer:fine)').matches) return;
    const buttons = qsa('.pn-v6-btn, .pn-subjects-clean-btn, .pn-topic-open-btn, #sidebar button, .pn-r-console-main button');
    buttons.forEach((btn) => {
      if (btn.dataset.magneticReady === 'true') return;
      btn.dataset.magneticReady = 'true';
      btn.addEventListener('mousemove', (event) => {
        const rect = btn.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * 0.16;
        const y = (event.clientY - rect.top - rect.height / 2) * 0.16;
        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
      btn.addEventListener('click', (event) => {
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        const size = Math.max(rect.width, rect.height) * 1.4;
        ripple.className = 'pn-premium-ripple';
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${event.clientX - rect.left}px`;
        ripple.style.top = `${event.clientY - rect.top}px`;
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 700);
      });
    });
  }

  function initCounters() {
    if (prefersReduced || !window.gsap || !window.ScrollTrigger) return;
    const nodes = qsa('#pn-v6-accuracy-mirror, #pn-r-accuracy-mirror, #pn-v6-saved-mirror, #pn-v6-notes-mirror, #pn-v6-exams-mirror, .pn-subjects-clean-stat strong');
    nodes.forEach((node) => {
      if (node.dataset.counterReady === 'true') return;
      const text = node.textContent.trim();
      const match = text.match(/^(\d+)(.*)$/);
      if (!match) return;
      node.dataset.counterReady = 'true';
      const target = Number(match[1]);
      const suffix = match[2] || '';
      const state = { value: 0 };
      window.gsap.to(state, {
        value: target,
        duration: 1.1,
        ease: 'power2.out',
        scrollTrigger: { trigger: node, start: 'top 90%', once: true },
        onUpdate: () => { node.textContent = `${Math.round(state.value)}${suffix}`; }
      });
    });
  }

  function initHeroParallax() {
    if (prefersReduced || !window.matchMedia('(pointer:fine)').matches) return;
    const hero = qs('.pn-v6-hero');
    const copy = qs('.pn-v6-hero-copy');
    const stage = qs('.pn-v6-product-stage');
    if (!hero || !copy || !stage) return;
    hero.addEventListener('mousemove', (event) => {
      const rect = hero.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5);
      const y = ((event.clientY - rect.top) / rect.height - 0.5);
      copy.style.transform = `translate3d(${(-x * 8).toFixed(1)}px, ${(-y * 5).toFixed(1)}px, 0)`;
      stage.style.transform = `translate3d(${(x * 15).toFixed(1)}px, ${(y * 12).toFixed(1)}px, 0)`;
    });
    hero.addEventListener('mouseleave', () => {
      copy.style.transform = '';
      stage.style.transform = '';
    });
  }



  function syncHomeMirrors() {
    const pairs = [
      ['home-accuracy', 'pn-v6-accuracy-mirror'],
      ['home-accuracy', 'pn-r-accuracy-mirror'],
      ['home-saved-count', 'pn-v6-saved-mirror'],
      ['home-notes-count', 'pn-v6-notes-mirror'],
      ['home-final-exams-count', 'pn-v6-exams-mirror']
    ];
    pairs.forEach(([from, to]) => {
      const source = qs(`#${from}`);
      const target = qs(`#${to}`);
      if (source && target) target.textContent = source.textContent;
    });
  }

  function observeDynamicContent() {
    const run = () => {
      initTiltCards();
      initMagneticButtons();
      initCounters();
    };
    const observer = new MutationObserver(() => {
      clearTimeout(observeDynamicContent._timer);
      observeDynamicContent._timer = setTimeout(run, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  ready(() => {
    finishLoader();
    enhanceHeroText();
    addHeroParticles();
    initGsapMotion();
    initTiltCards();
    initMagneticButtons();
    initCounters();
    initHeroParallax();
    syncHomeMirrors();
    setInterval(syncHomeMirrors, 900);
    observeDynamicContent();
  });
})();
