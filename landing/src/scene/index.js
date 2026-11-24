// La scène « Le banc d'essai » : un prisme (ton idée), des reflets flatteurs, un
// rayon (ETHER). Une seule scène, pilotée par la progression du scroll de toute
// la page (0 → 1), découpée en sept actes alignés sur les sections.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  NoiseEffect,
  VignetteEffect,
  BlendFunction,
  Effect,
  EffectAttribute,
} from 'postprocessing';
import { LOGO_LAYERS } from '../lib/logo.js';
import { state, emit } from '../lib/state.js';
import {
  COLORS,
  RING_Z,
  RING_RADIUS,
  LOGO_RADIUS,
  makePrismText,
  makePhraseAtlas,
  buildShards,
  buildCracks,
  buildGhosts,
  buildBeam,
  assignTargets,
} from './objects.js';

// Début de chaque acte dans la progression de la page (actes 0 à 6).
export const ACT_START = [0, 0.12, 0.28, 0.44, 0.66, 0.8, 0.9];
// Passage de chaque anneau (acte 3) : aligné sur le repère de chaque étape.
export const RING_P = [0.525, 0.555, 0.585, 0.615, 0.645];

const DEG = Math.PI / 180;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// Traînées de vitesse : flou radial depuis le centre, légère aberration
// chromatique. Nul à l'arrêt, décalage UV de 0,012 au plus au bord de l'image.
class TrailsEffect extends Effect {
  constructor() {
    super(
      'TrailsEffect',
      /* glsl */ `
      uniform float uStrength;
      uniform float uChroma;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        if (uStrength < 0.0002) { outputColor = inputColor; return; }
        vec2 dir = (uv - 0.5) * 2.0 * uStrength;
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 10; i++) {
          vec2 o = dir * (float(i) / 9.0);
          acc.r += texture2D(inputBuffer, uv - o * (1.0 + uChroma)).r;
          acc.g += texture2D(inputBuffer, uv - o).g;
          acc.b += texture2D(inputBuffer, uv - o * (1.0 - uChroma)).b;
        }
        outputColor = vec4(acc / 10.0, inputColor.a);
      }`,
      {
        attributes: EffectAttribute.CONVOLUTION,
        uniforms: new Map([
          ['uStrength', new THREE.Uniform(0)],
          ['uChroma', new THREE.Uniform(0.5)],
        ]),
      },
    );
  }
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Trajet de la caméra : [progression, position, point visé, décalage d'objectif X, Y].
 * Le décalage d'objectif (en coordonnées écran) laisse la colonne de texte libre
 * sur ordinateur et place le prisme sous le texte sur téléphone.
 */
function cameraKeys(portrait) {
  const d = portrait ? 1.5 : 1;
  const x = portrait ? 0 : 1;
  const keys = [
    [0.0, [0, 0, 5.5 * d], [0, 0, 0], 0.46 * x, portrait ? -0.64 : 0],
    [0.1, [0, 0.02, 5.4 * d], [0, 0, 0], 0.46 * x, portrait ? -0.6 : 0],
    [0.2, [-0.05, 0.06, 3.6], [0.1, 0, -6], 0.32 * x, 0],
    [0.28, [-0.1, 0.1, 1.5], [0.1, 0, -10], 0.26 * x, 0],
    // Acte 2 : le prisme assez à droite pour que la carte de la démo ne cache pas ses fissures.
    [0.34, [0, 0.2, 4 * d], [0, 0, 0], 0.52 * x, portrait ? -0.18 : 0],
    [0.44, [0.12, 0.26, 4.2 * d], [0, 0, 0], 0.52 * x, portrait ? -0.18 : 0],
    [0.475, [0, 0.35, 5.6 * d], [0, 0, -1.5], 0.36 * x, 0],
    [0.505, [0, 0.08, 4.4], [0, -0.05, -6], 0.3 * x, 0],
  ];
  const before = portrait ? 3.2 : 2.2;
  RING_P.forEach((p, k) => keys.push([p, [0, 0.02, RING_Z[k] + before], [0, -0.04, RING_Z[k] - 8], 0.3 * x, 0]));
  keys.push(
    [0.66, [0, 0.04, -14.5], [0, 0, -24], 0.3 * x, 0],
    [0.72, [0, 1.0, 6.5 * d], [0, 0, -5], 0.3 * x, 0],
    [0.8, [0, 1.2, 8.5 * d], [0, 0, -3], 0.3 * x, 0],
    [0.9, [0, 0.55, 7.4 * d], [0, 0.1, 0], 0.26 * x, 0.04],
    // Logo reconstruit au-dessus de l'appel final, sans toucher le titre.
    [0.95, [0, 0.3, 7.8 * d], [0, 0.05, 0], 0.2 * x, 0.16],
    [1.0, [0, 0.1, 8.2 * d], [0, 0.05, 0], 0, portrait ? 0.4 : 0.44],
  );
  return keys;
}

function buildRig(portrait) {
  const keys = cameraKeys(portrait);
  const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  return {
    p: keys.map((k) => k[0]),
    pos: new THREE.CatmullRomCurve3(keys.map((k) => vec(k[1])), false, 'centripetal'),
    target: new THREE.CatmullRomCurve3(keys.map((k) => vec(k[2])), false, 'centripetal'),
    lens: keys.map((k) => [k[3], k[4]]),
  };
}

async function loadFonts(prism, phrases) {
  const href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,144,300&display=swap';
  let link = document.querySelector('link[data-scene-font]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.sceneFont = '';
    document.head.append(link);
  }
  const timeout = new Promise((r) => setTimeout(r, 2500));
  const sheet = new Promise((r) => {
    if (link.sheet) r();
    link.addEventListener('load', r, { once: true });
    link.addEventListener('error', r, { once: true });
  });
  await Promise.race([sheet, timeout]);
  await Promise.race([
    Promise.all([document.fonts.load('300 64px Fraunces', prism), document.fonts.load('italic 300 64px Fraunces', phrases.join(' '))]),
    timeout,
  ]).catch(() => {});
}

export async function createScene({ light, forcedProgress = null, onFallback }) {
  const copy = document.getElementById('scene-copy').content;
  const prismText = copy.querySelector('[data-k="prism"]').textContent.trim();
  const phrases = [...copy.querySelectorAll('[data-k="phrase"]')].map((n) => n.textContent.trim());

  const canvas = document.createElement('canvas');
  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, light ? 1.5 : 2));
  renderer.setClearColor(COLORS.bg, 1);
  renderer.transmissionResolutionScale = 0.5;

  const scene = new THREE.Scene();
  // Fond posé sur la scène (et non via la couleur d'effacement) : postprocessing
  // efface son tampon avec la couleur du dernier rendu à l'écran, déjà en sRGB.
  scene.background = COLORS.bg;
  scene.fog = new THREE.Fog(COLORS.bg, 6, 22);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  pmrem.dispose();
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);

  // Lumières : une principale, un contre-jour froid (flatterie) puis rouge (ETHER).
  const ambient = new THREE.AmbientLight(COLORS.bone, 0.08);
  const key = new THREE.DirectionalLight(COLORS.bone, 1.2);
  key.position.set(-3, 4, 3);
  const rimCold = new THREE.DirectionalLight(COLORS.cold, 0.6);
  rimCold.position.set(2.5, 1.5, -4);
  const rimRed = new THREE.DirectionalLight(COLORS.red, 0);
  rimRed.position.set(-2, 1, -4);
  scene.add(ambient, key, rimCold, rimRed);

  await loadFonts(prismText, phrases);
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const textTexture = makePrismText(prismText, light ? { width: 1024, height: 128, anisotropy } : { width: 2048, height: 256, anisotropy });
  const atlas = makePhraseAtlas(phrases, light ? { rowWidth: 512, rowHeight: 64 } : { rowWidth: 1024, rowHeight: 128 });

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}shards-${light ? 'mobile' : 'desktop'}.glb`);

  const random = rng(42);
  const { shards, outer, shared, extras } = buildShards(gltf, { light, textTexture, random });
  assignTargets(shards);
  const world = new THREE.Group();
  scene.add(world);
  for (const s of shards) world.add(s.group);

  // Repère du prisme intact : fissures et zones de survol le suivent.
  const prismFrame = new THREE.Group();
  world.add(prismFrame);
  const cracks = buildCracks(extras);
  prismFrame.add(cracks.mesh, ...cracks.hits);

  const ghosts = buildGhosts({ count: light ? 6 : 12, phrases: atlas, phraseRows: phrases.length });
  world.add(ghosts.mesh, ghosts.phrasesMesh);

  const beamIn = buildBeam();
  const beamTunnel = buildBeam();
  const beamOut = buildBeam({ halfWidth: 0.012, coreRatio: 0.5 });
  beamOut.material.uniforms.uFadeEnds.value = 0.02;
  world.add(beamIn.mesh, beamTunnel.mesh, beamOut.mesh);

  // Mode léger : pas de bloom, un halo rouge doux le remplace.
  let glow = null;
  if (light) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: COLORS.red, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    glow.scale.setScalar(1.4);
    world.add(glow);
  }

  // Post-traitement : bloom (rouge émissif seulement), traînées, vignette, grain.
  // Tampons 8 bits (chemin par défaut de postprocessing) : les couleurs restent
  // celles de la page ; les cœurs blancs rosés du rayon et des fissures dépassent seuls le seuil.
  const composer = new EffectComposer(renderer, {
    multisampling: !light && window.devicePixelRatio < 1.5 ? 4 : 0,
  });
  composer.addPass(new RenderPass(scene, camera));
  const trails = new TrailsEffect();
  trails.uniforms.get('uChroma').value = light ? 0 : 0.5;
  const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY });
  noise.blendMode.opacity.value = 0.035;
  const effects = [trails];
  if (!light) effects.push(new BloomEffect({ luminanceThreshold: 0.85, intensity: 0.6, radius: 0.4, mipmapBlur: true }));
  effects.push(new VignetteEffect({ offset: 0.3, darkness: 0.35 }), noise);
  composer.addPass(new EffectPass(camera, ...effects));

  // ---------------------------------------------------------- état animé

  let portrait = false;
  let rig = null;
  const lensBase = new THREE.Vector2();
  let lensX = 0;
  let lensY = 0;
  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const prismPos = new THREE.Vector3();
  const prismQuat = new THREE.Quaternion();
  const prismEuler = new THREE.Euler();
  const impact = new THREE.Vector3();
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _q1 = new THREE.Quaternion();
  const _q2 = new THREE.Quaternion();
  const _s1 = new THREE.Vector3();
  const _s2 = new THREE.Vector3();
  // Sur le logo, chaque éclat devient un trait le long de son arête.
  const DASH = light ? new THREE.Vector3(2, 0.26, 0.4) : new THREE.Vector3(1.15, 0.32, 0.45);
  const Z = new THREE.Vector3(0, 0, 1);
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const fine = window.matchMedia('(pointer: fine)');
  const layerAngle = LOGO_LAYERS.map((l) => -l.offset * DEG);
  const lit = [0, 0, 0, 0, 0];
  const hover = [0, 0, 0];
  let crackHover = -1;
  let pointerMoved = false;
  let redMix = 0;
  let time = 0;
  let scroll = window.scrollY;
  let velocitySmooth = 0;
  let scrollSource = null;
  let breakpoints = [];

  // ---------------------------------------------------------- scroll → progression

  function measure() {
    const vh = window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    const top = (el) => el.getBoundingClientRect().top + window.scrollY;
    const sections = document.querySelectorAll('main > section');
    const pts = [{ y: 0, p: 0 }];
    for (let i = 1; i <= 6 && i < sections.length; i++) pts.push({ y: top(sections[i]) - vh * 0.5, p: ACT_START[i] });
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    const markers = document.querySelectorAll(wide ? '[data-marker]' : '[data-step-item]');
    markers.forEach((m, k) => {
      if (k < RING_P.length) pts.push({ y: top(m) + m.offsetHeight / 2 - vh / 2, p: RING_P[k] });
    });
    pts.push({ y: max, p: 1 });
    pts.sort((a, b) => a.p - b.p);
    let lastY = -Infinity;
    for (const pt of pts) {
      pt.y = Math.min(max, Math.max(pt.y, lastY + 1, 0));
      lastY = pt.y;
    }
    breakpoints = pts;
  }

  function progressAt(y) {
    const b = breakpoints;
    if (y <= b[0].y) return b[0].p;
    for (let i = 1; i < b.length; i++) {
      if (y <= b[i].y) return lerp(b[i - 1].p, b[i].p, (y - b[i - 1].y) / (b[i].y - b[i - 1].y));
    }
    return 1;
  }

  // ---------------------------------------------------------- caméra

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    lensBase.set(camera.projectionMatrix.elements[8], camera.projectionMatrix.elements[9]);
    const nextPortrait = camera.aspect < 0.9;
    if (!rig || nextPortrait !== portrait) {
      portrait = nextPortrait;
      rig = buildRig(portrait);
    }
    measure();
  }

  function placeCamera(p) {
    const keys = rig.p;
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1]) i++;
    const u = clamp01((p - keys[i]) / (keys[i + 1] - keys[i]));
    const t = (i + u) / (keys.length - 1);
    rig.pos.getPoint(t, camPos);
    rig.target.getPoint(t, camTarget);
    const k = u * u * (3 - 2 * u);
    lensX = lerp(rig.lens[i][0], rig.lens[i + 1][0], k);
    lensY = lerp(rig.lens[i][1], rig.lens[i + 1][1], k);
    // Souris : la caméra se décale de ±0,15 unité.
    camPos.x += pointerSmooth.x * 0.15;
    camPos.y += pointerSmooth.y * 0.15;
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    // Décalage d'objectif : on déplace l'image sans déformer la perspective.
    const e = camera.projectionMatrix.elements;
    e[8] = lensBase.x - lensX;
    e[9] = lensBase.y - lensY;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  // ---------------------------------------------------------- actes

  function update(p, dt) {
    // Prisme intact : léger balancement (0,05 rad/s au plus), s'écarte pendant
    // l'acte 1 pour laisser la caméra entrer dans le couloir, revient à l'acte 2.
    const slide = smooth(0.12, 0.22, p) * (1 - smooth(0.28, 0.335, p));
    prismPos.set(slide * (portrait ? 2.1 : 1.6), 0, -0.5 * slide);
    const sway = 0.35 * Math.sin(time * 0.143);
    const mouseOn = 1 - smooth(0.44, 0.47, p) + smooth(0.95, 1, p);
    prismEuler.set(-8 * DEG - pointerSmooth.y * 8 * DEG * mouseOn, 12 * DEG + sway + slide * 0.4 + pointerSmooth.x * 8 * DEG * mouseOn, 0);
    prismQuat.setFromEuler(prismEuler);
    prismFrame.position.copy(prismPos);
    prismFrame.quaternion.copy(prismQuat);

    // Acte 2 : le rayon entre par la gauche et frappe le prisme.
    impact.set(extras.impact[0], extras.impact[1], extras.impact[2]).applyQuaternion(prismQuat).add(prismPos);
    const enter = easeOut(smooth(0.285, 0.318, p));
    const e = easeOut(smooth(0.445, 0.48, p)); // éclatement
    const uIn = beamIn.material.uniforms;
    uIn.uA.value.set(impact.x - 18, impact.y + 0.02, impact.z);
    uIn.uB.value.lerpVectors(uIn.uA.value, impact, enter);
    uIn.uIntensity.value = (enter > 0.001 ? 1 : 0) * (1 - smooth(0.445, 0.47, p));
    beamIn.mesh.visible = uIn.uIntensity.value > 0.001;

    // Fissures : trois cassures s'allument (0 → 3), survol d'une objection : 3 → 6 en 200 ms.
    const level = cracks.material.uniforms.uLevel.value;
    const grow = cracks.material.uniforms.uGrow.value;
    const intactHover = p < 0.46;
    for (let k = 0; k < 3; k++) {
      const g = smooth(0.318 + k * 0.012, 0.35 + k * 0.012, p);
      const want = intactHover && (state.objectionHover[k] || crackHover === k) ? 1 : 0;
      hover[k] = clamp01(hover[k] + (want ? dt : -dt) / 0.2);
      const lvl = lerp(3 * g, 6, hover[k]);
      grow.setComponent(k, Math.max(g, hover[k]));
      level.setComponent(k, lvl);
      shared.uCrack.value.setComponent(k, lvl * (1 - e));
    }
    cracks.material.uniforms.uOpacity.value = 1 - smooth(0.445, 0.465, p);
    cracks.mesh.visible = cracks.material.uniforms.uOpacity.value > 0.001 && (p > 0.3 || hover[0] + hover[1] + hover[2] > 0);
    outer.emissiveIntensity = 1 - smooth(0.445, 0.47, p);

    // Reflets : ils s'enfoncent (acte 0), se resserrent (acte 1), se fissurent et tombent (acte 2).
    const gu = ghosts.uniforms;
    gu.uSqueeze.value = 1 - 0.45 * smooth(0.12, 0.28, p);
    gu.uFall.value = smooth(0.292, 0.405, p);
    gu.uStretch.value = 1 + 0.6 * velocitySmooth;
    gu.uTime.value = time;
    gu.uGlobal.value = 1 - smooth(0.41, 0.44, p);
    ghosts.mesh.visible = ghosts.phrasesMesh.visible = gu.uGlobal.value > 0.001;

    // Contre-jour : le rouge remplace le froid en 1,5 s quand ETHER entre.
    redMix = clamp01(redMix + (p > 0.3 ? dt : -dt) / 1.5);
    const dim = 1 - 0.7 * smooth(0.66, 0.7, p) * (1 - smooth(0.88, 0.95, p)); // acte 4 : éclairé à 30 %
    key.intensity = 1.2 * dim;
    rimCold.intensity = 0.6 * (1 - redMix);
    rimRed.intensity = 2.5 * redMix * dim;
    scene.environmentIntensity = 0.35 * dim;

    // Acte 3 : anneaux. L'anneau de l'étape active s'illumine (0,4 → 2).
    const ringIn = smooth(0.468, 0.515, p);
    const toCloud = smooth(0.655, 0.705, p);
    const converge = smooth(0.8, 0.885, p);
    const toLogo = smooth(0.895, 0.965, p);
    const ringSpin = time * 0.06;
    const tu = beamTunnel.material.uniforms;
    for (let k = 0; k < 5; k++) {
      const on = smooth(RING_P[k] - 0.01, RING_P[k] + 0.002, p);
      const off = k < 4 ? smooth(RING_P[k + 1] - 0.01, RING_P[k + 1] + 0.002, p) : smooth(0.655, 0.67, p);
      lit[k] = on * (1 - off);
      tu.uRingOn.value[k] = on;
    }
    // Le rayon traverse le tunnel en diagonale et rejoint l'axe au loin.
    tu.uA.value.set(-0.55, -0.5, 4);
    tu.uB.value.set(0, 0, -40);
    tu.uIntensity.value = smooth(0.475, 0.515, p) * (1 - 0.85 * smooth(0.655, 0.7, p)) * (1 - smooth(0.78, 0.84, p));
    beamTunnel.mesh.visible = tu.uIntensity.value > 0.001;

    // Acte 6 : le logo se reconstruit, chaque couche tourne à la vitesse de l'appli.
    const spinOn = smooth(0.955, 0.99, p);
    for (let k = 0; k < 5; k++) {
      const l = LOGO_LAYERS[k];
      layerAngle[k] -= l.dir * ((Math.PI * 2) / l.period) * dt * spinOn;
    }
    const ou = beamOut.material.uniforms;
    const out = easeOut(smooth(0.95, 0.998, p));
    ou.uA.value.set(0, 0, 0.05);
    ou.uB.value.set(lerp(0, 16, out), 0, 0.05);
    ou.uIntensity.value = out > 0.001 ? 0.9 : 0;
    beamOut.mesh.visible = ou.uIntensity.value > 0;

    if (glow) {
      const hot = enter * (1 - e) * (0.45 + 0.1 * (hover[0] + hover[1] + hover[2]));
      glow.position.copy(impact);
      if (toLogo > 0.5) glow.position.set(0, 0, 0.1);
      glow.material.opacity = Math.max(hot, 0.22 * toLogo);
      glow.visible = glow.material.opacity > 0.001;
    }
    trails.uniforms.get('uStrength').value = 0.012 * velocitySmooth;

    const explodeFlash = 1.5 * smooth(0.445, 0.46, p) * (1 - smooth(0.47, 0.505, p));
    // Anneaux plus étroits en portrait : le champ horizontal y est réduit.
    const ringScale = portrait ? 0.62 : 1;
    const ringShard = portrait ? 0.7 : 0.8;

    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      // Intact.
      _v1.copy(s.center).applyQuaternion(prismQuat).add(prismPos);
      _q1.copy(prismQuat);
      _s1.set(1, 1, 1);
      // Éclatement : chaque éclat part le long de la direction de son centre.
      if (e > 0) {
        _v2.copy(s.dir).applyQuaternion(prismQuat).multiplyScalar((1.8 + s.rand * 0.4) * e);
        _v1.add(_v2);
        _q2.setFromAxisAngle(s.axis, s.spin * e);
        _q1.multiply(_q2);
      }
      // Anneaux pentagonaux espacés sur Z : les cinq lentilles.
      if (ringIn > 0) {
        const k = s.layer;
        const r = ((RING_RADIUS * LOGO_LAYERS[k].r) / 84) * ringScale;
        const a = s.slotAngle + (k % 2 ? -ringSpin : ringSpin);
        _v2.set(Math.cos(a) * r, Math.sin(a) * r, RING_Z[k]);
        _q2.setFromAxisAngle(Z, a - s.homeAngle);
        const w = easeInOut(clamp01((ringIn - s.rand * 0.3) / 0.7));
        _v1.lerp(_v2, w);
        _q1.slerp(_q2, w);
        _s2.setScalar(ringShard);
        _s1.lerp(_s2, w);
      }
      // Acte 4 : nuage lent autour de l'axe.
      if (toCloud > 0) {
        const c = s.cloud;
        const a = c.a + time * c.speed;
        _v2.set(Math.cos(a) * c.r, c.y + Math.sin(time * 0.3 + c.a) * 0.15, c.z);
        _q2.setFromAxisAngle(s.axis, time * 0.12 + s.spin);
        const w = easeInOut(toCloud);
        _v1.lerp(_v2, w);
        _q1.slerp(_q2, w);
      }
      // Logo : place sur le contour de sa couche, qui tourne.
      const la = layerAngle[s.layer] + s.slotAngle;
      const lr = Math.hypot(s.logo.x, s.logo.y) * LOGO_RADIUS;
      // Acte 5 : convergence vers le centre.
      if (converge > 0) {
        _v2.set(Math.cos(la) * lr * 0.3, Math.sin(la) * lr * 0.3, -0.6 - s.rand * 0.6);
        _q2.setFromAxisAngle(s.axis, s.spin * 0.5);
        const w = easeInOut(converge) * 0.85;
        _v1.lerp(_v2, w);
        _q1.slerp(_q2, w);
      }
      if (toLogo > 0) {
        _v2.set(Math.cos(la) * lr, Math.sin(la) * lr, -0.05 * s.layer);
        _q2.setFromAxisAngle(Z, layerAngle[s.layer] + s.edgeAngle);
        const w = easeInOut(clamp01((toLogo - s.layer * 0.07) / 0.72));
        _v1.lerp(_v2, w);
        _q1.slerp(_q2, w);
        _s1.lerp(DASH, w);
      }
      s.group.position.copy(_v1);
      s.group.quaternion.copy(_q1);
      s.group.scale.copy(_s1);

      // Cassures : éclair à l'éclatement, anneaux à 0,4 (2 si étape active),
      // nuage à 30 %, réparations visibles sur le logo (0,6).
      const ringGlow = (0.4 + 1.6 * lit[s.layer]) * ringIn * (1 - toCloud);
      s.inner.userData.base.value = explodeFlash + ringGlow + 0.08 * toCloud * (1 - toLogo) + 0.6 * toLogo;
    }
  }

  // ---------------------------------------------------------- interactions

  function onPointerMove(ev) {
    if (!fine.matches) return;
    pointer.set((ev.clientX / window.innerWidth) * 2 - 1, -((ev.clientY / window.innerHeight) * 2 - 1));
    ndc.copy(pointer);
    pointerMoved = true;
  }

  function pickCrack(p) {
    if (!fine.matches || p < 0.33 || p > 0.45) {
      if (crackHover !== -1) {
        crackHover = -1;
        emit('crack', -1);
      }
      return;
    }
    if (!pointerMoved) return;
    pointerMoved = false;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(cracks.hits, false)[0];
    const next = hit ? hit.object.userData.crack : -1;
    if (next !== crackHover) {
      crackHover = next;
      emit('crack', next);
    }
  }

  // ---------------------------------------------------------- boucle

  let running = false;
  let lastScroll = scroll;
  let lastNow = -1;

  function frame(now) {
    const dt = lastNow < 0 ? 0 : Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;
    time += dt;
    const target = scrollSource ? scrollSource() : window.scrollY;
    if (!scrollSource) scroll += (target - scroll) * (1 - Math.exp(-dt * 6));
    else scroll = target;
    const velocity = dt > 0 ? (scroll - lastScroll) / dt : 0;
    lastScroll = scroll;
    velocitySmooth += (Math.min(1, Math.abs(velocity) / 3000) - velocitySmooth) * (1 - Math.exp(-dt * 8));
    const p = forcedProgress ?? progressAt(scroll);
    state.sceneProgress = p;
    state.velocity = velocitySmooth;
    const k = 1 - (1 - 0.06) ** (dt * 60);
    pointerSmooth.x += (pointer.x - pointerSmooth.x) * k;
    pointerSmooth.y += (pointer.y - pointerSmooth.y) * k;
    placeCamera(p);
    update(p, dt);
    pickCrack(p);
    composer.render(dt);
  }

  function start() {
    if (running || document.hidden) return;
    running = true;
    lastNow = -1;
    renderer.setAnimationLoop(frame);
  }
  function stop() {
    running = false;
    renderer.setAnimationLoop(null);
  }
  const onVisibility = () => (document.hidden ? stop() : start());
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  };
  const ro = new ResizeObserver(() => measure());
  ro.observe(document.body);

  const onContextLost = (ev) => {
    ev.preventDefault();
    stop();
    onFallback?.('contextlost');
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  resize();
  document.fonts?.ready.then(measure);
  placeCamera(forcedProgress ?? progressAt(window.scrollY));
  update(forcedProgress ?? 0, 0);
  await renderer.compileAsync(scene, camera);
  composer.render(0);
  canvas.classList.add('is-ready');
  start();

  function destroy() {
    stop();
    ro.disconnect();
    clearTimeout(resizeTimer);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointerMove);
    const seen = new Set();
    scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) {
        seen.add(o.geometry);
        o.geometry.dispose();
      }
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (seen.has(m)) continue;
        seen.add(m);
        m.dispose();
      }
    });
    for (const g of ghosts.geometries) g.dispose();
    textTexture.dispose();
    atlas.texture.dispose();
    glow?.material.map.dispose();
    envTarget.dispose();
    composer.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return {
    destroy,
    measure,
    setScrollSource(fn) {
      scrollSource = fn;
    },
    // Pour les scripts de capture (poster, vérifications) : une progression fixe.
    setProgress(p) {
      forcedProgress = p;
    },
    debug: import.meta.env.DEV ? { scene, camera, renderer, composer, beamIn, beamTunnel, cracks, shards, state } : undefined,
  };
}
