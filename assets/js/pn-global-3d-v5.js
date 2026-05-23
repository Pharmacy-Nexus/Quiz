
(function(){
  'use strict';

  const HERO_HTML = `
    <section class="pn-global-hero" aria-label="Pharmacy Nexus premium learning hero">
      <div class="pn-hero-shell">
        <div class="pn-hero-copy">
          <div class="pn-kicker">Clinical Mastery Suite</div>
          <h1 class="pn-hero-title">Your Ultimate <span>Pharmacy Learning Platform</span></h1>
          <p class="pn-hero-text">A premium study cockpit for future pharmacists: structured subjects, focused sets, instant feedback, saved notes, performance analytics, and final-exam readiness in one clean workflow.</p>
          <div class="pn-hero-actions">
            <button type="button" class="pn-btn-primary" onclick="navigateTo('subjects')">Explore Subjects <span class="material-symbols-outlined">arrow_forward</span></button>
            <button type="button" class="pn-btn-secondary" onclick="navigateTo('finalexam')">Go to Final Exam <span class="material-symbols-outlined">school</span></button>
          </div>
          <div class="pn-micro-row">
            <span class="pn-micro-chip"><b id="hero-subject-count">4</b> Subjects</span>
            <span class="pn-micro-chip"><b id="hero-question-count">1627</b> Questions</span>
            <span class="pn-micro-chip"><b>20</b> Q / Set</span>
          </div>
        </div>

        <div class="pn-hero-visual" aria-hidden="true">
          <div class="pn-stage-orbit"></div>
          <div class="pn-dashboard-3d" data-tilt-scene>
            <div class="pn-dashboard-screen">
              <div class="pn-dash-top">
                <div class="pn-dash-brand"><div class="pn-dash-logo"><span class="material-symbols-outlined">science</span></div> Pharmacy Nexus</div>
                <div class="pn-dash-pills"><span></span><span></span><span></span></div>
              </div>
              <div class="pn-dash-grid">
                <div class="pn-dash-card pn-dash-main">
                  <div>
                    <div class="pn-dash-label">Exam Readiness</div>
                    <div class="pn-dash-big">86%</div>
                    <div class="pn-dash-sub">+14% this week</div>
                  </div>
                  <div class="pn-bars"><span></span><span></span><span></span><span></span><span></span></div>
                </div>
                <div class="pn-dash-card">
                  <div class="pn-dash-label">Accuracy</div>
                  <div class="pn-progress-ring"></div>
                </div>
                <div class="pn-dash-card">
                  <div class="pn-dash-label">Weakness Map</div>
                  <div class="pn-mini-list"><i></i><i></i><i></i></div>
                </div>
              </div>
            </div>
          </div>
          <div class="pn-floating-card pn-float-a"><span class="material-symbols-outlined">psychology</span><strong>Clinical Reasoning</strong><span>Case-based review</span></div>
          <div class="pn-floating-card pn-float-b"><span class="material-symbols-outlined">query_stats</span><strong>Performance Analytics</strong><span>Track every session</span></div>
          <div class="pn-floating-card pn-float-c"><span class="material-symbols-outlined">bookmark_added</span><strong>Saved Knowledge</strong><span>Notes + flagged Qs</span></div>
          <div class="pn-hero-pill-3d"></div>
        </div>
      </div>
    </section>`;

  function replaceHero(){
    const page = document.getElementById('page-home');
    if(!page || page.dataset.pnV5Ready === '1') return;
    const container = page.querySelector('.max-w-7xl');
    if(!container) return;
    const firstSection = Array.from(container.children).find(el => el.tagName === 'SECTION');
    if(!firstSection) return;
    firstSection.outerHTML = HERO_HTML;
    page.dataset.pnV5Ready = '1';
  }

  function addReveals(){
    const els = document.querySelectorAll('#page-home .grid.grid-cols-2.md\\:grid-cols-4 > div, #page-home #home-subjects-grid > div, #page-home .lg\\:col-span-4 > div, #page-home .lg\\:col-span-8 > section');
    els.forEach((el, i) => {
      el.classList.add('pn-reveal');
      el.style.transitionDelay = Math.min(i * 55, 440) + 'ms';
    });
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){ entry.target.classList.add('is-visible'); io.unobserve(entry.target); }
      });
    }, { threshold:.12 });
    els.forEach(el => io.observe(el));
  }

  function addScrollBar(){
    if(document.querySelector('.pn-scrollbar')) return;
    const bar = document.createElement('div');
    bar.className = 'pn-scrollbar';
    document.body.appendChild(bar);
    const update = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      bar.style.width = Math.min(100, (window.scrollY / max) * 100) + '%';
    };
    window.addEventListener('scroll', update, { passive:true });
    update();
  }

  function addTilt(){
    if(!window.matchMedia || !window.matchMedia('(pointer:fine)').matches) return;
    const hero = document.querySelector('.pn-global-hero');
    const panel = document.querySelector('[data-tilt-scene]');
    if(!hero || !panel) return;
    hero.addEventListener('mousemove', e => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      panel.style.setProperty('--mx', x.toFixed(3));
      panel.style.setProperty('--my', y.toFixed(3));
      panel.style.filter = `drop-shadow(${x * 22}px ${18 + y * 12}px 35px rgba(0,0,0,.28))`;
    });
    hero.addEventListener('mouseleave', () => { panel.style.filter = ''; });
  }

  function boot(){
    document.body.classList.add('pn-world-class-v5');
    replaceHero();
    addReveals();
    addScrollBar();
    addTilt();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
