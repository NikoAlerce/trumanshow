// Shared wave model: the same sum of directional waves is evaluated on the
// GPU (ocean surface, cut-away skirts, wet line on the wall) and on the CPU
// (boat bobbing), so everything moves together.
//
// Units are content units (the cube is 1 x 1 x 1, ~12 m in the fiction).

export const WATER_Y = -0.371;      // mean sea level
export const WALL_X = -0.474;       // front face of the painted sky wall
export const LEDGE_X = -0.398;      // front face of the ledge / stairs
const G = 0.82;                     // gravity in content units / s^2 (9.81 m/s^2 at 12 m per unit)
const TIME_SCALE = 0.85;            // a touch slower than real life: calm after the storm

// [dirX, dirZ, wavelength, amplitude, phase]
const RAW = [
  [-1.00, 0.22, 0.46, 0.0064, 0.0],
  [-0.78, -0.62, 0.29, 0.0040, 1.7],
  [-0.30, 1.00, 0.19, 0.0024, 4.1],
  [-1.00, -0.12, 0.123, 0.0014, 2.3],
  [0.55, 0.83, 0.083, 0.0008, 5.2],
];

export const WAVES = RAW.map(([dx, dz, L, A, P]) => {
  const n = Math.hypot(dx, dz);
  const k = (2 * Math.PI) / L;
  return { dx: dx / n, dz: dz / n, k, A, P, w: Math.sqrt(G * k) * TIME_SCALE };
});

// sharpened sine: crests a little narrower than troughs
const SHARP = 1.5;

export function waveHeight(x, z, t) {
  let h = 0;
  for (const wv of WAVES) {
    const ph = wv.k * (wv.dx * x + wv.dz * z) - wv.w * t + wv.P;
    const s = (Math.sin(ph) + 1) * 0.5;
    h += wv.A * (2 * Math.pow(s, SHARP) - 1);
  }
  return h;
}

// amplitude fade far away from the cube (keeps the horizon calm and alias free)
export function waveFade(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z));
  const t = Math.min(1, Math.max(0, (d - 0.6) / (1.08 - 0.6)));
  return 1 - t * t * (3 - 2 * t);
}

const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

// GLSL chunk with waveH(p, t, out grad) and waveFade(p)
export const WAVES_GLSL = /* glsl */ `
float waveFade(vec2 p) {
  float d = max(abs(p.x), abs(p.y));
  return 1.0 - smoothstep(0.6, 1.08, d);
}
float waveH(vec2 p, float t, out vec2 grad) {
  float h = 0.0;
  grad = vec2(0.0);
  vec2 d; float ph; float s; float c; float sp;
${WAVES.map((w) => `
  d = vec2(${f(w.dx)}, ${f(w.dz)});
  ph = ${f(w.k)} * dot(d, p) - ${f(w.w)} * t + ${f(w.P)};
  s = (sin(ph) + 1.0) * 0.5; c = cos(ph);
  sp = pow(max(s, 1e-4), ${f(SHARP - 1)});
  h += ${f(w.A)} * (2.0 * sp * s - 1.0);
  grad += ${f(w.A * SHARP * w.k)} * sp * c * d;`).join('')}
  return h;
}
`;

// Portal test: a fragment of a world is only visible if the segment from the
// camera to it passes through one of the cube faces (windows) that show that
// world. Each material enables its windows with defines: PORTAL_RX (+x),
// PORTAL_LX (-x), PORTAL_FZ (+z), PORTAL_BZ (-z), PORTAL_TY (+y), PORTAL_DY (-y).
export const PORTAL_GLSL = /* glsl */ `
bool seenThroughWindow(vec3 C, vec3 P) {
  const float H = 0.5;
  const float E = 0.004;
  if (all(lessThanEqual(abs(C), vec3(H)))) return true;
  vec3 d = P - C;
  float t; vec3 q;
#ifdef PORTAL_RX
  if (C.x > H && P.x < H + E) { t = (H - C.x) / d.x; q = C + d * t; if (abs(q.y) <= H + E && abs(q.z) <= H + E) return true; }
#endif
#ifdef PORTAL_LX
  if (C.x < -H && P.x > -H - E) { t = (-H - C.x) / d.x; q = C + d * t; if (abs(q.y) <= H + E && abs(q.z) <= H + E) return true; }
#endif
#ifdef PORTAL_FZ
  if (C.z > H && P.z < H + E) { t = (H - C.z) / d.z; q = C + d * t; if (abs(q.x) <= H + E && abs(q.y) <= H + E) return true; }
#endif
#ifdef PORTAL_BZ
  if (C.z < -H && P.z > -H - E) { t = (-H - C.z) / d.z; q = C + d * t; if (abs(q.x) <= H + E && abs(q.y) <= H + E) return true; }
#endif
#ifdef PORTAL_TY
  if (C.y > H && P.y < H + E) { t = (H - C.y) / d.y; q = C + d * t; if (abs(q.x) <= H + E && abs(q.z) <= H + E) return true; }
#endif
#ifdef PORTAL_DY
  if (C.y < -H && P.y > -H - E) { t = (-H - C.y) / d.y; q = C + d * t; if (abs(q.x) <= H + E && abs(q.z) <= H + E) return true; }
#endif
  return false;
}
`;
