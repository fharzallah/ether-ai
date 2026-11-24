// État partagé entre l'interface (chargée tout de suite) et la scène 3D (chargée
// après le premier affichage). Un objet simple et un mini-émetteur suffisent.

export const state = {
  reducedMotion: false,
  light: false,
  // 0 ou 1 par objection de la démo : survol ou focus côté interface.
  objectionHover: [0, 0, 0],
  // Étape de la réflexion approfondie active à l'écran (-1 : aucune).
  activeStep: -1,
};

const listeners = new Map();

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => listeners.get(type).delete(fn);
}

export function emit(type, detail) {
  const set = listeners.get(type);
  if (set) for (const fn of set) fn(detail);
}
