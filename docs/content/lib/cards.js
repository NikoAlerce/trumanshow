// Painted cut-outs, drawn here on canvases (no image files):
// - trees and bushes as cards that turn to whoever looks at them: the camera, and
//   — in the shadow pass — the sun, so their shadows keep their whole shape. A
//   normal map made from the painted alpha gives each crown a round volume, so the
//   scene's sun lights one side of it and leaves the other in shade;
// - a car painted on a stage flat (with plywood and braces behind: it is a set).

const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ---------------------------------------------------------------- trees
const KINDS = {
  oak: { cy: 0.39, rx: 0.42, ry: 0.34, clumps: 20, clumpR: 0.11, trunkW: 0.05, hue: [0.96, 1.0, 0.86], holes: 6, low: 3 },
  maple: { cy: 0.4, rx: 0.39, ry: 0.36, clumps: 19, clumpR: 0.115, trunkW: 0.043, hue: [1.07, 1.0, 0.74], holes: 5, low: 2 },
  poplar: { cy: 0.45, rx: 0.17, ry: 0.44, clumps: 26, clumpR: 0.075, trunkW: 0.032, hue: [0.84, 0.96, 0.98], holes: 2, low: 0 },
  bush: { cy: 0.74, rx: 0.45, ry: 0.2, clumps: 15, clumpR: 0.105, trunkW: 0, hue: [0.92, 1.0, 0.8], holes: 0, low: 0 },
};
// uv offsets of the 2x2 atlas (v up): oak, maple / poplar, bush
export const CELLS = { oak: [0, 0.5], maple: [0.5, 0.5], poplar: [0, 0], bush: [0.5, 0] };
const SLOT = { oak: [0, 0], maple: [1, 0], poplar: [0, 1], bush: [1, 1] };

const STOPS = [[0, [18, 34, 16]], [0.5, [54, 92, 38]], [0.9, [112, 146, 62]], [1.25, [182, 200, 110]]];
function green(L, hue) {
  L = Math.max(0, Math.min(1.25, L));
  let i = 0;
  while (i < STOPS.length - 2 && L > STOPS[i + 1][0]) i++;
  const [l0, c0] = STOPS[i], [l1, c1] = STOPS[i + 1];
  const u = (L - l0) / (l1 - l0);
  return `rgb(${Math.round((c0[0] + (c1[0] - c0[0]) * u) * hue[0])},${Math.round((c0[1] + (c1[1] - c0[1]) * u) * hue[1])},${Math.round((c0[2] + (c1[2] - c0[2]) * u) * hue[2])})`;
}

function paintTree(g, S, kind, seed) {
  const K = KINDS[kind];
  const r = rng(seed);
  const cx = S * 0.5, ground = S * 0.985;
  const crownTop = (K.cy - K.ry) * S, crownBot = (K.cy + K.ry) * S;
  // the clumps of the crown, painted back to front
  const clumps = [];
  for (let i = 0; i < K.clumps; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.42) * 0.84;
    clumps.push({ x: cx + Math.cos(a) * d * K.rx * S, y: K.cy * S + Math.sin(a) * d * K.ry * S, rad: K.clumpR * S * (0.8 + r() * 0.45), z: r() });
  }
  // low boughs at the sides, so the crown is not a ball on a stick
  for (let i = 0; i < K.low; i++) {
    const sd = i % 2 ? 1 : -1;
    clumps.push({ x: cx + sd * (0.5 + r() * 0.35) * K.rx * S, y: (K.cy + K.ry * (0.55 + r() * 0.3)) * S, rad: K.clumpR * S * (0.7 + r() * 0.3), z: r() * 0.6 });
  }
  clumps.push({ x: cx, y: K.cy * S, rad: K.clumpR * S * 1.35, z: 0 });
  clumps.sort((p, q) => p.z - q.z);
  const holes = [];
  for (let i = 0; i < K.holes; i++) {
    const a = r() * Math.PI * 2, d = 0.5 + r() * 0.32;
    holes.push({ x: cx + Math.cos(a) * d * K.rx * S, y: K.cy * S + Math.sin(a) * d * K.ry * S, rad: S * (0.018 + r() * 0.028) });
  }
  // trunk and limbs
  g.lineCap = 'round';
  const limb = (x0, y0, x1, y1, w0, w1, bend) => {
    const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2;
    let px = x0, py = y0;
    for (let s = 1; s <= 12; s++) {
      const u = s / 12;
      const qx = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1;
      const qy = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y1;
      const w = w0 + (w1 - w0) * u;
      g.strokeStyle = '#382c22'; g.lineWidth = w;
      g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke();
      g.strokeStyle = 'rgba(118,98,76,0.3)'; g.lineWidth = w * 0.3;
      g.beginPath(); g.moveTo(px - w * 0.16, py); g.lineTo(qx - w * 0.16, qy); g.stroke();
      px = qx; py = qy;
    }
  };
  if (K.trunkW > 0) {
    const tw = K.trunkW * S;
    const top = { x: cx + (r() - 0.5) * S * 0.03, y: K.cy * S + K.ry * S * 0.15 };
    // root flare
    g.fillStyle = '#382c22';
    g.beginPath();
    g.moveTo(cx - tw * 1.2, ground);
    g.quadraticCurveTo(cx - tw * 0.45, ground - tw * 0.5, cx - tw * 0.45, ground - tw * 1.8);
    g.lineTo(cx + tw * 0.45, ground - tw * 1.8);
    g.quadraticCurveTo(cx + tw * 0.45, ground - tw * 0.5, cx + tw * 1.2, ground);
    g.closePath(); g.fill();
    limb(cx, ground, top.x, top.y, tw, tw * 0.55, (r() - 0.5) * S * 0.04);
    for (const c of clumps) if (r() < 0.75) limb(top.x, top.y, c.x, c.y, tw * 0.5, tw * 0.1, (r() - 0.5) * c.rad);
  }
  // the leaves: dense in each clump, ragged at its rim; lighter on top, darker below
  const LR = S * 0.0072;
  for (const c of clumps) {
    const back = 0.68 + 0.32 * c.z;
    const n = Math.round(2.3 * (c.rad / LR) * (c.rad / LR));
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.55) * c.rad;
      const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.88;
      if (r() < 0.85 && holes.some((h) => (x - h.x) * (x - h.x) + (y - h.y) * (y - h.y) < h.rad * h.rad)) continue;
      const ny = (y - c.y) / c.rad;
      const vy = Math.min(1, Math.max(0, (y - crownTop) / (crownBot - crownTop)));
      const L = back * (0.6 - 0.3 * ny + (ny < 0 ? 0.2 : 0.05) * (d / c.rad)) * (1.08 - 0.45 * vy) * (0.8 + 0.4 * r());
      g.fillStyle = green(L, K.hue);
      const lr = LR * (0.6 + r() * 0.8);
      g.beginPath(); g.ellipse(x, y, lr, lr * (0.45 + r() * 0.35), r() * Math.PI, 0, Math.PI * 2); g.fill();
    }
    // sunlit specks on the top of the front clumps
    if (c.z > 0.45) for (let i = 0; i < n / 7; i++) {
      const a = Math.PI + r() * Math.PI, d = (0.55 + r() * 0.45) * c.rad;
      const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.85;
      g.fillStyle = green(1.0 + r() * 0.25, K.hue);
      const lr = LR * (0.4 + r() * 0.5);
      g.beginPath(); g.ellipse(x, y, lr, lr * 0.6, r() * Math.PI, 0, Math.PI * 2); g.fill();
    }
  }
  // the crown shades itself towards the bottom; the sky lights its top
  g.globalCompositeOperation = 'source-atop';
  const ao = g.createLinearGradient(0, crownTop, 0, ground);
  ao.addColorStop(0, 'rgba(255,250,215,0.1)');
  ao.addColorStop(0.42, 'rgba(0,0,0,0)');
  ao.addColorStop(0.78, 'rgba(6,18,5,0.38)');
  ao.addColorStop(1, 'rgba(6,12,5,0.22)');
  g.fillStyle = ao; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
}

function boxBlur(src, N, R, passes) {
  let a = Float32Array.from(src);
  const b = new Float32Array(N * N), k = 1 / (2 * R + 1);
  const cl = (v) => (v < 0 ? 0 : v > N - 1 ? N - 1 : v);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < N; y++) {
      const row = y * N;
      let acc = 0;
      for (let x = -R; x <= R; x++) acc += a[row + cl(x)];
      for (let x = 0; x < N; x++) { b[row + x] = acc * k; acc += a[row + cl(x + R + 1)] - a[row + cl(x - R)]; }
    }
    for (let x = 0; x < N; x++) {
      let acc = 0;
      for (let y = -R; y <= R; y++) acc += b[cl(y) * N + x];
      for (let y = 0; y < N; y++) { a[y * N + x] = acc * k; acc += b[cl(y + R + 1) * N + x] - b[cl(y - R) * N + x]; }
    }
  }
  return a;
}

// a normal map from the painted cut-out: puffy where it is solid, plus the leaves' grain
function normalsFrom(src, N) {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0, N, N);
  const d = g.getImageData(0, 0, N, N).data;
  const A = new Float32Array(N * N), Lm = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    A[i] = d[i * 4 + 3] / 255;
    Lm[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  }
  const H = boxBlur(A, N, Math.round(N / 64), 3);
  const out = g.createImageData(N, N), o = out.data;
  const k = (N / 64) * 3.2, k2 = 1.6;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const xl = x > 0 ? x - 1 : x, xr = x < N - 1 ? x + 1 : x, yu = y > 0 ? y - 1 : y, yd = y < N - 1 ? y + 1 : y;
    const hx = (H[y * N + xr] - H[y * N + xl]) * 0.5, hy = (H[yd * N + x] - H[yu * N + x]) * 0.5;
    const lx = (Lm[y * N + xr] - Lm[y * N + xl]) * 0.5, ly = (Lm[yd * N + x] - Lm[yu * N + x]) * 0.5;
    const nx = -hx * k - lx * k2, ny = hy * k + ly * k2;      // tangent space, +y up (the canvas runs down)
    const l = Math.sqrt(nx * nx + ny * ny + 1);
    o[i * 4] = (nx / l * 0.5 + 0.5) * 255;
    o[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255;
    o[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255;
    o[i * 4 + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return c;
}

// the atlas painted once by paintTreeAtlas and saved as tex/trees.webp + tex/trees_n.webp
// (painting it takes about a second at load; the two images are ~330 KB)
export function loadTreeAtlas(THREE, base) {
  const loader = new THREE.TextureLoader();
  const map = loader.load(new URL('tex/trees.webp', base).href);
  map.encoding = THREE.sRGBEncoding;
  map.anisotropy = 8;
  const normalMap = loader.load(new URL('tex/trees_n.webp', base).href);
  normalMap.anisotropy = 8;
  return { map, normalMap };
}

export function paintTreeAtlas(THREE, { size = 1024, seed = 11 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const S = size / 2;
  Object.keys(SLOT).forEach((kind, i) => {
    const [sx, sy] = SLOT[kind];
    g.save();
    g.translate(sx * S, sy * S);
    g.beginPath(); g.rect(0, 0, S, S); g.clip();
    paintTree(g, S, kind, seed + i * 101);
    g.restore();
  });
  const map = new THREE.CanvasTexture(c);
  map.encoding = THREE.sRGBEncoding;
  map.anisotropy = 8;
  const normalMap = new THREE.CanvasTexture(normalsFrom(c, size / 2));
  normalMap.anisotropy = 8;
  return { map, normalMap };
}

// turn each card about its own up axis to face cameraPosition: the camera, or in
// the shadow pass the light; the top of the crown sways in the breeze
const BILLBOARD = /* glsl */ `
  #ifdef USE_MAP
    vMapUv = vMapUv * 0.5 + aCell;       // three r151: each map has its own uv varying
  #endif
  #ifdef USE_NORMALMAP
    vNormalMapUv = vNormalMapUv * 0.5 + aCell;
  #endif
  vec3 bbBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 bbUp = (modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
  vec3 bbX = (modelMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz;
  vec3 bbUpN = normalize(bbUp);
  #ifdef BB_LIGHT
    vec3 bbTo = uBBLight;                  // the shadow pass: face the sun
  #else
    vec3 bbTo = cameraPosition - bbBase;
  #endif
  vec3 bbH = bbTo - dot(bbTo, bbUpN) * bbUpN;
  vec3 bbFacing = dot(bbH, bbH) > 1e-12 ? normalize(bbH) : normalize(cross(bbX, bbUpN));
  vec3 bbRight = normalize(cross(bbUpN, bbFacing));
  float bbSway = (sin(uTime * 1.3 + bbBase.x * 7.0 + bbBase.z * 4.0) * 0.6 + sin(uTime * 2.7 + bbBase.x * 3.0 + bbBase.z) * 0.25) * aSway * position.y * position.y;
  vec3 bbWorld = bbBase + bbRight * (position.x + bbSway) * length(bbX) + bbUp * position.y;
`;

export function makeTreeCards(THREE, { atlas, uniforms, count }) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);                       // the card stands on its base
  const aCell = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
  const aSway = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  geo.setAttribute('aCell', aCell);
  geo.setAttribute('aSway', aSway);
  const mat = new THREE.MeshStandardMaterial({ map: atlas.map, normalMap: atlas.normalMap, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.92, envMapIntensity: 0.35 });
  mat.alphaToCoverage = true;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas.map, alphaTest: 0.42 });
  const uBBLight = { value: new THREE.Vector3(1, 1, -1).normalize() };
  const patch = (sh, isDepth) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uBBLight = uBBLight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec2 aCell;\nattribute float aSway;\nuniform float uTime;\nuniform vec3 uBBLight;${isDepth ? '\n#define BB_LIGHT' : ''}`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n${BILLBOARD}`)
      .replace('#include <project_vertex>', 'vec4 mvPosition = viewMatrix * vec4(bbWorld, 1.0);\ngl_Position = projectionMatrix * mvPosition;');
    if (!isDepth) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <normal_vertex>', 'transformedNormal = normalize(mat3(viewMatrix) * bbFacing);\n#include <normal_vertex>')
        .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(bbWorld, 1.0);');
    }
  };
  mat.onBeforeCompile = (sh) => patch(sh, false);
  mat.customProgramCacheKey = () => 'tree-card';
  depth.onBeforeCompile = (sh) => patch(sh, true);
  depth.customProgramCacheKey = () => 'tree-card-depth';
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.customDepthMaterial = depth;
  mesh.castShadow = true;
  mesh.receiveShadow = false;         // a card would catch its own (sun-facing) shadow
  mesh.frustumCulled = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  let n = 0;
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  return {
    mesh,
    // the direction to the shadow-casting light, in world space (call each frame: the cube turns)
    setLight(light) {
      light.getWorldPosition(_a);
      light.target.getWorldPosition(_b);
      uBBLight.value.subVectors(_a, _b).normalize();
    },
    // a card standing at (x, y, z), w wide and h tall, painted with one of CELLS
    add(x, y, z, w, h, kind, sway = 0.03) {
      if (n >= count) return -1;
      mesh.setMatrixAt(n, m4.compose(p.set(x, y, z), q, s.set(w, h, 1)));
      aCell.setXY(n, CELLS[kind][0], CELLS[kind][1]);
      aSway.setX(n, sway);
      n++;
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      aCell.needsUpdate = true; aSway.needsUpdate = true;
      return n - 1;
    },
  };
}

// ---------------------------------------------------------------- the car: a 90s sedan painted on a flat
// Design space 1000 x 340, the car facing left, the ground line at y = 330.
export const CAR = { DW: 1000, DH: 340, GROUND: 330, signalFront: [44, 243], signalRear: [957, 186] };

function carBody() {
  const W1 = { x: 222, y: 270 }, W2 = { x: 738, y: 270 }, AR = 70, BOT = 306;
  const a0 = Math.asin((BOT - W1.y) / AR);
  const p = new Path2D();
  p.moveTo(56, BOT);
  p.bezierCurveTo(38, 302, 31, 282, 33, 260);
  p.bezierCurveTo(34, 240, 42, 224, 60, 216);
  p.bezierCurveTo(140, 202, 250, 190, 338, 166);
  p.bezierCurveTo(385, 140, 445, 98, 505, 78);
  p.bezierCurveTo(565, 64, 660, 64, 714, 72);
  p.bezierCurveTo(762, 94, 800, 126, 834, 150);
  p.bezierCurveTo(880, 154, 930, 156, 953, 162);
  p.bezierCurveTo(967, 178, 971, 212, 967, 242);
  p.bezierCurveTo(965, 272, 962, 294, 948, BOT);
  p.lineTo(W2.x + AR * Math.cos(a0), BOT);
  p.arc(W2.x, W2.y, AR, a0, Math.PI - a0, true);
  p.lineTo(W1.x + AR * Math.cos(a0), BOT);
  p.arc(W1.x, W1.y, AR, a0, Math.PI - a0, true);
  p.closePath();
  return { p, W1, W2, AR, BOT };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function paintCarSide(g) {
  const { p: body, W1, W2, AR, BOT } = carBody();
  // under the car: its own shade on the street (behind the wheels)
  const sh = g.createLinearGradient(0, 296, 0, 333);
  sh.addColorStop(0, 'rgba(6,7,9,0.92)'); sh.addColorStop(1, 'rgba(6,7,9,0)');
  g.fillStyle = sh; g.fillRect(120, 296, 740, 37);
  // the wheel wells
  [W1, W2].forEach((w) => {
    g.beginPath(); g.arc(w.x, w.y, AR - 2, Math.PI, 0); g.lineTo(w.x + AR - 2, BOT); g.lineTo(w.x - AR + 2, BOT); g.closePath();
    g.fillStyle = '#0a0c0f'; g.fill();
  });
  // paint: the sky on the roof and the shoulder, a bright line along it, the horizon
  // reflected across the doors and the ground below it
  const grad = g.createLinearGradient(0, 60, 0, BOT);
  grad.addColorStop(0.0, '#7d9cb6');
  grad.addColorStop(0.36, '#8eaecb');
  grad.addColorStop(0.415, '#d2e2ee');
  grad.addColorStop(0.47, '#6f90ab');
  grad.addColorStop(0.6, '#56789a');
  grad.addColorStop(0.62, '#86a6c1');
  grad.addColorStop(0.665, '#3f5d78');
  grad.addColorStop(0.9, '#2a3f53');
  grad.addColorStop(1.0, '#1b2835');
  g.fillStyle = grad; g.fill(body);
  g.save();
  g.clip(body);
  // the hood and the trunk lid catch the sky
  const hood = g.createLinearGradient(0, 165, 0, 232);
  hood.addColorStop(0, 'rgba(225,238,247,0.6)'); hood.addColorStop(1, 'rgba(225,238,247,0)');
  g.fillStyle = hood;
  g.beginPath(); g.moveTo(30, 236); g.lineTo(60, 214); g.bezierCurveTo(140, 200, 250, 188, 340, 164); g.lineTo(352, 236); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(830, 150); g.bezierCurveTo(880, 152, 930, 154, 955, 160); g.lineTo(970, 210); g.lineTo(826, 210); g.closePath(); g.fill();
  // door seams
  g.strokeStyle = 'rgba(14,20,28,0.85)'; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(374, 160); g.bezierCurveTo(366, 200, 360, 250, 362, 304); g.stroke();
  g.beginPath(); g.moveTo(596, 158); g.lineTo(596, 304); g.stroke();
  g.beginPath(); g.moveTo(798, 156); g.bezierCurveTo(808, 190, 812, 212, 806, 238); g.stroke();
  g.beginPath(); g.moveTo(338, 168); g.bezierCurveTo(330, 186, 326, 200, 330, 214); g.stroke();      // the fender's seam
  // the black rubbing strip, and the rocker panel
  g.fillStyle = '#171b21'; g.fillRect(30, 229, 945, 9);
  g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(30, 229, 945, 1.6);
  g.fillStyle = 'rgba(16,22,30,0.55)'; g.fillRect(30, 284, 945, 24);
  // the bumpers' grey
  g.fillStyle = 'rgba(40,46,52,0.55)';
  g.beginPath(); g.moveTo(30, 250); g.lineTo(118, 248); g.lineTo(118, 306); g.lineTo(30, 306); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(880, 238); g.lineTo(975, 236); g.lineTo(975, 306); g.lineTo(880, 306); g.closePath(); g.fill();
  g.restore();
  // the side windows: dark glass with the sky in it, two headrests behind
  const dlo = new Path2D();
  dlo.moveTo(378, 157);
  dlo.bezierCurveTo(418, 130, 460, 102, 510, 88);
  dlo.bezierCurveTo(570, 76, 655, 76, 704, 84);
  dlo.bezierCurveTo(742, 102, 774, 126, 800, 150);
  dlo.lineTo(794, 157);
  dlo.closePath();
  const gl = g.createLinearGradient(0, 80, 0, 160);
  gl.addColorStop(0, '#2c3e50'); gl.addColorStop(1, '#10181f');
  g.fillStyle = gl; g.fill(dlo);
  g.save();
  g.clip(dlo);
  g.fillStyle = 'rgba(8,10,13,0.75)';
  g.beginPath(); g.ellipse(560, 130, 15, 20, 0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(706, 134, 14, 18, 0.1, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(196,220,238,0.3)';
  g.beginPath(); g.moveTo(420, 162); g.lineTo(522, 70); g.lineTo(600, 70); g.lineTo(500, 162); g.closePath(); g.fill();
  g.fillStyle = 'rgba(196,220,238,0.15)';
  g.beginPath(); g.moveTo(640, 162); g.lineTo(700, 70); g.lineTo(728, 70); g.lineTo(668, 162); g.closePath(); g.fill();
  g.restore();
  g.strokeStyle = '#0d1116'; g.lineWidth = 5; g.stroke(dlo);
  g.strokeStyle = 'rgba(210,220,228,0.35)'; g.lineWidth = 1.2; g.stroke(dlo);
  g.fillStyle = '#11151a'; g.fillRect(588, 80, 16, 78);
  // the side mirror
  g.fillStyle = '#14181d'; g.beginPath(); g.ellipse(394, 146, 17, 10, -0.15, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(150,175,195,0.35)'; g.beginPath(); g.ellipse(390, 142, 10, 4, -0.15, 0, Math.PI * 2); g.fill();
  // door handles
  [[528, 182], [736, 182]].forEach(([x, y]) => {
    g.fillStyle = 'rgba(10,14,18,0.6)'; roundRect(g, x, y + 2, 30, 8, 3); g.fill();
    g.fillStyle = '#c9d2d9'; roundRect(g, x, y, 30, 7, 3); g.fill();
  });
  // lights: a headlamp round the front corner, an amber marker, the tail lamp
  g.fillStyle = '#d8e2e7';
  g.beginPath(); g.moveTo(34, 222); g.lineTo(98, 213); g.lineTo(100, 229); g.lineTo(37, 238); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(48, 219, 30, 3);
  g.fillStyle = '#e8962a'; g.beginPath(); g.moveTo(33, 239); g.lineTo(60, 236); g.lineTo(60, 248); g.lineTo(34, 250); g.closePath(); g.fill();
  g.fillStyle = '#a8121b';
  g.beginPath(); g.moveTo(946, 165); g.lineTo(965, 176); g.lineTo(968, 208); g.lineTo(942, 204); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,110,100,0.7)'; g.fillRect(948, 172, 14, 4);
  g.fillStyle = '#d9891f'; g.fillRect(944, 182, 22, 8);
  // the wheels
  [W1, W2].forEach((w) => {
    const tg = g.createRadialGradient(w.x - 10, w.y - 12, 8, w.x, w.y, 60);
    tg.addColorStop(0, '#2b2e32'); tg.addColorStop(0.72, '#16181b'); tg.addColorStop(1, '#0a0b0c');
    g.fillStyle = tg; g.beginPath(); g.arc(w.x, w.y, 60, 0, Math.PI * 2); g.fill();
    const rg = g.createRadialGradient(w.x - 9, w.y - 11, 3, w.x, w.y, 40);
    rg.addColorStop(0, '#f4f6f8'); rg.addColorStop(0.55, '#b9c1c9'); rg.addColorStop(1, '#68717a');
    g.fillStyle = rg; g.beginPath(); g.arc(w.x, w.y, 39, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#454d55'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#272c32';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      g.beginPath(); g.ellipse(w.x + Math.cos(a) * 25, w.y + Math.sin(a) * 25, 7.5, 4, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#dde2e6'; g.beginPath(); g.arc(w.x, w.y, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#737c84'; g.beginPath(); g.arc(w.x, w.y, 3.5, 0, Math.PI * 2); g.fill();
  });
  g.strokeStyle = 'rgba(8,12,16,0.55)'; g.lineWidth = 2; g.stroke(body);
}

function paintPlywood(g, W, H) {
  // the back of the flat: the same silhouette in plywood, mirrored
  const { p: body, W1, W2 } = carBody();
  g.save();
  g.translate(W, 0);
  g.scale(-W / CAR.DW, H / CAR.DH);
  g.fillStyle = '#c3a274'; g.fill(body);
  [W1, W2].forEach((w) => { g.beginPath(); g.arc(w.x, w.y, 60, 0, Math.PI * 2); g.fill(); });
  g.save();
  g.clip(body);
  const r = rng(5);
  for (let i = 0; i < 70; i++) {
    const y = 60 + r() * 250;
    g.strokeStyle = `rgba(${110 + r() * 30},${80 + r() * 25},${48 + r() * 20},${0.25 + r() * 0.2})`; g.lineWidth = 1 + r() * 1.5;
    g.beginPath();
    for (let x = 20; x <= 980; x += 20) g.lineTo(x, y + Math.sin(x * 0.012 + i) * 3);
    g.stroke();
  }
  g.fillStyle = 'rgba(90,62,36,0.35)';
  for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(100 + r() * 800, 120 + r() * 160, 6, 3, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.strokeStyle = '#e2c99f'; g.lineWidth = 3; g.stroke(body);
  g.restore();
  g.fillStyle = 'rgba(20,20,20,0.82)';
  g.font = `700 ${Math.round(H * 0.075)}px sans-serif`;
  g.textAlign = 'center';
  g.fillText('SEAHAVEN PROPS', W * 0.5, H * 0.6);
  g.font = `700 ${Math.round(H * 0.06)}px sans-serif`;
  g.fillText('CAR · T. BURBANK · No 2', W * 0.5, H * 0.7);
}

export function paintCarFlat(THREE) {
  const W = 1024, H = Math.round((1024 * CAR.DH) / CAR.DW);
  const mk = (draw) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  };
  const front = mk((g) => { g.scale(W / CAR.DW, H / CAR.DH); paintCarSide(g); });
  const back = mk((g) => paintPlywood(g, W, H));
  return { front, back };
}

// ---------------------------------------------------------------- birds: painted silhouettes, a strip of wingbeats
// Sprites always face the viewer, so a bird never shows up edge-on as a dash.
export const BIRD_FRAMES = 6;
const BIRD_W = 128, BIRD_H = 72;
export function paintBirdStrip(THREE, kind = 'gull') {
  const F = BIRD_FRAMES;
  const c = document.createElement('canvas');
  c.width = BIRD_W * F; c.height = BIRD_H;
  const g = c.getContext('2d');
  const gull = kind === 'gull';
  for (let f = 0; f < F; f++) {
    const lift = Math.cos((f / F) * Math.PI * 2);        // +1 wings up, -1 wings down
    g.save();
    g.translate(f * BIRD_W + BIRD_W / 2, BIRD_H * 0.52);
    const span = BIRD_W * 0.44;
    const wristY = -lift * BIRD_H * 0.14 - 2, tipY = -lift * BIRD_H * 0.34 + 3;
    [-1, 1].forEach((s) => {
      const p = new Path2D();
      p.moveTo(s * 3, -3);
      p.quadraticCurveTo(s * span * 0.3, wristY - 7, s * span * 0.52, wristY - 3);     // leading edge to the wrist
      p.quadraticCurveTo(s * span * 0.8, tipY - 4, s * span, tipY);                     // out to the tip
      p.quadraticCurveTo(s * span * 0.8, tipY + 6, s * span * 0.52, wristY + 6);        // trailing edge back
      p.quadraticCurveTo(s * span * 0.28, wristY + 9, s * 3, 6);
      p.closePath();
      if (gull) {
        const gr = g.createLinearGradient(0, 0, s * span, 0);
        gr.addColorStop(0, '#eef1f3'); gr.addColorStop(0.6, '#d0d7dc'); gr.addColorStop(0.7, '#2b2e32'); gr.addColorStop(1, '#151719');
        g.fillStyle = gr;
      } else g.fillStyle = '#2f2c2b';
      g.fill(p);
      g.strokeStyle = gull ? 'rgba(62,68,74,0.55)' : 'rgba(18,16,16,0.6)';
      g.lineWidth = 1.4;
      g.stroke(p);
    });
    // body, head, beak and tail
    g.fillStyle = gull ? '#f5f7f8' : '#2b2827';
    g.beginPath(); g.ellipse(0, 3, 6, 10, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(0, -7, 4.5, 0, Math.PI * 2); g.fill();
    if (gull) { g.fillStyle = '#e8b23a'; g.beginPath(); g.moveTo(-1.6, -4); g.lineTo(1.6, -4); g.lineTo(0, 0.5); g.closePath(); g.fill(); }
    g.fillStyle = gull ? '#e6eaed' : '#2b2827';
    g.beginPath(); g.moveTo(-5, 10); g.lineTo(5, 10); g.lineTo(0, 19); g.closePath(); g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
export function makeBird(THREE, strip, size) {
  const tex = strip.clone();              // its own frame offset, the same image
  tex.repeat.set(1 / BIRD_FRAMES, 1);
  tex.needsUpdate = true;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05, depthWrite: false }));
  s.scale.set(size, (size * BIRD_H) / BIRD_W, 1);
  s.userData.tex = tex;
  return s;
}
// phase 0 = wings up, 0.25 = level (a glide), 0.5 = down
export function setBirdFrame(bird, phase) {
  const f = Math.floor((((phase % 1) + 1) % 1) * BIRD_FRAMES) % BIRD_FRAMES;
  bird.userData.tex.offset.x = f / BIRD_FRAMES;
}

// ---------------------------------------------------------------- a vignette just inside a window, drawn last
// It faces the viewer outside the cube (+z of the plane); from inside it is culled.
export function makeVignette(THREE, { size = 1, strength = 0.5, tint = [0.05, 0.04, 0.03] } = {}) {
  const u = { uStrength: { value: strength }, uTint: { value: new THREE.Color(tint[0], tint[1], tint[2]) }, uSize: { value: size } };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({
    name: 'Vignette', uniforms: u, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: 'uniform float uSize; varying vec2 vUv; void main(){ vUv = position.xy / uSize + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uStrength; uniform vec3 uTint; varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p * vec2(0.92, 1.0)) / 1.3;
        float a = smoothstep(0.5, 1.05, r) * uStrength;
        a = max(a, smoothstep(0.86, 1.0, max(abs(p.x), abs(p.y))) * uStrength * 0.4);
        gl_FragColor = vec4(uTint, a);
      }`,
  }));
  mesh.renderOrder = 999;
  mesh.frustumCulled = false;
  return { mesh, u };
}
