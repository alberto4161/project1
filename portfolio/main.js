(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.documentElement.classList.add('reduce');

  // Resume link: enable once resume.pdf exists.
  fetch('resume.pdf', { method: 'HEAD' }).then(r => {
    if (!r.ok) return;
    const a = document.querySelector('[data-resume]');
    a.removeAttribute('aria-disabled');
    document.querySelector('[data-resume-note]').remove();
  }).catch(() => {});

  if (reduce) return;
  const { animate, inView, stagger } = Motion;

  // Smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync.
  const lenis = new Lenis({ lerp: 0.1 });
  gsap.registerPlugin(ScrollTrigger);
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach(a =>
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -10 }); }
    }));

  // Reveals (Motion): content rises from slight blur as it enters.
  inView('[data-reveal]', el => {
    animate(el, { opacity: [0, 1], transform: ['translateY(28px)', 'none'], filter: ['blur(6px)', 'blur(0px)'] },
      { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
  }, { margin: '0px 0px -12% 0px' });

  // The one authored moment (GSAP): the photo strip travels sideways as you scroll.
  const mm = gsap.matchMedia();
  mm.add('(min-width: 701px)', () => {
    const track = document.querySelector('.track');
    const dist = () => track.scrollWidth - innerWidth + 48;
    gsap.to(track, { x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.field', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true } });
  });

  // Hero parallax.
  gsap.to('.hero-img', { yPercent: 8, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
})();
