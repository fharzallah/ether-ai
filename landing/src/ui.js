// Comportements de l'interface disponibles dès le premier affichage, sans la 3D :
// navigation, démo comparée, étapes de la réflexion approfondie.
import { state, emit, on } from './lib/state.js';

/**
 * Titres lettre par lettre. Le titre garde son vrai texte (aria-label), les
 * lettres découpées sont masquées aux lecteurs d'écran. Sans JavaScript, ou
 * avec moins d'animations, rien n'est découpé : le texte s'affiche normalement.
 * L'animation elle-même est en CSS (styles/main.css) : elle part sans attendre GSAP.
 */
export async function initKinetic() {
  const heads = [...document.querySelectorAll('[data-split]')];
  for (const h of heads) {
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    let i = 0;
    const lines = h.querySelectorAll('.line');
    for (const el of lines.length ? lines : [h]) {
      const words = el.textContent.trim().split(/ +/);
      el.textContent = '';
      words.forEach((word, wi) => {
        const w = document.createElement('span');
        w.className = 'w';
        w.setAttribute('aria-hidden', 'true');
        for (const ch of word) {
          const c = document.createElement('span');
          c.className = 'ch';
          c.textContent = ch;
          c.style.setProperty('--i', String(i++));
          w.append(c);
        }
        el.append(w);
        if (wi < words.length - 1) el.append(' ');
      });
    }
    h.classList.add('is-split');
  }
  // Largeur de chaque lettre fixée en em, mesurée à la graisse finale une fois
  // Fraunces chargée : l'animation de graisse ne déplace pas le reste de la ligne.
  try {
    await Promise.race([document.fonts ? document.fonts.load('340 64px Fraunces') : null, new Promise((r) => setTimeout(r, 1800))]);
  } catch {
    // Police indisponible : les largeurs seront celles de la police de secours.
  }
  for (const h of heads) {
    const size = parseFloat(getComputedStyle(h).fontSize) || 16;
    const chars = [...h.querySelectorAll('.ch')];
    const widths = chars.map((c) => c.getBoundingClientRect().width);
    chars.forEach((c, k) => c.style.setProperty('width', `${(widths[k] / size).toFixed(4)}em`));
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  heads.forEach((h) => io.observe(h));
}

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
