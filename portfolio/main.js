(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = document.querySelector('.nav');
  const hero = document.querySelector('.hero');

  // The top bar turns solid once the hero photo is no longer behind it.
  new IntersectionObserver(([entry]) => nav.classList.toggle('solid', !entry.isIntersecting), { rootMargin: '-72px 0px 0px 0px' }).observe(hero);

  // Everything below is enhancement. Without it the page is complete and the photo strip swipes sideways.
  if (reduce || !window.gsap || !window.ScrollTrigger || !window.Lenis) return;

  // Smooth scroll (Lenis), driven by GSAP's ticker so ScrollTrigger stays in sync.
  const lenis = new Lenis({ lerp: 0.1 });
  gsap.registerPlugin(ScrollTrigger);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll('a[href^="#"]:not(.skip)').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, { offset: target.id === 'top' ? 0 : -64 });
      history.replaceState(null, '', link.getAttribute('href'));
    });
  });

  // The one authored moment (GSAP): the matchday photos travel sideways while the page holds still.
  gsap.matchMedia().add('(min-width: 701px)', () => {
    const field = document.querySelector('.field');
    const track = field.querySelector('.track');
    const distance = () => Math.max(0, track.scrollWidth - field.clientWidth);
    gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: { trigger: field, start: 'center center', end: () => '+=' + distance(), pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true }
    });
  });

  // The ledger fills in line by line the first time it comes into view (Motion).
  if (window.Motion) {
    const { animate, inView, stagger } = Motion;
    const rows = document.querySelectorAll('.ledger tbody tr');
    rows.forEach(row => { row.style.opacity = '0'; });
    inView('.ledger', () => {
      animate(rows, { opacity: [0, 1] }, { duration: 0.5, delay: stagger(0.08), ease: 'easeOut' });
      animate('.ledger td span', { transform: ['translateX(14px)', 'translateX(0px)'] }, { duration: 0.7, delay: stagger(0.08), ease: [0.16, 1, 0.3, 1] });
    }, { amount: 0.3 });
  }
})();
