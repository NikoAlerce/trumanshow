// BACK face — "Good morning!" and the falling star.
// Seahaven, a sunny morning: Truman waves from his front walk. Up in the sky a
// star flickers — it is a stage light labelled SIRIUS (9 CANIS MAJOR) hanging in
// the dome — it slips, falls and smashes on the street next to his car. He walks
// over, touches it (hot!), reads the label and searches the sky; a crane hook
// comes down out of the sky and takes the lamp away, the star is back in its
// place, and he walks home staring at it. The street is alive: birds, a
// sprinkler, swaying trees, chimney smoke, drifting clouds.
// Seen from -z looking +z (screen right = -x).
import { PORTAL_GLSL } from './waves.js';
import { mergeStatic } from './batch.js';
import { paintTreeAtlas, makeTreeCards, paintCarFlat, CAR, paintBirdStrip, makeBird, setBirdFrame, makeVignette } from './cards.js';

const GROUND_Y = -0.42;
const LOOP = 26.5;

function canvasTex(THREE, w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  return t;
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const ramp = (t, a, b) => smooth(clamp01((t - a) / (b - a)));

export function createMorning(THREE, { root, skyTex, noiseTex, uniforms, trumanArmature, trumanClip, makeRig, family, treeAtlas }) {
  const world = new THREE.Group();
  world.name = 'GoodMorning';
  root.add(world);
  // closer in: the whole street is scaled up about the bottom of the window,
  // so Truman reads at the size of a person on his front walk
  const ZOOM = 1.45;
  world.scale.setScalar(ZOOM);
  world.position.set(0, GROUND_Y * (1 - ZOOM), -0.5 * (1 - ZOOM));
  const add = (geo, mat, x, y, z, parent = world) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

  // ---------------------------------------------------------------- textures
  const siding = canvasTex(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(120,115,100,0.35)'; g.fillRect(0, y + 13, w, 3); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, y, w, 2); }
  });
  siding.wrapS = siding.wrapT = THREE.RepeatWrapping;
  siding.repeat.set(3, 2);
  const shingles = canvasTex(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = '#4b4f57'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 20) for (let x = (y / 20) % 2 ? -16 : 0; x < w; x += 32) {
      const v = 60 + Math.floor(Math.random() * 30);
      g.fillStyle = `rgb(${v},${v + 3},${v + 10})`; g.fillRect(x + 1, y + 1, 30, 18);
    }
  });
  shingles.wrapS = shingles.wrapT = THREE.RepeatWrapping;
  shingles.repeat.set(4, 2);
  const grass = canvasTex(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = '#4f8a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = Math.random();
      g.fillStyle = `rgba(${40 + v * 60},${110 + v * 70},${30 + v * 30},0.6)`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 3);
    }
  });
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(6, 6);
  const asphalt = canvasTex(THREE, 512, 256, (g, w, h) => {
    g.fillStyle = '#3a3c40'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) { const v = 45 + Math.random() * 40; g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; g.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2); }
    g.fillStyle = '#e9d36a';
    for (let x = 0; x < w; x += 64) g.fillRect(x + 8, h / 2 - 3, 36, 6);
  });
  asphalt.wrapS = THREE.RepeatWrapping;
  asphalt.repeat.set(3, 1);
  const label = canvasTex(THREE, 512, 128, (g, w, h) => {
    g.fillStyle = '#d9d4c4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#222'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 54px ${family}, sans-serif`; g.fillText('SIRIUS', w / 2, 44);
    g.font = `500 30px ${family}, sans-serif`; g.fillText('(9 CANIS MAJOR)', w / 2, 92);
  });
  const mailTex = canvasTex(THREE, 256, 64, (g, w, h) => {
    g.fillStyle = '#1f3f7a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 34px ${family}, sans-serif`; g.fillText('BURBANK', w / 2, h / 2 + 2);
  });

  // ---------------------------------------------------------------- ground: street, curb, sidewalk, lawn
  const groundMat = (map, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ map, roughness: 0.95, ...extra });
    // nothing between the camera and the back window (portal)
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRootRot = uniforms.uRootRot;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPortalP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPortalP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform mat3 uRootRot;
        varying vec3 vPortalP;
        ${PORTAL_GLSL}`)
        .replace('#include <map_fragment>', `
          if (!seenThroughWindow(transpose(uRootRot) * cameraPosition, transpose(uRootRot) * vPortalP)) discard;
          #include <map_fragment>`);
    };
    m.defines = { PORTAL_BZ: 1 };
    m.customProgramCacheKey = () => 'portal-bz';
    return m;
  };
  const street = add(new THREE.PlaneGeometry(6, 0.26), groundMat(asphalt, { bumpMap: asphalt, bumpScale: 0.45 }), 0, GROUND_Y, -0.37);
  // the street cut open at the window: asphalt, gravel, soil, a water main and
  // the bundles of studio cable that run under Seahaven
  const cutTex = canvasTex(THREE, 512, 128, (g, w, h) => {
    g.fillStyle = '#2f3134'; g.fillRect(0, 0, w, 12);
    g.fillStyle = '#7b7266'; g.fillRect(0, 12, w, 22);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${150 + Math.random() * 60},${140 + Math.random() * 50},${120 + Math.random() * 40},0.8)`; g.fillRect(Math.random() * w, 12 + Math.random() * 22, 2, 2); }
    const soil = g.createLinearGradient(0, 34, 0, h);
    soil.addColorStop(0, '#6b5038'); soil.addColorStop(1, '#3e2c1f');
    g.fillStyle = soil; g.fillRect(0, 34, w, h - 34);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(30,20,12,${0.2 + Math.random() * 0.3})`; g.fillRect(Math.random() * w, 34 + Math.random() * (h - 34), 3, 2); }
    g.fillStyle = '#4c5a64'; g.beginPath(); g.arc(150, 76, 14, 0, 6.3); g.fill();
    g.fillStyle = '#1d2329'; g.beginPath(); g.arc(150, 76, 9, 0, 6.3); g.fill();
    [['#c0392b', 300], ['#2e6fb5', 312], ['#e1b12c', 324], ['#222', 336]].forEach(([c, x]) => { g.fillStyle = c; g.beginPath(); g.arc(x, 96, 5, 0, 6.3); g.fill(); });
  });
  cutTex.wrapS = THREE.RepeatWrapping;
  cutTex.repeat.set(4, 1);
  add(new THREE.PlaneGeometry(6, 0.16), new THREE.MeshStandardMaterial({ map: cutTex, roughness: 0.95 }), 0, GROUND_Y - 0.08, -0.4995).castShadow = false;
  street.rotation.x = -Math.PI / 2;
  const walkway = add(new THREE.PlaneGeometry(6, 0.075), groundMat(null, { color: 0xc9c5bb }), 0, GROUND_Y + 0.006, -0.20);
  walkway.rotation.x = -Math.PI / 2;
  add(new THREE.BoxGeometry(6, 0.012, 0.012), std(0xb9b5ab), 0, GROUND_Y + 0.004, -0.239);   // curb
  const lawn = add(new THREE.PlaneGeometry(6, 3.2), groundMat(grass, { bumpMap: grass, bumpScale: 0.5 }), 0, GROUND_Y + 0.004, 1.43);
  lawn.rotation.x = -Math.PI / 2;
  const path = add(new THREE.PlaneGeometry(0.06, 0.32), std(0xd2cdc2, 0.9), 0.02, GROUND_Y + 0.008, -0.01);
  path.rotation.x = -Math.PI / 2;

  // ---------------------------------------------------------------- Truman's house
  const sidingMat = std(0xffffff, 0.85, { map: siding, bumpMap: siding, bumpScale: 0.28 });
  const trim = std(0xfbfaf5, 0.6);
  const house = new THREE.Group();
  house.position.set(0.02, GROUND_Y, 0.34);
  world.add(house);
  add(new THREE.BoxGeometry(0.52, 0.2, 0.26), sidingMat, 0, 0.1 + 0.012, 0, house);
  add(new THREE.BoxGeometry(0.54, 0.012, 0.28), std(0x9a968c), 0, 0.006, 0, house);   // foundation
  // gable roof
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-0.16, 0); roofShape.lineTo(0.16, 0); roofShape.lineTo(0, 0.12); roofShape.lineTo(-0.16, 0);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 0.58, bevelEnabled: false });
  roofGeo.translate(0, 0, -0.29);
  roofGeo.rotateY(Math.PI / 2);
  const gable = add(roofGeo, sidingMat, 0, 0.212, 0, house);
  gable.scale.set(1, 1, 0.98);
  const roofSlab = (sign) => {
    const s = add(new THREE.BoxGeometry(0.6, 0.008, 0.215), std(0xffffff, 0.9, { map: shingles, bumpMap: shingles, bumpScale: 0.5 }), 0, 0.272, sign * 0.075, house);
    s.rotation.x = sign * 0.64;
    return s;
  };
  roofSlab(1); roofSlab(-1);
  add(new THREE.BoxGeometry(0.045, 0.09, 0.045), std(0x8a3b2c, 0.9), 0.16, 0.31, 0.04, house);   // chimney
  // porch, door, steps
  add(new THREE.BoxGeometry(0.18, 0.014, 0.07), trim, 0.0, 0.007, -0.163, house);
  add(new THREE.BoxGeometry(0.14, 0.008, 0.03), trim, 0.0, 0.004, -0.205, house);
  const porchRoof = add(new THREE.BoxGeometry(0.2, 0.01, 0.08), trim, 0.0, 0.135, -0.165, house);
  porchRoof.rotation.x = -0.12;
  [-0.08, 0.08].forEach((x) => add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.125, 10), trim, x, 0.07, -0.195, house));
  add(new THREE.BoxGeometry(0.056, 0.105, 0.006), std(0x7b2a22, 0.5), 0.0, 0.066, -0.131, house);   // red door
  add(new THREE.SphereGeometry(0.0035, 8, 6), std(0xd4b35a, 0.3, { metalness: 0.9 }), -0.018, 0.066, -0.135, house);
  // windows with shutters
  const glass = std(0x1d2c3d, 0.08, { metalness: 0.3, envMapIntensity: 1.5 });
  const shutter = std(0x2d4a39, 0.7);
  const window_ = (x, y) => {
    add(new THREE.BoxGeometry(0.062, 0.072, 0.006), trim, x, y, -0.13, house);
    add(new THREE.BoxGeometry(0.05, 0.06, 0.004), glass, x, y, -0.134, house);
    add(new THREE.BoxGeometry(0.004, 0.06, 0.006), trim, x, y, -0.136, house);
    add(new THREE.BoxGeometry(0.05, 0.004, 0.006), trim, x, y, -0.136, house);
    [-1, 1].forEach((s) => add(new THREE.BoxGeometry(0.022, 0.074, 0.005), shutter, x + s * 0.044, y, -0.133, house));
  };
  window_(-0.16, 0.08); window_(0.16, 0.08); window_(-0.16, 0.175); window_(0.16, 0.175); window_(0, 0.175);

  // white picket fence along the lawn, with a gate on the path
  const picket = new THREE.BoxGeometry(0.008, 0.05, 0.004);
  const pickets = new THREE.InstancedMesh(picket, trim, 120);
  const m4 = new THREE.Matrix4();
  let pi = 0;
  for (let x = -0.62; x <= 0.62; x += 0.021) {
    if (Math.abs(x - 0.02) < 0.035) continue;   // gate opening
    m4.makeTranslation(x, GROUND_Y + 0.025, -0.165);
    pickets.setMatrixAt(pi++, m4);
  }
  pickets.count = pi;
  pickets.castShadow = true;
  world.add(pickets);
  [-1, 1].forEach((s) => add(new THREE.BoxGeometry(1.24, 0.005, 0.004), trim, 0, GROUND_Y + 0.012 + (s > 0 ? 0.022 : 0), -0.163));

  // mailbox "BURBANK"
  add(new THREE.BoxGeometry(0.006, 0.05, 0.006), std(0x5a4a3a), 0.09, GROUND_Y + 0.025, -0.18);
  const box = add(new THREE.BoxGeometry(0.03, 0.018, 0.018), std(0x1f3f7a, 0.4, { metalness: 0.4 }), 0.09, GROUND_Y + 0.059, -0.18);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.0075), new THREE.MeshStandardMaterial({ map: mailTex, roughness: 0.6 }));
  plate.position.set(0.09, GROUND_Y + 0.059, -0.1895);
  plate.rotation.y = Math.PI;
  world.add(plate);

  // trees and bushes: painted cards that turn to the camera (and to the sun for their shadows)
  const cards = makeTreeCards(THREE, { atlas: treeAtlas || paintTreeAtlas(THREE), uniforms, count: 110 });
  world.add(cards.mesh);
  cards.add(-0.33, GROUND_Y + 0.004, 0.02, 0.31, 0.34, 'oak', 0.022);           // the big tree by the house
  cards.add(0.52, GROUND_Y + 0.004, 0.08, 0.27, 0.31, 'maple', 0.025);
  // hedges along the house
  [-0.215, -0.17, -0.125, 0.155, 0.2, 0.245].forEach((x, i) => cards.add(x, GROUND_Y + 0.004, 0.19 + (i % 2) * 0.006, 0.075, 0.09, 'bush', 0.008));

  // ---------------------------------------------------------------- the neighbours and the trees behind them
  const facade = canvasTex(THREE, 256, 128, (g, w, h) => {
    g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(110,105,95,0.28)'; g.fillRect(0, y + 6, w, 2); }
    const win = (x, y) => {
      g.fillStyle = '#fbfaf5'; g.fillRect(x - 13, y - 15, 26, 30);
      g.fillStyle = '#26384c'; g.fillRect(x - 10, y - 12, 20, 24);
      g.fillStyle = '#fbfaf5'; g.fillRect(x - 1, y - 12, 2, 24); g.fillRect(x - 10, y - 1, 20, 2);
      g.fillStyle = '#2f4a3a'; g.fillRect(x - 20, y - 15, 6, 30); g.fillRect(x + 14, y - 15, 6, 30);
    };
    [40, 216].forEach((x) => { win(x, 34); win(x, 92); });
    win(128, 34);
    g.fillStyle = '#6b2a22'; g.fillRect(116, 76, 24, 52);
  });
  const roofMatN = std(0xffffff, 0.9, { map: shingles, bumpMap: shingles, bumpScale: 0.5 });
  const neighbour = (x, z, tint, rot) => {
    const g = new THREE.Group();
    g.position.set(x, GROUND_Y, z);
    g.rotation.y = rot;
    world.add(g);
    const body = add(new THREE.BoxGeometry(0.46, 0.2, 0.24), std(tint, 0.85, { map: facade }), 0, 0.1, 0, g);
    body.rotation.y = Math.PI;      // the painted facade faces the street
    [-1, 1].forEach((sgn) => {
      const r = add(new THREE.BoxGeometry(0.5, 0.008, 0.19), roofMatN, 0, 0.245, sgn * 0.066, g);
      r.rotation.x = sgn * 0.62;
    });
  };
  [[-0.74, 0.36, 0xd2e4f0, 0.05], [0.77, 0.38, 0xf3dcc4, -0.06], [-0.43, 1.3, 0xdcecd2, 0.0], [0.42, 1.34, 0xf2d6da, 0.0],
    [-1.22, 1.2, 0xf0e6c8, 0.1], [1.2, 1.26, 0xd2e4f0, -0.1]].forEach(([x, z, c, r]) => neighbour(x, z, c, r));
  // the trees behind them, and a few bushes in front of the next-door houses
  {
    const r = (() => { let sd = 404; return () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; }; })();
    let placed = 0;
    for (let i = 0; i < 400 && placed < 92; i++) {
      const far = placed >= 52;                                 // a second, taller row further back
      const x = -1.9 + r() * 3.8, z = far ? 2.0 + r() * 1.2 : 0.72 + r() * 1.3;
      if (!far && Math.abs(x) < 0.34 && z < 1.05) continue;    // keep Truman's roof clear
      const kr = r(), kind = kr < 0.42 ? 'oak' : kr < 0.74 ? 'maple' : 'poplar';
      const h = far ? 0.26 + r() * 0.12 : 0.22 + r() * 0.16;      // low enough to leave sky behind the star
      const w = kind === 'poplar' ? h * 0.5 : h * (0.82 + r() * 0.15);
      cards.add(x, GROUND_Y + 0.004, z, w, h, kind, 0.018 + r() * 0.014);
      placed++;
    }
    [[-0.74, 0.22], [0.77, 0.24]].forEach(([x, z]) => [-0.13, 0.13].forEach((dx) => cards.add(x + dx, GROUND_Y + 0.004, z, 0.085, 0.1, 'bush', 0.008)));
  }

  // ---------------------------------------------------------------- Truman's car (a 90s sedan), parked at the curb
  // a painted flat: from the street it is his car, from behind it is plywood and two braces
  const car = new THREE.Group();
  car.position.set(-0.26, GROUND_Y, -0.35);
  world.add(car);
  const carTex = paintCarFlat(THREE);
  const CAR_W = 0.3, CAR_H = (CAR_W * CAR.DH) / CAR.DW;
  const flatGeo = new THREE.PlaneGeometry(CAR_W, CAR_H);
  flatGeo.translate(0, CAR_H * (CAR.GROUND / CAR.DH - 0.5), 0);         // the painted ground line at y = 0
  const carFront = new THREE.Mesh(flatGeo, new THREE.MeshStandardMaterial({ map: carTex.front, alphaTest: 0.5, roughness: 0.6, envMapIntensity: 0.35 }));
  carFront.rotation.y = Math.PI;                                         // faces the street
  carFront.receiveShadow = true;
  car.add(carFront);
  const carBack = new THREE.Mesh(flatGeo, new THREE.MeshStandardMaterial({ map: carTex.back, alphaTest: 0.5, roughness: 0.9 }));
  carBack.position.z = 0.0008;
  carBack.castShadow = true;                                             // (shadow maps draw back faces)
  carBack.receiveShadow = true;
  car.add(carBack);
  const braceMat = std(0xb08d5e, 0.9), bagMat = std(0xcdb48a, 0.95);
  [-0.085, 0.085].forEach((x) => {
    add(new THREE.BoxGeometry(0.0045, 0.1, 0.0025), braceMat, x, 0.038, 0.035, car).rotation.x = -0.73;
    add(new THREE.SphereGeometry(0.008, 10, 6), bagMat, x, 0.004, 0.068, car).scale.set(1.5, 0.6, 1.0);
  });
  // a point painted on the flat (design coordinates) in the car's own space
  const carLocal = (dx, dy) => new THREE.Vector3(((CAR.DW / 2 - dx) / CAR.DW) * CAR_W, ((CAR.GROUND - dy) / CAR.DH) * CAR_H, -0.003);

  // ---------------------------------------------------------------- sky (the dome, painted) and light
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.ShaderMaterial({
    name: 'MorningSky', side: THREE.BackSide, depthWrite: false,
    uniforms: { uSky: { value: skyTex }, uTime: uniforms.uTime },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D uSky; uniform float uTime; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir);
        float v = clamp(d.y * 1.15 + 0.03, 0.002, 0.995);
        vec3 c = texture2D(uSky, vec2(atan(d.x, d.z) / 6.2831853 * 5.0 + uTime * 0.004, v)).rgb * 1.05;
        c = mix(c, vec3(0.75, 0.82, 0.86), smoothstep(0.02, -0.08, d.y));
        float hgt = clamp(d.y, 0.0, 1.0);
        c *= mix(vec3(1.08, 1.0, 0.86), vec3(0.78, 0.87, 1.05), smoothstep(0.02, 0.45, hgt));
        c += vec3(0.34, 0.2, 0.07) * pow(max(d.x, 0.0), 3.0) * (1.0 - smoothstep(0.0, 0.5, hgt));
        c = mix(c, vec3(0.9, 0.86, 0.78), smoothstep(0.2, 0.0, d.y) * 0.3);   // morning haze
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  world.add(sky);
  // a low, warm morning sun from the left; a cool sky fills the shadows; a pale
  // back light from the sky behind the houses draws rims round Truman and the props
  world.add(new THREE.HemisphereLight(0x98b8e6, 0x4a5236, 0.26));
  const sun = new THREE.DirectionalLight(0xffc489, 5.9);
  sun.position.set(1.9, 0.75, -0.55);            // about 21 degrees up, from the side: long shadows across the view
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 0.3, far: 5.5 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.003;
  world.add(sun);
  world.add(sun.target);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.15);
  rim.position.set(-0.7, 0.75, 1.7);
  world.add(rim);
  // a soft vignette just inside the window
  const vignette = makeVignette(THREE, { size: 1 / ZOOM, strength: 0.42, tint: [0.07, 0.05, 0.03] });
  vignette.mesh.position.set(0, -world.position.y / ZOOM, (-0.4995 - world.position.z) / ZOOM);
  vignette.mesh.rotation.y = Math.PI;                   // faces the viewer outside the back face
  world.add(vignette.mesh);

  // ---------------------------------------------------------------- SIRIUS (9 CANIS MAJOR)
  // A star far up in the morning sky — really a stage light hanging in the dome.
  // 4.2 it flickers · 5.1 it slips · 6.0 it falls towards us like a shooting star,
  // lit, a torn power cable whipping behind it · 7.05 it smashes on the street:
  // flash, sparks, glass, dust, a crack, the car alarm · 17.3 a crane hook comes
  // down out of the sky, catches it by the yoke and lifts it away · 21.2 the star
  // is back in its place.
  const T_GLINT = 4.2, T_LOOSE = 5.1, T_FALL = 6.0, T_HIT = 7.05;
  const T_HOOK = 17.3, T_CATCH = 18.5, T_LIFT = 19.0, T_GONE = 20.8, T_STAR = 21.2;
  const LS = 0.72, LAMP_R = 0.03 * LS, BACK = 0.036 * LS, DROP = 0.02;     // lamp scale, radius, centre->back
  const HANG = new THREE.Vector3(-0.4, 0.14, 1.0);                    // the star: low over the rooftops, seen from any side
  const impact = new THREE.Vector3(-0.06, GROUND_Y + LAMP_R, -0.36);
  const REST = new THREE.Vector3(-0.056, GROUND_Y + LAMP_R, -0.338);  // where it rolls to
  const ROLL = REST.distanceTo(impact) / LAMP_R;
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qs = new THREE.Quaternion();
  const _m4 = new THREE.Matrix4(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
  const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);

  const lampGroup = new THREE.Group();     // at the lamp's centre
  world.add(lampGroup);
  const lamp = new THREE.Group();          // turned by a quaternion
  lamp.scale.setScalar(LS);
  lampGroup.add(lamp);
  const black = std(0x15161a, 0.45, { metalness: 0.6 });
  const body = add(new THREE.CylinderGeometry(0.03, 0.026, 0.07, 20), black, 0, 0, 0, lamp);
  body.rotation.x = Math.PI / 2;
  const lensMat = std(0xfff3d0, 0.1, { emissive: 0xfff0c8, emissiveIntensity: 0.6 });
  add(new THREE.CircleGeometry(0.026, 24), lensMat, 0, 0, 0.0352, lamp);
  add(new THREE.TorusGeometry(0.03, 0.004, 8, 24), black, 0, 0, 0.034, lamp);
  for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(0.0272 - i * 0.0004, 0.0015, 6, 24), black, 0, 0, -0.012 - i * 0.006, lamp);   // cooling fins
  add(new THREE.CylinderGeometry(0.006, 0.008, 0.008, 10), black, 0, 0, -0.038, lamp).rotation.x = Math.PI / 2;           // cable gland
  const yoke = add(new THREE.TorusGeometry(0.04, 0.004, 6, 20, Math.PI), black, 0, 0, 0, lamp);
  yoke.rotation.z = Math.PI;
  add(new THREE.TorusGeometry(0.005, 0.0016, 6, 12), black, 0, -0.043, 0, lamp);                                       // the rigging ring
  // the label on four sides, the text along the lamp
  const labelMat = new THREE.MeshStandardMaterial({ map: label, roughness: 0.7 });
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([x, y]) => {
    const n = new THREE.Vector3(x, y, 0), right = new THREE.Vector3(0, 0, -1);
    const up = new THREE.Vector3().crossVectors(n, right);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.0125), labelMat);
    pl.quaternion.setFromRotationMatrix(_m4.makeBasis(right, up, n));
    pl.position.copy(n).multiplyScalar(0.0305).add(_v.set(0, 0, -0.004));
    lamp.add(pl);
  });
  lamp.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const qOf = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(_m4.makeBasis(x, y, z));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const MOUNT = V(0, -0.047 * LS, 0);                             // the rigging ring at the top of the yoke (lamp space)
  const qBase = qOf(V(0, 0, 1), V(0, -1, 0), V(1, 0, 0));   // on its side: lens to +x, yoke on top, a label to the street
  const qHang = qOf(V(1, 0, 0), V(0, 0, 1), V(0, -1, 0));   // hanging in the dome: lens down
  const qRest = new THREE.Quaternion().setFromAxisAngle(AX, ROLL).multiply(qBase);
  const TUMBLE = new THREE.Vector3(0.7, 0.3, 0.65).normalize();
  const LENS_REST = REST.clone().add(V(0, 0, 0.036 * LS).applyQuaternion(qRest));
  const HOOK_AT = REST.clone().add(MOUNT.clone().applyQuaternion(qRest));   // where the hook catches the ring

  // ------------------------------------------------ where the lamp (and the hook) are
  const lampPos = new THREE.Vector3(), lampQ = new THREE.Quaternion(), attachP = new THREE.Vector3(), hookP = new THREE.Vector3();
  const swingQ = (t, amp, out) => {
    _qa.setFromAxisAngle(AZ, amp * 0.1 * Math.sin(t * 1.1));
    _qb.setFromAxisAngle(AX, amp * 0.08 * Math.sin(t * 0.83 + 1.0));
    return out.multiplyQuaternions(_qa, _qb);
  };
  const slip = (t) => {        // it slips three times before it lets go
    let d = 0;
    for (const t0 of [T_LOOSE + 0.1, T_LOOSE + 0.45, T_LOOSE + 0.72]) if (t > t0) {
      const k = t - t0;
      d += 0.03 * smooth(clamp01(k / 0.07)) - 0.01 * Math.exp(-k * 9) * Math.sin(k * 45);
    }
    return d;
  };
  const hangAt = (t, out) => {
    const loosening = t > T_LOOSE && t <= T_FALL;
    attachP.copy(HANG);
    attachP.y -= DROP + (loosening ? slip(t) : 0);
    lampQ.multiplyQuaternions(swingQ(t, loosening ? 1 + 3 * clamp01((t - T_LOOSE) / (T_FALL - T_LOOSE)) : 1, _qs), qHang);
    return out.copy(attachP).add(_v.set(0, 0, BACK).applyQuaternion(lampQ));
  };
  const C0 = new THREE.Vector3();
  hangAt(T_FALL, C0);
  const qF0 = lampQ.clone();
  const backEnd = () => attachP.copy(lampPos).add(_v.set(0, 0, -BACK).applyQuaternion(lampQ));
  const hangFrom = (hook, q) => lampPos.copy(hook).sub(_v.copy(MOUNT).applyQuaternion(q));
  const lampAt = (t) => {
    hookP.set(0, 0, 0);
    if (t < T_FALL || t >= T_STAR) { hangAt(t, lampPos); return 'hang'; }
    if (t < T_HIT) {                     // falling, tumbling, lit
      const u = (t - T_FALL) / (T_HIT - T_FALL);
      const h = Math.pow(u, 1.2);
      lampPos.set(C0.x + (impact.x - C0.x) * h, C0.y + (impact.y - C0.y) * u * u, C0.z + (impact.z - C0.z) * h);
      _qa.slerpQuaternions(qF0, qBase, u);
      lampQ.setFromAxisAngle(TUMBLE, Math.PI * 2 * u).multiply(_qa);
      backEnd();
      return 'fall';
    }
    const k = t - T_HIT;
    if (t < T_CATCH) {                   // bounces, rolls, lies there
      const bounce = k < 0.3 ? 0.028 * Math.sin(Math.PI * k / 0.3) : k < 0.47 ? 0.006 * Math.sin(Math.PI * (k - 0.3) / 0.17) : 0;
      const r = smooth(clamp01((k - 0.05) / 0.85));
      lampPos.lerpVectors(impact, REST, r).y += bounce;
      _qa.setFromAxisAngle(AZ, 0.3 * Math.exp(-3 * k) * Math.sin(k * 14));
      lampQ.setFromAxisAngle(AX, ROLL * r).multiply(_qa).multiply(qBase);
      backEnd();
      if (t > T_HOOK) {                  // the hook comes down out of the sky
        const u = clamp01((t - T_HOOK) / (T_CATCH - T_HOOK));
        const e = 1 - Math.pow(1 - u, 2.2);
        const kk = t - T_HOOK;
        hookP.copy(HOOK_AT).add(_v.set(0.012 * Math.sin(kk * 3.3) * (1 - u), 0.012 + 0.9 * (1 - e), 0.006 * Math.sin(kk * 2.1) * (1 - u)));
      }
      return t > T_HOOK ? 'hook' : 'ground';
    }
    if (t < T_LIFT) {                    // hooked: the cable takes the weight and rights it on the yoke
      const tip = smooth(clamp01((t - T_CATCH - 0.2) / (T_LIFT - T_CATCH - 0.2)));
      lampQ.slerpQuaternions(qRest, qBase, tip);
      lampPos.copy(REST).y += 0.003 * tip;
      const settle = 1 - smooth(clamp01((t - T_CATCH) / 0.2));
      hookP.copy(lampPos).add(_v.copy(MOUNT).applyQuaternion(lampQ)).y += 0.012 * settle;
      backEnd();
      return 'catch';
    }
    // lifted away, swinging under the hook
    const kk = t - T_LIFT, u = kk / (T_GONE - T_LIFT);
    hookP.copy(REST).add(_v.copy(MOUNT).applyQuaternion(qBase)).y += 0.003 + 1.15 * u * u;
    _qa.setFromAxisAngle(AZ, 0.22 * Math.exp(-1.2 * kk) * Math.sin(kk * 4.4));
    _qb.setFromAxisAngle(AX, 0.12 * Math.exp(-0.9 * kk) * Math.sin(kk * 3.3 + 0.6) * smooth(clamp01(kk * 2)));
    lampQ.copy(_qa).multiply(_qb).multiply(qBase);
    hangFrom(hookP, lampQ);
    backEnd();
    return t < T_GONE ? 'lift' : 'gone';
  };

  // ------------------------------------------------ light: the star's glint, the lamp's glow, its beam
  const glowTex = canvasTex(THREE, 128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,248,225,1)'); grd.addColorStop(0.25, 'rgba(255,236,190,0.55)'); grd.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
  const starTex = canvasTex(THREE, 128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 34);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,252,240,0.6)'); grd.addColorStop(1, 'rgba(255,248,230,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    [[64, 0, 64, 128], [0, 64, 128, 64]].forEach(([x0, y0, x1, y1]) => {
      const lg = g.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = lg; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    });
  }, false);
  const sprite = (map) => new THREE.Sprite(new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  const lampGlow = sprite(glowTex);
  lampGroup.add(lampGlow);
  const star = sprite(starTex);
  world.add(star);
  const lampLight = new THREE.PointLight(0xffe8c0, 0, 0, 2);
  world.add(lampLight);                    // never inside a hidden group: the light count must not change
  const beam = new THREE.SpotLight(0xfff0d0, 0, 0, 0.34, 0.6, 2);
  beam.position.set(0, 0, 0.036);
  beam.target.position.set(0, 0, 1);
  world.add(beam, beam.target);

  // ------------------------------------------------ the torn power cable at the lamp's back
  const CN = 28, CR = 6, CABLE_RAD = 0.0016, TAIL = 0.11;
  const cablePos = new Float32Array((CN + 1) * CR * 3);
  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute('position', new THREE.BufferAttribute(cablePos, 3));
  {
    const idx = [];
    for (let i = 0; i < CN; i++) for (let j = 0; j < CR; j++) {
      const a = i * CR + j, b = i * CR + (j + 1) % CR, c = (i + 1) * CR + j, d = (i + 1) * CR + (j + 1) % CR;
      idx.push(a, c, b, b, c, d);
    }
    cableGeo.setIndex(idx);
  }
  const cableMat = std(0x111214, 0.55, { side: THREE.DoubleSide });
  const cable = new THREE.Mesh(cableGeo, cableMat);
  cable.frustumCulled = false;
  cable.castShadow = true;
  world.add(cable);
  const cA = Array.from({ length: CN + 1 }, () => new THREE.Vector3());
  const cB = Array.from({ length: CN + 1 }, () => new THREE.Vector3());
  const FALL_DIR = C0.clone().sub(impact).normalize();
  const _pp = new THREE.Vector3();
  const trailInto = (arr, from, t) => {           // whipping behind the falling lamp
    _pp.set(-FALL_DIR.z, 0, FALL_DIR.x).normalize();
    for (let i = 0; i <= CN; i++) {
      const s = i / CN;
      arr[i].copy(from).addScaledVector(FALL_DIR, TAIL * s).addScaledVector(_pp, 0.018 * s * Math.sin(t * 23 - s * 7)).y += 0.012 * s * Math.sin(t * 17 - s * 5);
    }
  };
  const lieInto = (arr, from) => {                 // drops to the street and lies there in a curl
    for (let i = 0; i <= CN; i++) {
      const s = i / CN, d = TAIL * s, ph = 1.6 * s;
      arr[i].set(from.x - Math.cos(ph) * d * 0.8, 0, from.z + Math.sin(ph) * d * 0.55);
      arr[i].y = from.y + (GROUND_Y + 0.0018 - from.y) * smooth(clamp01(s / 0.22));
    }
  };
  const dangleInto = (arr, from, t) => {           // hangs under the lifted lamp
    for (let i = 0; i <= CN; i++) {
      const s = i / CN;
      arr[i].copy(from).add(_v.set(0.01 * s * s * Math.sin(t * 4.4), -TAIL * s, 0.006 * s * s * Math.sin(t * 3.3)));
      arr[i].y = Math.max(GROUND_Y + 0.0018, arr[i].y);
    }
  };
  const _tn = new THREE.Vector3(), _nn = new THREE.Vector3(), _bn = new THREE.Vector3();
  const buildCable = (P) => {
    for (let i = 0; i <= CN; i++) {
      _tn.subVectors(P[Math.min(CN, i + 1)], P[Math.max(0, i - 1)]);
      if (_tn.lengthSq() < 1e-12) _tn.set(0, -1, 0);
      _tn.normalize();
      if (i === 0) {
        _nn.set(0, 1, 0).cross(_tn);
        if (_nn.lengthSq() < 1e-6) _nn.set(1, 0, 0).cross(_tn);
        _nn.normalize();
      } else {
        _nn.addScaledVector(_tn, -_nn.dot(_tn));       // parallel transport: no twisting
        if (_nn.lengthSq() < 1e-8) _nn.set(1, 0, 0).cross(_tn);
        _nn.normalize();
      }
      _bn.crossVectors(_tn, _nn);
      for (let j = 0; j < CR; j++) {
        const an = j / CR * Math.PI * 2, c = Math.cos(an) * CABLE_RAD, s = Math.sin(an) * CABLE_RAD;
        const k = (i * CR + j) * 3;
        cablePos[k] = P[i].x + _nn.x * c + _bn.x * s;
        cablePos[k + 1] = P[i].y + _nn.y * c + _bn.y * s;
        cablePos[k + 2] = P[i].z + _nn.z * c + _bn.z * s;
      }
    }
    cableGeo.attributes.position.needsUpdate = true;
    cableGeo.computeVertexNormals();
  };

  // ------------------------------------------------ the crane hook, on a line down from the sky
  const hook = new THREE.Group();
  world.add(hook);
  const yellow = std(0xe3b21c, 0.45, { metalness: 0.2 });
  add(new THREE.BoxGeometry(0.014, 0.018, 0.009), yellow, 0, 0.021, 0, hook);           // the block
  add(new THREE.BoxGeometry(0.0145, 0.004, 0.0095), black, 0, 0.026, 0, hook);           // a black band
  add(new THREE.CylinderGeometry(0.0016, 0.0016, 0.008, 6), black, 0, 0.009, 0, hook);   // shank
  const hookCurve = add(new THREE.TorusGeometry(0.0055, 0.0016, 6, 14, Math.PI * 1.45), black, 0.0044, 0.0055, 0, hook);   // its bottom is the catch point
  hookCurve.rotation.z = Math.PI * 0.8;
  const hookLine = add(new THREE.CylinderGeometry(CABLE_RAD * 1.2, CABLE_RAD * 1.2, 1, 6), black, 0, 0, 0);
  hookLine.castShadow = false;
  hook.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ------------------------------------------------ the crash: sparks, glass, dust, a crack, smoke
  const SPARKS = 180;
  const sparkPos = new Float32Array(SPARKS * 3), sparkA = new Float32Array(SPARKS);
  const sparkSeed = new Float32Array(SPARKS * 3);
  for (let i = 0; i < SPARKS * 3; i++) sparkSeed[i] = Math.random() * 2 - 1;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('aA', new THREE.BufferAttribute(sparkA, 1));
  const sparks = new THREE.Points(sparkGeo, new THREE.ShaderMaterial({
    name: 'Sparks', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (1.5 + 5.0 * aA) * 4.0 / max(0.3, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.8, 0.45) * a * 1.8, a); }',
  }));
  sparks.frustumCulled = false;
  world.add(sparks);
  // the impact, then the lamp sputtering at its lens
  const BURSTS = [
    { at: 0, from: 0, n: 120, sp: 1, life: 0.9, o: impact },
    { at: 1.0, from: 120, n: 20, sp: 0.35, life: 0.45, o: LENS_REST },
    { at: 1.75, from: 140, n: 20, sp: 0.3, life: 0.4, o: LENS_REST },
    { at: 2.6, from: 160, n: 20, sp: 0.25, life: 0.35, o: LENS_REST },
  ];
  const updateSparks = (k) => {
    sparkA.fill(0);
    for (const B of BURSTS) {
      const kk = k - B.at;
      if (kk <= 0 || kk >= B.life) continue;
      for (let i = B.from; i < B.from + B.n; i++) {
        const sx = sparkSeed[i * 3], sy = Math.abs(sparkSeed[i * 3 + 1]), sz = sparkSeed[i * 3 + 2];
        sparkPos[i * 3] = B.o.x + sx * kk * 0.3 * B.sp;
        sparkPos[i * 3 + 1] = Math.max(GROUND_Y + 0.002, B.o.y + sy * kk * 0.45 * B.sp - 1.1 * kk * kk);
        sparkPos[i * 3 + 2] = B.o.z + sz * kk * 0.24 * B.sp;
        sparkA[i] = 1 - kk / B.life;
      }
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.aA.needsUpdate = true;
  };
  // the lens shatters: shards fly out, skitter and lie on the asphalt
  const SHARDS = 44;
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xe8f0f4, roughness: 0.05, metalness: 0.3, envMapIntensity: 2.2, side: THREE.DoubleSide, transparent: true });
  const shards = new THREE.InstancedMesh(new THREE.CircleGeometry(0.0045, 3), shardMat, SHARDS);
  const shardV = [], shardSpin = [];
  for (let i = 0; i < SHARDS; i++) {
    const an = Math.random() * Math.PI * 2, sp = 0.1 + Math.random() * 0.3;
    shardV.push(new THREE.Vector3(Math.cos(an) * sp, 0.25 + Math.random() * 0.45, Math.sin(an) * sp * 0.7));
    shardSpin.push(new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20));
  }
  shards.frustumCulled = false;
  world.add(shards);
  const updateShards = (k) => {
    for (let i = 0; i < SHARDS; i++) {
      const v = shardV[i];
      const land = 2 * v.y / 2.6;
      const tt = Math.min(k, land);
      const sk = Math.max(0, Math.min(k, land + 0.25) - land);
      const skid = sk * (1 - sk / 0.5);              // skitters a little after landing
      _a.set(impact.x + v.x * (tt + skid * 0.5), Math.max(GROUND_Y + 0.0012, impact.y + v.y * tt - 1.3 * tt * tt), impact.z + v.z * (tt + skid * 0.5));
      const spin = Math.min(k, land);
      _e.set(-Math.PI / 2 + Math.sin(shardSpin[i].x * spin) * (k < land ? 1.2 : 0.12), shardSpin[i].y * spin * 0.2, shardSpin[i].z * spin);
      shards.setMatrixAt(i, _m4.compose(_a, _qa.setFromEuler(_e), _s.setScalar(0.6 + (i % 5) * 0.2)));
    }
    shards.instanceMatrix.needsUpdate = true;
  };
  // a puff of dust
  const DUST = 48;
  const dustGeo = new THREE.BufferGeometry();
  const dustSeed = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST * 3; i++) dustSeed[i] = Math.random();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 3));
  const dustU = { uK: { value: -1 }, uImpact: { value: impact.clone().setY(GROUND_Y + 0.004) } };
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    name: 'ImpactDust', uniforms: dustU, transparent: true, depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uK; uniform vec3 uImpact; attribute vec3 aSeed; varying float vA;
      void main() {
        float k = max(uK, 0.0);
        float a = aSeed.x * 6.2831853;
        float r = (0.02 + 0.1 * aSeed.y) * (1.0 - exp(-k * 3.0));
        vec3 p = uImpact + vec3(cos(a) * r, 0.004 + 0.05 * aSeed.z * (1.0 - exp(-k * 2.0)), sin(a) * r * 0.7);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = step(0.0, uK) * (1.0 - smoothstep(0.5, 1.9, k)) * smoothstep(0.0, 0.05, k);
        gl_PointSize = (32.0 + 110.0 * k * aSeed.y) / max(0.3, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * vA * 0.32;
        gl_FragColor = vec4(vec3(0.66, 0.63, 0.58), a);
        #include <encodings_fragment>
      }`,
  }));
  dust.frustumCulled = false;
  world.add(dust);
  // a crack in the asphalt
  const crackTex = canvasTex(THREE, 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(12,12,14,0.9)'; g.lineCap = 'round';
    const r = (() => { let s = 5; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
    for (let i = 0; i < 9; i++) {
      let an = i / 9 * Math.PI * 2 + r() * 0.4, x = 128, y = 128;
      for (let s = 0; s < 6; s++) {
        g.lineWidth = Math.max(0.6, 3.2 - s * 0.5);
        g.beginPath(); g.moveTo(x, y);
        an += (r() - 0.5) * 0.7; x += Math.cos(an) * (10 + r() * 14); y += Math.sin(an) * (10 + r() * 14);
        g.lineTo(x, y); g.stroke();
      }
    }
    const grd = g.createRadialGradient(128, 128, 2, 128, 128, 30);
    grd.addColorStop(0, 'rgba(10,10,12,0.9)'); grd.addColorStop(1, 'rgba(10,10,12,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(128, 128, 30, 0, 6.3); g.fill();
  }, false);
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  crack.rotation.x = -Math.PI / 2;
  crack.position.set(impact.x, GROUND_Y + 0.0006, impact.z);
  world.add(crack);
  // smoke: from the hot lamp, and from Truman's chimney (breakfast)
  const makeSmoke = (count, { life, rise, drift, size, alpha, color }) => {
    const geo = new THREE.BufferGeometry();
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) seed[i] = i / count;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const u = { uTime: uniforms.uTime, uOrigin: { value: new THREE.Vector3() }, uOn: { value: 1 } };
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      name: 'Smoke', uniforms: u, transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uTime, uOn; uniform vec3 uOrigin; attribute float aSeed; varying float vA;
        void main() {
          float age = fract(uTime / ${life.toFixed(2)} + aSeed) * ${life.toFixed(2)};
          float k = age / ${life.toFixed(2)};
          vec3 p = uOrigin + vec3(${drift.toFixed(3)} * k + 0.01 * sin(age * 2.0 + aSeed * 37.0), ${rise.toFixed(3)} * k, -0.3 * ${drift.toFixed(3)} * k + 0.008 * cos(age * 1.7 + aSeed * 21.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = smoothstep(0.0, 0.12, k) * (1.0 - k) * uOn;
          gl_PointSize = ${size.toFixed(1)} * (0.3 + 1.7 * k) / max(0.3, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(${color}, smoothstep(0.5, 0.05, d) * vA * ${alpha.toFixed(3)});
          #include <encodings_fragment>
        }`,
    }));
    pts.frustumCulled = false;
    world.add(pts);
    return u;
  };
  const lampSmoke = makeSmoke(26, { life: 2.6, rise: 0.13, drift: 0.03, size: 70, alpha: 0.3, color: 'vec3(0.42, 0.42, 0.44)' });
  lampSmoke.uOrigin.value.copy(REST).add(V(0.01, 0.03, 0));
  const chimney = makeSmoke(36, { life: 6.0, rise: 0.22, drift: 0.05, size: 110, alpha: 0.1, color: 'vec3(0.93, 0.93, 0.95)' });
  chimney.uOrigin.value.set(0.18, GROUND_Y + 0.36, 0.38);
  // the car alarm: hazard lights blinking on the flat, which rocks on its braces
  const blinkMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x000000, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  [CAR.signalFront, CAR.signalRear].forEach(([dx, dy]) => {
    const b = new THREE.Sprite(blinkMat);
    b.position.copy(carLocal(dx, dy));
    b.scale.setScalar(0.04);
    car.add(b);
  });

  // ---------------------------------------------------------------- a neighbourhood that is alive
  // contact shadows: the soft dark where things meet the ground
  const blobTex = canvasTex(THREE, 64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.5)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
  const blob = (sx, sz, opacity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    world.add(m);
    return m;
  };
  blob(0.34, 0.11, 0.6).position.set(car.position.x, GROUND_Y + 0.0007, car.position.z + 0.01);
  blob(0.62, 0.07, 0.4).position.set(0.02, GROUND_Y + 0.0048, 0.205);       // the house's foot on the lawn
  const truBlob = blob(0.06, 0.05, 0.42);
  const lampBlob = blob(0.08, 0.07, 0);
  // birds crossing the sky: painted silhouettes that always face us
  const birdStrip = paintBirdStrip(THREE, 'songbird');
  const birds = Array.from({ length: 6 }, (_, i) => {
    const b = makeBird(THREE, birdStrip, 0.03 + 0.006 * (i % 3));
    b.userData.d = { dx: -0.045 * Math.abs(i - 2.5), dy: 0.02 * Math.abs(i - 2.5) + 0.006 * (i % 2), dz: 0.05 * (i - 2.5), ph: i * 1.3 };
    world.add(b);
    return b;
  });
  // an oscillating sprinkler on Truman's lawn
  const SPR = 280;
  const sprGeo = new THREE.BufferGeometry();
  const sprSeed = new Float32Array(SPR * 2);
  for (let i = 0; i < SPR * 2; i++) sprSeed[i] = Math.random();
  sprGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPR * 3), 3));
  sprGeo.setAttribute('aSeed', new THREE.BufferAttribute(sprSeed, 2));
  const SPR_AT = V(0.24, GROUND_Y + 0.008, 0.0);
  const sprinkler = new THREE.Points(sprGeo, new THREE.ShaderMaterial({
    name: 'Sprinkler', uniforms: { uTime: uniforms.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime; attribute vec2 aSeed; varying float vA;
      void main() {
        float life = 0.62;
        float age = fract(uTime / life + aSeed.x) * life;
        float te = uTime - age;
        float fan = sin(te * 1.2) * 1.0;                // the arm rocks from side to side
        vec3 v = vec3(sin(fan) * 0.2 + (aSeed.y - 0.5) * 0.02, cos(fan) * 0.36, (aSeed.y - 0.5) * 0.06);
        vec3 p = vec3(${SPR_AT.x.toFixed(3)}, ${SPR_AT.y.toFixed(3)}, ${SPR_AT.z.toFixed(3)}) + v * age + vec3(0.0, -0.6, 0.0) * age * age;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (1.0 - 0.6 * age / life) * step(${(GROUND_Y + 0.004).toFixed(4)}, p.y);
        gl_PointSize = 6.0 / max(0.3, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * 0.6; gl_FragColor = vec4(vec3(0.8, 0.9, 1.0) * a, a); }',
  }));
  sprinkler.frustumCulled = false;
  world.add(sprinkler);
  add(new THREE.BoxGeometry(0.02, 0.004, 0.006), std(0xd8c23a, 0.5), SPR_AT.x, GROUND_Y + 0.006, SPR_AT.z);
  const sprArm = add(new THREE.CylinderGeometry(0.0012, 0.0012, 0.018, 6), std(0x9aa0a6, 0.4, { metalness: 0.6 }), SPR_AT.x, GROUND_Y + 0.008, SPR_AT.z);
  sprArm.rotation.z = Math.PI / 2;

  // ---------------------------------------------------------------- Truman's part
  // 0 waves good morning · hears it coming, looks back over his shoulder and
  // follows it down · flinches at the crash · glances at his car · 9.0 walks over ·
  // crouches · touches it — hot! — shakes his hand, blows on his fingers · reads the
  // label · stands, shades his eyes and searches the sky · a hook comes down: he
  // startles, watches it lift the lamp away · the star is back: he turns to it and
  // walks home staring at it · turns round to face the street again.
  const HOME = V(0.03, 0, -0.07), GATE = V(0.022, 0, -0.178), SPOT = V(REST.x + 0.045, 0, REST.z + 0.03);
  const YAW_STREET = Math.PI / 2;
  const T_WALK1 = 9.0, T_WALK1_END = 11.8, T_WALK2 = 22.4, T_WALK2_END = 25.0;
  const rig = makeRig(THREE, { armature: trumanArmature, clip: trumanClip, space: world, position: V(HOME.x, GROUND_Y + 0.008, HOME.z), yaw: YAW_STREET });
  const FOOT_H = 0.0068, STRIDE = 0.07, DEG = Math.PI / 180;
  const groundAt = (z) => GROUND_Y + 0.0005 + 0.0065 * smooth(clamp01((z + 0.246) / 0.012));   // street | curb | walk
  const OUT = [HOME, GATE, SPOT], IN = [SPOT, GATE, HOME];
  const WALK_LEN = HOME.distanceTo(GATE) + GATE.distanceTo(SPOT);
  const polyAt = (pts, u, out) => {
    let s = clamp01(u) * WALK_LEN;
    for (let i = 1; i < pts.length; i++) {
      const l = pts[i].distanceTo(pts[i - 1]);
      if (s <= l || i === pts.length - 1) return out.lerpVectors(pts[i - 1], pts[i], Math.min(1, s / l));
      s -= l;
    }
    return out;
  };
  const wrap = (an) => Math.atan2(Math.sin(an), Math.cos(an));
  const lerpAngle = (x, y, k) => x + wrap(y - x) * k;
  const yawTo = (from, to) => Math.atan2(-(to.z - from.z), to.x - from.x);
  const walkOn = (pts, t0, t1, t, pos) => {
    const u = smooth(clamp01((t - t0) / (t1 - t0)));
    polyAt(pts, u, pos);
    polyAt(pts, u - 0.07, _a); polyAt(pts, u + 0.07, _b);
    return [u, ramp(t, t0 - 0.05, t0 + 0.4) * (1 - ramp(t, t1 - 0.4, t1 + 0.05)), yawTo(_a, _b)];
  };
  const FACE_LAMP = yawTo(SPOT, REST);
  const TO_STAR = yawTo(SPOT, HANG);
  const WATCHED = lerpAngle(FACE_LAMP, TO_STAR, 0.7);
  const CAR_EYE = V(car.position.x + 0.05, GROUND_Y + 0.05, car.position.z);
  const truPos = new THREE.Vector3(), lookP = new THREE.Vector3(), skyP = new THREE.Vector3();
  const headP = new THREE.Vector3(), lastHead = V(HOME.x, GROUND_Y + 0.112, HOME.z), shP = new THREE.Vector3();
  const tgt = new THREE.Vector3(), pole = new THREE.Vector3(), fwdV = new THREE.Vector3(), leftV = new THREE.Vector3();
  const _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), axW = new THREE.Vector3();
  const armTo = (s, target, w, p) => rig.reach(s, world.localToWorld(_ta.copy(target)), w, world.localToWorld(_tb.copy(p)));
  const worldBase = world.position.clone();
  const clampN = THREE.MathUtils.clamp;
  const LINE_TOP = 1.6;

  // less sky fill on everything matte (glass and metal keep their reflections), so
  // the sun and its shadows carry the picture
  {
    const seen = new Set();
    const skip = new Set();
    rig.pivot.traverse((o) => skip.add(o));
    world.traverse((o) => {
      if (skip.has(o) || !o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => {
        if (!mt.isMeshStandardMaterial || seen.has(mt) || mt.metalness > 0.2) return;
        seen.add(mt);
        mt.envMapIntensity *= 0.38;
      });
    });
  }

  // one draw call per kind of static piece (house trim, windows, shutters, roofs...)
  world.userData.batch = mergeStatic(THREE, world, { skip: new Set([rig.pivot, lampGroup, hook, hookLine, cable, car, sprArm]) });

  return {
    world,
    rig,
    update(time) {
      const t = time % LOOP;
      cards.setLight(sun);
      // ------------------------------------------------ the lamp
      const st = lampAt(t);
      lampGroup.visible = st !== 'gone' && st !== 'hang';
      lampGroup.position.copy(lampPos);
      lamp.quaternion.copy(lampQ);
      const k = t - T_HIT;
      const falling = st === 'fall';
      const onGround = st === 'ground' || st === 'hook';
      const sputter = onGround && k < 3.0 ? Math.max(0, 1 - k / 3.0) * (0.5 + 0.5 * Math.sin(k * 41.0) * Math.sin(k * 17.0)) : 0;
      const flash = k > 0 && k < 0.25 ? 1 - k / 0.25 : 0;
      lampGlow.visible = falling || sputter > 0.02 || flash > 0;
      lampGlow.material.opacity = falling ? 0.95 : Math.max(sputter, flash);
      lampGlow.scale.setScalar(0.12 + 0.3 * flash + 0.06 * (falling ? 1 : 0));
      lampLight.position.copy(lampPos);
      beam.position.copy(lampPos).add(_v.set(0, 0, 0.036 * LS).applyQuaternion(lampQ));
      beam.target.position.copy(lampPos).add(_v.set(0, 0, 1).applyQuaternion(lampQ));
      lampLight.intensity = (falling ? 0.08 : 0) + flash * 0.7 + sputter * 0.05;
      beam.intensity = falling ? 0.8 : flash * 2.0 + sputter * 0.25;
      lensMat.emissiveIntensity = st === 'hang' || falling ? 1.6 : 0.15 + sputter * 2.0;
      // the star: twinkles, flickers as it comes loose; lights up again once it is back
      const back = t >= T_STAR ? smooth(clamp01((t - T_STAR) / 0.8)) : 1;
      const flick = t > T_GLINT && t < T_FALL ? 0.55 + 0.45 * Math.abs(Math.sin(t * 9.0) * Math.sin(t * 23.0)) : 0;
      star.visible = st === 'hang' || st === 'fall';
      star.position.copy(lampPos).add(_v.set(0, 0, 0.036 * LS).applyQuaternion(lampQ));
      star.material.opacity = falling ? Math.max(0, 1 - (t - T_FALL) / 0.35) : Math.min(1, 0.75 + 0.25 * flick + 0.1 * Math.sin(t * 3.1)) * back;
      star.material.rotation = t * 0.3;
      star.scale.setScalar((0.13 + 0.1 * flick + 0.018 * Math.sin(t * 7.0)) * (falling ? 1 : 0.4 + 0.6 * back));
      // the torn cable
      cable.visible = st !== 'gone' && st !== 'hang';
      if (st === 'hang') for (let i = 0; i <= CN; i++) cA[i].copy(attachP).y += TAIL * i / CN;
      else if (falling) trailInto(cA, attachP, t);
      else if (st === 'lift') {
        lieInto(cA, attachP);
        dangleInto(cB, attachP, t);
        const w = smooth(clamp01((t - T_LIFT) / 0.7));
        for (let i = 0; i <= CN; i++) cA[i].lerp(cB[i], w);
      } else if (st !== 'gone') {
        lieInto(cA, attachP);
        if (k < 0.35) {
          trailInto(cB, attachP, t);
          const w = smooth(k / 0.35);
          for (let i = 0; i <= CN; i++) cA[i].lerpVectors(cB[i], cA[i], w);
        }
      }
      if (cable.visible) buildCable(cA);
      // the hook and its line
      hook.visible = hookLine.visible = st === 'hook' || st === 'catch' || st === 'lift';
      if (hook.visible) {
        hook.position.copy(hookP);
        hook.position.x -= 0.0044;
        hook.rotation.y = 0.3;
        const y0 = hookP.y + 0.03;
        hookLine.position.set(hook.position.x, (y0 + LINE_TOP) / 2, hookP.z);
        hookLine.scale.y = LINE_TOP - y0;
      }
      // sparks, shards, dust, crack, smoke
      updateSparks(k > 0 ? k : -1);
      shards.visible = k > 0;
      if (k > 0) updateShards(Math.min(k, 1.6));
      const tidy = 1 - ramp(t, LOOP - 1.4, LOOP - 0.3);       // by the next morning the street is clean
      shardMat.opacity = tidy;
      dustU.uK.value = k > 0 ? k : -1;
      crack.material.opacity = k > 0 ? Math.min(1, k * 8) * tidy * 0.85 : 0;
      lampSmoke.uOn.value = onGround ? ramp(t, T_HIT + 0.4, T_HIT + 1.2) * (1 - ramp(t, T_HOOK - 4.0, T_HOOK - 1.0)) : 0;
      // the car alarm
      const alarm = k > 0.1 && k < 4.6;
      blinkMat.color.setHex(alarm && Math.floor(k * 3.2) % 2 === 0 ? 0xffa21f : 0x000000);
      car.rotation.x = alarm ? 0.035 * Math.sin(k * 15) * Math.exp(-k * 1.3) : 0;
      // the street shakes at the impact
      const shake = k > 0 && k < 0.35 ? 1 - k / 0.35 : 0;
      world.position.copy(worldBase).add(_v.set(Math.sin(k * 97) * 0.006 * shake, Math.sin(k * 71) * 0.005 * shake, 0));
      world.updateMatrixWorld(true);

      // ------------------------------------------------ the neighbourhood
      const bt = (time + 2.0) % 15.0, bu = bt / 8.5;
      birds.forEach((b) => {
        const d = b.userData.d;
        b.visible = bu < 1;
        b.position.set(1.25 - 2.5 * bu + d.dx, 0.06 + d.dy + 0.02 * Math.sin(bt * 0.9 + d.ph) + 0.03 * bu, 1.15 + d.dz);
        setBirdFrame(b, Math.sin(bt * 1.6 + d.ph) > -0.3 ? time * 2.2 + d.ph : 0.25);   // flap, glide, flap
      });
      sprArm.rotation.x = Math.sin(time * 1.2);

      // ------------------------------------------------ Truman
      let yaw = YAW_STREET, walking = 0, travelled = 0;
      if (t < T_WALK1 - 0.4) truPos.copy(HOME);
      else if (t < T_WALK2 - 0.4) {
        const [u, w, py] = walkOn(OUT, T_WALK1, T_WALK1_END, t, truPos);
        walking = w; travelled = u * WALK_LEN;
        yaw = lerpAngle(YAW_STREET, py, ramp(t, T_WALK1 - 0.4, T_WALK1 + 0.25));
        yaw = lerpAngle(yaw, FACE_LAMP, ramp(t, T_WALK1_END - 0.25, T_WALK1_END + 0.35));
        yaw = lerpAngle(yaw, WATCHED, ramp(t, T_STAR + 0.1, T_STAR + 1.0));     // turns to the star
      } else if (t < T_WALK2_END) {
        const [u, w, py] = walkOn(IN, T_WALK2, T_WALK2_END, t, truPos);
        walking = w; travelled = u * WALK_LEN;
        yaw = lerpAngle(WATCHED, py, ramp(t, T_WALK2 - 0.4, T_WALK2 + 0.25));
      } else {
        truPos.copy(HOME);
        yaw = lerpAngle(yawTo(GATE, HOME), YAW_STREET, ramp(t, T_WALK2_END, T_WALK2_END + 0.8));
      }
      truBlob.position.set(truPos.x, groundAt(truPos.z) + 0.0008, truPos.z);
      truBlob.scale.setScalar(1 + 0.35 * ramp(t, 12.0, 12.8) * (1 - ramp(t, 15.8, 16.6)));
      lampBlob.visible = st !== 'hang' && st !== 'gone';
      if (lampBlob.visible) {
        lampBlob.position.set(lampPos.x, GROUND_Y + 0.0008, lampPos.z);
        lampBlob.material.opacity = 0.5 * clamp01(1 - (lampPos.y - REST.y) * 6);
      }
      const ph = (travelled / STRIDE) * Math.PI * 2;
      const sw = Math.sin(ph) * walking;
      const flinch = ramp(t, T_HIT - 0.32, T_HIT - 0.1) * (1 - ramp(t, T_HIT + 0.45, T_HIT + 1.0));
      const crouch = ramp(t, 12.0, 12.8) * (1 - ramp(t, 15.8, 16.6));
      const touch = ramp(t, 12.9, 13.5) * (1 - ramp(t, 13.7, 13.85));
      const ouch = ramp(t, 13.7, 13.8) * (1 - ramp(t, 14.1, 14.5));
      const toMouth = ramp(t, 13.78, 14.05) * (1 - ramp(t, 15.05, 15.4));     // the hand comes up...
      const blow = ramp(t, 14.4, 14.7);                                      // ...shaken, then to the mouth
      const flap = ramp(t, 13.85, 14.0) * (1 - ramp(t, 14.35, 14.5));
      const read = ramp(t, 15.0, 15.4) * (1 - ramp(t, 15.8, 16.2));
      const shade = ramp(t, 16.6, 17.1) * (1 - ramp(t, 17.75, 18.05));
      const skyW = ramp(t, 16.3, 16.9) * (1 - ramp(t, 17.8, 18.1));
      const hookW = ramp(t, 17.8, 18.1) * (1 - ramp(t, 18.45, 18.8));
      const startle = ramp(t, 17.95, 18.1) * (1 - ramp(t, 18.5, 19.1));
      const watch = ramp(t, T_LIFT, T_LIFT + 0.6) * (1 - ramp(t, T_STAR, T_STAR + 0.6));
      const starW = ramp(t, T_STAR + 0.1, T_STAR + 0.8);
      // where he looks: the falling lamp, his car, the lamp, the sky, the hook, the lamp going up, the star
      lookP.copy(lampPos);
      lookP.lerp(CAR_EYE, ramp(t, 8.1, 8.35) * (1 - ramp(t, 8.8, 9.05)));
      skyP.set(truPos.x - 0.2 + 0.32 * Math.sin((t - 16.3) * 0.75), GROUND_Y + 0.8, truPos.z - 0.32);
      lookP.lerp(skyP, skyW);
      if (st === 'hook') lookP.lerp(hookP, hookW);
      lookP.lerp(HANG, starW);
      const W = ramp(t, T_FALL - 0.1, T_FALL + 0.3) * (1 - ramp(t, T_WALK2_END - 0.6, T_WALK2_END + 0.2));
      const dx = lookP.x - lastHead.x, dz = lookP.z - lastHead.z;
      const rel = wrap(Math.atan2(-dz, dx) - yaw) / DEG;
      const pitch = Math.atan2(lookP.y - lastHead.y, Math.max(0.01, Math.hypot(dx, dz))) / DEG;
      const steep = W * clamp01((pitch - 45) / 35);
      const lean = 4 * walking + 30 * crouch - 9 * ouch + 6 * read + 6 * flinch - 6 * skyW - 12 * steep - 5 * startle;
      const pitchRel = pitch + lean * 0.9;
      const side = W * clampN(rel, -85, 85) * (1 - flinch) - 25 * flinch + (1 - W) * 10 * Math.sin(t * 0.9) * (t < 5 ? 1 : 0);
      const lookUp = W * clampN(pitchRel / 40, 0, 1.45);
      const lookDown = W * clampN(-pitchRel / 26, 0, 1.3) * (1 - flinch) + 0.6 * flinch;
      const clipT = t < 5.0 ? 0.25 + t * 0.95 : 5.0;
      const a = 54 * crouch;
      rig.pivot.position.set(truPos.x, groundAt(truPos.z), truPos.z);
      rig.pivot.rotation.y = yaw;
      rig.pose(clipT, {
        lookUp, lookDown,
        lookSide: side * 0.6,
        lean,
        sway: 2 * Math.sin(time * 0.7) * (1 - crouch),
        brace: 10 * flinch + 6 * startle,
        extra: [
          ['Neck', 'up', side * 0.25], ['Spine2', 'up', side * 0.15],
          ['LeftUpLeg', 'side', -24 * sw - a], ['RightUpLeg', 'side', 24 * sw - a],
          ['LeftLeg', 'side', 38 * Math.max(0, Math.sin(ph + 1.2)) * walking + 2 * a], ['RightLeg', 'side', 38 * Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * walking + 2 * a],
          ['LeftFoot', 'side', -a], ['RightFoot', 'side', -a],
          ['LeftUpLeg', 'fwd', -9 * crouch], ['RightUpLeg', 'fwd', 9 * crouch],
          ['LeftArm', 'side', 14 * sw - 10 * startle], ['RightArm', 'side', -14 * sw - 10 * startle],
          ['Head', 'fwd', 13 * read],
        ],
      });
      // keep the soles on the ground (crouching, walking, flinching)
      rig.bonePos('LeftFoot', _fa); rig.bonePos('RightFoot', _fb);
      world.worldToLocal(_fa); world.worldToLocal(_fb);
      rig.pivot.position.y += groundAt(truPos.z) + FOOT_H - Math.min(_fa.y, _fb.y);
      rig.pivot.updateMatrixWorld(true);
      rig.bonePos('Head', headP);
      world.worldToLocal(headP);
      lastHead.copy(headP);
      fwdV.set(Math.cos(yaw), 0, -Math.sin(yaw));
      leftV.set(0, 1, 0).cross(fwdV).normalize();          // the character's left
      // hands up in front of the face at the crash
      if (flinch > 0.01) ['Left', 'Right'].forEach((s, i) => {
        const sg = i ? -1 : 1;
        rig.bonePos(s + 'Arm', shP); world.worldToLocal(shP);
        tgt.copy(headP).addScaledVector(fwdV, 0.024).addScaledVector(leftV, 0.007 * sg).y += 0.002;
        pole.copy(shP).addScaledVector(leftV, 0.05 * sg).addScaledVector(fwdV, 0.005).y -= 0.03;
        armTo(s, tgt, flinch, pole);
        rig.curl(s, 0.6 * flinch);
      });
      // touches the lamp — hot! — shakes the hand and blows on the fingers
      if (touch > 0.01 || toMouth > 0.01) {
        rig.bonePos('RightArm', shP); world.worldToLocal(shP);
        if (touch > 0.01) {
          tgt.set(SPOT.x - REST.x, 0, SPOT.z - REST.z).normalize().multiplyScalar(0.012).add(REST);
          tgt.y = REST.y + LAMP_R + 0.007;
          pole.copy(shP).addScaledVector(leftV, -0.05).y -= 0.02;
          armTo('Right', tgt, touch, pole);
        }
        if (toMouth > 0.01) {
          // shaking it in front of the chest ... then the fingertips to the lips
          _a.copy(headP).addScaledVector(fwdV, 0.017).addScaledVector(leftV, -0.006).y -= 0.026 - 0.005 * Math.sin(t * 27) * flap;
          _b.copy(headP).addScaledVector(fwdV, 0.011).addScaledVector(leftV, -0.001).y -= 0.013;
          tgt.lerpVectors(_a, _b, blow);
          pole.copy(shP).addScaledVector(leftV, -0.025).addScaledVector(fwdV, -0.004).y -= 0.03;
          armTo('Right', tgt, toMouth, pole);
        }
        if (flap > 0.01) rig.rotateBone('RightHand', axW.copy(leftV).transformDirection(world.matrixWorld), 40 * Math.sin(t * 27) * flap);
        rig.curl('Right', 0.12 + 0.3 * toMouth);
      }
      // shades his eyes and searches the sky
      if (shade > 0.01) {
        rig.bonePos('LeftArm', shP); world.worldToLocal(shP);
        tgt.copy(headP).addScaledVector(fwdV, 0.015).addScaledVector(leftV, 0.009).y += 0.005;
        pole.copy(shP).addScaledVector(leftV, 0.022).addScaledVector(fwdV, 0.028).y -= 0.022;
        armTo('Left', tgt, shade, pole);
        _a.copy(headP).addScaledVector(fwdV, 0.016).addScaledVector(leftV, -0.012).y += 0.009;
        rig.aimHand('Left', world.localToWorld(_a), 'LeftHandMiddle4', shade, 75);
        rig.curl('Left', 0.08 * shade);
      }
    },
  };
}
