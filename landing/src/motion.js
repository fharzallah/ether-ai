// Mouvement : Lenis (seul moteur de défilement fluide) branché sur ScrollTrigger,
// position de scroll lissée pour la scène (scrub: 1), inclinaison des titres
// selon la vitesse. Jamais chargé quand l'utilisateur demande moins d'animations.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

export function startMotion() {
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ autoRaf: false, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // La scène lit cette valeur : la position de scroll, lissée par ScrollTrigger.
  const proxy = { y: window.scrollY };
  gsap.fromTo(
    proxy,
    { y: 0 },
    {
      y: () => ScrollTrigger.maxScroll(window),
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 1, invalidateOnRefresh: true },
    },
  );

  // Titres visibles : les lettres s'inclinent selon la vitesse (6° au plus),
  // puis reviennent à 0 en 400 ms quand le scroll s'arrête.
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target);
      else {
        visible.delete(e.target);
        e.target.style.removeProperty('--skew');
      }
    }
  });
  document.querySelectorAll('[data-split]').forEach((h) => io.observe(h));
  const skew = { v: 0 };
  const toSkew = gsap.quickTo(skew, 'v', { duration: 0.4, ease: 'power3.out' });
  let lastScroll = 0;
  let settling = false;
  let written = '';
  lenis.on('scroll', ({ velocity }) => {
    toSkew(gsap.utils.clamp(-6, 6, velocity * 0.12));
    lastScroll = performance.now();
    settling = false;
  });
  gsap.ticker.add(() => {
    if (!settling && performance.now() - lastScroll > 80) {
      settling = true;
      toSkew(0);
    }
    const value = Math.abs(skew.v) < 0.02 ? '0deg' : `${skew.v.toFixed(2)}deg`;
    if (value === written) return;
    written = value;
    for (const h of visible) h.style.setProperty('--skew', value);
  });

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  return {
    scrollValue: () => proxy.y,
    scrollTo: (y) => lenis.scrollTo(y, { duration: 1.2 }),
  };
}
