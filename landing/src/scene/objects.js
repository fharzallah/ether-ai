// Construction des objets de la scène « Le banc d'essai » : le prisme découpé,
// ses fissures, les reflets flatteurs, les phrases, le rayon, et les positions
// cibles des éclats (anneaux de l'acte 3, logo de l'acte 6).
import * as THREE from 'three';
import { LOGO_LAYERS, polygonPoints } from '../lib/logo.js';
import {
  ghostVertex,
  ghostFragment,
  phraseVertex,
  phraseFragment,
  beamVertex,
  beamFragment,
  crackVertex,
  crackFragment,
} from './shaders.js';

export const COLORS = {
  bg: new THREE.Color('#0e0c0b'),
  bone: new THREE.Color('#f3eee7'),
  cold: new THREE.Color('#8f99a6'),
  red: new THREE.Color('#ef4136'),
  core: new THREE.Color('#ffd9d4'),
};

export const RING_Z = [0, -3, -6, -9, -12];
export const RING_RADIUS = 1.55; // rayon du plus grand anneau, les autres suivent les proportions du logo
export const LOGO_RADIUS = 1.3; // rayon de la plus grande couche du logo reconstruit

// ------------------------------------------------------------ textes

const SERIF = 'Fraunces, Georgia, "Times New Roman", serif';

/** Phrase gravée dans le prisme : une bande de texture sur la face avant. */
export function makePrismText(text, { width, height, anisotropy }) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  let size = height * 0.42;
  ctx.font = `300 ${size}px ${SERIF}`;
  const maxWidth = width * 0.78;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth) {
    size *= maxWidth / measured;
    ctx.font = `300 ${size}px ${SERIF}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#a59c91';
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/** Les phrases flatteuses, une par ligne, en Fraunces italique. */
export function makePhraseAtlas(phrases, { rowWidth, rowHeight }) {
  const canvas = document.createElement('canvas');
  canvas.width = rowWidth;
  canvas.height = rowHeight * phrases.length;
  const ctx = canvas.getContext('2d');
  const size = rowHeight * 0.56;
  ctx.font = `italic 300 ${size}px ${SERIF}`;
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#8f99a6';
  const widths = phrases.map((p, i) => {
    const w = Math.min(ctx.measureText(p).width + size * 0.4, rowWidth);
    ctx.fillText(p, size * 0.2, rowHeight * (i + 0.5));
    return w / rowWidth;
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, widths, aspect: rowWidth / rowHeight };
}

// ------------------------------------------------------------ prisme découpé

function innerMaterial(shared) {
  const material = new THREE.MeshStandardMaterial({
    color: '#0b0a09',
    roughness: 0.55,
    metalness: 0,
    emissive: COLORS.red,
    emissiveIntensity: 1,
  });
  const base = { value: 0 };
  material.userData.base = base;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCrack = shared.uCrack;
    shader.uniforms.uBase = base;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float _crack;\nvarying float vCrackId;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCrackId = _crack;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCrack;\nuniform float uBase;\nvarying float vCrackId;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float crackLevel = vCrackId > 2.5 ? uCrack.z : (vCrackId > 1.5 ? uCrack.y : (vCrackId > 0.5 ? uCrack.x : 0.0));
        // Une cassure vue de face reste sombre, vue de biais elle rougeoie : du relief, pas un aplat.
        float grazing = 1.0 - abs(dot(normal, normalize(-vViewPosition)));
        totalEmissiveRadiance *= (uBase + crackLevel) * (0.28 + 0.72 * grazing * grazing);`,
      );
  };
  material.customProgramCacheKey = () => 'ether-shard-inner';
  return material;
}

/**
 * Les éclats du GLB, recollés : tant que le prisme est intact on n'affiche
 * qu'eux, sans second modèle. Faces externes : matériau du prisme ; cassures :
 * matériau émissif rouge dont l'intensité est un uniform (0 au repos).
 */
export function buildShards(gltf, { light, textTexture, random }) {
  const extras = gltf.scene.userData;
  const shared = { uCrack: { value: new THREE.Vector3() } };
  const outer = light
    ? new THREE.MeshStandardMaterial({ color: '#1d1a17', metalness: 0.2, roughness: 0.3 })
    : new THREE.MeshPhysicalMaterial({
        color: '#1d1a17',
        transmission: 0.55,
        thickness: 1.2,
        ior: 1.45,
        roughness: 0.18,
        clearcoat: 1,
        // Reflets adoucis : seuls les rouges émissifs doivent franchir le seuil du bloom.
        clearcoatRoughness: 0.32,
        specularIntensity: 0.45,
      });
  outer.emissive = new THREE.Color(1, 1, 1);
  outer.emissiveMap = textTexture;
  outer.emissiveIntensity = 1;

  const shards = [];
  const nodes = [...gltf.scene.children];
  nodes.forEach((node, i) => {
    const parts = node.isMesh ? [node] : node.children.filter((c) => c.isMesh);
    const outerGeo = parts.find((m) => !m.geometry.getAttribute('_crack')).geometry;
    const innerGeo = parts.find((m) => m.geometry.getAttribute('_crack')).geometry;
    const inner = innerMaterial(shared);
    const group = new THREE.Group();
    group.name = `shard-${i}`;
    const a = new THREE.Mesh(outerGeo, outer);
    const b = new THREE.Mesh(innerGeo, inner);
    a.matrixAutoUpdate = false;
    b.matrixAutoUpdate = false;
    group.add(a, b);
    const center = node.position.clone();
    const dir = center.clone().setZ(center.z * 0.4);
    if (dir.lengthSq() < 1e-6) dir.set(random() - 0.5, random() - 0.5, 0.2);
    dir.normalize();
    shards.push({
      group,
      inner,
      center,
      dir,
      rand: random(),
      axis: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
      spin: (random() - 0.5) * Math.PI * 2.4,
      cloud: { r: 1.4 + random() * 1.9, a: random() * Math.PI * 2, z: -9 + random() * 10, y: (random() - 0.5) * 1.2, speed: 0.04 + random() * 0.05 },
    });
  });
  return { shards, outer, shared, extras };
}

/** Rubans lumineux des trois fissures, posés juste devant la face avant. */
export function buildCracks(extras, { width = 0.022, hitWidth = 0.075 } = {}) {
  const z = extras.T / 2 + 0.004;
  const ribbon = (points, w, crackId) => {
    const pos = [];
    const side = [];
    const crack = [];
    const lenAttr = [];
    const index = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    let run = 0;
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const l = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / l;
      const ny = (bx - ax) / l;
      const base = pos.length / 3;
      // Les segments débordent un peu pour masquer les joints.
      const ex = ((bx - ax) / l) * w * 0.5;
      const ey = ((by - ay) / l) * w * 0.5;
      pos.push(ax - ex - nx * w, ay - ey - ny * w, z, ax - ex + nx * w, ay - ey + ny * w, z, bx + ex - nx * w, by + ey - ny * w, z, bx + ex + nx * w, by + ey + ny * w, z);
      side.push(-1, 1, -1, 1);
      const l0 = run / total;
      run += l;
      const l1 = run / total;
      lenAttr.push(l0, l0, l1, l1);
      crack.push(crackId, crackId, crackId, crackId);
      index.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
    return { pos, side, crack, lenAttr, index };
  };

  const merged = { pos: [], side: [], crack: [], lenAttr: [], index: [] };
  const hits = [];
  extras.cracks.forEach((points, k) => {
    const r = ribbon(points, width, k);
    const offset = merged.pos.length / 3;
    merged.pos.push(...r.pos);
    merged.side.push(...r.side);
    merged.crack.push(...r.crack);
    merged.lenAttr.push(...r.lenAttr);
    merged.index.push(...r.index.map((i) => i + offset));

    const h = ribbon(points, hitWidth, k);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(h.pos, 3));
    geo.setIndex(h.index);
    const hit = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.crack = k;
    hits.push(hit);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(merged.pos, 3));
  geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(merged.side, 1));
  geometry.setAttribute('aCrack', new THREE.Float32BufferAttribute(merged.crack, 1));
  geometry.setAttribute('aLen', new THREE.Float32BufferAttribute(merged.lenAttr, 1));
  geometry.setIndex(merged.index);
  const material = new THREE.ShaderMaterial({
    vertexShader: crackVertex,
    fragmentShader: crackFragment,
    uniforms: {
      uCore: { value: COLORS.core },
      uHalo: { value: COLORS.red },
      uLevel: { value: new THREE.Vector3() },
      uGrow: { value: new THREE.Vector3() },
      uOpacity: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return { mesh, material, hits };
}

// ------------------------------------------------------------ reflets flatteurs

export function buildGhosts({ count, phrases, phraseRows }) {
  const base = new THREE.CylinderGeometry(1, 1, 0.5, 5, 1).rotateX(-Math.PI / 2).toNonIndexed();
  base.computeVertexNormals();
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', base.getAttribute('position'));
  geometry.setAttribute('normal', base.getAttribute('normal'));
  geometry.instanceCount = count;

  // Du plus loin au plus proche : l'ordre de dessin reste correct sans tri.
  const side = new Float32Array(count);
  const depth = new Float32Array(count);
  const order = new Float32Array(count);
  const rot = new Float32Array(count * 3);
  const opacity = new Float32Array(count);
  const meta = [];
  for (let n = 0; n < count; n++) {
    const near = count - 1 - n; // 0 = le plus proche
    const t = count > 1 ? near / (count - 1) : 0;
    side[n] = near % 2 === 0 ? -1 : 1;
    depth[n] = -1.5 - t * 16.5;
    order[n] = t;
    opacity[n] = 0.5 - t * 0.46;
    rot[n * 3] = Math.sin(near * 12.9898) * 0.16;
    rot[n * 3 + 1] = Math.sin(near * 78.233) * 0.22;
    rot[n * 3 + 2] = Math.sin(near * 37.719) * 0.28;
    meta[near] = { side: side[n], depth: depth[n], order: order[n] };
  }
  geometry.setAttribute('aSide', new THREE.InstancedBufferAttribute(side, 1));
  geometry.setAttribute('aDepth', new THREE.InstancedBufferAttribute(depth, 1));
  geometry.setAttribute('aOrder', new THREE.InstancedBufferAttribute(order, 1));
  geometry.setAttribute('aRot', new THREE.InstancedBufferAttribute(rot, 3));
  geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(opacity, 1));

  const shared = {
    uSpread: { value: 1.6 },
    uSqueeze: { value: 1 },
    uStretch: { value: 1 },
    uFall: { value: 0 },
    uTime: { value: 0 },
    uGlobal: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: ghostVertex,
    fragmentShader: ghostFragment,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: COLORS.cold }, uRed: { value: COLORS.red } }]),
    fog: true,
    transparent: true,
    depthWrite: false,
  });
  Object.assign(material.uniforms, shared);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  // Quatre phrases, chacune accrochée à un reflet proche.
  const anchors = (count >= 12 ? [1, 2, 4, 6] : [0, 1, 2, 4]).map((k) => meta[k]);
  const plane = new THREE.PlaneGeometry(1, 1);
  const pGeo = new THREE.InstancedBufferGeometry();
  pGeo.setAttribute('position', plane.getAttribute('position'));
  pGeo.setAttribute('uv', plane.getAttribute('uv'));
  pGeo.setIndex(plane.getIndex());
  pGeo.instanceCount = anchors.length;
  const h = 0.26;
  pGeo.setAttribute('aWidth', new THREE.InstancedBufferAttribute(new Float32Array(anchors.map((_, i) => phrases.widths[i])), 1));
  pGeo.setAttribute('aSide', new THREE.InstancedBufferAttribute(new Float32Array(anchors.map((a) => a.side)), 1));
  pGeo.setAttribute('aDepth', new THREE.InstancedBufferAttribute(new Float32Array(anchors.map((a) => a.depth)), 1));
  pGeo.setAttribute('aOrder', new THREE.InstancedBufferAttribute(new Float32Array(anchors.map((a) => a.order)), 1));
  pGeo.setAttribute('aRot', new THREE.InstancedBufferAttribute(new Float32Array(anchors.length * 3), 3));
  pGeo.setAttribute('aRow', new THREE.InstancedBufferAttribute(new Float32Array(anchors.map((_, i) => i)), 1));
  pGeo.setAttribute(
    'aSize',
    new THREE.InstancedBufferAttribute(new Float32Array(anchors.flatMap((_, i) => [phrases.widths[i] * phrases.aspect * h, h])), 2),
  );
  const pMat = new THREE.ShaderMaterial({
    vertexShader: phraseVertex,
    fragmentShader: phraseFragment,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uRows: { value: phraseRows } }]),
    fog: true,
    transparent: true,
    depthWrite: false,
  });
  pMat.uniforms.uMap.value = phrases.texture;
  Object.assign(pMat.uniforms, shared);
  const pMesh = new THREE.Mesh(pGeo, pMat);
  pMesh.frustumCulled = false;
  pMesh.renderOrder = 1;
  return { mesh, phrasesMesh: pMesh, uniforms: shared, materials: [material, pMat], geometries: [geometry, pGeo, base, plane] };
}

// ------------------------------------------------------------ rayon

export function buildBeam({ halfWidth = 0.04, coreRatio = 0.015 / 0.08, segments = 96 } = {}) {
  const count = (segments + 1) * 2;
  const geometry = new THREE.BufferGeometry();
  const t = new Float32Array(count);
  const side = new Float32Array(count);
  const index = [];
  for (let i = 0; i <= segments; i++) {
    t[i * 2] = t[i * 2 + 1] = i / segments;
    side[i * 2] = -1;
    side[i * 2 + 1] = 1;
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  geometry.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({
    vertexShader: beamVertex,
    fragmentShader: beamFragment,
    uniforms: {
      uA: { value: new THREE.Vector3() },
      uB: { value: new THREE.Vector3() },
      uHalfWidth: { value: halfWidth },
      uCoreRatio: { value: coreRatio },
      uIntensity: { value: 0 },
      uFadeEnds: { value: 0.04 },
      uCore: { value: COLORS.core },
      uHalo: { value: COLORS.red },
      uRingZ: { value: RING_Z.slice() },
      uRingOn: { value: [0, 0, 0, 0, 0] },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    // Le ruban se retourne vers la caméra : l'ordre de ses sommets varie.
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return { mesh, material };
}

// ------------------------------------------------------------ anneaux et logo

/** Nombre d'éclats par couche, proportionnel au périmètre de chaque pentagone. */
function layerCounts(n) {
  const total = LOGO_LAYERS.reduce((s, l) => s + l.r, 0);
  const raw = LOGO_LAYERS.map((l) => (n * l.r) / total);
  const counts = raw.map(Math.floor);
  let left = n - counts.reduce((s, c) => s + c, 0);
  raw
    .map((v, i) => ({ i, f: v - Math.floor(v) }))
    .sort((a, b) => b.f - a.f)
    .forEach(({ i }) => {
      if (left-- > 0) counts[i]++;
    });
  return counts;
}

/**
 * Point du contour d'un pentagone (repère three.js, y vers le haut), t ∈ [0, 1).
 * Renvoie aussi l'angle de l'arête : l'éclat s'y aligne comme un trait.
 */
function perimeterPoint(r, t, out) {
  const pts = polygonPoints(r, 5);
  const f = (((t % 1) + 1) % 1) * 5;
  const e = Math.floor(f);
  const u = f - e;
  const a = pts[e];
  const b = pts[(e + 1) % 5];
  out.set(a[0] + (b[0] - a[0]) * u, -(a[1] + (b[1] - a[1]) * u));
  return Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
}

/**
 * Chaque éclat reçoit une couche (les éclats du bord vont aux grandes couches)
 * et une place sur le contour de cette couche, dans l'ordre de son angle : les
 * trajectoires ne se croisent presque pas.
 */
export function assignTargets(shards) {
  const counts = layerCounts(shards.length);
  const sorted = shards.slice().sort((a, b) => Math.hypot(b.center.x, b.center.y) - Math.hypot(a.center.x, a.center.y));
  const tmp = new THREE.Vector2();
  let cursor = 0;
  counts.forEach((count, layer) => {
    const group = sorted.slice(cursor, cursor + count);
    cursor += count;
    const angleOf = (s) => (Math.atan2(s.center.x, s.center.y) + Math.PI * 2) % (Math.PI * 2); // 0 en haut, sens horaire
    group.sort((a, b) => angleOf(a) - angleOf(b));
    const def = LOGO_LAYERS[layer];
    group.forEach((s, k) => {
      const t = (k + 0.5) / count;
      s.edgeAngle = perimeterPoint(def.r, t, tmp);
      s.layer = layer;
      s.logo = new THREE.Vector2(tmp.x / 84, tmp.y / 84); // unité : rayon de la plus grande couche
      s.homeAngle = Math.atan2(s.center.y, s.center.x);
      s.slotAngle = Math.atan2(tmp.y, tmp.x);
    });
  });
  return counts;
}
