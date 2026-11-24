// Point d'entrée. Ce fichier reste léger : la page est complète sans lui, et la
// scène 3D comme le défilement fluide arrivent par import dynamique ensuite.
import './styles/main.css';
import { state } from './lib/state.js';
import { initNav, initDemo, initSteps } from './ui.js';

const html = document.documentElement;
state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Mode léger : petit écran ou appareil modeste.
state.light =
  window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

const scroller = {
  to(y) {
    window.scrollTo({ top: y, behavior: state.reducedMotion ? 'auto' : 'smooth' });
  },
};

initNav();
initDemo();
initSteps({ scrollTo: (y) => scroller.to(y) });

// Captures (développement uniquement) : ?p=0.4 fige la scène, ?poster masque l'interface.
const params = new URLSearchParams(window.location.search);
const devProgress = import.meta.env.DEV && params.has('p') ? Number(params.get('p')) : null;
const posterMode = import.meta.env.DEV && params.has('poster');
if (posterMode) html.classList.add('poster-mode');

function showPoster() {
  html.classList.add('scene-fallback');
}

function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function bootScene() {
  import('./scene/index.js')
    .then(({ createScene }) =>
      createScene({
        light: state.light,
        forcedProgress: devProgress ?? (posterMode ? 0.4 : null),
        onFallback: showPoster,
      }),
    )
    .then((scene) => {
      if (import.meta.env.DEV) window.__ether = scene;
    })
    .catch((error) => {
      if (import.meta.env.DEV) console.error(error);
      document.querySelector('.scene-canvas')?.remove();
      showPoster();
    });
}

// Sans animation demandée ou sans WebGL 2 : l'image fixe remplace la scène.
if (state.reducedMotion && !posterMode) showPoster();
else if (!hasWebGL2()) showPoster();
else {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
  const later = () => idle(bootScene, { timeout: 1500 });
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later, { once: true });
}
