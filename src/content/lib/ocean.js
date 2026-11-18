// Animated studio sea: surface, horizon ring and the "aquarium" cut-away
// sections where the cube faces slice through the water.
import { WAVES_GLSL, PORTAL_GLSL, WATER_Y, WALL_X, LEDGE_X } from './waves.js';
import { SKY } from './skywall.js';

export const HULL_GLSL = /* glsl */ `
float hullDist(vec2 p) {
  vec2 a = vec2(-0.352, 0.409);
  vec2 b = vec2(0.035, 0.392);
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float r = mix(0.016, 0.062, smoothstep(0.0, 0.42, h)) * mix(1.0, 0.72, smoothstep(0.78, 1.0, h));
  return length(pa - ba * h) - r;
}
`;

const DEFINES = () => ({
  WATER_Y: WATER_Y.toFixed(5),
  WALL_X: WALL_X.toFixed(5),
  LEDGE_X: LEDGE_X.toFixed(5),
  SKY_US: (-1 / SKY.uSpan).toFixed(6),
  SKY_UO: SKY.uOffset.toFixed(6),
  SKY_VS: (1 / SKY.vSpan).toFixed(6),
  WALL_TOP: SKY.wallTop.toFixed(4),
  DOME_R: SKY.domeR.toFixed(3),
  DOME_H: SKY.domeH.toFixed(3),
  DOME_REP: SKY.domeRepeat.toFixed(3),
  DOOR_Z0: '-0.2200', DOOR_Z1: '-0.1550', DOOR_Y0: '-0.1070', DOOR_Y1: '0.0300',
  PORTAL_RX: 1,
});

const SKY_FUNCS = /* glsl */ `
uniform sampler2D uSky;
uniform float uWallGlow;
float gDoorK = 1.0;
vec3 wallSky(vec3 hit) {
  vec2 uv = vec2(hit.z * SKY_US + SKY_UO, (hit.y - WATER_Y) * SKY_VS);
  vec3 c = texture2D(uSky, uv, 1.6).rgb * uWallGlow;
  float door = smoothstep(DOOR_Z0 - 0.006, DOOR_Z0 + 0.006, hit.z) * smoothstep(DOOR_Z1 + 0.006, DOOR_Z1 - 0.006, hit.z)
             * smoothstep(DOOR_Y0 - 0.01, DOOR_Y0 + 0.01, hit.y) * smoothstep(DOOR_Y1 + 0.01, DOOR_Y1 - 0.01, hit.y);
  return mix(c, vec3(0.01, 0.03, 0.04), door * 0.85 * gDoorK);
}
vec3 domeSky(vec3 d) {
  float az = atan(d.x, d.z);
  float tanEl = max(d.y, 0.0) / max(length(d.xz), 1e-3);
  float v = clamp(tanEl * DOME_R / DOME_H, 0.0, 0.995);
  return texture2D(uSky, vec2(az / 6.2831853 * DOME_REP, v), 1.5).rgb * uWallGlow;
}
vec3 envReflect(vec3 P, vec3 R) {
  vec3 res = domeSky(R);
  if (R.x < -1e-4) {
    gDoorK = smoothstep(0.25, 0.55, -R.x);   // no long smeared door reflection at grazing angles
    float t = (WALL_X - P.x) / R.x;
    vec3 hit = P + R * t;
    if (hit.y < WALL_TOP && abs(hit.z) < DOME_R) res = wallSky(hit);
  }
  return res;
}
`;

export function createOcean(THREE, { skyTex, rippleTex, noiseTex, uniforms }) {
  const group = new THREE.Group();
  group.name = 'StudioSea';

  // ---------------------------------------------------------------- surface geometry
  const inner = 0.6, outer = 1.15, N = 192, Nside = 22, far = 14;
  const xs = [];
  for (let i = 0; i < Nside; i++) xs.push(-outer + (outer - inner) * (i / Nside));
  for (let i = 0; i <= N; i++) xs.push(-inner + (2 * inner * i) / N);
  for (let i = Nside - 1; i >= 0; i--) xs.push(outer - (outer - inner) * (i / Nside));
  const n = xs.length;
  const pos = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pos.push(xs[i], 0, xs[j]);
  const idx = [];
  const pushTri = (a, b, c) => {
    // make every triangle face +y
    const ax = pos[a * 3], az = pos[a * 3 + 2];
    const bx = pos[b * 3], bz = pos[b * 3 + 2];
    const cx = pos[c * 3], cz = pos[c * 3 + 2];
    // y component of (b - a) x (c - a)
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (ny >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      pushTri(a, c, b); pushTri(b, c, d);
    }
  }
  // horizon ring: border of the grid pushed out to the dome
  const k = far / outer;
  const ring = (getIdx) => {
    for (let i = 0; i < n - 1; i++) {
      const p0 = getIdx(i), p1 = getIdx(i + 1);
      const q0 = pos.length / 3; pos.push(pos[p0 * 3] * k, 0, pos[p0 * 3 + 2] * k);
      const q1 = pos.length / 3; pos.push(pos[p1 * 3] * k, 0, pos[p1 * 3 + 2] * k);
      pushTri(p0, q0, p1); pushTri(p1, q0, q1);
    }
  };
  ring((i) => i);                       // z = -outer
  ring((i) => (n - 1) * n + i);         // z = +outer
  ring((i) => i * n);                   // x = -outer
  ring((i) => i * n + (n - 1));         // x = +outer
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, WATER_Y, 0), far * 1.5);

  const common = {
    uTime: uniforms.uTime, uLight: uniforms.uLight, uSunDir: uniforms.uSunDir,
    uSunColor: uniforms.uSunColor, uRootRot: uniforms.uRootRot, uWallGlow: uniforms.uWallGlow,
    uSky: { value: skyTex }, uRipple: { value: rippleTex }, uNoise: { value: noiseTex },
    uShallow: { value: new THREE.Color(0.07, 0.36, 0.40) },
    uDeep: { value: new THREE.Color(0.012, 0.10, 0.15) },
    uHorizon: { value: new THREE.Color(0.50, 0.68, 0.84) },
  };

  const surfaceMat = new THREE.ShaderMaterial({
    name: 'OceanSurface',
    defines: DEFINES(),
    uniforms: common,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vLocal;
      varying vec3 vWorld;
      ${WAVES_GLSL}
      void main() {
        vec3 p = position;
        vec2 g;
        p.y = WATER_Y + waveH(p.xz, uTime, g) * waveFade(p.xz);
        vLocal = p;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uLight;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uHorizon;
      uniform mat3 uRootRot;
      uniform sampler2D uRipple;
      uniform sampler2D uNoise;
      varying vec3 vLocal;
      varying vec3 vWorld;
      ${WAVES_GLSL}
      ${SKY_FUNCS}
      ${HULL_GLSL}
      ${PORTAL_GLSL}
      void main() {
        if (vLocal.x < LEDGE_X - 0.0015) discard;
        if (!seenThroughWindow(transpose(uRootRot) * cameraPosition, vLocal)) discard;
        float dist = length(vLocal.xz);
        float fade = waveFade(vLocal.xz);
        vec2 g;
        float h = waveH(vLocal.xz, uTime, g) * fade;
        g *= fade;

        // small ripples riding on the swell (two scrolling layers)
        float rs = 1.0 - smoothstep(1.2, 7.0, dist);
        vec2 uvA = vLocal.xz * 5.3 + vec2(-0.023, 0.011) * uTime;
        vec2 uvB = vLocal.xz * 11.7 + vec2(0.015, -0.029) * uTime;
        vec2 rA = texture2D(uRipple, uvA).xy * 2.0 - 1.0;
        vec2 rB = texture2D(uRipple, uvB).xy * 2.0 - 1.0;
        vec2 rip = (rA * 0.6 + rB * 0.4) * (0.34 * rs + 0.06);

        vec3 nL = normalize(vec3(-g.x + rip.x, 1.0, -g.y + rip.y));
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 Vl = normalize(transpose(uRootRot) * V);
        float NdV = clamp(dot(nL, Vl), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);

        vec3 Rl = reflect(-Vl, nL);
        Rl.y = abs(Rl.y) + 0.001;
        vec3 refl = envReflect(vLocal, normalize(Rl));

        vec3 L = normalize(uSunDir);
        float sunUp = clamp(L.y, 0.0, 1.0);
        float crest = clamp(h / 0.007, -1.0, 1.0);
        vec3 body = mix(uDeep, uShallow, clamp(0.42 + 0.33 * crest, 0.0, 1.0));
        body *= 0.5 + 0.6 * sunUp * (0.6 + 0.4 * dot(nL, L));
        float sss = pow(clamp(dot(Vl, -L) * 0.5 + 0.5, 0.0, 1.0), 2.0) * max(crest, 0.0);
        body += uShallow * sss * 0.45;

        vec3 col = mix(body, refl * 0.82, F);

        // sun glitter
        vec3 Hh = normalize(L + Vl);
        float NdH = max(dot(nL, Hh), 0.0);
        float spec = pow(NdH, 1400.0) * 14.0 + pow(NdH, 180.0) * 0.55;
        col += uSunColor * spec * (0.25 + F);

        // foam where the sea meets the ledge and around the stranded hull
        vec2 fuv = vLocal.xz;
        float n1 = texture2D(uNoise, fuv * 2.7 + vec2(0.013, 0.021) * uTime).r;
        float n2 = texture2D(uNoise, fuv * 6.9 - vec2(0.024, 0.009) * uTime).g;
        float fn = n1 * 0.55 + n2 * 0.45;
        float dl = vLocal.x - LEDGE_X;
        float ledgeF = (1.0 - smoothstep(0.0, 0.020 + 0.03 * fn, dl)) * (0.45 + 0.55 * smoothstep(-0.004, 0.005, h));
        float dh = hullDist(vLocal.xz);
        float hullF = 1.0 - smoothstep(0.0, 0.016 + 0.02 * fn, dh);
        float foamMask = max(ledgeF, hullF * 0.9);
        float foam = smoothstep(0.42, 0.85, foamMask * (0.45 + 0.95 * fn));
        vec3 foamCol = vec3(0.86, 0.92, 0.95) * (0.65 + 0.4 * sunUp);
        col = mix(col, foamCol, foam * 0.9);

        // haze towards the painted horizon
        float haze = smoothstep(2.0, 13.5, dist);
        col = mix(col, uHorizon * uWallGlow, haze);

        gl_FragColor = vec4(col * uLight, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const surface = new THREE.Mesh(geo, surfaceMat);
  surface.name = 'OceanSurface';
  surface.frustumCulled = false;
  surface.renderOrder = 1;
  group.add(surface);

  // ---------------------------------------------------------------- cut-away sections
  // vertical sheets on the cube faces, top edge following the waves
  const skirtGeo = (axis, coord, from, to, steps, bottom) => {
    const p = [], top = [], id = [];
    for (let i = 0; i <= steps; i++) {
      const t = from + ((to - from) * i) / steps;
      const x = axis === 'z' ? t : coord;
      const z = axis === 'z' ? coord : t;
      p.push(x, bottom, z); top.push(0);
      p.push(x, 0, z); top.push(1);
    }
    for (let i = 0; i < steps; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      // outward facing: +z for the front sheet, +x for the right sheet
      if (axis === 'z') id.push(a, c, b, b, c, d);
      else id.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
    g.setIndex(id);
    g.computeBoundingSphere();
    return g;
  };
  const skirtMat = new THREE.ShaderMaterial({
    name: 'OceanSection',
    defines: DEFINES(),
    uniforms: common,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aTop;
      varying vec3 vLocal;
      varying float vSurf;
      ${WAVES_GLSL}
      void main() {
        vec3 p = position;
        vec2 g;
        float s = WATER_Y + waveH(p.xz, uTime, g) * waveFade(p.xz);
        if (aTop > 0.5) p.y = s;
        vSurf = s;
        vLocal = p;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uLight;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uSunColor;
      uniform sampler2D uNoise;
      varying vec3 vLocal;
      varying float vSurf;
      void main() {
        float depth = max(vSurf - vLocal.y, 0.0);
        float d01 = clamp(depth / 0.13, 0.0, 1.0);
        vec3 c = mix(uShallow * 1.15, uDeep * 0.55, pow(d01, 0.55));
        // dancing caustic light just under the surface
        float along = vLocal.x + vLocal.z;
        vec2 cuv = vec2(along * 3.0 + sin(vLocal.y * 40.0 + uTime * 0.7) * 0.02, vLocal.y * 2.0 - uTime * 0.035);
        float ca = texture2D(uNoise, cuv).b;
        float cb = texture2D(uNoise, cuv * 1.7 + vec2(0.31, uTime * 0.02)).b;
        float caust = (ca * 0.6 + cb * 0.4) * exp(-depth * 22.0);
        c += uSunColor * uShallow * caust * 2.2;
        // light shafts
        float shaft = texture2D(uNoise, vec2(along * 1.4 + vLocal.y * 0.35 + uTime * 0.01, 0.5)).r;
        c += uShallow * smoothstep(0.55, 0.9, shaft) * 0.35 * (1.0 - d01);
        // bright meniscus line at the surface
        c = mix(c, vec3(0.70, 0.88, 0.92), smoothstep(0.0022, 0.0, depth) * 0.75);
        float a = mix(0.80, 0.97, d01);
        gl_FragColor = vec4(c * uLight, a);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  // the sea shows through the front (+z) and right (+x) faces of the cube;
  // vertices sit exactly on the surface grid lines (spacing 0.00625)
  const B = -0.5;
  const skirts = [
    skirtGeo('x', 0.5, -0.5, 0.5, 160, B),   // right face (+x): the only window on the finale
  ];
  skirts.forEach((g, i) => {
    const m = new THREE.Mesh(g, skirtMat);
    m.name = 'OceanSection' + i;
    m.renderOrder = 2;
    group.add(m);
  });
  return { group, surface, uniforms: common };
}
