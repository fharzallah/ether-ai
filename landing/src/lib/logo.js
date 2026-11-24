// Géométrie du logo ETHER, reprise à l'identique du prototype de l'identité visuelle
// (design/prototype-reference.html : fonctions pts(), dots() et tableau LAYERS).
// icons/icon.svg contient encore l'ancien logo (cercle et « E ») : il ne sert pas ici.
//
// Repère du prototype : viewBox -100 -100 200 200, premier sommet en haut,
// sens horaire à l'écran. Durées de rotation : celles de l'appli (40 s pour la
// plus grande couche, 12 s pour la plus petite, sens alternés).

export const LOGO_LAYERS = [
  { r: 84, offset: 0, period: 40, dir: 1, dots: true },
  { r: 73, offset: -12, period: 30, dir: -1, dots: true },
  { r: 61, offset: 18, period: 22, dir: 1, dots: false },
  { r: 49, offset: -8, period: 16, dir: -1, dots: false },
  { r: 37, offset: 26, period: 12, dir: 1, dots: false },
];

export const LOGO_TRIANGLES = [
  { r: 22, rot: 0, offset: 0, period: 9, dir: -1 },
  { r: 18, rot: 40, offset: 22, period: 13, dir: 1 },
];

/** Sommets d'un polygone régulier, en coordonnées SVG (y vers le bas). */
export function polygonPoints(r, n, rotDeg = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const g = ((rotDeg + (360 / n) * i) * Math.PI) / 180;
    pts.push([r * Math.sin(g), -r * Math.cos(g)]);
  }
  return pts;
}

const fmt = (pts) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/**
 * Le logo en SVG. Chaque couche est dans un groupe fixe (son décalage d'origine)
 * qui contient un groupe animé : la rotation part du décalage sans à-coup.
 */
export function logoSvg({ animated = false, className = 'logo' } = {}) {
  const layers = LOGO_LAYERS.map((l, i) => {
    const pts = polygonPoints(l.r, 5);
    const dots = l.dots
      ? pts.map(([x, y]) => `<circle class="lg-d" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.4"/>`).join('')
      : '';
    return `<g transform="rotate(${l.offset})"><g class="lg-s lg-l${i + 1}"><polygon class="lg-p" points="${fmt(pts)}"/>${dots}</g></g>`;
  }).join('');
  const tris = LOGO_TRIANGLES.map(
    (t, i) => `<g transform="rotate(${t.offset})"><g class="lg-s lg-t${i + 1}"><polygon class="lg-t" points="${fmt(polygonPoints(t.r, 3, t.rot))}"/></g></g>`,
  ).join('');
  const cls = animated ? `${className} is-spinning` : className;
  return `<svg class="${cls}" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">${layers}${tris}</svg>`;
}

/** Version autonome (favicon) : couleurs écrites en dur, sans feuille de style. */
export function logoSvgStandalone() {
  const p = 'fill="#ef4136" fill-opacity=".26" stroke="#ef4136" stroke-opacity=".9" stroke-width="13" stroke-linejoin="round"';
  const d = 'fill="#a82a22" fill-opacity=".75"';
  const t = 'fill="#9c3b34" fill-opacity=".72" stroke="#9c3b34" stroke-opacity=".72" stroke-width="3" stroke-linejoin="round"';
  const layers = LOGO_LAYERS.map((l) => {
    const pts = polygonPoints(l.r, 5);
    const dots = l.dots ? pts.map(([x, y]) => `<circle ${d} cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.4"/>`).join('') : '';
    return `<g transform="rotate(${l.offset})"><polygon ${p} points="${fmt(pts)}"/>${dots}</g>`;
  }).join('');
  const tris = LOGO_TRIANGLES.map(
    (tr) => `<g transform="rotate(${tr.offset})"><polygon ${t} points="${fmt(polygonPoints(tr.r, 3, tr.rot))}"/></g>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">${layers}${tris}</svg>\n`;
}
