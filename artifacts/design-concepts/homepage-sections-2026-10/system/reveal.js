// Shared reveal (live preset G-02): blocks start at 0.55 opacity and 12px low, and settle in
// 0.3s expo-out, fired 220px before they enter, once. Skipped for reduced motion and for
// automated screenshots (navigator.webdriver), so every render shows the final state.
(() => {
  if (navigator.webdriver || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const blocks = document.querySelectorAll('section > .de-canvas > *, section > .de-canvas > * > .de-grid > *, section > .de-canvas > .de-grid > *');
  const io = new IntersectionObserver((entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px 220px 0px', threshold: 0.08 });
  blocks.forEach(b => { if (b.getBoundingClientRect().top > innerHeight + 220) { b.classList.add('de-reveal'); io.observe(b); } });
})();
