// The sky speaks.
//  * Christof: the dome dims, a light opens between the painted clouds and his
//    words appear in that light (engraved capitals).
//  * Truman answers: a small skywriter plane writes his farewell across the
//    painted sky with smoke, letter by letter; the smoke billows and dissolves.
import { WALL_X } from './waves.js';

const ATLAS_ROWS = 8;
export const OPEN_POS = { z: 0.02, y: 0.30 };   // where the sky opens (content space, on the wall)

// two text rows for the skywriting, centred above the door
const SKY_ROWS = [{ y: 0.335, z: 0.0 }, { y: 0.205, z: 0.0 }];
const SMOKE_H = 0.13;      // height of a written line (content units)
const LIGHT_H = 0.092;
const WORDS_Y = 0.172;     // Christof's words float just under the opening

const SMOKE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SMOKE_FRAG = /* glsl */ `
  uniform sampler2D uText;
  uniform sampler2D uNoise;
  uniform float uRow;
  uniform vec2 uExtent;
  uniform float uAge;      // seconds since the plane started this line
  uniform float uDur;      // seconds the plane needs for the whole line
  uniform float uFade;     // 0..1 dissolve
  uniform float uTime;
  uniform float uLight;
  varying vec2 vUv;
  void main() {
    float passed = uAge - vUv.x * uDur;              // time since the plane passed here
    float written = smoothstep(0.0, 0.3, passed);
    if (written <= 0.001) discard;
    float spread = clamp(passed / 8.0, 0.0, 1.0) + uFade * 0.6;
    vec2 nuv = vUv * vec2(5.0, 1.3) + vec2(uTime * 0.008, -uTime * 0.016);
    vec2 warp = (texture2D(uNoise, nuv).rg - 0.5) * (0.006 + 0.03 * spread);
    vec2 auv = vec2(mix(uExtent.x, uExtent.y, vUv.x) + warp.x * 0.25,
                    (uRow + clamp(vUv.y + warp.y * 1.6 - uFade * 0.08, 0.0, 1.0)) / ${ATLAS_ROWS.toFixed(1)});
    vec2 m = texture2D(uText, auv).rg;
    float puff = texture2D(uNoise, vUv * vec2(34.0, 4.5) + vec2(uTime * 0.015, uTime * 0.01)).r;
    float puff2 = texture2D(uNoise, vUv * vec2(11.0, 1.6) - vec2(uTime * 0.01, 0.0)).g;
    float d = mix(m.r, m.g, 0.55 + 0.45 * clamp(spread, 0.0, 1.0));
    float thr = mix(0.33, 0.12, clamp(spread, 0.0, 1.0));
    float a = smoothstep(thr, thr + 0.2, d + (puff - 0.5) * (0.16 + 0.22 * spread));
    a *= written * (1.0 - uFade) * (1.0 - 0.3 * clamp(spread, 0.0, 1.0));
    float shade = 0.55 + 0.45 * smoothstep(0.25, 0.85, puff * 0.6 + puff2 * 0.4);
    vec3 col = mix(vec3(0.70, 0.76, 0.86), vec3(1.0, 0.995, 0.98), shade);
    gl_FragColor = vec4(col * uLight, a * 0.96);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }`;

const LIGHT_FRAG = /* glsl */ `
  uniform sampler2D uText;
  uniform float uRow;
  uniform vec2 uExtent;
  uniform float uAlpha;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 auv = vec2(mix(uExtent.x, uExtent.y, vUv.x), (uRow + vUv.y) / ${ATLAS_ROWS.toFixed(1)});
    vec2 m = texture2D(uText, auv).rg;
    float reveal = smoothstep(0.0, 0.18, uAlpha * 1.35 - abs(vUv.x - 0.5));
    float shimmer = 0.88 + 0.12 * sin(uTime * 5.0 + vUv.x * 40.0);
    vec3 col = vec3(1.0, 0.93, 0.76) * (m.r * 1.9 + m.g * 0.85) * shimmer;
    float a = clamp(m.r + m.g * 0.55, 0.0, 1.0) * reveal * uAlpha;
    gl_FragColor = vec4(col, a);
  }`;

function radialTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0.0, 'rgba(255,248,226,1)');
  grd.addColorStop(0.18, 'rgba(255,236,196,0.75)');
  grd.addColorStop(0.45, 'rgba(255,214,160,0.22)');
  grd.addColorStop(1.0, 'rgba(255,200,150,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

// a little skywriter: white fuselage, red stripes, spinning prop
function makePlane(THREE) {
  const g = new THREE.Group();
  g.name = 'Skywriter';
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.45, metalness: 0.1 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc8261e, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.6 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  // built along -z (nose towards -z, the direction it flies)
  add(new THREE.BoxGeometry(0.0042, 0.0042, 0.026), white, 0, 0, 0);
  add(new THREE.BoxGeometry(0.0044, 0.0044, 0.004), red, 0, 0, -0.011);
  add(new THREE.BoxGeometry(0.030, 0.0007, 0.0062), white, 0, 0.0008, -0.004);   // wings
  add(new THREE.BoxGeometry(0.030, 0.0008, 0.0016), red, 0, 0.0009, -0.0012);
  add(new THREE.BoxGeometry(0.011, 0.0006, 0.0038), white, 0, 0.0012, 0.0115);  // tailplane
  add(new THREE.BoxGeometry(0.0006, 0.0055, 0.0042), red, 0, 0.0034, 0.0118);   // fin
  const prop = add(new THREE.BoxGeometry(0.009, 0.0009, 0.0006), dark, 0, 0, -0.0135);
  g.userData.prop = prop;
  return g;
}

export function createSkyVoice(THREE, { ocean, textTex, textInfo, noiseTex, uniforms }) {
  const group = new THREE.Group();
  group.name = 'SkyVoice';
  ocean.add(group);
  textTex.encoding = THREE.LinearEncoding;
  textTex.generateMipmaps = true;
  textTex.anisotropy = 8;

  const lines = textInfo.lines;
  const rowOf = (i) => ATLAS_ROWS - 1 - i;     // image row i -> texture v cell (flipY)
  const widthOf = (i, h) => h * (textInfo.width / textInfo.rowHeight) * (lines[i].x1 - lines[i].x0);

  // ---------------------------------------------------------- Truman's smoke lines (atlas rows 0-3)
  const MAX_W = 0.84;
  const smoke = [0, 1, 2, 3].map((i) => {
    let w = widthOf(i, SMOKE_H);
    let h = SMOKE_H;
    if (w > MAX_W) { h = SMOKE_H * MAX_W / w; w = MAX_W; }   // long lines stay inside the wall
    const mat = new THREE.ShaderMaterial({
      name: 'Skywriting' + i,
      uniforms: {
        uText: { value: textTex }, uNoise: { value: noiseTex },
        uRow: { value: rowOf(i) }, uExtent: { value: new THREE.Vector2(lines[i].x0, lines[i].x1) },
        uAge: { value: 0 }, uDur: { value: 2.6 }, uFade: { value: 0 },
        uTime: uniforms.uTime, uLight: uniforms.uLight,
      },
      vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG,
      transparent: true, depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateY(Math.PI / 2);                 // faces the sea, reads left -> right
    const mesh = new THREE.Mesh(geo, mat);
    const row = SKY_ROWS[i % 2];
    mesh.position.set(WALL_X + 0.004 + i * 0.0004, row.y, row.z);
    mesh.renderOrder = 3;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, mat, w, row };
  });

  // ---------------------------------------------------------- Christof's words of light (rows 4-7)
  const light = [4, 5, 6, 7].map((i) => {
    const w = widthOf(i, LIGHT_H);
    const mat = new THREE.ShaderMaterial({
      name: 'ChristofWords' + i,
      uniforms: {
        uText: { value: textTex }, uRow: { value: rowOf(i) },
        uExtent: { value: new THREE.Vector2(lines[i].x0, lines[i].x1) },
        uAlpha: { value: 0 }, uTime: uniforms.uTime,
      },
      vertexShader: SMOKE_VERT, fragmentShader: LIGHT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const geo = new THREE.PlaneGeometry(w, LIGHT_H);
    geo.rotateY(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(WALL_X + 0.006, WORDS_Y, OPEN_POS.z);
    mesh.renderOrder = 4;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, mat };
  });

  // ---------------------------------------------------------- the opening: a glow and a beam of light on Truman
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(THREE), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false,
  }));
  glow.position.set(WALL_X + 0.05, OPEN_POS.y, OPEN_POS.z);
  glow.scale.set(0.42, 0.42, 1);
  glow.renderOrder = 5;
  glow.material.opacity = 0;
  group.add(glow);
  const beam = new THREE.SpotLight(0xffe2b8, 0, 0, 0.42, 0.65, 2);
  beam.position.set(WALL_X + 0.06, OPEN_POS.y, OPEN_POS.z);
  beam.target.position.set(-0.437, -0.11, -0.11);
  group.add(beam);
  group.add(beam.target);

  // ---------------------------------------------------------- the skywriter
  const plane = makePlane(THREE);
  plane.visible = false;
  group.add(plane);

  return {
    group,
    smoke,
    light,
    // state = { open, christof: [a0..a3], smoke: [{age, dur, fade, on}], planeLine, planeT }
    update(state, time) {
      uniforms.uOpen.value = state.open;
      glow.material.opacity = state.open * 0.55;
      glow.visible = state.open > 0.001;
      glow.scale.setScalar(0.22 + 0.08 * state.open + 0.012 * Math.sin(time * 2.0));
      beam.intensity = 0.55 * state.open;
      light.forEach((l, k) => {
        const a = state.christof[k] || 0;
        l.mat.uniforms.uAlpha.value = a;
        l.mesh.visible = a > 0.001;
      });
      smoke.forEach((s, k) => {
        const st = state.smoke[k];
        s.mesh.visible = !!(st && st.on);
        if (!st || !st.on) return;
        s.mat.uniforms.uAge.value = st.age;
        s.mat.uniforms.uDur.value = st.dur;
        s.mat.uniforms.uFade.value = st.fade;
      });
      // plane: flies along the line it is writing, from screen-left (+z) to screen-right (-z)
      const pl = state.plane;
      plane.visible = !!pl;
      if (pl) {
        const s = smoke[pl.line];
        const zLeft = s.row.z + s.w / 2;
        const z = zLeft - pl.u * s.w - 0.012;
        const y = s.row.y + 0.004 + 0.012 * Math.sin(pl.u * 26.0) * Math.min(1, Math.max(0, pl.u * (1 - pl.u) * 8));
        plane.position.set(WALL_X + 0.022, y, z);
        plane.rotation.set(0, 0, 0.18 * Math.cos(pl.u * 26.0));
        plane.scale.setScalar(Math.max(0.001, pl.s));
        plane.userData.prop.rotation.z = time * 60.0;
      }
    },
  };
}
