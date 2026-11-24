// Point d'entrée. Ce fichier reste léger : la page est complète sans lui, et la
// scène 3D comme le défilement fluide arrivent par import dynamique ensuite.
import './styles/main.css';
import { state } from './lib/state.js';
import { initNav, initDemo, initSteps } from './ui.js';

state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const scroller = {
  to(y) {
    window.scrollTo({ top: y, behavior: state.reducedMotion ? 'auto' : 'smooth' });
  },
};

initNav();
initDemo();
initSteps({ scrollTo: (y) => scroller.to(y) });
