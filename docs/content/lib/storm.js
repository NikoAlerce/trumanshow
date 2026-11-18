// FRONT face — "Cue the storm".
// Truman lashed to the mast of the Santa Maria, heeled over in a black sea,
// rain, lightning, the dome's sky turned into storm clouds.
import { PORTAL_GLSL } from './waves.js';

export const STORM_SEA_Y = -0.17;
const G = 0.82;
const RAW = [
  // dirX, dirZ, wavelength, amplitude, phase   (rolling towards the viewer, +z)
  [0.25, 1.0, 1.15, 0.052, 0.0],
  [-0.55, 0.85, 0.62, 0.028, 1.3],
  [0.8, 0.6, 0.36, 0.013, 2.9],
  [-0.2, 1.0, 0.22, 0.007, 4.4],
  [0.9, -0.3, 0.14, 0.004, 0.7],
];
const WAVES = RAW.map(([dx, dz, L, A, P]) => {
  const n = Math.hypot(dx, dz), k = (2 * Math.PI) / L;
  return { dx: dx / n, dz: dz / n, k, A, P, w: Math.sqrt(G * k) * 1.05 };
});
const SHARP = 2.2;
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

export function stormHeight(x, z, t) {
  let h = 0;
  const fade = 1 - smooth01((Math.max(Math.abs(x), Math.abs(z)) - 0.7) / 0.5);
  for (const w of WAVES) {
    const s = (Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * t + w.P) + 1) * 0.5;
    h += w.A * (2 * Math.pow(s, SHARP) - 1);
  }
  return h * (0.25 + 0.75 * fade);
}
function smooth01(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }

const STORM_GLSL = /* glsl */ `
float stormFade(vec2 p) { return 0.25 + 0.75 * (1.0 - smoothstep(0.7, 1.2, max(abs(p.x), abs(p.y)))); }
float stormH(vec2 p, float t, out vec2 grad) {
  float h = 0.0; grad = vec2(0.0);
  vec2 d; float ph; float s; float c; float sp;
${WAVES.map((w) => `
  d = vec2(${f(w.dx)}, ${f(w.dz)});
  ph = ${f(w.k)} * dot(d, p) - ${f(w.w)} * t + ${f(w.P)};
  s = (sin(ph) + 1.0) * 0.5; c = cos(ph);
  sp = pow(max(s, 1e-4), ${f(SHARP - 1)});
  h += ${f(w.A)} * (2.0 * sp * s - 1.0);
  grad += ${f(w.A * SHARP * w.k)} * sp * c * d;`).join('')}
  float fd = stormFade(p);
  grad *= fd;
  return h * fd;
}
`;

const SEA_VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vLocal;
  varying vec3 vWorld;
  ${STORM_GLSL}
  void main() {
    vec3 p = position;
    vec2 g;
    p.y = ${STORM_SEA_Y.toFixed(4)} + stormH(p.xz, uTime, g);
    vLocal = p;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const SEA_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFlash;
  uniform mat3 uRootRot;
  uniform sampler2D uRipple;
  uniform sampler2D uNoise;
  uniform vec3 uBoat;      // x, z, heading
  varying vec3 vLocal;
  varying vec3 vWorld;
  ${STORM_GLSL}
  ${PORTAL_GLSL}
  void main() {
    if (!seenThroughWindow(transpose(uRootRot) * cameraPosition, vLocal)) discard;
    vec2 g;
    float h = stormH(vLocal.xz, uTime, g);
    float dist = length(vLocal.xz);
    // wind-blown chop + raindrop pockmarks
    vec2 rA = texture2D(uRipple, vLocal.xz * 6.5 + vec2(0.05, 0.11) * uTime).xy * 2.0 - 1.0;
    vec2 rB = texture2D(uRipple, vLocal.xz * 23.0 - vec2(0.09, 0.03) * uTime).xy * 2.0 - 1.0;
    float drops = texture2D(uNoise, vLocal.xz * 60.0 + fract(uTime * 3.7) * 7.0).b;
    vec2 rip = rA * 0.35 + rB * 0.22 + (drops - 0.3) * 0.15;
    vec3 n = normalize(vec3(-g.x + rip.x, 1.0, -g.y + rip.y));
    vec3 V = normalize(transpose(uRootRot) * (cameraPosition - vWorld));
    float F = 0.02 + 0.98 * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 5.0);
    vec3 sky = mix(vec3(0.035, 0.045, 0.06), vec3(0.75, 0.82, 1.0), uFlash);
    vec3 deep = vec3(0.006, 0.022, 0.026);
    vec3 shallow = vec3(0.02, 0.075, 0.075);
    float crest = clamp(h / 0.035, -1.0, 1.0);
    vec3 col = mix(deep, shallow, 0.4 + 0.4 * crest);
    col = mix(col, sky, F);
    // whitecaps: foam on the steep crests, streaked by the wind
    float slope = length(g);
    float fn = texture2D(uNoise, vLocal.xz * vec2(4.0, 9.0) + vec2(uTime * 0.05, -uTime * 0.12)).r;
    float fn2 = texture2D(uNoise, vLocal.xz * 13.0 - uTime * 0.07).g;
    // wind streaks: noise stretched along the wind, broken into lace
    float streak = texture2D(uNoise, vec2(vLocal.x * 3.0 + vLocal.z * 1.2, vLocal.z * 26.0 - vLocal.x * 4.0) + vec2(0.0, -uTime * 0.25)).r;
    float lace = smoothstep(0.38, 0.7, texture2D(uNoise, vec2(vLocal.x * 7.0 + vLocal.z * 2.0, vLocal.z * 13.0) + uTime * vec2(0.01, -0.04)).g);
    float tops = smoothstep(0.86, 1.08, crest * 0.6 + slope * 0.75 + fn * 0.25);
    float foam = tops * (0.35 + 0.65 * lace) * (0.5 + 0.5 * smoothstep(0.35, 0.7, streak))
               + smoothstep(0.62, 0.85, streak) * smoothstep(0.2, 0.7, crest) * 0.35 * lace;
    // churn around the hull
    vec2 bp = vLocal.xz - uBoat.xy;
    vec2 bd = vec2(cos(uBoat.z), -sin(uBoat.z));
    float along = dot(bp, bd);
    float across = abs(bp.x * bd.y - bp.y * bd.x);
    float hull = 1.0 - smoothstep(0.0, 0.06, max(abs(along) - 0.30, 0.0) + max(across - 0.075, 0.0));
    foam = max(foam, hull * smoothstep(0.5, 0.9, fn + lace * 0.35) * 0.65);
    col = mix(col, vec3(0.55, 0.61, 0.63) * (0.55 + 0.9 * uFlash), clamp(foam, 0.0, 1.0) * 0.6);
    col += vec3(0.5, 0.55, 0.65) * uFlash * 0.12;
    col = mix(col, vec3(0.03, 0.04, 0.05) + vec3(0.25) * uFlash, smoothstep(2.0, 11.0, dist));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }`;

const SKY_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFlash;
  uniform vec3 uBolt;
  uniform sampler2D uNoise;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    vec2 uv = vec2(atan(d.x, d.z) / 6.2831853, d.y);
    float n = texture2D(uNoise, uv * vec2(3.0, 1.5) + vec2(uTime * 0.012, 0.0)).r;
    float n2 = texture2D(uNoise, uv * vec2(7.0, 3.0) - vec2(uTime * 0.02, uTime * 0.004) + n * 0.15).g;
    float clouds = smoothstep(0.25, 0.85, n * 0.6 + n2 * 0.5);
    vec3 col = mix(vec3(0.012, 0.016, 0.022), vec3(0.07, 0.08, 0.10), clouds);
    col = mix(col, vec3(0.02, 0.025, 0.03), smoothstep(0.0, -0.05, d.y));
    // the flash lights the clouds from inside, strongest around the bolt
    float near = exp(-length(d - normalize(uBolt)) * 2.2);
    col += vec3(0.55, 0.62, 0.85) * uFlash * (0.25 + clouds * 1.4) * (0.35 + 0.9 * near);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }`;

const RAIN_VERT = /* glsl */ `
  uniform float uTime;
  attribute vec4 aSeed;
  attribute vec2 aCorner;
  varying float vSide;
  varying float vAlong;
  void main() {
    float H = 1.25;
    vec3 base = vec3(mix(-0.75, 0.75, aSeed.x), 0.0, mix(-1.3, 0.48, aSeed.y));
    float fall = fract(aSeed.z + uTime * (1.1 + aSeed.w * 0.5) / H);
    base.y = ${STORM_SEA_Y.toFixed(3)} + H * (1.0 - fall);
    vec3 dir = normalize(vec3(0.32, -1.5, -0.05));
    float len = 0.045 + 0.03 * aSeed.w;
    vec3 p0 = (modelViewMatrix * vec4(base, 1.0)).xyz;
    vec3 p1 = (modelViewMatrix * vec4(base + dir * len, 1.0)).xyz;
    vec3 D = normalize(p1 - p0);
    vec3 S = normalize(cross(D, vec3(0.0, 0.0, 1.0))) * 0.0009;
    vec3 pos = mix(p0, p1, aCorner.y) + S * (aCorner.x * 2.0 - 1.0);
    vSide = aCorner.x * 2.0 - 1.0;
    vAlong = aCorner.y;
    gl_Position = projectionMatrix * vec4(pos, 1.0);
  }`;
const RAIN_FRAG = /* glsl */ `
  uniform float uFlash;
  varying float vSide;
  varying float vAlong;
  void main() {
    float a = (1.0 - abs(vSide)) * (0.25 + 0.75 * vAlong) * (0.22 + 0.6 * uFlash);
    gl_FragColor = vec4(vec3(0.7, 0.78, 0.9) * a, a);
  }`;

function makeBolt(THREE, rnd, from, to) {
  // jagged ribbon in the XY plane (seen from +z), with a couple of forks
  const strands = [];
  const subdivide = (a, b, depth, rough) => {
    const pts = [a, b];
    for (let d = 0; d < depth; d++) {
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        const m = p.clone().lerp(q, 0.5);
        const len = p.distanceTo(q);
        m.x += (rnd() - 0.5) * len * rough;
        m.z += (rnd() - 0.5) * len * rough * 0.3;
        out.push(m, q);
      }
      pts.splice(0, pts.length, ...out);
    }
    return pts;
  };
  const main = subdivide(from, to, 6, 0.55);
  strands.push({ pts: main, w: 0.0045 });
  for (let k = 0; k < 2; k++) {
    const i = 8 + Math.floor(rnd() * (main.length - 20));
    const start = main[i];
    const end = start.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.35, -0.18 - rnd() * 0.25, 0));
    strands.push({ pts: subdivide(start, end, 4, 0.6), w: 0.0022 });
  }
  const pos = [], idx = [];
  for (const s of strands) {
    const b = pos.length / 3;
    s.pts.forEach((p, i) => {
      const w = s.w * (1 - 0.6 * i / s.pts.length);
      pos.push(p.x - w, p.y, p.z, p.x + w, p.y, p.z);
      if (i > 0) { const v = b + i * 2; idx.push(v - 2, v - 1, v, v, v - 1, v + 1); }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function createStorm(THREE, { root, finaleBoat, finaleBowPoint, trumanArmature, trumanClip, rippleTex, noiseTex, uniforms, makeRig }) {
  const world = new THREE.Group();
  world.name = 'TheStorm';
  root.add(world);
  const U = {
    uTime: uniforms.uTime, uRootRot: uniforms.uRootRot,
    uFlash: { value: 0 }, uRipple: { value: rippleTex }, uNoise: { value: noiseTex },
    uBoat: { value: new THREE.Vector3(0, 0, 0) }, uBolt: { value: new THREE.Vector3(-0.4, 0.6, -1) },
  };

  // ---------------------------------------------------------------- sea
  const inner = 0.6, outer = 1.25, N = 160, side = 16, far = 12;
  const xs = [];
  for (let i = 0; i < side; i++) xs.push(-outer + (outer - inner) * (i / side));
  for (let i = 0; i <= N; i++) xs.push(-inner + (2 * inner * i) / N);
  for (let i = side - 1; i >= 0; i--) xs.push(outer - (outer - inner) * (i / side));
  xs[0] = -far; xs[xs.length - 1] = far;
  const n = xs.length, pos = [], idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pos.push(xs[i], 0, xs[j]);
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const seaGeo = new THREE.BufferGeometry();
  seaGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  seaGeo.setIndex(idx);
  seaGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), far * 1.5);
  const sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({
    name: 'StormSea', uniforms: U, vertexShader: SEA_VERT, fragmentShader: SEA_FRAG,
    defines: { PORTAL_FZ: 1 },
  }));
  sea.frustumCulled = false;
  world.add(sea);

  // cut-away section on the front face: a black, churning water mass
  const steps = 160;
  const sp = [], st = [], si = [];
  for (let i = 0; i <= steps; i++) {
    const x = -0.5 + i / steps;
    sp.push(x, -0.5, 0.5, x, 0, 0.5); st.push(0, 1);
  }
  for (let i = 0; i < steps; i++) { const a = i * 2; si.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  skirtGeo.setAttribute('aTop', new THREE.Float32BufferAttribute(st, 1));
  skirtGeo.setIndex(si);
  const skirt = new THREE.Mesh(skirtGeo, new THREE.ShaderMaterial({
    name: 'StormSection', uniforms: U, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aTop;
      varying vec3 vLocal;
      varying float vSurf;
      ${STORM_GLSL}
      void main() {
        vec3 p = position;
        vec2 g;
        float s = ${STORM_SEA_Y.toFixed(4)} + stormH(p.xz, uTime, g);
        if (aTop > 0.5) p.y = s;
        vSurf = s; vLocal = p;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uFlash;
      uniform sampler2D uNoise;
      varying vec3 vLocal;
      varying float vSurf;
      void main() {
        float depth = max(vSurf - vLocal.y, 0.0);
        float d01 = clamp(depth / 0.25, 0.0, 1.0);
        vec3 c = mix(vec3(0.03, 0.10, 0.10), vec3(0.002, 0.008, 0.012), pow(d01, 0.5));
        // bubbles and churned sand
        float b = texture2D(uNoise, vec2(vLocal.x * 6.0, vLocal.y * 4.0 + uTime * 0.25)).b;
        float b2 = texture2D(uNoise, vec2(vLocal.x * 14.0 + uTime * 0.05, vLocal.y * 9.0 + uTime * 0.5)).r;
        c += vec3(0.15, 0.2, 0.2) * smoothstep(0.6, 0.95, b * 0.6 + b2 * 0.5) * (1.0 - d01) * 0.6;
        c += vec3(0.25, 0.3, 0.4) * uFlash * (1.0 - d01) * 0.5;
        c = mix(c, vec3(0.55, 0.62, 0.65), smoothstep(0.004, 0.0, depth) * 0.8);
        gl_FragColor = vec4(c, mix(0.86, 0.98, d01));
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  }));
  skirt.renderOrder = 2;
  world.add(skirt);

  // ---------------------------------------------------------------- sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(12, 48, 24), new THREE.ShaderMaterial({
    name: 'StormSky', uniforms: U, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SKY_FRAG,
  }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  world.add(sky);

  // ---------------------------------------------------------------- rain
  const RAIN = 2200;
  const rp = [], seed = [], corner = [], ri = [];
  let s = 7;
  const r1 = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < RAIN; i++) {
    const sd = [r1(), r1(), r1(), r1()];
    for (let k = 0; k < 4; k++) { rp.push(0, 0, 0); seed.push(...sd); }
    corner.push(0, 0, 1, 0, 0, 1, 1, 1);
    const b = i * 4;
    ri.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  rainGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4));
  rainGeo.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
  rainGeo.setIndex(ri);
  const rain = new THREE.Mesh(rainGeo, new THREE.ShaderMaterial({
    name: 'StormRain', uniforms: U, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  rain.frustumCulled = false;
  rain.renderOrder = 6;
  world.add(rain);

  // ---------------------------------------------------------------- lightning
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x6f86ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const boltGroup = new THREE.Group();
  boltGroup.visible = false;
  world.add(boltGroup);

  // ---------------------------------------------------------------- lights
  world.add(new THREE.AmbientLight(0x6c7a94, 0.22));
  const moon = new THREE.DirectionalLight(0x9fb0d0, 0.55);
  moon.position.set(-0.4, 1.0, 0.6);
  world.add(moon);
  const flashLight = new THREE.DirectionalLight(0xd8e2ff, 0);
  flashLight.position.set(-0.5, 1.0, -0.8);
  world.add(flashLight);

  // ---------------------------------------------------------------- the boat and Truman
  // clone the finale boat; the outer group sits on the sea and rolls with it
  const CENTER_REST = new THREE.Vector3(-0.17, -0.371, 0.41);   // mid-hull on the waterline (finale coords)
  const boatOuter = new THREE.Group();
  boatOuter.name = 'StormBoat';
  world.add(boatOuter);
  const boatInner = new THREE.Group();
  boatInner.position.copy(finaleBowPoint).sub(CENTER_REST);
  boatOuter.add(boatInner);
  finaleBoat.children.forEach((c) => boatInner.add(c.clone(true)));
  boatOuter.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  const HEADING = 0.42;   // bow points away-left: the sails and Truman face the viewer
  const BOAT = { x: 0.0, z: 0.12, scale: 1.35 };   // closer and bigger than in the finale, so the lashing reads
  boatOuter.scale.setScalar(BOAT.scale);

  // Truman lashed to the mast, his back against it, shaking his fist at the sky.
  // The mast (boat local): base (-0.103, -0.016, 0.002), head (-0.097, 0.535, 0.001)
  const mastX = (y) => -0.103 + (y + 0.016) * (0.006 / 0.551);
  const MAST_Z = 0.002, MAST_R = 0.0032;
  const trumanPos = new THREE.Vector3(mastX(0.064), 0.064, 0.0105);
  const rig = makeRig(THREE, { armature: trumanArmature, clip: trumanClip, space: boatOuter, position: trumanPos, yaw: -Math.PI / 2 });
  const TIED = { lookUp: 0.85, brace: 9 };
  rig.pose(1.9, TIED);
  rig.pivot.updateMatrixWorld(true);

  // the lashing: rope loops drawn tight round the mast and his body, built from
  // the real silhouette of the posed body at the waist and the chest
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x9a7a48, roughness: 0.95, name: 'Rope' });
  const ROPE_R = 0.00105;
  const skinnedSection = (yLevel, band) => {
    const pts = [];
    const v = new THREE.Vector3();
    rig.armature.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const pos = o.geometry.attributes.position;
      const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
      const limbBone = o.skeleton.bones.map((bn) => /Arm|Hand|Shoulder|Head|Neck/.test(bn.name));
      const xf = (o.applyBoneTransform || o.boneTransform).bind(o);
      o.updateMatrixWorld(true);
      for (let i = 0; i < pos.count; i += 2) {
        // only the torso: skip vertices that mostly follow the arms (or the head)
        if (si && sw) {
          let best = 0, bw = -1;
          const ws = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], ids = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
          for (let k = 0; k < 4; k++) if (ws[k] > bw) { bw = ws[k]; best = ids[k]; }
          if (limbBone[best]) continue;
        }
        v.fromBufferAttribute(pos, i);
        xf(i, v);
        v.applyMatrix4(o.matrixWorld);
        boatOuter.worldToLocal(v);
        if (Math.abs(v.y - yLevel) < band) pts.push([v.x, v.z]);
      }
    });
    return pts;
  };
  const hull = (pts) => {
    const P = pts.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  };
  const lashing = (y, wobble) => {
    const body = skinnedSection(y, 0.0022);
    if (body.length < 8) return null;
    const pts = body.slice();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; pts.push([mastX(y) + Math.cos(a) * MAST_R, MAST_Z + Math.sin(a) * MAST_R]); }
    const h = hull(pts);
    // push out by the rope radius, then a smooth closed curve
    let cx = 0, cz = 0;
    h.forEach(([x, z]) => { cx += x; cz += z; });
    cx /= h.length; cz /= h.length;
    const curve = new THREE.CatmullRomCurve3(h.map(([x, z], i) => {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1;
      return new THREE.Vector3(x + dx / d * (ROPE_R + 0.0004), y + wobble * Math.sin(i * 1.7), z + dz / d * (ROPE_R + 0.0004));
    }), true, 'centripetal');
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, ROPE_R, 6, true), ropeMat);
    boatOuter.add(m);
    return { curve, y };
  };
  const hips = new THREE.Vector3(), chest = new THREE.Vector3();
  rig.bonePos('Hips', hips); boatOuter.worldToLocal(hips);
  rig.bonePos('Spine2', chest); boatOuter.worldToLocal(chest);
  const loops = [lashing(hips.y + 0.006, 0.0004), lashing(hips.y + 0.017, 0.0005), lashing(chest.y + 0.002, 0.0004)].filter(Boolean);
  // the knot on his belly and the loose end hanging to the deck
  if (loops.length) {
    const front = loops[0].curve.getPoints(80).reduce((a, p) => (p.z > a.z ? p : a));
    const knot = new THREE.Mesh(new THREE.SphereGeometry(ROPE_R * 2.2, 10, 8), ropeMat);
    knot.position.copy(front).add(new THREE.Vector3(0.004, 0, 0.0008));
    boatOuter.add(knot);
    const tail = new THREE.CatmullRomCurve3([
      knot.position.clone(),
      knot.position.clone().add(new THREE.Vector3(0.003, -0.012, 0.004)),
      knot.position.clone().add(new THREE.Vector3(0.001, -0.03, 0.006)),
      new THREE.Vector3(knot.position.x + 0.006, 0.068, knot.position.z + 0.012),
      new THREE.Vector3(knot.position.x + 0.02, 0.066, knot.position.z + 0.016),
    ]);
    boatOuter.add(new THREE.Mesh(new THREE.TubeGeometry(tail, 40, ROPE_R * 0.95, 6, false), ropeMat));
  }
  // a few turns round the mast itself above and below him
  [0.071, 0.075, 0.079, 0.198, 0.202].forEach((y, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(MAST_R + ROPE_R, ROPE_R, 6, 16), ropeMat);
    ring.position.set(mastX(y), y, MAST_Z);
    ring.rotation.x = Math.PI / 2 + (i % 2 ? 0.12 : -0.1);
    boatOuter.add(ring);
  });
  // where his left hand grips the rope (on the chest loop, a little to his left)
  const gripLocal = new THREE.Vector3();
  if (loops.length) {
    const want = chest.x - 0.009;          // his right hand (the left one is the fist)
    const front = loops[loops.length - 1].curve.getPoints(120).filter((p) => p.z > chest.z);
    const best = front.reduce((a, p) => (Math.abs(p.x - want) < Math.abs(a.x - want) ? p : a), front[0]);
    gripLocal.copy(best).add(new THREE.Vector3(0, -0.001, 0.003));
  }

  // spray thrown up by the bow when it slams into a wave
  const SPRAY = 260;
  const sprayGeo = new THREE.BufferGeometry();
  const sSeed = new Float32Array(SPRAY * 4);
  { let k = 9; const r = () => { k = (k * 16807) % 2147483647; return (k - 1) / 2147483646; }; for (let i = 0; i < SPRAY * 4; i++) sSeed[i] = r(); }
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPRAY * 3), 3));
  sprayGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 4));
  const sprayU = { uTime: uniforms.uTime, uSpray: { value: 0 }, uFlash: U.uFlash };
  const spray = new THREE.Points(sprayGeo, new THREE.ShaderMaterial({
    name: 'BowSpray', uniforms: sprayU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uSpray;
      attribute vec4 aSeed;
      varying float vA;
      void main() {
        float life = 0.9 + aSeed.w * 0.6;
        float age = fract(uTime / life + aSeed.x) * life;
        vec3 p = vec3(-0.285 + aSeed.y * 0.05, 0.035, 0.012 + (aSeed.z - 0.5) * 0.04);
        vec3 vel = vec3(-0.06 - 0.12 * aSeed.y, 0.16 + 0.22 * aSeed.w, (aSeed.z - 0.5) * 0.34);
        p += vel * age + vec3(0.03, -0.42, 0.0) * age * age;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = uSpray * (1.0 - age / life) * smoothstep(0.0, 0.08, age);
        gl_PointSize = (1.5 + 5.0 * age / life) * 2.6 / max(0.4, -mv.z * 0.35);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFlash;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * 0.45;
        gl_FragColor = vec4(vec3(0.62, 0.68, 0.72) * (0.6 + 1.6 * uFlash) * a, a);
      }`,
  }));
  spray.frustumCulled = false;
  boatOuter.add(spray);
  let prevBow = 0, sprayLevel = 0;
  const gripTmp = new THREE.Vector3(), poleTmp = new THREE.Vector3();
  const fistSh = new THREE.Vector3(), fistAt = new THREE.Vector3(), fistPole = new THREE.Vector3(), fistAxis = new THREE.Vector3();

  // ---------------------------------------------------------------- animation
  let nextStrike = 1.5;
  let strikeT = -10;
  let strikeSeed = 3;
  const rnd = () => { strikeSeed = (strikeSeed * 16807) % 2147483647; return (strikeSeed - 1) / 2147483646; };
  const state = { roll: 0, pitch: 0, heave: 0 };

  return {
    world,
    U,
    update(time, dt) {
      // lightning
      if (time > nextStrike) {
        strikeT = time;
        nextStrike = time + 2.2 + rnd() * 4.0;
        boltGroup.clear();
        const bx = -0.7 + rnd() * 1.4, bz = -1.6 - rnd() * 1.5;
        const g = makeBolt(THREE, rnd, new THREE.Vector3(bx, 1.4, bz), new THREE.Vector3(bx + (rnd() - 0.5) * 0.4, STORM_SEA_Y, bz + 0.1));
        boltGroup.add(new THREE.Mesh(g, boltMat));
        const glow = new THREE.Mesh(g.clone(), glowMat);
        glow.scale.set(5, 1, 1);
        glow.position.x = -bx * 4;   // widen around the bolt's own x
        boltGroup.add(glow);
        U.uBolt.value.set(bx, 0.8, bz);
      }
      const k = time - strikeT;
      const flicker = k < 0 ? 0 : (k < 0.06 ? 1 : k < 0.11 ? 0.15 : k < 0.24 ? 0.9 : Math.exp(-(k - 0.24) * 9.0) * 0.6);
      U.uFlash.value = flicker;
      boltGroup.visible = k >= 0 && k < 0.3 && flicker > 0.2;
      flashLight.intensity = flicker * 4.0;

      // the boat rides the storm
      const t = time;
      const hb = stormHeight(BOAT.x - 0.27, BOAT.z, t), hs = stormHeight(BOAT.x + 0.27, BOAT.z, t);
      const hl = stormHeight(BOAT.x, BOAT.z - 0.08, t), hr = stormHeight(BOAT.x, BOAT.z + 0.08, t);
      const pitch = Math.atan2(hb - hs, 0.4) * 1.2;
      const roll = Math.atan2(hr - hl, 0.12) * 0.9 + 0.30 + 0.06 * Math.sin(t * 0.7);
      const kk = 1 - Math.exp(-dt * 4.0);
      state.pitch += (pitch - state.pitch) * kk;
      state.roll += (roll - state.roll) * kk;
      // buoyant: the hull rides on the highest of the water under bow, middle and stern
      const hMid = stormHeight(BOAT.x, BOAT.z, t);
      const hBow = stormHeight(BOAT.x - 0.22 * Math.cos(HEADING), BOAT.z + 0.22 * Math.sin(HEADING), t);
      const hStern = stormHeight(BOAT.x + 0.22 * Math.cos(HEADING), BOAT.z - 0.22 * Math.sin(HEADING), t);
      const ride = Math.max(hMid, (hBow + hStern) * 0.5, hMid * 0.4 + Math.max(hBow, hStern) * 0.6) + 0.004;
      state.heave += (ride - state.heave) * kk;
      boatOuter.position.set(BOAT.x, STORM_SEA_Y + state.heave, BOAT.z);
      boatOuter.rotation.set(state.roll, HEADING, state.pitch, 'YXZ');
      U.uBoat.value.set(BOAT.x, BOAT.z, HEADING);

      // spray when the bow drops into a wave
      const bow = stormHeight(BOAT.x - 0.35 * Math.cos(HEADING), BOAT.z + 0.35 * Math.sin(HEADING), t);
      const fall = (prevBow - bow) / Math.max(dt, 1e-3);
      prevBow = bow;
      sprayLevel = Math.max(sprayLevel * Math.exp(-dt * 1.6), Math.min(1, Math.max(0, fall * 9.0)));
      sprayU.uSpray.value = 0.25 + 0.75 * sprayLevel;

      // Truman: lashed to the mast, fist up at the sky, the other hand on the rope
      const shout = 0.5 + 0.5 * Math.sin(t * 1.3);
      rig.pose(1.9 + 0.3 * Math.sin(t * 2.1), {
        lookUp: TIED.lookUp + 0.15 * shout,
        brace: TIED.brace,
        sway: Math.max(-3, Math.min(3, -(state.roll - 0.30) * 14)),
        lean: 1.2 * Math.sin(t * 0.9),
      });
      // the left fist raised to the sky on the side we can see (the jib hides
      // his right), elbow out, shaking; the right hand holds the rope
      rig.bonePos('LeftArm', fistSh); boatOuter.worldToLocal(fistSh);
      // he shouts in bursts: the fist pumps two or three times, then holds,
      // trembling with the effort; the wrist cocks back at the top of a pump
      const burst = Math.pow(Math.max(0, Math.sin(t * 0.83 + 0.4)), 2);
      const pump = burst * (0.55 * Math.sin(t * 6.1) + 0.3 * Math.sin(t * 9.7 + 1.1) + 0.15 * Math.sin(t * 15.3 + 2.4));
      const tremble = Math.sin(t * 23.0) * Math.sin(t * 3.1) * (0.3 + 0.7 * (1 - burst));
      fistAt.set(
        fistSh.x + 0.008 + 0.0015 * Math.sin(t * 1.7),
        fistSh.y + 0.031 + 0.0045 * pump + 0.0005 * tremble,
        fistSh.z + 0.01 + 0.002 * pump,
      );
      fistPole.set(fistSh.x + 0.05, fistSh.y - 0.005, fistSh.z - 0.02);
      rig.reach('Left', boatOuter.localToWorld(fistAt), 1, boatOuter.localToWorld(fistPole));
      rig.curl('Left', 0.9 + 0.08 * burst, 0.35 + 0.05 * burst);
      fistAxis.set(1, 0, 0).transformDirection(boatOuter.matrixWorld);
      rig.rotateBone('LeftHand', fistAxis, -12 * Math.max(0, pump) + 3 * tremble);
      if (loops.length) {
        const grip = boatOuter.localToWorld(gripTmp.copy(gripLocal));
        const pole = boatOuter.localToWorld(poleTmp.set(chest.x - 0.03, chest.y - 0.03, chest.z - 0.005));
        rig.reach('Right', grip, 1, pole);
        rig.curl('Right', 0.85, 0.5);
      }
    },
  };
}
