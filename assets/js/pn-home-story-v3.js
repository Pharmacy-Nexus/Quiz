(function () {
  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function revealOnScroll() {
    const items = qsa('.pn-story-reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' });
    items.forEach(el => io.observe(el));
  }

  function updateProgressDots() {
    const sections = qsa('[data-story-section]');
    const dots = qsa('.pn-story-progress a');
    if (!sections.length || !dots.length) return;
    let active = 0;
    const mid = window.innerHeight * 0.46;
    sections.forEach((section, idx) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= mid && rect.bottom >= mid) active = idx;
    });
    dots.forEach((dot, idx) => dot.classList.toggle('is-active', idx === active));
  }

  function addSubtleParallax() {
    const home = qs('#page-home.pn-story-home');
    if (!home || window.matchMedia('(pointer: coarse)').matches) return;
    home.addEventListener('mousemove', event => {
      const x = (event.clientX / window.innerWidth - 0.5) * 10;
      const y = (event.clientY / window.innerHeight - 0.5) * 10;
      qsa('.pn-story-stage img').forEach((img, index) => {
        img.style.transform = `scale(1.012) translate3d(${x * (index % 2 ? -0.18 : 0.18)}px, ${y * 0.16}px, 0)`;
      });
    }, { passive: true });
  }

  function init() {
    revealOnScroll();
    updateProgressDots();
    addSubtleParallax();
    window.addEventListener('scroll', updateProgressDots, { passive: true });
    window.addEventListener('resize', updateProgressDots, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
