// Graphlay — UI behaviour (no third-party code, no network requests)
const root = document.documentElement;

// Refuse to render inside someone else's frame (basic clickjacking protection;
// GitHub Pages cannot send X-Frame-Options / frame-ancestors headers).
if (window.top !== window.self) {
  root.classList.add('framed');
  try { window.top.location.replace(window.self.location.href); } catch (_) { /* cross-origin: page stays hidden */ }
}

root.classList.add('js');

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

// Footer year
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

// Nav background on scroll
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Mobile menu
const menuBtn = document.querySelector('.menu-btn');
const menu = document.getElementById('mobile-menu');
const setMenu = (open) => {
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.querySelector('.menu-label').textContent = open ? 'Close' : 'Menu';
  menu.hidden = !open;
  root.classList.toggle('menu-open', open);
};
menuBtn.addEventListener('click', () => setMenu(menu.hidden));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

// Stagger delays (set via CSSOM so the CSP needs no 'unsafe-inline')
document.querySelectorAll('[data-stagger]').forEach((group) => {
  [...group.children].forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 90}ms`; });
});

// Reveal on scroll
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('in'));
}

// Count-up stats
const counters = document.querySelectorAll('[data-count]');
if (!reduce && 'IntersectionObserver' in window) {
  const run = (el) => {
    const end = parseInt(el.dataset.count, 10) || 0;
    const t0 = performance.now();
    const dur = 1400;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    el.textContent = '0';
    requestAnimationFrame(tick);
  };
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { run(en.target); cio.unobserve(en.target); } });
  }, { threshold: 0.6 });
  counters.forEach((el) => cio.observe(el));
}

// 3D tilt on cards (desktop pointers only)
if (canHover && !reduce) {
  document.querySelectorAll('.tilt').forEach((el) => {
    let raf = 0;
    const max = el.classList.contains('mono') ? 10 : 7;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transition = 'transform .12s linear, box-shadow .5s';
        el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateY(-4px)`;
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      el.style.transition = '';
      el.style.transform = '';
    });
  });
}

// Work cards: hover flips on desktop, keyboard focus flips via CSS, tap toggles on touch
document.querySelectorAll('.wcard').forEach((card) => {
  card.addEventListener('click', () => { if (!canHover) card.classList.toggle('is-flipped'); });
  card.addEventListener('blur', () => card.classList.remove('is-flipped'));
});
