// TOP face — Truman at his bathroom mirror.
// The top face of the cube *is* the mirror over his basin: a two-way mirror,
// and the viewer is the hidden camera behind it. With a bar of soap Truman
// draws a price chart of tez going down, looks at it, shakes his head, leans in
// to stare straight into the lens, and rubs it all off the glass.
import { createFaceFrame } from './faceframe.js';

const S = 18;                        // Truman's scale here (the model is ~0.12 tall)
const FLOOR = -1.95;
const COUNTER_Y = FLOOR + 1.07;
const COUNTER_D = 0.40;
const TRU = { x: 0.18, z: -0.55 };   // where he stands
const X0 = -1.7, X1 = 1.7, Y1 = 1.25, Z0 = -2.7;
const WAINSCOT = FLOOR + 1.5;
const LOOP = 28;
const GLASS = 0.62;                  // half size of the doodle texture on the glass
const DOODLE_PX = 1024;

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const ramp = (t, a, b) => smooth(clamp01((t - a) / (b - a)));
const lerp = (a, b, k) => a + (b - a) * k;
const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(THREE, c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function hexShade(hex, d) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + d)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// ---------------------------------------------------------------- 1950s bathroom textures
function tileTexture(THREE, base, grout, n, seed) {
  const c = makeCanvas(256, 256), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = grout; g.fillRect(0, 0, 256, 256);
  const s = 256 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = hexShade(base, (r() - 0.5) * 16);
    g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    const grd = g.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)'); grd.addColorStop(0.45, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.07)');
    g.fillStyle = grd; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  return canvasTex(THREE, c);
}
function checkerTexture(THREE) {
  const c = makeCanvas(256, 256), g = c.getContext('2d'), r = rng(3);
  g.fillStyle = '#8f8a80'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const dark = (i + j) % 2 === 0;
    g.fillStyle = dark ? hexShade('#1c1d21', r() * 8) : hexShade('#ece8de', -r() * 10);
    g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30);
  }
  return canvasTex(THREE, c);
}
function wallpaperTexture(THREE) {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#efe5cc'; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) { g.fillStyle = 'rgba(176,150,110,0.12)'; g.fillRect(x, 0, 9, 256); }
  // little sailboats (Seahaven is a seaside town), half-drop repeat
  g.fillStyle = 'rgba(64,112,124,0.55)';
  const boat = (x, y) => {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 17); g.lineTo(x + 10, y - 2); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x - 1.5, y - 14); g.lineTo(x - 1.5, y - 2); g.lineTo(x - 7, y - 2); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x - 9, y + 1); g.lineTo(x + 13, y + 1); g.lineTo(x + 9, y + 6); g.lineTo(x - 6, y + 6); g.closePath(); g.fill();
  };
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) boat(i * 64 + 26 + (j % 2) * 32, j * 64 + 40);
  return canvasTex(THREE, c);
}
function curtainTexture(THREE) {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#f2b9c0'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#fff7f2';
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
    g.beginPath(); g.arc(i * 42.7 + (j % 2) * 21 + 10, j * 42.7 + 12, 7, 0, 6.3); g.fill();
  }
  return canvasTex(THREE, c);
}
function towelTexture(THREE) {
  const c = makeCanvas(128, 256), g = c.getContext('2d'), r = rng(9);
  g.fillStyle = '#9fc4d8'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.12})`; g.fillRect(r() * 128, r() * 256, 1, 2); }
  g.fillStyle = '#f5f1e8'; g.fillRect(0, 196, 128, 14); g.fillRect(0, 216, 128, 5);
  return canvasTex(THREE, c, false);
}
function laminateTexture(THREE) {
  const c = makeCanvas(256, 256), g = c.getContext('2d'), r = rng(17);
  g.fillStyle = '#f0d3cf'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(120,90,90,0.25)' : 'rgba(255,255,255,0.5)';
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r());
  }
  return canvasTex(THREE, c);
}

// ---------------------------------------------------------------- the drawing on the glass
// Glass coordinates: x to the viewer's right, y up (Truman's right hand is on
// the viewer's left). The soap is on Truman's side of the glass.
function resample(pts, step = 0.008) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}
function arc(cx, cy, r, a0, a1, n = 48) {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return p;
}
function arcE(cx, cy, rx, ry, a0, a1, n = 40) {
  const p = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return p;
}
function roundedRect(cx, cy, hw, hh, r) {
  const p = [];
  const corner = (x, y, a0) => { for (let i = 0; i <= 8; i++) { const a = a0 - i / 8 * Math.PI / 2; p.push([x + r * Math.cos(a), y + r * Math.sin(a)]); } };
  p.push([cx, cy + hh]);
  corner(cx + hw - r, cy + hh - r, Math.PI / 2);
  corner(cx + hw - r, cy - hh + r, 0);
  corner(cx - hw + r, cy - hh + r, -Math.PI / 2);
  corner(cx - hw + r, cy + hh - r, Math.PI);
  p.push([cx + 0.01, cy + hh]);
  return p;
}
function smoothPath(pts, n) {
  // Catmull-Rom through the points
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// a price chart of tez going down, drawn to read right from behind the glass
// (the hidden camera's side): axes with ticks, a jagged line falling to the
// right, an arrow at the end, and XTZ written over it
function makeChart(tx, hy) {
  const S = [];
  const x0 = tx - 0.58, x1 = tx - 0.17;            // to his right (our left), clear of his body and inside the frame (opening +-0.452)
  const y0 = hy - 0.27, y1 = hy + 0.12;            // between his chest and his eyes
  S.push([[x0, y1], [x0, y0], [x1, y0]]);
  [0.25, 0.5, 0.75].forEach((f) => S.push([[x0 - 0.016, y0 + (y1 - y0) * f], [x0 + 0.011, y0 + (y1 - y0) * f]]));
  const W = x1 - x0, H = y1 - y0;
  const line = [[0.06, 0.66], [0.14, 0.76], [0.22, 0.6], [0.3, 0.68], [0.39, 0.48], [0.46, 0.54], [0.55, 0.34], [0.62, 0.4], [0.71, 0.2], [0.8, 0.25], [0.9, 0.07]]
    .map(([u, v]) => [x0 + u * W, y0 + v * H]);
  S.push(line);
  const [ex, ey] = line[line.length - 1];
  S.push([[ex - 0.045, ey + 0.01], [ex, ey], [ex - 0.01, ey + 0.045]]);
  // XTZ in the empty top right of the chart
  const h = 0.052, w = 0.036, gap = 0.018;
  const lx = x0 + 0.55 * W, ly = y0 + 0.74 * H;
  S.push([[lx, ly + h], [lx + w, ly]]);
  S.push([[lx + w, ly + h], [lx, ly]]);
  const tx2 = lx + w + gap;
  S.push([[tx2, ly + h], [tx2 + w, ly + h]]);
  S.push([[tx2 + w / 2, ly + h], [tx2 + w / 2, ly]]);
  const zx = tx2 + w + gap;
  S.push([[zx, ly + h], [zx + w, ly + h], [zx, ly], [zx + w, ly]]);
  return S.map((pts) => resample(pts));
}
// hand path through the strokes: keys {t, x, y, z}; z < 0 = lifted off the glass.
// Drawn like a real hand: it eases into every stroke and out of it, slows down
// in the sharp turns, and lifts off the glass in a little arc between strokes.
function schedule(strokes, speed, lift) {
  const keys = [], segs = [];
  let t = 0;
  const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  strokes.forEach((pts, si) => {
    if (si > 0 && lift > 0) {
      const a = keys[keys.length - 1], b = pts[0];
      const jump = Math.hypot(b[0] - a.x, b[1] - a.y);
      const dur = lift + jump * 0.9;               // no hand flies between strokes
      for (let i = 1; i <= 8; i++) {
        const u = i / 8, e = sm(u);
        keys.push({
          t: t + dur * u, x: a.x + (b[0] - a.x) * e - 0.05 * Math.sin(Math.PI * u) * Math.min(1, jump * 4),
          y: a.y + (b[1] - a.y) * e + 0.015 * Math.sin(Math.PI * u) * Math.min(1, jump * 6),
          z: -0.055 * Math.sin(Math.PI * u),
        });
      }
      t += dur;
    }
    // how sharply the line turns at each point, spread a little to its neighbours
    const n = pts.length;
    const turn = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      const ax = pts[i][0] - pts[i - 1][0], ay = pts[i][1] - pts[i - 1][1];
      const bx = pts[i + 1][0] - pts[i][0], by = pts[i + 1][1] - pts[i][1];
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la > 1e-6 && lb > 1e-6) turn[i] = Math.acos(Math.min(1, Math.max(-1, (ax * bx + ay * by) / (la * lb))));
    }
    const slow = turn.map((_, i) => {
      let m = 0;
      for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) m = Math.max(m, turn[j] * (1 - Math.abs(j - i) / 4));
      return m;
    });
    const acc = [0];
    for (let i = 1; i < n; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = acc[n - 1];
    keys.push({ t, x: pts[0][0], y: pts[0][1], z: 0 });
    for (let i = 1; i < n; i++) {
      const q = pts[i - 1], p = pts[i];
      const ease = 0.3 + 0.7 * sm(acc[i] / 0.06) * sm((total - acc[i - 1]) / 0.06);
      const corner = 1 - 0.65 * Math.min(1, slow[i] / 1.1);
      const dt = (acc[i] - acc[i - 1]) / (speed * ease * corner);
      segs.push({ x0: q[0], y0: q[1], x1: p[0], y1: p[1], t0: t, t1: t + dt });
      t += dt;
      keys.push({ t, x: p[0], y: p[1], z: 0 });
    }
  });
  return { keys, segs, total: t };
}
function sampleKeys(keys, t, out) {
  if (t <= keys[0].t) { const k = keys[0]; return out.set(k.x, k.y, k.z); }
  let lo = 0, hi = keys.length - 1;
  if (t >= keys[hi].t) { const k = keys[hi]; return out.set(k.x, k.y, k.z); }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (keys[m].t <= t) lo = m; else hi = m; }
  const a = keys[lo], b = keys[hi], k = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return out.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k));
}
// a hand-drawn line is never clean: it wobbles, and the long curves get a
// second, looser pass
function sketchify(strokes, r) {
  const out = [];
  strokes.forEach((pts, si) => {
    const ph = r() * 10, amp = 0.0035;
    const wob = pts.map(([x, y], i) => [x + amp * Math.sin(i * 0.21 + ph), y + amp * Math.cos(i * 0.17 + ph * 1.3)]);
    out.push(wob);
    if (pts.length > 40 && si < 3) {
      const ph2 = r() * 10;
      out.push(wob.slice(Math.floor(wob.length * 0.12)).map(([x, y], i) => [x + 0.006 * Math.sin(i * 0.05 + ph2), y + 0.006 * Math.cos(i * 0.04 + ph2)]));
    }
  });
  return out;
}
// at the end he rubs the whole chart off the glass
function makeChartWipe(tx, hy) {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const y = hy + 0.12 - i * 0.078;
    const a = [tx + (i % 2 ? -0.15 : -0.61), y], b = [tx + (i % 2 ? -0.61 : -0.15), y - 0.02];
    p.push(a, b);
  }
  return resample(p, 0.01);
}
// R: soap on the glass (a bar of soap leaves streaks along the stroke),
// G: when it is drawn (0..1), B: when the hand rubs it off (0..1)
function soapTexture(THREE, draw, wipe) {
  const N = DOODLE_PX, k = N / (2 * GLASS);
  const px = (x) => (x + GLASS) * k, py = (y) => (GLASS - y) * k;
  const cc = makeCanvas(N, N), gc = cc.getContext('2d');
  gc.fillStyle = '#000'; gc.fillRect(0, 0, N, N);
  gc.fillStyle = '#fff';
  const r = rng(11);
  const LANES = 8, W = 0.018 * k;
  const laneA = Array.from({ length: LANES }, () => 0.3 + 0.55 * r());
  let along = 0;
  for (const s of draw.segs) {
    const ax = px(s.x0), ay = py(s.y0), bx = px(s.x1), by = py(s.y1);
    const L = Math.hypot(bx - ax, by - ay);
    if (L < 1e-3) continue;
    const dx = (bx - ax) / L, dy = (by - ay) / L, nx = -dy, ny = dx;
    for (let d = 0; d < L; d += 1.1) {
      along += 1.1;
      const x = ax + dx * d, y = ay + dy * d;
      const press = 0.75 + 0.25 * Math.sin(along * 0.011) * Math.sin(along * 0.0037 + 1.0);
      for (let l = 0; l < LANES; l++) {
        const off = (l / (LANES - 1) - 0.5) * W * press;
        gc.globalAlpha = laneA[l] * (0.6 + 0.4 * Math.sin(along * 0.05 + l * 1.7)) * 0.6;
        gc.fillRect(x + nx * off - 1.1, y + ny * off - 1.1, 2.2, 2.2);
      }
    }
  }
  gc.globalAlpha = 1;
  const paint = (segs, total, width, chan) => {
    const c = makeCanvas(N, N), g = c.getContext('2d');
    g.fillStyle = chan === 1 ? 'rgb(0,255,0)' : 'rgb(0,0,255)';
    g.fillRect(0, 0, N, N);
    g.lineCap = 'round';
    g.lineWidth = width;
    // latest first, so where lines cross the earliest time wins
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      const v = Math.round(250 * ((s.t0 + s.t1) * 0.5) / total);
      g.strokeStyle = chan === 1 ? `rgb(0,${v},0)` : `rgb(0,0,${v})`;
      g.beginPath(); g.moveTo(px(s.x0), py(s.y0)); g.lineTo(px(s.x1), py(s.y1)); g.stroke();
    }
    return g.getImageData(0, 0, N, N).data;
  };
  const G = paint(draw.segs, draw.total, W + 6, 1);
  const B = paint(wipe.segs, wipe.total, 0.17 * k, 2);
  const R = gc.getImageData(0, 0, N, N).data;
  const out = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    const src = (N - 1 - y) * N * 4, dst = y * N * 4;
    for (let x = 0; x < N * 4; x += 4) {
      out[dst + x] = R[src + x];
      out[dst + x + 1] = G[src + x + 1];
      out[dst + x + 2] = B[src + x + 2];
      out[dst + x + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
const SOAP_FRAG = /* glsl */ `
  uniform sampler2D uDoodle;
  uniform float uDraw;
  uniform float uWipe;
  uniform float uHaze;
  varying vec2 vUv;
  void main() {
    vec3 d = texture2D(uDoodle, vUv).rgb;
    float drawn = smoothstep(d.g - 0.006, d.g + 0.002, uDraw);
    float wiped = smoothstep(d.b - 0.01, d.b + 0.01, uWipe) * step(d.b, 0.99);
    // once rubbed off, only a faint smear of soap stays where the lines were
    float a = d.r * drawn * mix(0.94, 0.1 * uHaze, wiped);
    gl_FragColor = vec4(vec3(0.9, 0.93, 0.96), clamp(a, 0.0, 1.0));
    #include <encodings_fragment>
  }`;

export function createMirror(THREE, { root, noiseTex, uniforms, trumanArmature, trumanClip, makeRig }) {
  const ff = createFaceFrame(THREE, { root, face: 'top', name: 'BathroomMirror' });
  const { world, frame } = ff;

  const add = (geo, mat, x, y, z, parent = frame) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const std = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, envMapIntensity: 0.5, ...extra });
  // a plane whose UVs are in world units / tile (so every wall has the same tile size)
  const panel = (w, h, mat, tile, x, y, z, rx = 0, ry = 0) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
    const m = add(geo, mat, x, y, z);
    m.rotation.set(rx, ry, 0);
    return m;
  };

  // ---------------------------------------------------------------- the room
  const tileMat = std(0xffffff, 0.22, { map: tileTexture(THREE, '#9fd3c1', '#e9efe9', 4, 5), envMapIntensity: 0.8 });
  const capMat = std(0x2f6f62, 0.25, { envMapIntensity: 0.8 });
  const paperMat = std(0xffffff, 0.85, { map: wallpaperTexture(THREE) });
  const floorMat = std(0xffffff, 0.35, { map: checkerTexture(THREE), envMapIntensity: 0.6 });
  const ceilMat = std(0xf3efe6, 0.9);
  const tileH = WAINSCOT - FLOOR, paperH = Y1 - WAINSCOT;
  const depth = -Z0, width = X1 - X0;
  // back wall
  panel(width, tileH, tileMat, 0.52, 0, FLOOR + tileH / 2, Z0);
  panel(width, paperH, paperMat, 0.6, 0, WAINSCOT + paperH / 2, Z0);
  // side walls
  panel(depth, tileH, tileMat, 0.52, X0, FLOOR + tileH / 2, Z0 / 2, 0, Math.PI / 2);
  panel(depth, paperH, paperMat, 0.6, X0, WAINSCOT + paperH / 2, Z0 / 2, 0, Math.PI / 2);
  panel(depth, tileH, tileMat, 0.52, X1, FLOOR + tileH / 2, Z0 / 2, 0, -Math.PI / 2);
  panel(depth, paperH, paperMat, 0.6, X1, WAINSCOT + paperH / 2, Z0 / 2, 0, -Math.PI / 2);
  // floor and ceiling
  panel(width, depth, floorMat, 0.72, 0, FLOOR, Z0 / 2, -Math.PI / 2);
  panel(width, depth, ceilMat, 1, 0, Y1, Z0 / 2, Math.PI / 2);
  // bullnose cap on the tiles
  add(new THREE.BoxGeometry(width, 0.04, 0.03), capMat, 0, WAINSCOT, Z0 + 0.015);
  add(new THREE.BoxGeometry(0.03, 0.04, depth), capMat, X0 + 0.015, WAINSCOT, Z0 / 2);
  add(new THREE.BoxGeometry(0.03, 0.04, depth), capMat, X1 - 0.015, WAINSCOT, Z0 / 2);

  // ---------------------------------------------------------------- the vanity: cabinet, counter, basin, taps
  const cabinetMat = std(0xf7f4ec, 0.5);
  add(new THREE.BoxGeometry(1.8, COUNTER_Y - 0.04 - FLOOR, COUNTER_D - 0.05), cabinetMat, 0, (COUNTER_Y - 0.04 + FLOOR) / 2, -(COUNTER_D - 0.05) / 2);
  const top = new THREE.Shape();
  top.moveTo(-0.95, 0); top.lineTo(-0.95, -COUNTER_D - 0.02); top.lineTo(0.95, -COUNTER_D - 0.02); top.lineTo(0.95, 0); top.lineTo(-0.95, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, -0.25, 0.21, 0.15, 0, Math.PI * 2, true);
  top.holes.push(hole);
  const topGeo = new THREE.ExtrudeGeometry(top, { depth: 0.04, bevelEnabled: false, curveSegments: 40 });
  topGeo.rotateX(Math.PI / 2);                 // shape y -> z (negative: towards the room), depth -> down
  const lam = laminateTexture(THREE);
  lam.repeat.set(2.5, 2.5);
  const counter = add(topGeo, std(0xffffff, 0.35, { map: lam }), 0, COUNTER_Y, 0);
  counter.castShadow = true;
  const porcelain = std(0xfbfbf8, 0.12, { envMapIntensity: 0.9 });
  const bowl = add(new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfbfbf8, roughness: 0.12, side: THREE.BackSide, envMapIntensity: 0.9 }), 0, COUNTER_Y - 0.035, -0.25);
  bowl.scale.set(0.21, 0.13, 0.15);
  const drain = add(new THREE.CircleGeometry(0.018, 20), std(0x9a9ca0, 0.25, { metalness: 1 }), 0, COUNTER_Y - 0.163, -0.25);
  drain.rotation.x = -Math.PI / 2;
  const chrome = std(0xe8eaee, 0.12, { metalness: 1.0, envMapIntensity: 1.2 });
  add(new THREE.CylinderGeometry(0.03, 0.036, 0.05, 20), chrome, 0, COUNTER_Y + 0.025, -0.06);
  const spout = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, COUNTER_Y + 0.04, -0.06), new THREE.Vector3(0, COUNTER_Y + 0.17, -0.07),
    new THREE.Vector3(0, COUNTER_Y + 0.21, -0.12), new THREE.Vector3(0, COUNTER_Y + 0.17, -0.19),
  ]);
  add(new THREE.TubeGeometry(spout, 24, 0.015, 10), chrome, 0, 0, 0);
  [-0.13, 0.13].forEach((x) => {
    add(new THREE.CylinderGeometry(0.02, 0.026, 0.05, 16), chrome, x, COUNTER_Y + 0.025, -0.07);
    const cross = add(new THREE.BoxGeometry(0.075, 0.012, 0.012), chrome, x, COUNTER_Y + 0.055, -0.07);
    cross.rotation.y = 0.5;
    add(new THREE.BoxGeometry(0.012, 0.012, 0.075), chrome, x, COUNTER_Y + 0.055, -0.07).rotation.y = 0.5;
  });
  // a tumbler with toothbrushes, a can of shaving cream
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xdfeef0, roughness: 0.05, transparent: true, opacity: 0.35, envMapIntensity: 1.2 });
  add(new THREE.CylinderGeometry(0.035, 0.03, 0.11, 18, 1, true), glassMat, 0.6, COUNTER_Y + 0.055, -0.16);
  [[0x3f7fbf, 0.25], [0xd8574a, -0.25]].forEach(([c, a]) => {
    const b = add(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8), std(c, 0.4), 0.6 + a * 0.04, COUNTER_Y + 0.12, -0.16);
    b.rotation.z = a;
  });
  const can = add(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 18), std(0xc7ccd3, 0.25, { metalness: 0.8 }), -0.62, COUNTER_Y + 0.075, -0.14);
  can.castShadow = true;
  add(new THREE.CylinderGeometry(0.031, 0.031, 0.05, 18), std(0x2e5aa8, 0.4), -0.62, COUNTER_Y + 0.09, -0.14);

  // ---------------------------------------------------------------- vanity light over the mirror
  add(new THREE.BoxGeometry(1.0, 0.03, 0.05), chrome, 0, 0.72, -0.03);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff6e6, emissive: 0xffe3b8, emissiveIntensity: 2.2, roughness: 0.4 });
  [-0.38, 0, 0.38].forEach((x) => {
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), chrome, x, 0.69, -0.06);
    add(new THREE.SphereGeometry(0.06, 20, 12), bulbMat, x, 0.62, -0.08);
  });
  const vanity = new THREE.PointLight(0xffe2b5, 1.15, 0, 2);
  vanity.position.set(0, 0.56, -0.2);
  frame.add(vanity);

  // ---------------------------------------------------------------- the bathtub and its curtain (behind Truman)
  const enamel = std(0xf8f6f0, 0.18, { envMapIntensity: 0.8 });
  add(new THREE.BoxGeometry(1.95, 0.62, 0.85), enamel, X0 + 0.975, FLOOR + 0.31, Z0 + 0.425);
  add(new THREE.CylinderGeometry(0.012, 0.012, 1.95, 10), chrome, X0 + 0.975, 1.08, Z0 + 0.86).rotation.z = Math.PI / 2;
  const curtainGeo = new THREE.PlaneGeometry(1.45, 2.15, 90, 1);
  const cp = curtainGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i);
    const fold = Math.sin(x * 44) * 0.035 + Math.sin(x * 17 + 1.3) * 0.02;
    cp.setZ(i, fold * (0.75 + 0.25 * (y + 1.075) / 2.15));
  }
  curtainGeo.computeVertexNormals();
  const curtainTex = curtainTexture(THREE);
  curtainTex.repeat.set(3.2, 4.5);
  const curtain = add(curtainGeo, std(0xffffff, 0.8, { map: curtainTex, side: THREE.DoubleSide }), X0 + 0.74, 1.05 - 1.075, Z0 + 0.86);
  curtain.castShadow = true;
  const ring = new THREE.TorusGeometry(0.018, 0.004, 6, 14);
  for (let i = 0; i < 14; i++) add(ring, chrome, X0 + 0.06 + i * 0.105, 1.07, Z0 + 0.86).rotation.y = Math.PI / 2;

  // ---------------------------------------------------------------- frosted window with morning light (right wall)
  const winZ0 = -1.75, winZ1 = -0.95, winY0 = -0.05, winY1 = 0.85;
  const frost = add(new THREE.PlaneGeometry(winZ1 - winZ0, winY1 - winY0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.18, 1.05) }), X1 - 0.004, (winY0 + winY1) / 2, (winZ0 + winZ1) / 2);
  frost.rotation.y = -Math.PI / 2;
  const sashMat = std(0xfbfaf4, 0.5);
  [[0.05, winY1 - winY0 + 0.1, 0.05, (winY0 + winY1) / 2, winZ0], [0.05, winY1 - winY0 + 0.1, 0.05, (winY0 + winY1) / 2, winZ1],
    [0.05, 0.05, winZ1 - winZ0, winY0, (winZ0 + winZ1) / 2], [0.05, 0.05, winZ1 - winZ0, winY1, (winZ0 + winZ1) / 2],
    [0.03, 0.03, winZ1 - winZ0, (winY0 + winY1) / 2, (winZ0 + winZ1) / 2], [0.03, winY1 - winY0, 0.03, (winY0 + winY1) / 2, (winZ0 + winZ1) / 2],
  ].forEach(([w, h, d, y, z]) => add(new THREE.BoxGeometry(w, h, d), sashMat, X1 - 0.02, y, z));
  // a soft shaft of light from the window
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 2.4, 4, 1, true), new THREE.ShaderMaterial({
    name: 'WindowShaft', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: uniforms.uTime, uNoise: { value: noiseTex } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform sampler2D uNoise; varying vec2 vUv;
      void main() {
        float along = vUv.y;                       // 1 at the window
        float edge = sin(vUv.x * 3.14159 * 4.0);   // four faces of the prism
        float n = texture2D(uNoise, vec2(vUv.x * 2.0, vUv.y * 0.6 - uTime * 0.01)).r;
        float a = smoothstep(0.0, 0.7, along) * (0.5 + 0.5 * abs(edge)) * (0.7 + 0.3 * n) * 0.05;
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * a, a);
      }`,
  }));
  shaft.position.set(X1 - 1.05, 0.05, -1.35);
  shaft.rotation.set(0, 0, -1.05);
  frame.add(shaft);

  // towel bar and towel (left wall)
  add(new THREE.CylinderGeometry(0.01, 0.01, 0.62, 10), chrome, X0 + 0.07, -0.2, -1.15).rotation.x = Math.PI / 2;
  const towel = add(new THREE.BoxGeometry(0.035, 0.62, 0.5), std(0xffffff, 0.95, { map: towelTexture(THREE) }), X0 + 0.075, -0.5, -1.15);
  towel.castShadow = true;
  // ceiling light
  const dome = add(new THREE.SphereGeometry(0.2, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.2 }), 0, Y1, -1.4);
  dome.rotation.x = Math.PI;

  // ---------------------------------------------------------------- light
  frame.add(new THREE.HemisphereLight(0xfff4e8, 0x6d6658, 0.6));
  const ceilingLight = new THREE.PointLight(0xfff1dc, 0.8, 0, 2);
  ceilingLight.position.set(0, Y1 - 0.25, -1.4);
  frame.add(ceilingLight);
  const daylight = new THREE.DirectionalLight(0xfff0d6, 2.2);
  daylight.position.set(X1 + 1.2, 1.3, -1.35);
  daylight.target.position.set(-0.2, FLOOR + 1.1, -0.9);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1024, 1024);
  Object.assign(daylight.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.3, far: 6 });
  daylight.shadow.bias = -0.0006;
  daylight.shadow.normalBias = 0.01;
  frame.add(daylight);
  frame.add(daylight.target);

  // ---------------------------------------------------------------- Truman
  const rig = makeRig(THREE, { armature: trumanArmature, clip: trumanClip, space: frame, position: new THREE.Vector3(TRU.x, FLOOR, TRU.z), yaw: -Math.PI / 2 });
  rig.pivot.scale.setScalar(S);
  rig.pose(4.8, {});
  const ARM = rig.armLength('Right');
  // wrist -> fingertip (pointing) and wrist -> knuckles (open hand), measured on the model
  const measure = (tipName) => {
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    rig.bonePos('RightHand', a); rig.bonePos(tipName, b);
    frame.worldToLocal(a); frame.worldToLocal(b);
    return a.distanceTo(b);
  };
  frame.updateMatrixWorld(true);
  rig.curl('Right', 1.0, 0.7, { Index: 0.06 });
  const POINT = measure('RightHandIndex4');
  rig.pose(4.8, {});
  const PALM = measure('RightHandMiddle1');

  // where his face is while he leans over the basin: the helmet is drawn round it
  rig.pose(4.8, { lean: 19, lookSide: -6 });
  frame.updateMatrixWorld(true);
  const hA = new THREE.Vector3(), hB = new THREE.Vector3();
  rig.bonePos('Head', hA); rig.bonePos('HeadTop_End', hB);
  frame.worldToLocal(hA); frame.worldToLocal(hB);
  const HEAD = { x: (hA.x + hB.x) / 2, y: (hA.y + hB.y) / 2 + 0.01 };

  // ---------------------------------------------------------------- a bar of soap, and what he draws with it
  add(new THREE.CylinderGeometry(0.06, 0.05, 0.012, 20), porcelain, -0.38, COUNTER_Y + 0.006, -0.12);   // the empty soap dish
  const SOAP_OFF = 0.045;     // knuckles -> the face of the bar on the glass
  const soap = add(new THREE.BoxGeometry(0.07, 0.042, 0.026), std(0xf3ecdc, 0.6), 0, 0, 0);
  soap.castShadow = true;
  const strokes = sketchify(makeChart(TRU.x, HEAD.y), rng(31));
  const draw = schedule(strokes, 0.95, 0.2);
  const wipe = schedule([makeChartWipe(TRU.x, HEAD.y)], 2.2, 0);
  const soapU = { uDoodle: { value: soapTexture(THREE, draw, wipe) }, uDraw: { value: 0 }, uWipe: { value: 0 }, uHaze: { value: 0 } };
  const doodle = new THREE.Mesh(new THREE.PlaneGeometry(2 * GLASS, 2 * GLASS), new THREE.ShaderMaterial({
    name: 'SoapDoodle', transparent: true, depthWrite: false, uniforms: soapU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SOAP_FRAG,
  }));
  doodle.position.z = -0.003;
  doodle.renderOrder = 5;
  frame.add(doodle);

  // the glass itself (fixed to the face, not to the turning frame): a two-way
  // mirror seen from behind is a touch dark
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    name: 'TwoWayGlass', color: 0x040607, transparent: true, opacity: 0.06, depthWrite: false,
  }));
  glass.rotation.x = -Math.PI / 2;
  glass.position.y = 0.4992;
  glass.renderOrder = 6;
  world.add(glass);

  // the mirror's frame: chrome with a rounded edge, round the border of the face
  // (fixed to the face, so it never turns with the room behind it)
  {
    const outer = new THREE.Shape();
    outer.moveTo(-0.5, -0.5); outer.lineTo(0.5, -0.5); outer.lineTo(0.5, 0.5); outer.lineTo(-0.5, 0.5); outer.lineTo(-0.5, -0.5);
    const iw = 0.452, ir = 0.035;
    const hole = new THREE.Path();
    hole.moveTo(-iw + ir, -iw);
    hole.lineTo(iw - ir, -iw); hole.quadraticCurveTo(iw, -iw, iw, -iw + ir);
    hole.lineTo(iw, iw - ir); hole.quadraticCurveTo(iw, iw, iw - ir, iw);
    hole.lineTo(-iw + ir, iw); hole.quadraticCurveTo(-iw, iw, -iw, iw - ir);
    hole.lineTo(-iw, -iw + ir); hole.quadraticCurveTo(-iw, -iw, -iw + ir, -iw);
    outer.holes.push(hole);
    const depth = 0.02, bevel = 0.007;
    const geo = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 8 });
    geo.rotateX(-Math.PI / 2);                       // the extrusion runs up, towards the face
    // a light satin-nickel frame: it has to read clearly from behind the glass,
    // where the bathroom lights do not reach it
    const chromeFrame = new THREE.MeshStandardMaterial({ name: 'MirrorFrame', color: 0xe9e6df, metalness: 0.35, roughness: 0.32, envMapIntensity: 0.3, emissive: 0x2a2926 });
    const mirrorFrame = new THREE.Mesh(geo, chromeFrame);
    mirrorFrame.position.y = 0.5 - depth - bevel - 0.0005;
    mirrorFrame.receiveShadow = true;
    world.add(mirrorFrame);
    // a dark line where the glass meets the frame, and a screw in each corner
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x9da3aa, metalness: 1.0, roughness: 0.35 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), screwMat);
      screw.position.set(sx * 0.476, 0.5 - 0.0015, sz * 0.476);
      world.add(screw);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.001, 0.0018), new THREE.MeshBasicMaterial({ color: 0x2a2d31 }));
      slot.position.set(sx * 0.476, 0.5 - 0.0008, sz * 0.476);
      slot.rotation.y = 0.6;
      world.add(slot);
    });
  }

  // ---------------------------------------------------------------- timeline
  // he draws the chart · looks at it and shakes his head · leans in and
  // stares straight into the lens · rubs it all off the glass · the smear
  // fades and it starts again
  const T_DRAW = 2.2, T_DRAW_END = T_DRAW + draw.total;
  const T_PLAY_END = T_DRAW_END + 3.2;
  const T_STARE = T_PLAY_END, T_STARE_END = T_STARE + 3.6;
  const T_WIPE = T_STARE_END + 0.6, T_WIPE_END = T_WIPE + wipe.total;
  const LOOP_M = Math.max(LOOP, T_WIPE_END + 4.5);

  const v = new THREE.Vector3(), cW = new THREE.Vector3(), shoulder = new THREE.Vector3(), dir = new THREE.Vector3();
  const wrist = new THREE.Vector3(), pole = new THREE.Vector3(), tmp = new THREE.Vector3();
  const contact = new THREE.Vector3(), tip = new THREE.Vector3(), err = new THREE.Vector3();
  const prevContact = new THREE.Vector3(), vel = new THREE.Vector2(), tgt = new THREE.Vector3();
  const elbowW = new THREE.Vector3(), handWW = new THREE.Vector3(), fore = new THREE.Vector3(), nW = new THREE.Vector3(), dW = new THREE.Vector3();
  const sfA = new THREE.Vector3(), sfB = new THREE.Vector3(), sfDir = new THREE.Vector3(), sfN = new THREE.Vector3();
  let LOWPASS = 0;          // debug: a low-pass on the arm joints (not needed any more)
  const arm = { ready: false, lastT: 0, qa: new THREE.Quaternion(), qf: new THREE.Quaternion(), pole: new THREE.Vector3(), roll: 0, vx: 0 };
  const handEase = { drawX: TRU.x };
  // where the bar of soap is when his hand hangs by his side (frame coords)
  const REST_TIP = new THREE.Vector3(TRU.x - 0.3, FLOOR + 0.92, TRU.z + 0.12);
  // the palm turns to face the glass, a little downwards
  const PALM_GOAL = new THREE.Vector3(0, -0.45, 0.9).normalize();
  // a straight wrist: the hand continues the forearm (worked out once, in the forearm's own space)
  const HB = rig.bones.RightHand;
  const kLocal = rig.bones.RightHandMiddle1.position.clone().normalize();
  const uLocal = HB.position.clone().normalize();
  const HAND_STRAIGHT = new THREE.Quaternion().setFromUnitVectors(kLocal, uLocal);
  const handBase = { q: HAND_STRAIGHT.clone(), baked: false };
  const acrossL = rig.bones.RightHandIndex1.position.clone().sub(rig.bones.RightHandPinky1.position).normalize();
  const palmLocal = new THREE.Vector3().crossVectors(kLocal, acrossL).negate().normalize();
  // the bar of soap sits in his curled fingers, in front of the palm (world coords)
  const soapFaceWorld = (out) => {
    rig.bonePos('RightHand', sfA); rig.bonePos('RightHandMiddle1', sfB);
    sfDir.subVectors(sfB, sfA);
    const len = sfDir.length();
    sfDir.normalize();
    sfN.copy(palmLocal).transformDirection(HB.matrixWorld);
    // on the axis of the straight hand: the point does not move when the
    // forearm turns, so the arm has one answer per frame (no flip-flopping)
    return out.copy(sfB).addScaledVector(sfDir, len * 0.35);
  };
  const soapFace = (out) => frame.worldToLocal(soapFaceWorld(out));

  const update = (time, dt, camera, rootQuat) => {
    ff.orient(camera, rootQuat, dt);
    const t = time % LOOP_M;

    // --- body: leans over the basin to draw, looks at the chart, leans in to stare
    const onGlass = ramp(t, T_DRAW - 0.8, T_DRAW) * (1 - ramp(t, T_DRAW_END, T_DRAW_END + 0.7));
    const onWipe = ramp(t, T_WIPE - 0.6, T_WIPE) * (1 - ramp(t, T_WIPE_END, T_WIPE_END + 0.6));
    const play = ramp(t, T_DRAW_END + 0.4, T_DRAW_END + 1.2) * (1 - ramp(t, T_PLAY_END - 0.5, T_PLAY_END));
    const stare = ramp(t, T_STARE, T_STARE + 1.4) * (1 - ramp(t, T_STARE_END, T_STARE_END + 0.9));
    const tp = t - T_DRAW_END;
    const lean = 6 + 13 * Math.max(onGlass, onWipe) + 17 * stare + play * 9;
    rig.pivot.position.set(TRU.x, FLOOR, TRU.z + 0.03 * stare);
    rig.pose(4.8, {
      lean: lean + Math.sin(time * 1.7) * 0.6,
      // the body follows the drawing hand a little
      sway: play * 1.5 * Math.sin(tp * 0.9) + 1.0 * Math.sin(time * 0.6)
        + 5 * Math.max(onGlass, onWipe) * Math.max(-1, Math.min(1, (TRU.x - handEase.drawX) * 2.2)),
      lookSide: -6 * onGlass + play * (-14 + 13 * Math.sin(tp * 5.5) * (1 - ramp(tp, 1.6, 2.6))),
      lookDown: 0.2 * onGlass + 0.35 * play - 0.15 * stare,
      extra: [['Head', 'side', 5 * stare]],
    });
    frame.updateMatrixWorld(true);

    // --- the right hand: the bar of soap on the glass, or down by his side
    if (t < T_STARE) {
      sampleKeys(draw.keys, Math.min(Math.max(t - T_DRAW, 0), draw.total), contact);
      if (t < T_DRAW) contact.z = -0.12 * (1 - ramp(t, T_DRAW - 0.45, T_DRAW));
      else if (t >= T_DRAW_END) contact.z = -0.12 * ramp(t, T_DRAW_END, T_DRAW_END + 0.45);
    } else {
      sampleKeys(wipe.keys, Math.min(Math.max(t - T_WIPE, 0), wipe.total), contact);
      if (t < T_WIPE) contact.z = -0.12 * (1 - ramp(t, T_WIPE - 0.45, T_WIPE));
      else if (t >= T_WIPE_END) contact.z = -0.12 * ramp(t, T_WIPE_END, T_WIPE_END + 0.45);
    }
    const k = Math.max(onGlass, onWipe);
    const fdt = Math.max(dt, 1e-3);
    const fresh = !arm.ready || t < arm.lastT;
    contact.z = Math.min(contact.z, -0.004);            // the bar touches the glass from Truman's side
    // where the bar should be: on the line, or down by his side
    tgt.lerpVectors(REST_TIP, contact, k);
    // the elbow points down and out, and its direction only drifts
    rig.bonePos('RightArm', shoulder); frame.worldToLocal(shoulder);
    // drawing: the elbow points down and out; hanging by his side: back and out
    // (a 'down' pole for an arm that already points down would be undefined)
    const across = smooth(clamp01((tgt.x - shoulder.x + 0.05) / 0.3));
    pole.set(shoulder.x - lerp(0.75, 0.3, across), shoulder.y - 0.85, shoulder.z - 0.3);
    tmp.set(shoulder.x - 0.5, shoulder.y - 0.2, shoulder.z - 0.9);
    pole.lerpVectors(tmp, pole, k);
    if (fresh) arm.pole.copy(pole); else arm.pole.lerp(pole, 1 - Math.exp(-fdt / 0.35));
    // carry on from last frame's arm, so it can never flip or twist round
    const B = rig.bones;
    if (!fresh) { B.RightArm.quaternion.copy(arm.qa); B.RightForeArm.quaternion.copy(arm.qf); }
    HB.quaternion.copy(handBase.q);
    B.RightArm.updateMatrixWorld(true);
    // the fingers hold the bar
    rig.curl('Right', 0.6, 0.5, { Index: 0.52, Ring: 0.66, Pinky: 0.72 });
    // the hand turns about the forearm so the palm faces the glass, leaning a
    // little into the direction it draws in; the turn is eased
    vel.set((contact.x - prevContact.x) / fdt, (contact.y - prevContact.y) / fdt);
    if (fresh || vel.length() > 6) vel.set(0, 0);
    prevContact.copy(contact);
    arm.vx += (vel.x * k - arm.vx) * (1 - Math.exp(-fdt / 0.25));
    rig.bonePos('RightForeArm', elbowW); rig.bonePos('RightHand', handWW);
    fore.subVectors(handWW, elbowW).normalize();
    nW.copy(palmLocal).transformDirection(HB.matrixWorld);
    dW.copy(PALM_GOAL).transformDirection(frame.matrixWorld);
    nW.addScaledVector(fore, -nW.dot(fore));
    dW.addScaledVector(fore, -dW.dot(fore));
    let roll = 0;
    if (nW.lengthSq() > 1e-8 && dW.lengthSq() > 1e-8) {
      nW.normalize(); dW.normalize();
      roll = Math.atan2(tmp.crossVectors(nW, dW).dot(fore), nW.dot(dW));
    }
    // the first time the bar is on the glass, bake the palm's turn into the wrist,
    // so from then on only small turns are ever needed (no flipping round)
    if (!handBase.baked && k > 0.9) {
      handBase.q.premultiply(new THREE.Quaternion().setFromAxisAngle(uLocal, roll));
      handBase.baked = true;
      roll = 0;
      if (!fresh) arm.roll = 0;
    }
    // stay on the same side as last frame's turn, and only turn so far
    if (!fresh) roll = arm.roll + Math.atan2(Math.sin(roll - arm.roll), Math.cos(roll - arm.roll));
    roll = Math.max(-0.9, Math.min(0.9, roll)) + 0.12 * Math.tanh(arm.vx * 2);
    if (fresh) arm.roll = roll; else arm.roll += (roll - arm.roll) * (1 - Math.exp(-fdt / 0.2));
    rig.rotateBone('RightHand', fore, arm.roll * 180 / Math.PI);
    // the arm puts the bar where it should be (the wrist keeps its angle)
    if (fresh) for (let i = 0; i < 3; i++) rig.reachTip('Right', soapFaceWorld, frame.localToWorld(cW.copy(REST_TIP)), frame.localToWorld(v.copy(arm.pole)));
    // one exact solve (the rig works in the armature's own space)
    frame.localToWorld(cW.copy(tgt));
    frame.localToWorld(v.copy(arm.pole));
    rig.reachTip('Right', soapFaceWorld, cW, v);
    if (!fresh && LOWPASS > 0) {
      const a = 1 - Math.exp(-fdt / LOWPASS);
      B.RightArm.quaternion.copy(arm.qa.slerp(B.RightArm.quaternion, a));
      B.RightForeArm.quaternion.copy(arm.qf.slerp(B.RightForeArm.quaternion, a));
      B.RightArm.updateMatrixWorld(true);
    }
    arm.qa.copy(B.RightArm.quaternion); arm.qf.copy(B.RightForeArm.quaternion);
    arm.ready = true; arm.lastT = t;
    handEase.drawX = contact.x;
    // the bar of soap in his fingers
    soapFace(tip);
    sfN.copy(palmLocal).transformDirection(HB.matrixWorld);
    v.copy(tip); frame.localToWorld(v);
    soap.position.copy(tip);
    soap.lookAt(v.add(sfN));
    // the left hand leans on the counter when he bends over it
    const leanK = clamp01((lean - 8) / 14) * (1 - play);
    if (leanK > 0) {
      v.set(TRU.x + 0.36, COUNTER_Y + 0.03, -COUNTER_D + 0.1);
      pole.set(TRU.x + 0.9, COUNTER_Y + 0.4, TRU.z - 0.4);
      rig.reach('Left', frame.localToWorld(v), leanK, frame.localToWorld(pole));
      rig.curl('Left', 0.2 * leanK);
    }

    // --- the soap on the glass
    // the line appears right behind the bar, as if the bar left it
    soapU.uDraw.value = t < T_DRAW + 0.02 ? 0 : Math.min(0.999, (t - T_DRAW - 0.02) / draw.total);
    soapU.uWipe.value = t < T_WIPE ? 0 : Math.min(1, (t - T_WIPE) / wipe.total);
    soapU.uHaze.value = 1 - ramp(t, T_WIPE_END + 1.0, LOOP_M - 0.5);
  };

  return { world, frame, update, rig, dbg: { contact, tip, wrist, shoulder, HEAD, ARM, arm, handBase, setLowpass: (v) => { LOWPASS = v; } } };
}
