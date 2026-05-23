/* Pharmacy Nexus — Premium 3D Rebuild v3
   Visual-only enhancement. It keeps all existing onclick handlers and app.js logic intact. */
(function(){
  'use strict';

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, {once:true});
    else fn();
  }

  function buildHero(){
    const hero = document.querySelector('#page-home section:first-of-type');
    if(!hero || hero.dataset.pnPremiumBuilt === '1') return;
    hero.dataset.pnPremiumBuilt = '1';
    hero.classList.add('pn-premium-hero');

    const right = hero.querySelector('.lg\\:col-span-5, .lg\:col-span-5');
    if(!right) return;
    right.className = 'pn-hero-stage';
    right.innerHTML = `
      <div class="pn-dashboard-3d" aria-label="Pharmacy Nexus premium learning dashboard preview">
        <div class="pn-main-glass">
          <div class="pn-window-top">
            <div class="pn-dots"><i></i><i></i><i></i></div>
            <span>Nexus Study OS</span>
          </div>
          <div class="pn-dashboard-body">
            <div class="pn-big-card">
              <div class="pn-card-label">Today\'s mastery path</div>
              <div class="pn-card-title">Clinical reasoning sprint</div>
              <div class="pn-line"><span style="width:72%"></span></div>
              <div class="pn-stats-row">
                <div class="pn-stat-tile"><b>82%</b><span>readiness</span></div>
                <div class="pn-stat-tile"><b>18</b><span>saved pearls</span></div>
                <div class="pn-stat-tile"><b>5</b><span>weak areas</span></div>
              </div>
            </div>
            <div class="pn-mini-card">
              <div class="pn-card-label">accuracy trend</div>
              <div class="pn-chart"><i style="height:32%"></i><i style="height:54%"></i><i style="height:42%"></i><i style="height:74%"></i><i style="height:62%"></i></div>
            </div>
            <div class="pn-mini-card">
              <div class="pn-card-label">next review</div>
              <div class="pn-card-title" style="font-size:1.05rem">Antibiotics<br/>high-yield set</div>
              <div class="pn-line"><span style="width:48%"></span></div>
            </div>
          </div>
        </div>

        <div class="pn-floating-panel pn-panel-subjects">
          <div class="pn-panel-icon"><span class="material-symbols-outlined">auto_stories</span></div>
          <div id="hero-subject-count" class="pn-panel-value">3</div>
          <div class="pn-panel-caption">Subjects</div>
        </div>

        <div class="pn-floating-panel pn-panel-questions">
          <div class="pn-panel-icon"><span class="material-symbols-outlined">quiz</span></div>
          <div id="hero-question-count" class="pn-panel-value">105</div>
          <div class="pn-panel-caption">Questions</div>
        </div>

        <div class="pn-floating-panel pn-panel-resume">
          <div class="pn-resume-row">
            <div>
              <div class="pn-resume-title">Resume Antibiotics</div>
              <div class="pn-resume-meta">Set 1 • Q8 of 20</div>
            </div>
            <button onclick="navigateTo('study')" class="pn-resume-btn font-bold text-sm flex items-center gap-1">
              Resume <span class="material-symbols-outlined text-sm">play_arrow</span>
            </button>
          </div>
        </div>
        <div class="pn-orbit"></div>
      </div>`;
  }

  function addReveals(){
    const candidates = document.querySelectorAll('#page-home section, #page-home > div > .grid, #page-subjects section, #page-dashboard section, #page-finalexam section, #page-saved section');
    candidates.forEach((el, i) => {
      if(i === 0 || el.classList.contains('pn-reveal')) return;
      el.classList.add('pn-reveal');
      el.style.transitionDelay = Math.min(i * 45, 220) + 'ms';
    });
    if(!('IntersectionObserver' in window)){
      document.querySelectorAll('.pn-reveal').forEach(el => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, {threshold:.12, rootMargin:'0px 0px -60px 0px'});
    document.querySelectorAll('.pn-reveal').forEach(el => io.observe(el));
  }

  function addScrollProgress(){
    if(document.querySelector('.pn-scroll-progress')) return;
    const bar = document.createElement('div');
    bar.className = 'pn-scroll-progress';
    document.body.appendChild(bar);
    const update = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      bar.style.width = Math.min(100, Math.max(0, (window.scrollY / max) * 100)) + '%';
    };
    window.addEventListener('scroll', update, {passive:true});
    window.addEventListener('resize', update);
    update();
  }

  function addSubtleTilt(){
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce || !window.matchMedia || !window.matchMedia('(pointer:fine)').matches) return;
    const stage = document.querySelector('.pn-hero-stage');
    const card = document.querySelector('.pn-dashboard-3d');
    if(!stage || !card) return;
    stage.addEventListener('mousemove', e => {
      const r = stage.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - .5) * 8;
      const y = ((e.clientY - r.top) / r.height - .5) * -6;
      card.style.transform = `translateY(-8px) rotateX(${y}deg) rotateY(${x}deg)`;
    });
    stage.addEventListener('mouseleave', () => { card.style.transform = ''; });
  }

  ready(() => {
    buildHero();
    addReveals();
    addScrollProgress();
    addSubtleTilt();
  });
})();
