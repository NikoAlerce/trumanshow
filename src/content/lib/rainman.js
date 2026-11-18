// BOTTOM face — the rain that only falls on Truman.
// A sunny afternoon on Seahaven's beach. Out of a clear sky, a shower falls on
// Truman and on nobody else. He steps away: it follows him, a beat late, like
// a follow-spot looking for its actor. He dashes back: it follows again. Then
// somebody up there gives up and opens it over the whole beach. His clothes soak
// and drip, a puddle forms, the waves keep running up the sand; when the sun is
// back he shakes himself off and stares straight at us, the hidden camera.
import { createFaceFrame } from './faceframe.js';
import { paintBirdStrip, makeBird, setBirdFrame, makeVignette } from './cards.js';

const S = 4.0;                    // Truman's scale here (~0.48 tall)
const GROUND = -0.40;
const SHORE_Z = -2.25;            // where the sand meets the sea
const LOOP = 24;
const R_COL = 0.075;              // radius of the column of rain
const WET_SPOTS = 12;

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const ramp = (t, a, b) => smooth(clamp01((t - a) / (b - a)));
const lerp = (a, b, k) => a + (b - a) * k;
const lerpAngle = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function canvasTex(THREE, w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- rain streaks (vertex-animated quads)
const STREAK_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uCenter;      // column centre (x, z); global rain: area centre
  uniform vec2 uSize;        // column: (radius, 0); global: half extents (x, z)
  uniform float uTop;
  uniform float uAmount;
  uniform float uDisc;
  uniform float uWidth;
  uniform float uWind;
  attribute vec4 aSeed;
  attribute vec2 aCorner;
  varying float vSide;
  varying float vAlong;
  varying float vFade;
  void main() {
    float H = uTop - ${GROUND.toFixed(3)};
    vec3 base;
    if (uDisc > 0.5) {
      float r = uSize.x * sqrt(aSeed.x), a = aSeed.y * 6.2831853;
      base = vec3(uCenter.x + r * cos(a), 0.0, uCenter.y + r * sin(a));
    } else {
      base = vec3(uCenter.x + (aSeed.x * 2.0 - 1.0) * uSize.x, 0.0, min(-0.01, uCenter.y + (aSeed.y * 2.0 - 1.0) * uSize.y));
    }
    float fall = fract(aSeed.z + uTime * (2.2 + aSeed.w * 0.8) / H);
    base.y = ${GROUND.toFixed(3)} + H * (1.0 - fall);
    vec3 dir = normalize(vec3(0.06 + uWind, -1.0, 0.02));
    float len = 0.032 + 0.02 * aSeed.w;
    vec3 p0 = (modelViewMatrix * vec4(base, 1.0)).xyz;
    vec3 p1 = (modelViewMatrix * vec4(base + dir * len, 1.0)).xyz;
    vec3 D = normalize(p1 - p0);
    vec3 Sd = normalize(cross(D, vec3(0.0, 0.0, 1.0))) * uWidth;
    vec3 pos = mix(p0, p1, aCorner.y) + Sd * (aCorner.x * 2.0 - 1.0);
    vSide = aCorner.x * 2.0 - 1.0;
    vAlong = aCorner.y;
    // fewer drops when the amount is low; fade out near the top
    vFade = step(aSeed.w, uAmount) * (1.0 - smoothstep(H * 0.75, H, H * (1.0 - fall)));
    gl_Position = projectionMatrix * vec4(pos, 1.0);
  }`;
const STREAK_FRAG = /* glsl */ `
  uniform float uBright;
  uniform float uNormal;
  varying float vSide;
  varying float vAlong;
  varying float vFade;
  void main() {
    float a = (1.0 - abs(vSide)) * (0.2 + 0.8 * vAlong) * vFade * uBright;
    vec3 c = vec3(0.82, 0.88, 0.95);
    // the column is drawn over the sun-lit sky: a touch of grey makes it read
    gl_FragColor = uNormal > 0.5 ? vec4(vec3(0.7, 0.78, 0.88), a * 0.85) : vec4(c * a, a);
  }`;

// little splashes on the sand
const SPLASH_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2 uCenter;
  uniform vec2 uSize;
  uniform float uDisc;
  uniform float uAmount;
  attribute vec3 aSeed;
  varying float vA;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float rate = 2.5 + aSeed.z * 2.0;
    float cyc = uTime * rate + aSeed.x * 17.0;
    float id = floor(cyc);
    float ph = fract(cyc);
    float u = hash(id * 1.37 + aSeed.y * 91.0), v = hash(id * 2.11 + aSeed.x * 53.0);
    vec3 p;
    if (uDisc > 0.5) { float r = uSize.x * sqrt(u), a = v * 6.2831853; p = vec3(uCenter.x + r * cos(a), 0.0, uCenter.y + r * sin(a)); }
    else p = vec3(uCenter.x + (u * 2.0 - 1.0) * uSize.x, 0.0, min(-0.01, uCenter.y + (v * 2.0 - 1.0) * uSize.y));
    p.y = ${(GROUND + 0.002).toFixed(4)} + ph * 0.008;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vA = (1.0 - ph) * step(aSeed.z, uAmount);
    gl_PointSize = (2.5 + 7.0 * ph) * 3.2 / max(0.5, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const SPLASH_FRAG = /* glsl */ `
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float ring = smoothstep(0.5, 0.35, r) * smoothstep(0.15, 0.3, r);
    float a = ring * vA * 0.7;
    gl_FragColor = vec4(vec3(0.9, 0.94, 1.0) * a, a);
  }`;

export function createRainOnTruman(THREE, { root, skyTex, noiseTex, uniforms, trumanArmature, trumanClip, makeRig }) {
  const ff = createFaceFrame(THREE, { root, face: 'bottom', name: 'RainOnTruman' });
  const { world, frame } = ff;
  const rnd = rng(77);
  const add = (geo, mat, x, y, z, parent = frame) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const std = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, envMapIntensity: 0.6, ...extra });

  // ---------------------------------------------------------------- shared state
  const U = {
    uTime: uniforms.uTime,
    uWet: { value: Array.from({ length: WET_SPOTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uWetAll: { value: 0 },
    uDim: { value: 1 },
    uWind: { value: 0.05 },
  };

  // ---------------------------------------------------------------- sand (gets wet where the rain falls)
  const sandTex = canvasTex(THREE, 512, 512, (g, w, h) => {
    g.fillStyle = '#d9c39a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) {
      const v = rnd();
      g.fillStyle = v < 0.5 ? `rgba(170,140,95,${0.1 + rnd() * 0.14})` : `rgba(250,238,210,${0.08 + rnd() * 0.14})`;   // fine grains, gently
      g.fillRect(rnd() * w, rnd() * h, 1.1, 1.1);
    }
    // wind ripples
    for (let y = 0; y < h; y += 32) {               // a few long, soft, wavy ridges
      g.strokeStyle = 'rgba(150,120,80,0.045)'; g.lineWidth = 3;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.0245 + y * 0.7) * 7 + Math.sin(x * 0.061 + y) * 2);
      g.stroke();
    }
  });
  sandTex.repeat.set(8, 8);
  const sandMat = std(0xffffff, 0.95, { map: sandTex, bumpMap: sandTex, bumpScale: 0.1 });
  sandMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = U.uWet;
    sh.uniforms.uWetAll = U.uWetAll;
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSandXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSandXZ = position.xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec4 uWet[${WET_SPOTS}];
        uniform float uWetAll;
        uniform float uTime;
        varying vec2 vSandXZ;
        float sandWet() {
          float w = uWetAll;
          for (int i = 0; i < ${WET_SPOTS}; i++) {
            float d = length(vSandXZ - uWet[i].xy);
            w = max(w, uWet[i].z * (1.0 - smoothstep(${(R_COL * 0.7).toFixed(4)}, ${(R_COL * 1.35).toFixed(4)}, d)));
          }
          w = max(w, smoothstep(${(SHORE_Z + 0.4).toFixed(3)}, ${(SHORE_Z + 0.05).toFixed(3)}, vSandXZ.y) * 0.85);
          return clamp(w, 0.0, 1.0);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float wetK = sandWet();
        // the wash of each wave runs up the sand and slides back
        float cycS = fract(uTime / 6.0);
        float runUp = ${(SHORE_Z - 0.42).toFixed(3)} + 0.3 * pow(sin(3.14159 * clamp(cycS * 1.25, 0.0, 1.0)), 1.6);
        float wobS = sin(vSandXZ.x * 3.1 + uTime * 0.7) * 0.02;
        float washK = smoothstep(runUp + wobS + 0.004, runUp + wobS - 0.03, vSandXZ.y);
        float foamS = smoothstep(0.026, 0.0, abs(vSandXZ.y - runUp - wobS));
        wetK = max(wetK, washK * 0.9);
        diffuseColor.rgb *= mix(1.0, 0.52, wetK);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.52, 0.57), washK * 0.38);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 0.98), foamS * 0.85);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.32, wetK);`);
  };
  sandMat.customProgramCacheKey = () => 'wet-sand';
  const sandGeo = new THREE.PlaneGeometry(14, -SHORE_Z + 0.4, 1, 1);
  sandGeo.rotateX(-Math.PI / 2);
  sandGeo.translate(0, 0, (SHORE_Z - 0.4) / 2);
  // stop it at z = 0 (nothing in front of the window)
  const sp = sandGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, Math.min(0, sp.getZ(i)));
  add(sandGeo, sandMat, 0, GROUND, 0).castShadow = false;
  const bankTex = canvasTex(THREE, 512, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#cdb486'); grd.addColorStop(0.18, '#b89c6c'); grd.addColorStop(0.55, '#9d8158'); grd.addColorStop(1, '#6d5a40');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {   // layers
      g.strokeStyle = `rgba(${90 + rnd() * 60},${70 + rnd() * 50},${40 + rnd() * 30},0.35)`; g.lineWidth = 2 + rnd() * 3;
      const y0 = 30 + i * 24 + rnd() * 8;
      g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.02 + i) * 4); g.stroke();
    }
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${150 + rnd() * 80},${140 + rnd() * 70},${120 + rnd() * 60},0.8)`; g.beginPath(); g.ellipse(rnd() * w, 40 + rnd() * (h - 40), 1 + rnd() * 3, 1 + rnd() * 2, rnd() * 3, 0, 6.3); g.fill(); }
    for (let i = 0; i < 6; i++) {   // a few shells
      const x = rnd() * w, y = 60 + rnd() * (h - 80);
      g.fillStyle = 'rgba(245,235,220,0.9)'; g.beginPath(); g.arc(x, y, 4 + rnd() * 3, Math.PI, 0); g.fill();
    }
  });
  bankTex.repeat.set(4, 1);
  const bank = add(new THREE.PlaneGeometry(14, 0.6), std(0xffffff, 0.95, { map: bankTex }), 0, GROUND - 0.3, -0.0015);
  bank.castShadow = false;

  // ---------------------------------------------------------------- the sea (the dome's bay)
  const seaMat = new THREE.ShaderMaterial({
    name: 'BeachSea',
    uniforms: { uTime: uniforms.uTime, uNoise: { value: noiseTex }, uSky: { value: skyTex }, uDim: U.uDim },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec2 vP;
      void main() { vP = position.xz; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform sampler2D uNoise; uniform sampler2D uSky; uniform float uDim;
      varying vec3 vW; varying vec2 vP;
      void main() {
        float far = clamp(-(vP.y - ${SHORE_Z.toFixed(2)}) / 14.0, 0.0, 1.0);
        vec2 q = vP * vec2(1.0, 2.2);
        float n1 = texture2D(uNoise, q * 0.9 + vec2(uTime * 0.02, uTime * 0.03)).r;
        float n2 = texture2D(uNoise, q * 2.7 - vec2(uTime * 0.03, -uTime * 0.05)).r;
        float n = n1 * 0.6 + n2 * 0.4;
        vec3 shallow = vec3(0.16, 0.62, 0.66), deep = vec3(0.05, 0.25, 0.42);
        vec3 col = mix(shallow, deep, smoothstep(0.0, 0.35, far));
        // the painted sky in the water, more towards the horizon
        vec3 sky = texture2D(uSky, vec2(vP.x * 0.03 + 0.5, 0.25)).rgb;
        col = mix(col, sky * 0.9, 0.25 + 0.4 * far);
        // sun glitter
        vec2 sunD = normalize(vec2(0.866, -0.5));
        float along = dot(vP, sunD), across = dot(vP, vec2(-sunD.y, sunD.x));
        float path = exp(-pow(across / max(along, 0.5) * 2.2, 2.0));
        float g = smoothstep(0.76, 0.95, n2 * 0.6 + n1 * 0.5) * (0.4 + 0.6 * far) * (0.3 + 1.7 * path);
        col += vec3(1.0, 0.9, 0.72) * g * 1.5 * uDim;
        // swells rolling in, whitening as they reach the beach
        for (int k = 0; k < 3; k++) {
          float ph = fract(uTime / 6.0 + float(k) / 3.0);
          float bz = ${(SHORE_Z - 3.2).toFixed(2)} + 2.8 * ph;
          float wob = (n1 - 0.5) * 0.08 + sin(vP.x * 2.3 + float(k) * 2.0) * 0.03;
          float crest = smoothstep(0.05 + 0.05 * ph, 0.0, abs(vP.y - bz - wob)) * smoothstep(0.0, 0.3, ph) * (0.25 + 0.75 * ph);
          col = mix(col, vec3(0.93, 0.96, 0.97), clamp(crest * (0.4 + 0.6 * n2), 0.0, 1.0) * 0.8);
        }
        // the wash on the shore
        float wash = ${SHORE_Z.toFixed(2)} - 0.05 + 0.04 * sin(uTime * 0.9) + (n1 - 0.5) * 0.05;
        float foam = smoothstep(0.06, 0.0, abs(vP.y - wash)) * 0.9 + smoothstep(0.25, 0.0, vP.y - (wash - 0.25)) * 0.12;
        col = mix(col, vec3(0.95, 0.97, 0.98), clamp(foam, 0.0, 1.0));
        col *= uDim;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const seaGeo = new THREE.PlaneGeometry(40, 20, 1, 1);
  seaGeo.rotateX(-Math.PI / 2);
  seaGeo.translate(0, 0, SHORE_Z + 0.15 - 10);
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.position.y = GROUND - 0.006;
  frame.add(sea);

  // ---------------------------------------------------------------- the painted sky of the dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(24, 48, 24), new THREE.ShaderMaterial({
    name: 'BeachSky', side: THREE.BackSide, depthWrite: false,
    uniforms: { uSky: { value: skyTex }, uDim: U.uDim },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uSky; uniform float uDim; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float v = clamp(d.y * 1.6 + 0.02, 0.002, 0.995);
        vec3 c = texture2D(uSky, vec2(atan(d.x, -d.z) / 6.2831853 * 4.0 + 0.35, v)).rgb * 1.08;
        c = mix(c, vec3(0.8, 0.86, 0.9), smoothstep(0.03, -0.05, d.y));
        float hgt = clamp(d.y, 0.0, 1.0);
        c *= mix(vec3(1.07, 0.99, 0.88), vec3(0.76, 0.86, 1.06), smoothstep(0.02, 0.5, hgt));
        c += vec3(0.38, 0.23, 0.1) * pow(max(dot(d, normalize(vec3(0.866, 0.387, -0.5))), 0.0), 4.0) * (1.0 - smoothstep(0.1, 0.6, hgt));
        // the downpour turns it grey
        float l = dot(c, vec3(0.3, 0.55, 0.15));
        c = mix(vec3(l) * vec3(0.78, 0.82, 0.88), c, uDim) * mix(0.62, 1.0, uDim);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  }));
  sky.position.set(0, GROUND, -6);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  frame.add(sky);

  // ---------------------------------------------------------------- beach props
  // umbrella and towel
  const stripes = (a, b, n) => canvasTex(THREE, 256, 64, (g, w, h) => {
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * w / n, 0, w / n + 1, h); }
  }, false);
  const umb = new THREE.Group();
  umb.position.set(-0.66, GROUND, -1.05);
  umb.rotation.z = 0.22;
  frame.add(umb);
  add(new THREE.CylinderGeometry(0.004, 0.004, 0.42, 8), std(0xf4f1ea, 0.4), 0, 0.21, 0, umb);
  const canopy = add(new THREE.ConeGeometry(0.25, 0.085, 24, 1, true), std(0xffffff, 0.75, { map: stripes('#d8433b', '#f6f1e6', 16), side: THREE.DoubleSide }), 0, 0.41, 0, umb);
  canopy.castShadow = true;
  const towelTex = canvasTex(THREE, 256, 512, (g, w, h) => {
    const rr = rng(31);
    g.fillStyle = '#ece3d0'; g.fillRect(0, 0, w, h);
    [[0.08, 0.16, '#2c66a2'], [0.185, 0.205, '#e3a13e'], [0.23, 0.31, '#2c66a2'], [0.42, 0.58, '#c4463b'], [0.69, 0.77, '#2c66a2'], [0.795, 0.815, '#e3a13e'], [0.84, 0.92, '#2c66a2']]
      .forEach(([a, b, col]) => { g.fillStyle = col; g.fillRect(0, a * h, w, (b - a) * h); });
    for (let i = 0; i < 30000; i++) {            // the terry loops
      g.fillStyle = rr() < 0.5 ? `rgba(255,255,255,${0.05 + rr() * 0.09})` : `rgba(0,0,0,${0.04 + rr() * 0.08})`;
      g.fillRect(rr() * w, rr() * h, 1.2 + rr(), 1.2 + rr());
    }
    const fade = g.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.5, h * 0.6);
    fade.addColorStop(0, 'rgba(255,248,232,0.2)'); fade.addColorStop(1, 'rgba(255,248,232,0)');
    g.fillStyle = fade; g.fillRect(0, 0, w, h);    // bleached by the sun
    for (let i = 0; i < 1200; i++) {              // sand on it, mostly at the edges
      const ex = rr() < 0.5, e = rr() < 0.5 ? rr() * 0.14 : 1 - rr() * 0.14;
      g.fillStyle = `rgba(${200 + rr() * 30},${168 + rr() * 30},${118 + rr() * 30},0.85)`;
      g.fillRect(ex ? e * w : rr() * w, ex ? rr() * h : e * h, 1.6, 1.6);
    }
    g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);   // hems
    g.clearRect(0, 0, w, 16); g.clearRect(0, h - 16, w, 16);
    g.strokeStyle = '#efe6d4'; g.lineWidth = 2.2;  // fringes
    for (let x = 4; x < w; x += 7) {
      g.beginPath(); g.moveTo(x, 16); g.lineTo(x + (rr() - 0.5) * 4, 4 + rr() * 5); g.stroke();
      g.beginPath(); g.moveTo(x, h - 16); g.lineTo(x + (rr() - 0.5) * 4, h - 4 - rr() * 5); g.stroke();
    }
  }, false);
  const TW = 0.15, TL = 0.31;
  const towelGeo = new THREE.PlaneGeometry(TW, TL, 30, 60);
  const tPos = towelGeo.attributes.position;
  const towelBase = new Float32Array(tPos.count), towelCorner = new Float32Array(tPos.count);
  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i), y = tPos.getY(i);
    towelBase[i] = 0.0026 + 0.0012 * Math.sin(x * 70 + y * 23) + 0.0010 * Math.sin(y * 55 - x * 30)   // soft ripples, above the sand
      + 0.006 * Math.exp(-Math.pow((y - 0.06 + 0.03 * x) / 0.012, 2));                             // a fold across it
    towelCorner[i] = Math.pow(Math.max(0, 1 - Math.hypot(x - TW / 2, y - TL / 2) / 0.07), 2);     // the corner the breeze lifts
    tPos.setZ(i, towelBase[i] + 0.016 * towelCorner[i]);
  }
  towelGeo.computeVertexNormals();
  const towelMat = std(0xffffff, 1.0, { map: towelTex, bumpMap: towelTex, bumpScale: 1.4, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  const towel = add(towelGeo, towelMat, -0.5, GROUND + 0.0004, -0.82);
  towel.rotation.set(-Math.PI / 2, 0, 0.4);
  // a deck chair
  const chair = new THREE.Group();
  chair.position.set(-0.8, GROUND, -0.95);
  chair.rotation.y = 0.5;
  frame.add(chair);
  const wood = std(0xb88a58, 0.7);
  const seat = add(new THREE.PlaneGeometry(0.075, 0.16), std(0xffffff, 0.8, { map: stripes('#2f8f7a', '#f5efe0', 6), side: THREE.DoubleSide }), 0, 0.06, 0, chair);
  seat.rotation.x = -0.9;
  [[-0.04, 0.045], [0.04, 0.045]].forEach(([x, y]) => add(new THREE.BoxGeometry(0.006, 0.13, 0.006), wood, x, y, 0.0, chair).rotation.x = 0.7);
  // lifeguard tower
  const tower = new THREE.Group();
  tower.position.set(0.86, GROUND, -1.62);
  tower.rotation.y = -0.35;
  frame.add(tower);
  const white = std(0xf6f4ee, 0.55);
  [[-0.09, -0.07], [0.09, -0.07], [-0.09, 0.07], [0.09, 0.07]].forEach(([x, z]) => add(new THREE.CylinderGeometry(0.008, 0.01, 0.3, 8), white, x, 0.15, z, tower));
  add(new THREE.BoxGeometry(0.26, 0.016, 0.2), white, 0, 0.3, 0, tower);
  add(new THREE.BoxGeometry(0.18, 0.13, 0.14), white, 0, 0.375, -0.01, tower);
  add(new THREE.BoxGeometry(0.11, 0.07, 0.003), std(0x223040, 0.15, { metalness: 0.3 }), 0, 0.385, 0.061, tower);
  const roof = add(new THREE.ConeGeometry(0.15, 0.07, 4, 1), std(0x2b6cb0, 0.6), 0, 0.475, -0.01, tower);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.2, 1, 1);
  const ramp_ = add(new THREE.BoxGeometry(0.06, 0.008, 0.36), white, 0.0, 0.15, 0.22, tower);
  ramp_.rotation.x = 0.98;
  const buoy = add(new THREE.TorusGeometry(0.025, 0.009, 8, 20), std(0xe0412f, 0.5), 0.095, 0.37, 0.065, tower);
  buoy.rotation.y = Math.PI / 2;
  // a flag on the tower
  add(new THREE.CylinderGeometry(0.002, 0.002, 0.14, 6), white, -0.08, 0.53, -0.01, tower);
  const flag = add(new THREE.PlaneGeometry(0.05, 0.03, 8, 1), std(0xf2c230, 0.7, { side: THREE.DoubleSide }), -0.055, 0.585, -0.01, tower);
  // the pier, far right
  const pier = new THREE.Group();
  pier.position.set(1.7, GROUND, -2.0);
  frame.add(pier);
  const plank = std(0x9c8061, 0.85);
  add(new THREE.BoxGeometry(0.16, 0.012, 6), plank, 0, 0.09, -3, pier);
  for (let i = 0; i < 16; i++) [-0.07, 0.07].forEach((x) => add(new THREE.CylinderGeometry(0.007, 0.007, 0.13, 6), plank, x, 0.035, -i * 0.38, pier));
  // a sailboat on the horizon
  const boat = new THREE.Group();
  boat.position.set(-3.0, GROUND, -11);
  frame.add(boat);
  add(new THREE.BoxGeometry(0.22, 0.03, 0.06), std(0xf3f0ea, 0.5), 0, 0.01, 0, boat);
  const sailShape = new THREE.Shape(); sailShape.moveTo(0, 0); sailShape.lineTo(0, 0.3); sailShape.lineTo(0.13, 0); sailShape.lineTo(0, 0);
  add(new THREE.ShapeGeometry(sailShape), std(0xfbfaf6, 0.6, { side: THREE.DoubleSide }), -0.03, 0.03, 0, boat);
  // seagulls: painted silhouettes that always face us (never a dash seen edge-on)
  const gullStrip = paintBirdStrip(THREE, 'gull');
  const gulls = [0, 1, 2, 3].map((i) => {
    const b = makeBird(THREE, gullStrip, 0.075 + 0.012 * (i % 2));
    b.userData.d = { ph: i * 2.1, rad: 0.5 + i * 0.22, h: 0.35 + i * 0.1, cz: -2.0 - i * 0.5, cx: -0.3 + i * 0.4, sp: 0.33 + i * 0.06 };
    frame.add(b);
    return b;
  });

  // ---------------------------------------------------------------- light
  const hemi = new THREE.HemisphereLight(0x9bbde8, 0xc9a374, 0.28);
  frame.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc386, 4.4);
  sun.position.set(1.9, GROUND + 0.85, -2.0);       // low, from over the sea on the right: long shadows towards us
  sun.target.position.set(0, GROUND, -0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 0.3, far: 6 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.004;
  frame.add(sun);
  frame.add(sun.target);
  const rim = new THREE.DirectionalLight(0xdfeaff, 0.6);
  rim.position.set(-1.0, 1.1, -2.6);
  rim.target.position.set(0, GROUND, -0.6);
  frame.add(rim, rim.target);
  const bounce = new THREE.DirectionalLight(0xffe2bf, 0.55);     // the sun off the sand, from in front and low
  bounce.position.set(-0.6, GROUND + 0.25, 1.0);
  bounce.target.position.set(0, GROUND + 0.2, -0.6);
  frame.add(bounce, bounce.target);
  // a soft vignette just inside the window, and the haze over the sea (fog, set by world.js)
  const vignette = makeVignette(THREE, { size: 1, strength: 0.4, tint: [0.03, 0.04, 0.06] });
  vignette.mesh.position.z = -0.0006;
  frame.add(vignette.mesh);
  const haze = { color: new THREE.Color(0.62, 0.7, 0.76), near: 0.5, far: 22 };
  const HAZE_CLEAR = new THREE.Color(0.62, 0.7, 0.76), HAZE_RAIN = new THREE.Color(0.38, 0.42, 0.47);
  const SUN_WARM = new THREE.Color(0xffc386), SUN_COLD = new THREE.Color(0xaebdd0);

  // ---------------------------------------------------------------- Truman
  const START_X = -0.16, AWAY_X = 0.24, TZ = -0.6;
  const FACE_VIEW = -Math.PI / 2 + 0.45;      // three-quarters to the viewer
  const rig = makeRig(THREE, { armature: trumanArmature, clip: trumanClip, space: frame, position: new THREE.Vector3(START_X, GROUND, TZ), yaw: FACE_VIEW });
  rig.pivot.scale.setScalar(S);

  // ---------------------------------------------------------------- the rain
  const streaks = (count, seedBase) => {
    const pos = [], seed = [], corner = [], idx = [];
    const r = rng(seedBase);
    for (let i = 0; i < count; i++) {
      const sd = [r(), r(), r(), r()];
      for (let k = 0; k < 4; k++) { pos.push(0, 0, 0); seed.push(...sd); }
      corner.push(0, 0, 1, 0, 0, 1, 1, 1);
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4));
    g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
    g.setIndex(idx);
    return g;
  };
  const mkRain = (count, seed, disc, size, top) => {
    const u = {
      uTime: uniforms.uTime, uCenter: { value: new THREE.Vector2(START_X, TZ) }, uSize: { value: new THREE.Vector2(...size) },
      uTop: { value: top }, uAmount: { value: 0 }, uDisc: { value: disc ? 1 : 0 }, uBright: { value: 1 },
      uWidth: { value: disc ? 0.0012 : 0.0008 }, uNormal: { value: disc ? 1 : 0 }, uWind: U.uWind,
    };
    const m = new THREE.Mesh(streaks(count, seed), new THREE.ShaderMaterial({
      name: disc ? 'RainColumn' : 'RainEverywhere', uniforms: u, vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG,
      transparent: true, depthWrite: false, blending: disc ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false,
    }));
    m.frustumCulled = false;
    m.renderOrder = 4;
    frame.add(m);
    return u;
  };
  const column = mkRain(950, 3, true, [R_COL, 0], 1.25);
  // a soft veil of drizzle round the column, so it reads as a shower
  const veilU = { uTime: uniforms.uTime, uNoise: { value: noiseTex }, uAmount: { value: 0 } };
  const veil = new THREE.Mesh(new THREE.CylinderGeometry(R_COL * 1.15, R_COL * 1.45, 1.6, 28, 1, true), new THREE.ShaderMaterial({
    name: 'RainVeil', uniforms: veilU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; uniform sampler2D uNoise; uniform float uAmount; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float n = texture2D(uNoise, vec2(vUv.x * 3.0, vUv.y * 1.5 + uTime * 0.9)).r;
        float fall = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.55, 0.95, vUv.y));
        float a = (0.06 + 0.1 * edge) * (0.6 + 0.4 * n) * fall * uAmount;
        gl_FragColor = vec4(vec3(0.86, 0.9, 0.96), a);
      }`,
  }));
  veil.position.set(START_X, GROUND + 0.8, TZ);
  veil.renderOrder = 3;
  frame.add(veil);
  const everywhere = mkRain(2600, 5, false, [1.7, 1.6], 1.5);
  everywhere.uCenter.value.set(0, -1.6);
  const mkSplash = (count, seed, disc, size) => {
    const r = rng(seed);
    const pos = new Float32Array(count * 3), sd = [];
    for (let i = 0; i < count; i++) sd.push(r(), r(), r());
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 3));
    const u = { uTime: uniforms.uTime, uCenter: { value: new THREE.Vector2(START_X, TZ) }, uSize: { value: new THREE.Vector2(...size) }, uDisc: { value: disc ? 1 : 0 }, uAmount: { value: 0 } };
    const p = new THREE.Points(g, new THREE.ShaderMaterial({
      name: 'RainSplash', uniforms: u, vertexShader: SPLASH_VERT, fragmentShader: SPLASH_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    p.frustumCulled = false;
    frame.add(p);
    return u;
  };
  const colSplash = mkSplash(60, 8, true, [R_COL * 1.1, 0]);
  const allSplash = mkSplash(700, 9, false, [1.7, 1.2]);
  allSplash.uCenter.value.set(0, -1.2);

  // ---------------------------------------------------------------- wet clothes: this Truman's own materials
  const wetMats = [];
  rig.armature.traverse((o) => {
    if (!o.isMesh) return;
    const one = (m) => { const c = m.clone(); wetMats.push({ m: c, color: c.color.clone(), rough: c.roughness }); return c; };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });

  // ---------------------------------------------------------------- drops off him: splashes under the rain, drips after it
  const mkDrops = (count, { life, vUp, spread, grav, size, alpha }) => {
    const r = rng(count * 13 + 7);
    const sd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { sd[i * 4] = i % 3; sd[i * 4 + 1] = r(); sd[i * 4 + 2] = r(); sd[i * 4 + 3] = r(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
    const u = { uTime: uniforms.uTime, uAmount: { value: 0 }, uA0: { value: new THREE.Vector3() }, uA1: { value: new THREE.Vector3() }, uA2: { value: new THREE.Vector3() } };
    const p = new THREE.Points(g, new THREE.ShaderMaterial({
      name: 'Drops', uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: /* glsl */ `
        uniform float uTime, uAmount; uniform vec3 uA0, uA1, uA2; attribute vec4 aSeed; varying float vA;
        void main() {
          float life = ${life.toFixed(3)};
          float age = fract(uTime / life + aSeed.y);
          float tt = age * life;
          vec3 anc = aSeed.x < 0.5 ? uA0 : (aSeed.x < 1.5 ? uA1 : uA2);
          vec3 v = vec3((aSeed.z - 0.5) * ${spread.toFixed(3)}, ${vUp.toFixed(3)} * (0.6 + 0.8 * aSeed.w), (aSeed.w - 0.5) * ${spread.toFixed(3)});
          vec3 p = anc + vec3(aSeed.z - 0.5, 0.0, aSeed.w - 0.5) * ${(0.02 * S).toFixed(4)} + v * tt - vec3(0.0, ${grav.toFixed(3)}, 0.0) * tt * tt;
          p.y = max(p.y, ${(GROUND + 0.003).toFixed(4)});
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (1.0 - age) * step(aSeed.w * 0.999, uAmount);
          gl_PointSize = ${size.toFixed(1)} / max(0.3, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA * ${alpha.toFixed(3)}; gl_FragColor = vec4(vec3(0.85, 0.92, 1.0) * a, a); }`,
    }));
    p.frustumCulled = false;
    p.renderOrder = 5;
    frame.add(p);
    return u;
  };
  const splashU = mkDrops(96, { life: 0.32, vUp: 0.5, spread: 0.5, grav: 3.2, size: 9, alpha: 0.9 });
  const dripU = mkDrops(30, { life: 0.55, vUp: 0.0, spread: 0.02, grav: 2.4, size: 7, alpha: 0.75 });

  // ---------------------------------------------------------------- a puddle where the shower stands still, and the little cloud's shadow
  const PR = R_COL * 1.3;
  const puddleU = { uTime: uniforms.uTime, uAmount: { value: 0 }, uRain: { value: 0 }, uSky: { value: skyTex } };
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(PR, 48), new THREE.ShaderMaterial({
    name: 'Puddle', uniforms: puddleU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime, uAmount, uRain; uniform sampler2D uSky; varying vec2 vP;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float R = ${PR.toFixed(4)};
        float r = length(vP) / R;
        float ang = atan(vP.y, vP.x);
        float edge = 0.5 + 0.45 * uAmount + 0.07 * sin(ang * 5.0 + 1.3) + 0.05 * sin(ang * 9.0 + 0.4);
        float a = smoothstep(edge, edge - 0.14, r) * smoothstep(0.0, 0.15, uAmount);
        float ring = 0.0;
        for (int i = 0; i < 10; i++) {
          float fi = float(i);
          float t = uTime * 1.9 + fi * 0.37;
          float id = floor(t), age = fract(t);
          vec2 c = (vec2(hash(id * 7.1 + fi), hash(id * 3.7 + fi * 1.3)) - 0.5) * R * 1.1;
          float d = length(vP - c);
          ring += smoothstep(0.0035, 0.0, abs(d - age * R * 0.45)) * (1.0 - age) * uRain;
        }
        vec3 skyC = texture2D(uSky, vec2(0.5 + vP.x * 0.6, 0.72)).rgb;
        vec3 col = mix(vec3(0.2, 0.24, 0.28), skyC, 0.55) + ring * 0.55;
        gl_FragColor = vec4(col, a * 0.82);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  }));
  puddle.rotation.x = -Math.PI / 2;
  puddle.renderOrder = 2;
  frame.add(puddle);
  const shadeTex = canvasTex(THREE, 64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
  const cloudShadow = new THREE.Mesh(new THREE.PlaneGeometry(R_COL * 5, R_COL * 4), new THREE.MeshBasicMaterial({ map: shadeTex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  cloudShadow.rotation.x = -Math.PI / 2;
  cloudShadow.renderOrder = 1;
  frame.add(cloudShadow);

  // ---------------------------------------------------------------- timeline
  // 0 sun · 2.2 a drop on his head: he flinches, touches it · 2.9 looks up, palm out ·
  // 4.4-6.4 he walks off to the right; the shower follows, a beat late · 6.4 sun on
  // him: relief · 6.9 it is on him again: a shrug · 8.4-9.5 he dashes back left; it
  // follows again · 10.1 palm out, looks up · 11.0 it pours on the whole beach: hands
  // over his head, hunched · 16.0 sun again: he shakes himself off, looks up,
  // suspicious · 19.6 he slowly turns and stares straight at us, the hidden camera
  const rainX = (t) => {
    const go = ramp(t, 5.5, 6.9), back = ramp(t, 9.0, 10.3);
    return lerp(lerp(START_X, AWAY_X, go), START_X, back);
  };
  const trumanX = (t) => lerp(lerp(START_X, AWAY_X, ramp(t, 4.9, 6.4)), START_X, ramp(t, 8.45, 9.5));
  const yawAt = (t) => {
    let y = FACE_VIEW;
    y = lerpAngle(y, 0.2, ramp(t, 4.4, 4.95));                    // turn to walk right
    y = lerpAngle(y, FACE_VIEW + 0.15, ramp(t, 6.3, 6.9));        // turn back to the viewer
    y = lerpAngle(y, -Math.PI + 0.25, ramp(t, 8.15, 8.45));       // spin round and dash back left
    y = lerpAngle(y, FACE_VIEW, ramp(t, 9.4, 10.0));              // and face the viewer again
    y = lerpAngle(y, -Math.PI / 2, ramp(t, 19.6, 20.8));          // straight at the camera
    y = lerpAngle(y, FACE_VIEW, ramp(t, LOOP - 1.2, LOOP - 0.2));
    return y;
  };
  const localAt = (t) => ramp(t, 2.2, 2.9) * (1 - ramp(t, 16.0, 16.5));
  const allAt = (t) => ramp(t, 11.0, 12.2) * (1 - ramp(t, 16.0, 16.6));
  const onHimAt = (t) => Math.max(localAt(t) * (1 - smooth(clamp01((Math.abs(trumanX(t) - rainX(t)) - R_COL * 0.6) / (R_COL * 0.8)))), allAt(t));
  // his clothes soak and dry; a puddle grows where the shower stands still (integrated
  // from the start of the loop, so that a jump in time gives the same answer)
  const sim = { wet: 0, pud: 0, pudX: START_X };
  const simulate = (t) => {
    let wet = 0, pud = 0, pudX = START_X, prevX = rainX(0);
    const STEP = 0.05;
    for (let s = STEP; s <= t + 1e-6; s += STEP) {
      const lc = localAt(s), al = allAt(s), rx = rainX(s), on = onHimAt(s);
      wet = clamp01(wet + STEP * (on * 0.55 - (1 - on) * 0.035));
      const still = Math.abs(rx - prevX) / STEP < 0.03;
      if (pud < 0.03 && lc > 0.5) pudX = rx;
      pud = clamp01(pud + STEP * ((lc > 0.5 && still && Math.abs(rx - pudX) < R_COL * 0.5 ? 0.3 : -0.12) + al * 0.25));
      prevX = rx;
    }
    sim.wet = wet; sim.pud = pud; sim.pudX = pudX;
    return sim;
  };
  let lastSpot = 0, spotI = 0, prevT = 0;
  const _f = new THREE.Vector3(), _l = new THREE.Vector3(), _h = new THREE.Vector3(), _s = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3(), _a = new THREE.Vector3();

  const update = (time, dt, camera, rootQuat) => {
    ff.orient(camera, rootQuat, dt);
    const t = time % LOOP;
    if (t < prevT) { U.uWet.value.forEach((v) => v.set(0, 0, 0, 0)); lastSpot = 0; }
    prevT = t;

    // --- weather and light: a little cloud over him, then the whole sky clouds over
    const local = localAt(t), all = allAt(t), cx = rainX(t);
    column.uAmount.value = local;
    column.uCenter.value.set(cx, TZ);
    veil.position.set(cx, GROUND + 0.8, TZ);
    veilU.uAmount.value = local * (1 - all);
    colSplash.uAmount.value = local;
    colSplash.uCenter.value.copy(column.uCenter.value);
    everywhere.uAmount.value = all;
    allSplash.uAmount.value = all;
    U.uDim.value = 1 - 0.55 * all;
    U.uWind.value = 0.05 + 0.24 * all + 0.03 * Math.sin(time * 0.7);
    sun.intensity = 4.4 * (1 - 0.74 * all) * (1 - 0.22 * local * (1 - all));
    sun.color.copy(SUN_WARM).lerp(SUN_COLD, all);
    hemi.intensity = 0.28 + 0.1 * all;
    rim.intensity = 0.6 * (1 - 0.4 * all);
    bounce.intensity = 0.55 * (1 - 0.75 * all);
    vignette.u.uStrength.value = 0.4 + 0.2 * all;
    haze.color.copy(HAZE_CLEAR).lerp(HAZE_RAIN, all);
    haze.near = 0.5 - 0.7 * all;
    haze.far = 22 - 18.8 * all;
    towelMat.color.setScalar(1 - 0.35 * U.uWetAll.value);
    const lift = 0.016 * (1 + 0.35 * Math.sin(time * 5.0) * (0.3 + all)) * (1 - 0.6 * U.uWetAll.value);
    for (let i = 0; i < tPos.count; i++) if (towelCorner[i] > 0) tPos.setZ(i, towelBase[i] + lift * towelCorner[i]);
    tPos.needsUpdate = true;
    towelGeo.computeVertexNormals();
    cloudShadow.position.set(cx, GROUND + 0.0012, TZ);
    cloudShadow.material.opacity = 0.32 * local * (1 - all);
    // wet sand: spots where the column has been, drying slowly; everything during the downpour
    if (local > 0.5 && time - lastSpot > 0.25) {
      lastSpot = time;
      U.uWet.value[spotI].set(column.uCenter.value.x, column.uCenter.value.y, 1, 0);
      spotI = (spotI + 1) % WET_SPOTS;
    }
    U.uWet.value.forEach((v) => { v.z = Math.max(0, v.z - dt / 9); });
    U.uWetAll.value = Math.max(all * 0.95, U.uWetAll.value - dt / 6);
    // wet clothes: darker and glossier; the puddle
    simulate(t);
    wetMats.forEach((w) => { w.m.color.copy(w.color).multiplyScalar(1 - 0.38 * sim.wet); w.m.roughness = w.rough * (1 - 0.45 * sim.wet); });
    puddle.position.set(sim.pudX, GROUND + 0.0016, TZ);
    puddleU.uAmount.value = sim.pud;
    puddleU.uRain.value = Math.max(local * (Math.abs(cx - sim.pudX) < R_COL ? 1 : 0), all);

    // --- Truman
    const x = trumanX(t), yaw = yawAt(t);
    rig.pivot.position.set(x, GROUND, TZ);
    rig.pivot.rotation.y = yaw;
    const dash = ramp(t, 8.45, 8.6) * (1 - ramp(t, 9.3, 9.5));
    const walking = Math.max(ramp(t, 4.9, 5.2) * (1 - ramp(t, 6.1, 6.4)), dash);
    const travelled = Math.abs(x - START_X) + (t > 8.0 ? 2 * Math.abs(AWAY_X - START_X) - 2 * Math.abs(x - START_X) : 0);
    const ph = (travelled / (0.035 * S * (1 + 0.5 * dash))) * Math.PI * 2;
    const sw = Math.sin(ph) * walking;
    const flinch = ramp(t, 2.2, 2.3) * (1 - ramp(t, 2.6, 2.9));
    const touchHead = ramp(t, 2.3, 2.55) * (1 - ramp(t, 2.85, 3.1));
    const looksUp = Math.max(ramp(t, 2.9, 3.3) * (1 - ramp(t, 4.2, 4.6)), ramp(t, 6.9, 7.3) * (1 - ramp(t, 7.9, 8.2)),
      ramp(t, 10.1, 10.6) * (1 - ramp(t, 11.4, 11.9)), ramp(t, 17.6, 18.2) * (1 - ramp(t, 19.3, 19.8)));
    const relief = ramp(t, 6.45, 6.75) * (1 - ramp(t, 6.95, 7.2));
    const shrug = ramp(t, 7.25, 7.55) * (1 - ramp(t, 8.0, 8.25));
    const palm = ramp(t, 3.1, 3.6) * (1 - ramp(t, 4.3, 4.7)) + ramp(t, 10.3, 10.7) * (1 - ramp(t, 11.2, 11.5));
    const cover = ramp(t, 11.3, 11.8) * (1 - ramp(t, 16.1, 16.7));
    const hunch = ramp(t, 11.4, 12.2) * (1 - ramp(t, 16.2, 16.9));
    const shake = ramp(t, 16.7, 16.9) * (1 - ramp(t, 17.5, 17.8));
    const stare = ramp(t, 20.0, 21.0) * (1 - ramp(t, LOOP - 1.0, LOOP - 0.3));
    const idle = (1 - looksUp) * (1 - walking) * (1 - hunch) * (1 - stare);
    rig.pose(4.8, {
      lookUp: 1.1 * looksUp + 0.45 * relief - 0.2 * hunch,
      lookDown: 0.8 * hunch + 0.35 * flinch,
      lookSide: 22 * Math.sin(t * 0.8) * idle * (t < 2.2 ? 1 : 0.3) + 25 * Math.sin(t * 13.0) * shake,
      lean: 4 * walking + 9 * dash + 9 * hunch - 3 * looksUp + 2 * shrug - 4 * relief + 3 * stare,
      sway: 2 * Math.sin(time * 0.7) + 7 * Math.sin(t * 24.0) * shake,
      brace: 7 * flinch,
      extra: [
        ['LeftUpLeg', 'side', -(24 + 14 * dash) * sw], ['RightUpLeg', 'side', (24 + 14 * dash) * sw],
        ['LeftLeg', 'side', (38 + 20 * dash) * Math.max(0, Math.sin(ph + 1.2)) * walking], ['RightLeg', 'side', (38 + 20 * dash) * Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * walking],
        ['LeftArm', 'side', (14 + 16 * dash) * sw], ['RightArm', 'side', -(14 + 16 * dash) * sw],
        ['LeftForeArm', 'side', -30 * dash - 32 * Math.sin(t * 30) * shake], ['RightForeArm', 'side', -30 * dash + 32 * Math.sin(t * 30) * shake],
        ['LeftArm', 'fwd', 28 * shrug], ['RightArm', 'fwd', -28 * shrug],
        ['LeftArm', 'side', -6 * relief], ['RightArm', 'side', -6 * relief],
        ['Head', 'fwd', 7 * stare],
      ],
    });
    _f.set(Math.cos(yaw), 0, -Math.sin(yaw));
    _l.set(0, 1, 0).cross(_f).normalize();               // his left
    rig.bonePos('HeadTop_End', _h); frame.worldToLocal(_h);
    // the first drop: a hand to the top of his head
    if (touchHead > 0.01) {
      rig.bonePos('RightArm', _s); frame.worldToLocal(_s);
      _t.copy(_h).addScaledVector(_l, -0.005 * S).addScaledVector(_f, 0.004 * S).y += 0.002 * S;
      _p.copy(_s).addScaledVector(_l, -0.05 * S).addScaledVector(_f, 0.012 * S).y += 0.004 * S;
      rig.reach('Right', frame.localToWorld(_t.clone()), touchHead, frame.localToWorld(_p.clone()));
      rig.curl('Right', 0.2 * touchHead);
    }
    // palm out to feel the rain
    if (palm > 0) {
      _t.set(x, GROUND + 0.235, TZ).addScaledVector(_f, 0.075).addScaledVector(_l, 0.035);
      _p.set(x, GROUND + 0.1, TZ).addScaledVector(_l, 0.2).addScaledVector(_f, -0.05);
      rig.reach('Left', frame.localToWorld(_t.clone()), palm, frame.localToWorld(_p.clone()));
    }
    // the downpour: both hands over his head
    if (cover > 0.01) ['Left', 'Right'].forEach((sn, i) => {
      const sg = i ? -1 : 1;
      rig.bonePos(sn + 'Arm', _s); frame.worldToLocal(_s);
      _t.copy(_h).addScaledVector(_l, 0.011 * S * sg).addScaledVector(_f, 0.002 * S).y += 0.001 * S;
      _p.copy(_s).addScaledVector(_l, 0.05 * S * sg).addScaledVector(_f, 0.014 * S).y += 0.012 * S;
      rig.reach(sn, frame.localToWorld(_t.clone()), cover, frame.localToWorld(_p.clone()));
      rig.curl(sn, 0.25 * cover);
    });
    // drops: splashing off his head and shoulders under the rain, dripping from him after it
    const onHim = onHimAt(t);
    splashU.uA0.value.copy(_h);
    rig.bonePos('LeftArm', _a); frame.worldToLocal(_a); splashU.uA1.value.copy(_a);
    rig.bonePos('RightArm', _a); frame.worldToLocal(_a); splashU.uA2.value.copy(_a);
    splashU.uAmount.value = onHim;
    rig.bonePos('LeftHand', _a); frame.worldToLocal(_a); dripU.uA0.value.copy(_a);
    rig.bonePos('RightHand', _a); frame.worldToLocal(_a); dripU.uA1.value.copy(_a);
    rig.bonePos('Hips', _a); frame.worldToLocal(_a); _a.y -= 0.012 * S; dripU.uA2.value.copy(_a);
    dripU.uAmount.value = sim.wet * (1 - onHim) * 0.9;

    // --- gulls and the flag
    gulls.forEach((g) => {
      const d = g.userData.d, a = time * d.sp + d.ph;
      g.position.set(d.cx + Math.cos(a) * d.rad, GROUND + d.h + 0.03 * Math.sin(a * 2.3), d.cz + Math.sin(a) * d.rad * 0.4);
      setBirdFrame(g, Math.sin(time * 0.9 + d.ph) > 0.2 ? 0.25 : time * 3.0 + d.ph);   // glide, then flap
      g.material.color.setScalar(1 - 0.45 * allAt(t));
    });
    flag.rotation.y = 0.3 * Math.sin(time * (4.0 + 4.0 * allAt(t)));
    umb.rotation.z = 0.22 + (0.012 + 0.06 * allAt(t)) * Math.sin(time * 2.3);
  };

  // less sky fill on everything matte (glass and metal keep their reflections), so
  // the sun and its shadows carry the picture
  {
    const seen = new Set();
    const skip = new Set();
    rig.pivot.traverse((o) => skip.add(o));
    frame.traverse((o) => {
      if (skip.has(o) || !o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => {
        if (!mt.isMeshStandardMaterial || seen.has(mt) || mt.metalness > 0.2) return;
        seen.add(mt);
        mt.envMapIntensity *= 0.42;
      });
    });
  }

  return { world, frame, update, rig, haze };
}
