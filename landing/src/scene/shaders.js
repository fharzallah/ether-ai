// GLSL de la scène. Les matériaux du prisme restent ceux de three.js
// (MeshPhysicalMaterial / MeshStandardMaterial) ; seuls les reflets, les phrases
// flatteuses, le rayon et les fissures ont leurs propres shaders.

// Position d'un reflet dans le couloir : décalage latéral resserré, étirement en
// profondeur selon la vitesse, chute et rotation quand ETHER entre (acte 2).
const ghostCommon = /* glsl */ `
  attribute float aSide;
  attribute float aDepth;
  attribute float aOrder;
  attribute vec3 aRot;
  uniform float uSpread;
  uniform float uSqueeze;
  uniform float uStretch;
  uniform float uFall;
  uniform float uTime;

  mat3 rotXYZ(vec3 r) {
    float cx = cos(r.x), sx = sin(r.x), cy = cos(r.y), sy = sin(r.y), cz = cos(r.z), sz = sin(r.z);
    mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, cx, sx, 0.0, -sx, cx);
    mat3 ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 rz = mat3(cz, sz, 0.0, -sz, cz, 0.0, 0.0, 0.0, 1.0);
    return rz * ry * rx;
  }

  // 0 → 1 : la fissure rouge traverse le reflet, puis il tombe et s'éteint.
  float fallOf(float order) { return clamp((uFall - order * 0.6) / 0.4, 0.0, 1.0); }

  vec3 ghostOffset(float fall) {
    return vec3(aSide * uSpread * uSqueeze, -2.0 * fall * fall + sin(uTime * 0.4 + aDepth) * 0.04, aDepth * uStretch);
  }
`;

export const ghostVertex = /* glsl */ `
  ${ghostCommon}
  attribute float aOpacity;
  varying float vAlpha;
  varying float vCrack;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying vec2 vLocal;
  #include <fog_pars_vertex>

  void main() {
    float fall = fallOf(aOrder);
    float crack = clamp((uFall * 1.7 - aOrder * 0.6) / 0.3, 0.0, 1.0);
    mat3 rot = rotXYZ(aRot + vec3(fall * 0.7, uTime * 0.03 * aSide, fall * 0.5 * aSide));
    vec3 p = rot * (position * vec3(1.0, 1.0, uStretch)) + ghostOffset(fall);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vNormalV = normalize(normalMatrix * (rot * normal));
    vViewPos = mvPosition.xyz;
    vLocal = position.xy;
    vAlpha = aOpacity * (1.0 - smoothstep(0.15, 1.0, fall));
    vCrack = crack * (1.0 - smoothstep(0.1, 0.6, fall));
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

export const ghostFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRed;
  uniform float uGlobal;
  varying float vAlpha;
  varying float vCrack;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying vec2 vLocal;
  #include <fog_pars_fragment>

  void main() {
    vec3 n = normalize(vNormalV);
    vec3 v = normalize(-vViewPos);
    float fres = pow(1.0 - abs(dot(n, v)), 2.2);
    float alpha = vAlpha * (0.28 + 0.72 * fres) * uGlobal;
    // Un mince trait rouge traverse le reflet avant qu'il tombe.
    float d = abs(dot(vLocal, normalize(vec2(0.78, -0.62))) - 0.06);
    float line = smoothstep(0.022, 0.0, d) * vCrack;
    vec3 color = mix(uColor, uRed, line);
    gl_FragColor = vec4(color, max(alpha, line * 0.95 * uGlobal));
    #include <fog_fragment>
  }
`;

// Phrases flatteuses : un rectangle face caméra, qui flotte devant son reflet.
export const phraseVertex = /* glsl */ `
  ${ghostCommon}
  attribute float aRow;
  attribute vec2 aSize;
  attribute float aWidth;
  uniform float uRows;
  varying vec2 vUv;
  varying float vAlpha;
  #include <fog_pars_vertex>

  void main() {
    float fall = fallOf(aOrder);
    vec3 anchor = ghostOffset(fall) + vec3(0.0, 0.08, 0.45);
    vec3 p = anchor + vec3(position.xy * aSize, 0.0);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vUv = vec2(uv.x * aWidth, (uv.y + (uRows - 1.0 - aRow)) / uRows);
    vAlpha = 1.0 - smoothstep(0.0, 0.6, fall);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

export const phraseFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uGlobal;
  varying vec2 vUv;
  varying float vAlpha;
  #include <fog_pars_fragment>

  void main() {
    vec4 t = texture2D(uMap, vUv);
    gl_FragColor = vec4(t.rgb, t.a * vAlpha * uGlobal);
    #include <fog_fragment>
  }
`;

// Profil commun d'une ligne lumineuse : cœur blanc rosé, halo rouge.
const glowProfile = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uHalo;
  float coreOf(float d, float ratio) { return smoothstep(ratio, ratio * 0.35, d); }
  float haloOf(float d) { return exp(-d * d * 5.0) * (1.0 - smoothstep(0.75, 1.0, d)); }
`;

// Le rayon : un ruban toujours tourné vers la caméra entre uA et uB.
export const beamVertex = /* glsl */ `
  attribute float aT;
  attribute float aSide;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform float uHalfWidth;
  uniform float uRingZ[5];
  uniform float uRingOn[5];
  varying float vSide;
  varying float vT;
  varying float vNarrow;

  void main() {
    vec3 p = mix(uA, uB, aT);
    vec3 dir = normalize(uB - uA);
    vec3 toCam = normalize(cameraPosition - p);
    vec3 side = cross(dir, toCam);
    float l = length(side);
    side = l > 1e-4 ? side / l : vec3(0.0, 1.0, 0.0);
    // Après chaque anneau traversé, le rayon devient plus fin et plus précis.
    float narrow = 1.0;
    for (int i = 0; i < 5; i++) {
      if (p.z < uRingZ[i]) narrow *= mix(1.0, 0.74, uRingOn[i]);
    }
    vNarrow = narrow;
    vSide = aSide;
    vT = aT;
    gl_Position = projectionMatrix * viewMatrix * vec4(p + side * aSide * uHalfWidth * narrow, 1.0);
  }
`;

export const beamFragment = /* glsl */ `
  ${glowProfile}
  uniform float uIntensity;
  uniform float uCoreRatio;
  uniform float uFadeEnds;
  varying float vSide;
  varying float vT;
  varying float vNarrow;

  void main() {
    float d = abs(vSide);
    float ends = smoothstep(0.0, uFadeEnds, vT) * smoothstep(1.0, 1.0 - uFadeEnds, vT);
    float core = coreOf(d, uCoreRatio / max(vNarrow, 0.2));
    float halo = haloOf(d);
    vec3 color = uCore * core * 1.6 + uHalo * halo * 0.85;
    gl_FragColor = vec4(color * uIntensity * ends, 1.0);
  }
`;

// Fissures : rubans posés sur la face avant du prisme, qui avancent depuis le
// point d'impact (aLen) et s'allument une par une (uGrow, uLevel).
export const crackVertex = /* glsl */ `
  attribute float aSide;
  attribute float aCrack;
  attribute float aLen;
  varying float vSide;
  varying float vCrack;
  varying float vLen;

  void main() {
    vSide = aSide;
    vCrack = aCrack;
    vLen = aLen;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const crackFragment = /* glsl */ `
  ${glowProfile}
  uniform vec3 uLevel;
  uniform vec3 uGrow;
  uniform float uOpacity;
  varying float vSide;
  varying float vCrack;
  varying float vLen;

  void main() {
    float level = vCrack < 0.5 ? uLevel.x : (vCrack < 1.5 ? uLevel.y : uLevel.z);
    float grow = vCrack < 0.5 ? uGrow.x : (vCrack < 1.5 ? uGrow.y : uGrow.z);
    float shown = smoothstep(grow, grow - 0.04, vLen);
    float d = abs(vSide);
    // Niveau 3 : fissure allumée ; niveau 6 : fissure survolée, plus vive.
    float k = level / 3.0;
    vec3 color = uCore * coreOf(d, 0.3) * (0.55 + 0.45 * k) + uHalo * haloOf(d) * 0.9;
    gl_FragColor = vec4(color * k * shown * uOpacity, 1.0);
  }
`;
