/* ==========================================================
   Pharmacy Nexus — 3D Overdrive Layer
   This file is visual-only: no quiz answers, storage schema,
   fetch paths, or app logic are changed.
   ========================================================== */
(function () {
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function createWorld() {
    if (document.getElementById('pn-3d-world')) return;
    const world = document.createElement('div');
    world.id = 'pn-3d-world';
    world.setAttribute('aria-hidden', 'true');
    const orbs = [
      ['12rem','8%','12%','rgba(203,167,47,.38)','14px','.36','-60px','11s'],
      ['18rem','76%','9%','rgba(155,206,223,.36)','18px','.30','-90px','13s'],
      ['10rem','82%','66%','rgba(49,101,116,.30)','10px','.26','-40px','9s'],
      ['14rem','9%','74%','rgba(255,224,136,.25)','16px','.24','-80px','12s']
    ];
    orbs.forEach(o => {
      const el = document.createElement('i');
      el.className = 'pn-orb';
      el.style.setProperty('--s', o[0]);
      el.style.setProperty('--x', o[1]);
      el.style.setProperty('--y', o[2]);
      el.style.setProperty('--c', o[3]);
      el.style.setProperty('--b', o[4]);
      el.style.setProperty('--o', o[5]);
      el.style.setProperty('--z', o[6]);
      el.style.setProperty('--d', o[7]);
      world.appendChild(el);
    });
    const caps = [
      ['8%','36%','-22deg','-120px','8s'],
      ['88%','38%','18deg','-80px','10s'],
      ['58%','80%','38deg','-110px','9s']
    ];
    caps.forEach(c => {
      const el = document.createElement('i');
      el.className = 'pn-capsule-float';
      el.style.left = c[0];
      el.style.top = c[1];
      el.style.setProperty('--r', c[2]);
      el.style.setProperty('--z', c[3]);
      el.style.setProperty('--d', c[4]);
      world.appendChild(el);
    });
    document.body.prepend(world);
  }

  function createScrollRail() {
    if (document.getElementById('pn-scroll-rail')) return;
    const rail = document.createElement('div');
    rail.id = 'pn-scroll-rail';
    document.body.appendChild(rail);
    const update = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      rail.style.transform = `scaleX(${Math.min(1, Math.max(0, window.scrollY / max))})`;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  }

  function injectHeroStage() {
    const heroGrid = document.querySelector('#page-home section:first-of-type .grid');
    if (!heroGrid || heroGrid.querySelector('.pn-hero-stage')) return;
    const stage = document.createElement('div');
    stage.className = 'pn-hero-stage lg:col-span-5 hidden lg:block';
    stage.innerHTML = `
      <div class="pn-nexus-stage" aria-hidden="true">
        <div class="pn-stage-glass"></div>
        <div class="pn-stage-screen">
          <div class="pn-screen-topbar">
            <span></span><span></span><span></span>
          </div>
          <div class="pn-screen-content">
            <div class="pn-study-chip">AI Study Map</div>
            <div class="pn-screen-title">Pharmacy Nexus</div>
            <div class="pn-screen-line wide"></div>
            <div class="pn-screen-line mid"></div>
            <div class="pn-screen-line short"></div>
            <div class="pn-mini-bars"><i></i><i></i><i></i><i></i></div>
          </div>
        </div>
        <div class="pn-floating-card pn-card-main">
          <span class="material-symbols-outlined">psychology</span>
          <div><b>Clinical Reasoning</b><small>Smart practice path</small></div>
        </div>
        <div class="pn-floating-card pn-card-score">
          <strong>92%</strong><small>Readiness</small>
        </div>
        <div class="pn-floating-card pn-card-mini">
          <span class="material-symbols-outlined">science</span><small>Drug Monographs</small>
        </div>
        <div class="pn-stage-orbit pn-orbit-one"><i></i><i></i><i></i></div>
        <div class="pn-stage-orbit pn-orbit-two"><i></i><i></i><i></i></div>
        <div class="pn-gold-capsule"></div>
      </div>`;
    heroGrid.appendChild(stage);
  }

  function tagCards() {
    const selector = [
      'section.bg-surface-container-lowest',
      'section.bg-surface-container-low',
      '.ambient-shadow.ghost-border',
      '.rounded-\\[2rem\\].bg-surface-container-lowest',
      '.rounded-xl.bg-surface-container-lowest',
      '.rounded-xl.bg-surface-container-low'
    ].join(',');
    document.querySelectorAll(selector).forEach((el, index) => {
      if (el.closest('#sidebar')) return;
      if (el.id === 'page-home') return;
      el.classList.add('pn-3d-card', 'pn-rise');
      el.style.setProperty('--delay', `${Math.min(index * 55, 520)}ms`);
    });
  }

  function revealOnView() {
    const items = document.querySelectorAll('.pn-rise');
    if (!('IntersectionObserver' in window) || prefersReduced) {
      items.forEach(el => el.classList.add('pn-in'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('pn-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(el => io.observe(el));
  }

  function enableTilt() {
    if (!finePointer || prefersReduced) return;
    const maxTilt = 7;
    const cards = () => document.querySelectorAll('.pn-3d-card');
    document.addEventListener('mousemove', e => {
      document.body.style.setProperty('--pn-glow-x', `${(e.clientX / window.innerWidth) * 100}%`);
      document.body.style.setProperty('--pn-glow-y', `${(e.clientY / window.innerHeight) * 100}%`);
    }, { passive: true });
    cards().forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / Math.max(1, r.width);
        const py = (e.clientY - r.top) / Math.max(1, r.height);
        card.style.setProperty('--pn-tilt-x', `${(0.5 - py) * maxTilt}deg`);
        card.style.setProperty('--pn-tilt-y', `${(px - 0.5) * maxTilt}deg`);
        card.style.setProperty('--mx', `${px * 100}%`);
        card.style.setProperty('--my', `${py * 100}%`);
      }, { passive: true });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--pn-tilt-x', '0deg');
        card.style.setProperty('--pn-tilt-y', '0deg');
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '20%');
      });
    });
  }

  function patchNavigationAnimation() {
    const original = window.navigateTo;
    if (typeof original !== 'function' || original.__pn3dPatched) return;
    function enhancedNavigate(pageId) {
      document.body.classList.add('pn-route-shift');
      const result = original.apply(this, arguments);
      requestAnimationFrame(() => {
        tagCards();
        revealOnView();
        setTimeout(() => document.body.classList.remove('pn-route-shift'), 260);
      });
      return result;
    }
    enhancedNavigate.__pn3dPatched = true;
    window.navigateTo = enhancedNavigate;
  }

  function init() {
    document.body.classList.add('pn-3d-ready');
    createWorld();
    createScrollRail();
    injectHeroStage();
    tagCards();
    revealOnView();
    enableTilt();
    patchNavigationAnimation();
  }

  ready(init);
})();
