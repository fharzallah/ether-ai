// Comportements de l'interface disponibles dès le premier affichage, sans la 3D :
// navigation, démo comparée, étapes de la réflexion approfondie.
import { state, emit, on } from './lib/state.js';

export function initNav() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const toggle = nav.querySelector('.menu-toggle');
  const menu = document.getElementById('nav-menu');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target)) setOpen(false);
  });
  window.matchMedia('(min-width: 960px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });

  // Un seul aplat rouge par écran : le bouton de la barre attend que les autres
  // boutons principaux (accueil, appel final) soient sortis de l'écran.
  const visible = new Set();
  nav.classList.add('cta-hidden');
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    nav.classList.toggle('cta-hidden', visible.size > 0);
  });
  document.querySelectorAll('[data-primary-cta]').forEach((el) => io.observe(el));
}

export function initDemo() {
  const card = document.querySelector('[data-demo]');
  if (!card) return;
  const buttons = card.querySelectorAll('[data-answer]');
  const panels = card.querySelectorAll('[data-panel]');
  const objections = [...card.querySelectorAll('[data-objection]')];

  const select = (which) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.answer === which)));
    panels.forEach((p) => {
      p.hidden = p.dataset.panel !== which;
    });
    if (which !== 'ether') objections.forEach((_, i) => setHover(i, 0));
  };

  // Objection survolée ou focalisée : la scène rallume la fissure correspondante.
  const setHover = (i, value) => {
    if (state.objectionHover[i] === value) return;
    state.objectionHover[i] = value;
    emit('objection', { index: i, value });
  };
  objections.forEach((li, i) => {
    li.addEventListener('pointerenter', () => setHover(i, 1));
    li.addEventListener('pointerleave', () => {
      if (document.activeElement !== li) setHover(i, 0);
    });
    li.addEventListener('focus', () => setHover(i, 1));
    li.addEventListener('blur', () => setHover(i, 0));
  });

  // Fissure survolée dans la scène : l'objection correspondante s'éclaire.
  on('crack', (index) => {
    objections.forEach((li, i) => li.classList.toggle('is-linked', i === index));
  });

  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.answer)));
  select('ether');
}

/**
 * Étapes : l'étape active suit l'anneau traversé par la caméra. Les repères sont
 * les blocs invisibles de la colonne de droite sur ordinateur, les étapes
 * elles-mêmes sur téléphone. Cliquer sur une étape amène son repère au centre.
 */
export function initSteps({ scrollTo }) {
  const section = document.querySelector('.how');
  if (!section) return;
  const buttons = [...section.querySelectorAll('[data-step]')];
  const items = [...section.querySelectorAll('[data-step-item]')];
  const markers = [...section.querySelectorAll('[data-marker]')];
  const wide = window.matchMedia('(min-width: 1024px)');
  const targets = () => (wide.matches ? markers : items);

  let active = -2;
  const update = () => {
    const mid = window.innerHeight / 2;
    const box = section.getBoundingClientRect();
    let next = -1;
    if (box.top < mid && box.bottom > mid) {
      targets().forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.top + r.height / 2 <= mid + 2) next = i;
      });
    }
    if (next === active) return;
    active = next;
    buttons.forEach((b, i) => {
      if (i === active) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    state.activeStep = active;
    emit('step', active);
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  buttons.forEach((b, i) =>
    b.addEventListener('click', () => {
      const r = targets()[i].getBoundingClientRect();
      scrollTo(window.scrollY + r.top + r.height / 2 - window.innerHeight / 2 + 4);
    }),
  );
}
