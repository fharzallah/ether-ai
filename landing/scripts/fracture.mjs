// Découpe hors ligne du prisme pentagonal (Voronoï 3D) et export en GLB compressé.
//
//   node scripts/fracture.mjs        → public/shards-desktop.glb (96) et shards-mobile.glb (36)
//
// Chaque cellule de Voronoï est l'intersection du prisme (convexe) et des
// demi-espaces des plans bissecteurs : on part du prisme et on le coupe plan par
// plan. Les faces qui viennent du prisme sont les faces externes ; celles qui
// viennent d'un plan bissecteur sont les cassures. Trois chaînes de cassures qui
// partent du point d'impact du rayon deviennent les trois fissures de la démo.
//
// Format : glTF 2.0, un nœud par éclat (translation = centre d'origine), deux
// primitives (externe, cassures), compression EXT_meshopt_compression et normales
// quantifiées (KHR_mesh_quantization). Décodé côté navigateur par GLTFLoader.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MeshoptEncoder } from 'meshoptimizer';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const OUT = fileURLToPath(new URL('../public/', import.meta.url));

export const R = 1; // rayon du pentagone, premier sommet en haut comme dans le logo
export const T = 0.5; // épaisseur
const H = T / 2;
// Bande de la face avant couverte par la texture de texte (le reste est noir).
const BAND = { y0: -0.125, h: 0.25 };
// Le rayon arrive par la gauche : point d'impact sur la face avant, et trois
// fissures en éventail vers la droite (angles en degrés).
const IMPACT = [-0.6, 0.03];
const CRACK_DIRS = [34, -2, -36];

const VARIANTS = [
  { file: 'shards-desktop.glb', count: 96, seed: 7 },
  { file: 'shards-mobile.glb', count: 36, seed: 23 },
];

// ---------------------------------------------------------------- outils

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / len(a));
const dist = (a, b) => len(sub(a, b));

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sommets du pentagone (x à droite, y en haut), sens horaire vu de face.
const PENT = Array.from({ length: 5 }, (_, i) => {
  const g = (i * 2 * Math.PI) / 5;
  return [R * Math.sin(g), R * Math.cos(g)];
});
const SIDES = PENT.map((a, i) => {
  const b = PENT[(i + 1) % 5];
  const n = norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0]);
  return { n, d: dot(n, [a[0], a[1], 0]) };
});

function insidePentagon(x, y, margin = 0) {
  return SIDES.every(({ n, d }) => n[0] * x + n[1] * y <= d - margin);
}

// ---------------------------------------------------------------- polyèdres

function newellNormal(verts) {
  const n = [0, 0, 0];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

function prism() {
  const faces = [
    { verts: PENT.map(([x, y]) => [x, y, H]), n: [0, 0, 1], d: H, kind: 'front' },
    { verts: PENT.map(([x, y]) => [x, y, -H]), n: [0, 0, -1], d: H, kind: 'back' },
  ];
  PENT.forEach((a, i) => {
    const b = PENT[(i + 1) % 5];
    faces.push({ verts: [[a[0], a[1], H], [b[0], b[1], H], [b[0], b[1], -H], [a[0], a[1], -H]], ...SIDES[i], kind: 'side' });
  });
  return faces;
}

function dedupe(points, eps = 1e-9) {
  const out = [];
  for (const p of points) if (!out.some((q) => dist(p, q) < eps)) out.push(p);
  return out;
}

function clipPolygon(verts, n, d) {
  const out = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const da = dot(n, a) - d;
    const db = dot(n, b) - d;
    if (da <= 1e-12) out.push(a);
    if ((da < -1e-12 && db > 1e-12) || (da > 1e-12 && db < -1e-12)) out.push(add(a, mul(sub(b, a), da / (da - db))));
  }
  return dedupe(out);
}

function orderOnPlane(points, n) {
  const c = mul(points.reduce(add, [0, 0, 0]), 1 / points.length);
  const u = norm(Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0]));
  const v = cross(n, u);
  return points
    .map((p) => ({ p, a: Math.atan2(dot(sub(p, c), v), dot(sub(p, c), u)) }))
    .sort((x, y) => x.a - y.a)
    .map((e) => e.p);
}

function area(verts) {
  return len(newellNormal(verts)) / 2;
}

function cell(i, seeds) {
  let faces = prism();
  const si = seeds[i];
  const others = seeds
    .map((s, j) => ({ j, d: dist(si, s) }))
    .filter((o) => o.j !== i)
    .sort((a, b) => a.d - b.d);
  for (const { j, d: dij } of others) {
    let reach = 0;
    for (const f of faces) for (const v of f.verts) reach = Math.max(reach, dist(v, si));
    if (dij / 2 > reach + 1e-9) break;
    const n = norm(sub(seeds[j], si));
    const d = dot(n, mul(add(si, seeds[j]), 0.5));
    if (!faces.some((f) => f.verts.some((v) => dot(n, v) - d > 1e-9))) continue;
    const next = [];
    const cap = [];
    for (const f of faces) {
      const verts = clipPolygon(f.verts, n, d);
      if (verts.length >= 3 && area(verts) > 1e-10) next.push({ ...f, verts });
      for (const v of verts) if (Math.abs(dot(n, v) - d) < 1e-7) cap.push(v);
    }
    const capVerts = orderOnPlane(dedupe(cap), n);
    if (capVerts.length >= 3 && area(capVerts) > 1e-10) next.push({ verts: capVerts, n, d, kind: 'inner', nb: j });
    faces = next;
  }
  // Ordre des sommets : sens trigonométrique vu de l'extérieur.
  for (const f of faces) if (dot(newellNormal(f.verts), f.n) < 0) f.verts.reverse();
  return faces;
}

function centroid(faces) {
  const all = faces.flatMap((f) => f.verts);
  const ref = mul(all.reduce(add, [0, 0, 0]), 1 / all.length);
  let vol = 0;
  let c = [0, 0, 0];
  for (const f of faces) {
    for (let k = 1; k < f.verts.length - 1; k++) {
      const a = sub(f.verts[0], ref);
      const b = sub(f.verts[k], ref);
      const e = sub(f.verts[k + 1], ref);
      const v = dot(a, cross(b, e)) / 6;
      vol += v;
      c = add(c, mul(add(add(f.verts[0], f.verts[k]), add(f.verts[k + 1], ref)), v / 4));
    }
  }
  return { center: mul(c, 1 / vol), volume: vol };
}

// ---------------------------------------------------------------- germes

function sampleSeeds(count, rand) {
  const seeds = [];
  while (seeds.length < count) {
    let best = null;
    let bestD = -1;
    for (let c = 0; c < 14; c++) {
      let p;
      do p = [rand() * 2 - 1, rand() * 2 - 1, (rand() * 2 - 1) * H * 0.92];
      while (!insidePentagon(p[0], p[1], 0.02));
      let dmin = Infinity;
      for (const s of seeds) dmin = Math.min(dmin, dist(p, s));
      if (dmin > bestD) {
        bestD = dmin;
        best = p;
      }
    }
    seeds.push(best);
  }
  return seeds;
}

// ---------------------------------------------------------------- fissures

const keyOf = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
const onBoundary = (p) => SIDES.some(({ n, d }) => Math.abs(n[0] * p[0] + n[1] * p[1] - d) < 1e-6);

function findCracks(cells) {
  // Arêtes des cassures sur la face avant : là où une fissure se voit.
  const segs = [];
  cells.forEach((faces, i) => {
    for (const f of faces) {
      if (f.kind !== 'inner' || f.nb < i) continue;
      const vs = f.verts;
      for (let k = 0; k < vs.length; k++) {
        const a = vs[k];
        const b = vs[(k + 1) % vs.length];
        if (Math.abs(a[2] - H) < 1e-7 && Math.abs(b[2] - H) < 1e-7) segs.push({ a, b, pair: [i, f.nb] });
      }
    }
  });
  const nodes = new Map();
  segs.forEach((s, si) => {
    for (const p of [s.a, s.b]) {
      const k = keyOf(p);
      if (!nodes.has(k)) nodes.set(k, { p, edges: [] });
      nodes.get(k).edges.push(si);
    }
  });

  // Nœuds intérieurs, du plus proche au plus éloigné d'un point donné.
  const interior = [...nodes.entries()].filter(([, n]) => !onBoundary(n.p));
  const nearest = (x, y) =>
    interior
      .map(([k, n]) => ({ k, d: Math.hypot(n.p[0] - x, n.p[1] - y) }))
      .sort((a, b) => a.d - b.d)
      .map((e) => e.k);

  const walk = (startKey, dir, used) => {
    let cur = startKey;
    let prev = dir;
    const path = [cur];
    const pairs = [];
    const taken = [];
    for (let step = 0; step < 12; step++) {
      let best = null;
      let bestScore = 0.2;
      for (const si of nodes.get(cur).edges) {
        if (used.has(si)) continue;
        const s = segs[si];
        const otherKey = keyOf(s.a) === cur ? keyOf(s.b) : keyOf(s.a);
        if (path.includes(otherKey)) continue;
        const from = nodes.get(cur).p;
        const to = nodes.get(otherKey).p;
        const l = Math.hypot(to[0] - from[0], to[1] - from[1]);
        const v = [(to[0] - from[0]) / l, (to[1] - from[1]) / l];
        const score = 0.7 * (v[0] * dir[0] + v[1] * dir[1]) + 0.3 * (v[0] * prev[0] + v[1] * prev[1]);
        if (score > bestScore) {
          bestScore = score;
          best = { si, otherKey, v };
        }
      }
      if (!best) break;
      taken.push(best.si);
      pairs.push(segs[best.si].pair);
      path.push(best.otherKey);
      prev = best.v;
      cur = best.otherKey;
      if (onBoundary(nodes.get(cur).p)) break;
    }
    return { points: path.map((k) => nodes.get(k).p), pairs, taken };
  };

  // Chaque fissure part près du point d'impact, légèrement décalée dans sa
  // propre direction, et doit compter au moins trois segments.
  const used = new Set();
  const cracks = CRACK_DIRS.map((deg) => {
    const dir = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    const candidates = nearest(IMPACT[0] + dir[0] * 0.07, IMPACT[1] + dir[1] * 0.07).slice(0, 12);
    let best = null;
    for (const k of candidates) {
      const c = walk(k, dir, used);
      if (!best || c.pairs.length > best.pairs.length) best = c;
      if (c.pairs.length >= 4) break;
    }
    if (!best || best.pairs.length < 3) throw new Error(`fissure à ${deg}° trop courte`);
    for (const si of best.taken) used.add(si);
    return best;
  });
  return { cracks, impact: [IMPACT[0], IMPACT[1], H] };
}

// ---------------------------------------------------------------- GLB

function buildGlb(shards, extras) {
  const views = []; // { data: Uint8Array, count, stride, mode, target }
  const accessors = [];
  const meshes = [];
  const nodes = [];

  // Données regroupées par type : peu de bufferViews, meilleure compression.
  const groups = {
    oPos: [], oNrm: [], oUv: [], iPos: [], iNrm: [], iCrack: [], idx: [],
  };
  const counts = { oVerts: 0, iVerts: 0, idx: 0 };
  const plan = shards.map((s) => {
    const o = { vStart: counts.oVerts, vCount: s.outer.pos.length / 3, iStart: counts.idx, iCount: s.outer.idx.length };
    counts.oVerts += o.vCount;
    counts.idx += o.iCount;
    const n = { vStart: counts.iVerts, vCount: s.inner.pos.length / 3, iStart: counts.idx, iCount: s.inner.idx.length };
    counts.iVerts += n.vCount;
    counts.idx += n.iCount;
    groups.oPos.push(...s.outer.pos);
    groups.oNrm.push(...s.outer.nrm);
    groups.oUv.push(...s.outer.uv);
    groups.iPos.push(...s.inner.pos);
    groups.iNrm.push(...s.inner.nrm);
    groups.iCrack.push(...s.inner.crack);
    groups.idx.push(...s.outer.idx, ...s.inner.idx);
    return { o, n };
  });

  const f32 = (arr) => new Uint8Array(new Float32Array(arr).buffer);
  const i8x4 = (arr) => {
    const out = new Int8Array((arr.length / 3) * 4);
    for (let k = 0, m = 0; k < arr.length; k += 3, m += 4) {
      out[m] = Math.round(arr[k] * 127);
      out[m + 1] = Math.round(arr[k + 1] * 127);
      out[m + 2] = Math.round(arr[k + 2] * 127);
    }
    return new Uint8Array(out.buffer);
  };
  const VIEW = {
    oPos: views.push({ data: f32(groups.oPos), count: counts.oVerts, stride: 12, mode: 'ATTRIBUTES' }) - 1,
    oNrm: views.push({ data: i8x4(groups.oNrm), count: counts.oVerts, stride: 4, mode: 'ATTRIBUTES' }) - 1,
    oUv: views.push({ data: f32(groups.oUv), count: counts.oVerts, stride: 8, mode: 'ATTRIBUTES' }) - 1,
    iPos: views.push({ data: f32(groups.iPos), count: counts.iVerts, stride: 12, mode: 'ATTRIBUTES' }) - 1,
    iNrm: views.push({ data: i8x4(groups.iNrm), count: counts.iVerts, stride: 4, mode: 'ATTRIBUTES' }) - 1,
    iCrack: views.push({ data: f32(groups.iCrack), count: counts.iVerts, stride: 4, mode: 'ATTRIBUTES' }) - 1,
    idx: views.push({ data: new Uint8Array(new Uint16Array(groups.idx).buffer), count: counts.idx, stride: 2, mode: 'TRIANGLES' }) - 1,
  };

  const accessor = (view, offsetElems, count, type, componentType, stride, extra = {}) =>
    accessors.push({ bufferView: view, byteOffset: offsetElems * stride, count, type, componentType, ...extra }) - 1;
  const bounds = (arr, start, count) => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let k = start * 3; k < (start + count) * 3; k += 3)
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], arr[k + c]);
        max[c] = Math.max(max[c], arr[k + c]);
      }
    return { min, max };
  };

  shards.forEach((s, i) => {
    const { o, n } = plan[i];
    const outer = {
      attributes: {
        POSITION: accessor(VIEW.oPos, o.vStart, o.vCount, 'VEC3', 5126, 12, bounds(groups.oPos, o.vStart, o.vCount)),
        NORMAL: accessor(VIEW.oNrm, o.vStart, o.vCount, 'VEC3', 5120, 4, { normalized: true }),
        TEXCOORD_0: accessor(VIEW.oUv, o.vStart, o.vCount, 'VEC2', 5126, 8),
      },
      indices: accessor(VIEW.idx, o.iStart, o.iCount, 'SCALAR', 5123, 2),
      material: 0,
    };
    const inner = {
      attributes: {
        POSITION: accessor(VIEW.iPos, n.vStart, n.vCount, 'VEC3', 5126, 12, bounds(groups.iPos, n.vStart, n.vCount)),
        NORMAL: accessor(VIEW.iNrm, n.vStart, n.vCount, 'VEC3', 5120, 4, { normalized: true }),
        _CRACK: accessor(VIEW.iCrack, n.vStart, n.vCount, 'SCALAR', 5126, 4),
      },
      indices: accessor(VIEW.idx, n.iStart, n.iCount, 'SCALAR', 5123, 2),
      material: 1,
    };
    meshes.push({ name: `shard-${i}`, primitives: [outer, inner] });
    nodes.push({ name: `shard-${i}`, mesh: i, translation: s.center.map((v) => +v.toFixed(6)) });
  });

  // Compression : chaque bufferView est encodé à part, aligné sur 4 octets.
  const chunks = [];
  let binLength = 0;
  let fallbackLength = 0;
  const bufferViews = views.map((v) => {
    const encoded = MeshoptEncoder.encodeGltfBuffer(v.data, v.count, v.stride, v.mode);
    const view = {
      buffer: 1,
      byteOffset: fallbackLength,
      byteLength: v.data.length,
      extensions: {
        EXT_meshopt_compression: { buffer: 0, byteOffset: binLength, byteLength: encoded.length, byteStride: v.stride, count: v.count, mode: v.mode },
      },
    };
    if (v.mode === 'ATTRIBUTES') view.byteStride = v.stride;
    else view.target = 34963;
    chunks.push(encoded);
    const pad = (4 - (encoded.length % 4)) % 4;
    if (pad) chunks.push(new Uint8Array(pad));
    binLength += encoded.length + pad;
    fallbackLength += v.data.length + ((4 - (v.data.length % 4)) % 4);
    return view;
  });

  const json = {
    asset: { version: '2.0', generator: 'ETHER landing / scripts/fracture.mjs' },
    extensionsUsed: ['EXT_meshopt_compression', 'KHR_mesh_quantization'],
    extensionsRequired: ['EXT_meshopt_compression', 'KHR_mesh_quantization'],
    scene: 0,
    scenes: [{ name: 'prism', nodes: nodes.map((_, i) => i), extras }],
    nodes,
    meshes,
    materials: [
      { name: 'outer', pbrMetallicRoughness: { baseColorFactor: [0.012, 0.01, 0.009, 1], metallicFactor: 0, roughnessFactor: 0.18 } },
      { name: 'inner', pbrMetallicRoughness: { baseColorFactor: [0.01, 0.01, 0.01, 1], metallicFactor: 0, roughnessFactor: 0.6 } },
    ],
    accessors,
    bufferViews,
    buffers: [
      { byteLength: binLength },
      { byteLength: fallbackLength, extensions: { EXT_meshopt_compression: { fallback: true } } },
    ],
  };

  const bin = Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
  const jsonBuf = Buffer.from(JSON.stringify(json));
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const total = 12 + 8 + jsonBuf.length + jsonPad + 8 + bin.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBuf.length + jsonPad, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonBuf.copy(out, 20);
  out.fill(0x20, 20 + jsonBuf.length, 20 + jsonBuf.length + jsonPad);
  const o = 20 + jsonBuf.length + jsonPad;
  out.writeUInt32LE(bin.length, o);
  out.writeUInt32LE(0x004e4942, o + 4);
  bin.copy(out, o + 8);
  return out;
}

// ---------------------------------------------------------------- assemblage

function fracture({ count, seed }) {
  const rand = rng(seed);
  const seeds = sampleSeeds(count, rand);
  const cells = seeds.map((_, i) => cell(i, seeds));
  const { cracks, impact } = findCracks(cells);
  const crackOf = new Map();
  cracks.forEach((c, k) => {
    for (const [a, b] of c.pairs) {
      crackOf.set(`${a}-${b}`, k + 1);
      crackOf.set(`${b}-${a}`, k + 1);
    }
  });

  let volume = 0;
  const shards = cells.map((faces, i) => {
    const { center, volume: v } = centroid(faces);
    volume += v;
    const outer = { pos: [], nrm: [], uv: [], idx: [] };
    const inner = { pos: [], nrm: [], crack: [], idx: [] };
    for (const f of faces) {
      const target = f.kind === 'inner' ? inner : outer;
      const base = target.pos.length / 3;
      const n = norm(f.n);
      for (const p of f.verts) {
        const local = sub(p, center);
        target.pos.push(local[0], local[1], local[2]);
        target.nrm.push(n[0], n[1], n[2]);
        if (target === outer) {
          if (f.kind === 'front') target.uv.push((p[0] + R) / (2 * R), (p[1] - BAND.y0) / BAND.h);
          else target.uv.push(0, -1);
        } else target.crack.push(crackOf.get(`${i}-${f.nb}`) || 0);
      }
      for (let k = 1; k < f.verts.length - 1; k++) target.idx.push(base, base + k, base + k + 1);
    }
    return { center, outer, inner };
  });

  const prismVolume = ((5 / 2) * R * R * Math.sin((2 * Math.PI) / 5)) * T;
  const round = (p) => p.map((v) => +v.toFixed(5));
  const extras = {
    R,
    T,
    bandY0: BAND.y0,
    bandH: BAND.h,
    impact: round(impact),
    cracks: cracks.map((c) => c.points.map(round)),
  };
  return { shards, extras, volumeError: Math.abs(volume - prismVolume) / prismVolume, cracks };
}

async function verify(buffer, expected) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const gltf = await new Promise((resolve, reject) => loader.parse(ab, '', resolve, reject));
  const meshes = [];
  gltf.scene.traverse((o) => o.isMesh && meshes.push(o));
  const cracked = new Set();
  for (const m of meshes) {
    const a = m.geometry.getAttribute('_crack');
    if (a) for (let k = 0; k < a.count; k++) if (a.getX(k) > 0) cracked.add(a.getX(k));
  }
  if (gltf.scene.children.length !== expected) throw new Error(`${gltf.scene.children.length} éclats lus au lieu de ${expected}`);
  if (cracked.size !== 3) throw new Error(`${cracked.size} fissures marquées au lieu de 3`);
  return meshes.length;
}

await MeshoptEncoder.ready;
for (const v of VARIANTS) {
  const { shards, extras, volumeError, cracks } = fracture(v);
  const glb = buildGlb(shards, extras);
  const meshCount = await verify(glb, v.count);
  writeFileSync(`${OUT}${v.file}`, glb);
  const tris = shards.reduce((s, x) => s + (x.outer.idx.length + x.inner.idx.length) / 3, 0);
  console.log(
    `${v.file} : ${v.count} éclats, ${tris} triangles, ${(glb.length / 1024).toFixed(1)} Ko, ` +
      `volume ${(volumeError * 100).toFixed(4)} % d'écart, fissures ${cracks.map((c) => c.pairs.length).join('/')} segments, ${meshCount} maillages relus`,
  );
}
