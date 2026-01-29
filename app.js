// Smooth scrolling + active section highlighting + back-to-top + reveal animations
(function () {
  // Smooth in-page scrolling
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;

      let target;
      try {
        target = document.querySelector(id);
      } catch (err) {
        return;
      }
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Update hash without jump
      history.pushState(null, '', id);
    });
  });

  // Back to top
  const btn = document.getElementById('backToTop');
  if (btn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 420) btn.classList.add('show');
      else btn.classList.remove('show');
    });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Active link highlight for section-nav (index page)
  const sectionNav = document.querySelector('.section-nav');
  if (sectionNav) {
    const links = Array.from(sectionNav.querySelectorAll('a[href^="#"]'));
    const map = new Map(links.map((l) => [l.getAttribute('href'), l]));

    const sections = links
      .map((l) => document.querySelector(l.getAttribute('href')))
      .filter(Boolean);

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        links.forEach((l) => l.classList.remove('active'));
        const href = '#' + visible.target.id;
        const active = map.get(href);
        if (active) active.classList.add('active');
      },
      { root: null, threshold: [0.18, 0.28, 0.38, 0.5] }
    );

    sections.forEach((s) => obs.observe(s));
  }

  // Reveal on scroll
  const reveals = document.querySelectorAll('[data-reveal]');
  if (reveals.length) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      reveals.forEach((el) => el.classList.add('is-visible'));
    } else {
      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.2 }
      );

      reveals.forEach((el) => {
        const delay = el.getAttribute('data-delay');
        if (delay) el.style.setProperty('--delay', delay);
        revealObserver.observe(el);
      });
    }
  }
})();
