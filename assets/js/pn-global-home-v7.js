(function(){
  'use strict';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mirrorStats(){
    const pairs = [
      ['home-accuracy','pn-v6-accuracy-mirror'],
      ['home-saved-count','pn-v6-saved-mirror'],
      ['home-notes-count','pn-v6-notes-mirror'],
      ['home-final-exams-count','pn-v6-exams-mirror']
    ];
    pairs.forEach(([sourceId,targetId])=>{
      const source=document.getElementById(sourceId);
      const target=document.getElementById(targetId);
      if(source && target) target.textContent=source.textContent;
    });
  }

  function setupReveal(){
    const els=[...document.querySelectorAll('.pn-reveal')];
    if(!els.length) return;
    if(reduceMotion || !('IntersectionObserver' in window)){
      els.forEach(el=>el.classList.add('is-visible'));
      return;
    }
    const io=new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },{threshold:.13,rootMargin:'0px 0px -8% 0px'});
    els.forEach(el=>io.observe(el));
  }

  function setupTilt(){
    if(reduceMotion || !window.matchMedia('(pointer:fine)').matches) return;
    document.querySelectorAll('[data-tilt-card]').forEach(card=>{
      card.addEventListener('mousemove',event=>{
        const rect=card.getBoundingClientRect();
        const x=(event.clientX-rect.left)/rect.width-.5;
        const y=(event.clientY-rect.top)/rect.height-.5;
        const base = card.classList.contains('pn-v6-dashboard-3d') ? 'rotateY(-13deg) rotateX(6deg) rotateZ(1deg)' : '';
        card.style.transform = `${base} translateY(-4px) rotateX(${(-y*5).toFixed(2)}deg) rotateY(${(x*6).toFixed(2)}deg)`;
      });
      card.addEventListener('mouseleave',()=>{card.style.transform='';});
    });
  }

  function enhanceKeyboardCards(){
    document.querySelectorAll('[role="button"][tabindex="0"]').forEach(el=>{
      el.addEventListener('keydown',e=>{
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          el.click();
        }
      });
    });
  }

  function patchRenderPersistentStats(){
    const original = window.renderPersistentStats;
    if(typeof original === 'function' && !original.__pnV6Patched){
      const patched=function(){
        const result=original.apply(this,arguments);
        mirrorStats();
        return result;
      };
      patched.__pnV6Patched=true;
      window.renderPersistentStats=patched;
    }
  }

  function init(){
    setupReveal();
    setupTilt();
    enhanceKeyboardCards();
    patchRenderPersistentStats();
    mirrorStats();
    setTimeout(mirrorStats,250);
    setTimeout(mirrorStats,1000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
