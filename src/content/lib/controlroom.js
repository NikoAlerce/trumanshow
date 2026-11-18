// The set of the control room (everything around Christof's desk): a curved
// wall of monitors with a big switcher screen, an LED ticker and the ON AIR
// sign; a curved operators' console with two technicians in headsets; a
// lighting truss with spots and dusty beams; racks, the camera map of the
// island, a running timecode; and a window on the night of the dome, because
// the control room hangs up in the sky of the set.

const C = { x: -0.30, z: 0 };       // centre of the curved wall and console
const R_MON = 0.76, D_MON = 0.60;   // monitor wall radius and half angle
const MON_COLS = 7, MON_ROWS = 4, MON_Y0 = -0.25, MON_Y1 = 0.23;
const D_CON = 0.52;                 // console half angle

const polar = (r, d, y) => [C.x + r * Math.cos(d), y, r * Math.sin(d)];
const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------------------------------------------------------------- painted views
function nightView(THREE) {
  const c = canvas(1024, 512), g = c.getContext('2d'), r = rng(31);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#04081a'); sky.addColorStop(0.62, '#0b1733'); sky.addColorStop(1, '#0a1220');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 520; i++) {
    const big = r() < 0.06;
    g.fillStyle = `rgba(255,${235 + r() * 20},${210 + r() * 40},${0.25 + r() * 0.6})`;
    g.beginPath(); g.arc(r() * 1024, r() * 330, big ? 1.6 : 0.8, 0, 6.3); g.fill();
  }
  // the bay of Seahaven far below: the sea, the coast, the lights of the town
  g.fillStyle = '#071226'; g.fillRect(0, 360, 1024, 152);
  g.fillStyle = '#060a10';
  g.beginPath(); g.moveTo(0, 512); g.lineTo(0, 420);
  for (let x = 0; x <= 1024; x += 16) g.lineTo(x, 410 + 26 * Math.sin(x * 0.006 + 1.0) + 10 * Math.sin(x * 0.03));
  g.lineTo(1024, 512); g.closePath(); g.fill();
  for (let i = 0; i < 900; i++) {
    const x = r() * 1024, base = 410 + 26 * Math.sin(x * 0.006 + 1.0) + 10 * Math.sin(x * 0.03);
    const y = base + 6 + r() * (512 - base - 6);
    const warm = r() < 0.8;
    g.fillStyle = warm ? `rgba(255,${190 + r() * 50},${110 + r() * 60},${0.35 + r() * 0.6})` : `rgba(180,210,255,${0.3 + r() * 0.5})`;
    g.fillRect(x, y, 1.6, 1.6);
  }
  // moonlight on the water
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(200,215,255,${0.08 + r() * 0.15})`; g.fillRect(620 + (r() - 0.5) * 80, 365 + r() * 40, 14 + r() * 30, 1.2); }
  // the lighthouse and its beam
  const lx = 300, ly = 420;
  const beam = g.createLinearGradient(lx, ly, lx + 380, ly - 60);
  beam.addColorStop(0, 'rgba(255,240,200,0.35)'); beam.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = beam; g.beginPath(); g.moveTo(lx, ly - 2); g.lineTo(lx + 420, ly - 90); g.lineTo(lx + 420, ly - 30); g.closePath(); g.fill();
  g.fillStyle = '#fff2c8'; g.fillRect(lx - 2, ly - 4, 4, 4);
  // the steel frame of the dome, seen from inside its sky
  g.strokeStyle = 'rgba(70,82,104,0.55)'; g.lineWidth = 3;
  for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(512, 1150, 820 + k * 150, 820 + k * 150, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  g.lineWidth = 2;
  for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(512 + k * 40, 512); g.lineTo(512 + k * 260, -40); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

function cameraMap(THREE, family, dots) {
  const c = canvas(512, 512), g = c.getContext('2d'), r = rng(57);
  g.fillStyle = '#06101e'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(70,140,200,0.18)'; g.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
  // the island
  const island = new Path2D();
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2;
    const rad = 150 + 28 * Math.sin(a * 3 + 0.5) + 16 * Math.sin(a * 7 + 1.7) + 9 * Math.sin(a * 13);
    pts.push([262 + Math.cos(a) * rad * 1.08, 285 + Math.sin(a) * rad * 0.82]);
  }
  pts.forEach(([x, y], i) => (i ? island.lineTo(x, y) : island.moveTo(x, y)));
  island.closePath();
  g.fillStyle = 'rgba(40,110,150,0.22)'; g.fill(island);
  g.strokeStyle = 'rgba(120,220,255,0.85)'; g.lineWidth = 2.5; g.stroke(island);
  // streets
  g.strokeStyle = 'rgba(120,220,255,0.35)'; g.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(150 + i * 26, 190); g.lineTo(140 + i * 30, 390); g.stroke(); }
  for (let j = 0; j < 6; j++) { g.beginPath(); g.moveTo(140, 200 + j * 34); g.lineTo(390, 205 + j * 33); g.stroke(); }
  // the bridge and the causeway
  g.beginPath(); g.moveTo(395, 330); g.lineTo(500, 360); g.stroke();
  g.fillStyle = 'rgba(160,230,255,0.9)';
  g.font = `600 22px ${family}, sans-serif`;
  g.fillText('SEAHAVEN  ·  CAMERA GRID', 22, 40);
  g.font = `500 14px ${family}, sans-serif`;
  g.fillText('ACTIVE', 22, 488);
  g.fillStyle = 'rgba(255,90,70,0.95)'; g.fillRect(80, 478, 10, 10);
  // camera positions (for the blinking lights): inside the island
  while (dots.length < 46) {
    const x = 110 + r() * 300, y = 160 + r() * 250;
    if (g.isPointInPath(island, x, y)) dots.push([x / 512, 1 - y / 512]);
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

function acousticPanels(THREE) {
  const c = canvas(256, 256), g = c.getContext('2d'), r = rng(13);
  g.fillStyle = '#151a24'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '90,100,120'},${r() * 0.12})`; g.fillRect(r() * 256, r() * 256, 1, 1); }
  for (let x = 0; x < 256; x += 64) { g.fillStyle = '#07090d'; g.fillRect(x, 0, 3, 256); g.fillStyle = 'rgba(120,130,150,0.12)'; g.fillRect(x + 3, 0, 1, 256); }
  g.fillStyle = '#07090d'; g.fillRect(0, 126, 256, 3);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function tickerTexture(THREE, family) {
  const c = canvas(2048, 64), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 64);
  g.fillStyle = '#fff'; g.textBaseline = 'middle';
  g.font = `700 44px ${family}, monospace`;
  g.fillText('SEAHAVEN ISLAND  •  LIVE  •  ALL CAMERAS ROLLING  •  STAND BY FOR SUNRISE  •  WEATHER: FAIR  •', 10, 34);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// a seated technician in a headset (seen mostly from behind, against the screens)
function makeOperator(THREE, { shirt, hair, seed }) {
  const k = 0.144;   // metres -> room units
  const g = new THREE.Group();
  const M = (color, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const skin = M(0xc49a7e, 0.6), cloth = M(shirt, 0.85), trousers = M(0x14161b, 0.9), chairM = M(0x0e0f12, 0.55, 0.2), metal = M(0x2b2e35, 0.35, 0.8);
  const hairM = M(hair, 0.8), headset = M(0x0b0c0e, 0.4, 0.3);
  const Y = new THREE.Vector3(0, 1, 0);
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x * k, y * k, z * k); parent.add(m); return m; };
  const limb = (a, b, r, mat, parent = g) => {
    const A = new THREE.Vector3(...a).multiplyScalar(k), B = new THREE.Vector3(...b).multiplyScalar(k);
    const len = A.distanceTo(B);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r * k, Math.max(0.001, len - 2 * r * k), 4, 10), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(Y, B.clone().sub(A).normalize());
    parent.add(m);
    return m;
  };
  // chair
  add(new THREE.BoxGeometry(0.48 * k, 0.07 * k, 0.46 * k), chairM, 0, 0.47, -0.03);
  const back = add(new THREE.BoxGeometry(0.46 * k, 0.58 * k, 0.07 * k), chairM, 0, 0.86, -0.27);
  back.rotation.x = -0.14;
  add(new THREE.CylinderGeometry(0.03 * k, 0.035 * k, 0.4 * k, 10), metal, 0, 0.24, -0.03);
  for (let i = 0; i < 5; i++) {
    const leg = add(new THREE.BoxGeometry(0.34 * k, 0.03 * k, 0.045 * k), metal, 0, 0.05, -0.03);
    leg.rotation.y = i / 5 * Math.PI * 2;
    leg.translateX(0.15 * k);
  }
  // legs
  [-1, 1].forEach((s) => {
    limb([s * 0.1, 0.52, 0.0], [s * 0.11, 0.52, 0.42], 0.075, trousers);
    limb([s * 0.11, 0.52, 0.42], [s * 0.12, 0.08, 0.46], 0.06, trousers);
    add(new THREE.BoxGeometry(0.1 * k, 0.07 * k, 0.24 * k), M(0x0a0a0b, 0.6), s * 0.12, 0.04, 0.52);
  });
  // body (leaning towards the console) and head
  const body = new THREE.Group();
  body.position.set(0, 0.52 * k, -0.04 * k);
  g.add(body);
  const torso = add(new THREE.CapsuleGeometry(0.17 * k, 0.3 * k, 4, 14), cloth, 0, 0.3, 0.03, body);
  torso.scale.set(1.25, 1, 0.85);
  torso.rotation.x = 0.16;
  limb([0, 0.52, 0.09], [0, 0.6, 0.12], 0.055, skin, body);   // neck
  const head = new THREE.Group();
  head.position.set(0, 0.68 * k, 0.13 * k);
  body.add(head);
  add(new THREE.SphereGeometry(0.105 * k, 18, 14), skin, 0, 0, 0, head).scale.set(0.92, 1.08, 1);
  const hairMesh = add(new THREE.SphereGeometry(0.112 * k, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM, 0, 0.012, -0.012, head);
  hairMesh.rotation.x = -0.35;
  const band = add(new THREE.TorusGeometry(0.118 * k, 0.012 * k, 6, 22, Math.PI), headset, 0, 0.0, 0, head);
  band.rotation.y = Math.PI / 2;
  band.rotation.x = 0;
  [-1, 1].forEach((s) => { const cup = add(new THREE.CylinderGeometry(0.045 * k, 0.045 * k, 0.035 * k, 14), headset, s * 0.11, -0.01, 0, head); cup.rotation.z = Math.PI / 2; });
  limb([-0.12, -0.02, 0.0], [-0.06, -0.07, 0.13], 0.008, headset, head);   // boom mic
  // arms reaching to the console
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group();
    a.position.set(s * 0.2 * k, 0.48 * k, 0.05 * k);
    body.add(a);
    limb([0, 0, 0], [s * 0.05, -0.24, 0.16], 0.05, cloth, a);
    limb([s * 0.05, -0.24, 0.16], [-s * 0.03, -0.2, 0.44], 0.042, cloth, a);
    add(new THREE.SphereGeometry(0.04 * k, 10, 8), skin, -s * 0.035, -0.2, 0.48, a).scale.set(1, 0.6, 1.3);
    return a;
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  g.userData = { head, body, arms, seed };
  return g;
}

export function buildControlRoom(THREE, { room, uniforms, screenMat, buildScreens, buttonsMat, labelFamily, FLOOR_Y, makeSignTexture }) {
  const shell = new THREE.Group();
  shell.name = 'ControlRoom';
  room.add(shell);
  const add = (geo, mat, x, y, z, parent = shell) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const panelMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.03, 0.033, 0.04), roughness: 0.55, metalness: 0.45, name: 'ControlPanel' });
  const trimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.07, 0.075, 0.085), roughness: 0.3, metalness: 0.85, name: 'ControlTrim' });
  const led = (c, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false, fog: false });
  const acoustic = acousticPanels(THREE);
  const wallMat = (rx, ry) => {
    const t = acoustic.clone();
    t.needsUpdate = true;
    t.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0.0, name: 'AcousticWall' });
  };
  const F = FLOOR_Y;

  // ------------------------------------------------------------- floor, ceiling, walls
  const floorTexC = canvas(128, 128);
  const fg = floorTexC.getContext('2d');
  fg.fillStyle = '#1a1d23'; fg.fillRect(0, 0, 128, 128);
  fg.strokeStyle = '#08090b'; fg.lineWidth = 3; fg.strokeRect(1.5, 1.5, 125, 125);
  const floorTex = new THREE.CanvasTexture(floorTexC);
  floorTex.encoding = THREE.sRGBEncoding;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(10, 10);
  floorTex.anisotropy = 8;
  const floor = add(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshLambertMaterial({ map: floorTex, color: new THREE.Color(0.5, 0.53, 0.6), name: 'ControlFloor' }), 0, F, 0);
  floor.rotation.x = -Math.PI / 2;
  const ceil = add(new THREE.PlaneGeometry(1.0, 1.0), wallMat(4, 4), 0, 0.499, 0);
  ceil.rotation.x = Math.PI / 2;
  const back = add(new THREE.PlaneGeometry(1.0, 1.0), wallMat(4, 2), 0.499, 0, 0);
  back.rotation.y = -Math.PI / 2;
  const right = add(new THREE.PlaneGeometry(1.0, 1.0), wallMat(4, 2), 0, 0, 0.499);
  right.rotation.y = Math.PI;
  // the window wall (-z): a big window on the night of the dome
  const W = { x0: -0.43, x1: 0.21, y0: -0.15, y1: 0.31 };
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-0.5, -0.5); wallShape.lineTo(0.5, -0.5); wallShape.lineTo(0.5, 0.5); wallShape.lineTo(-0.5, 0.5); wallShape.lineTo(-0.5, -0.5);
  const hole = new THREE.Path();
  hole.moveTo(W.x0, W.y0); hole.lineTo(W.x0, W.y1); hole.lineTo(W.x1, W.y1); hole.lineTo(W.x1, W.y0); hole.lineTo(W.x0, W.y0);
  wallShape.holes.push(hole);
  const winWallGeo = new THREE.ShapeGeometry(wallShape);
  const uvw = winWallGeo.attributes.uv;
  for (let i = 0; i < uvw.count; i++) uvw.setXY(i, uvw.getX(i) + 0.5, uvw.getY(i) + 0.5);
  add(winWallGeo, wallMat(4, 2), 0, 0, -0.499);
  const view = add(new THREE.PlaneGeometry(W.x1 - W.x0 + 0.08, W.y1 - W.y0 + 0.08), new THREE.MeshBasicMaterial({ map: nightView(THREE), toneMapped: false, fog: false, color: new THREE.Color(0.95, 0.95, 0.95) }),
    (W.x0 + W.x1) / 2, (W.y0 + W.y1) / 2, -0.545);
  view.name = 'NightOfTheDome';
  // frame, mullions and sill
  const fr = (w, h, x, y) => add(new THREE.BoxGeometry(w, h, 0.05), trimMat, x, y, -0.5);
  fr(W.x1 - W.x0 + 0.03, 0.015, (W.x0 + W.x1) / 2, W.y1);
  fr(W.x1 - W.x0 + 0.03, 0.03, (W.x0 + W.x1) / 2, W.y0);
  fr(0.015, W.y1 - W.y0, W.x0, (W.y0 + W.y1) / 2);
  fr(0.015, W.y1 - W.y0, W.x1, (W.y0 + W.y1) / 2);
  [1, 2].forEach((i) => fr(0.009, W.y1 - W.y0, W.x0 + (W.x1 - W.x0) * i / 3, (W.y0 + W.y1) / 2));
  // reflections of the monitor wall on the glass
  add(new THREE.PlaneGeometry(W.x1 - W.x0, W.y1 - W.y0), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; void main(){
      float a = smoothstep(0.35, 1.0, vUv.x) * (0.05 + 0.05 * sin(vUv.x * 40.0 + vUv.y * 6.0)) + 0.03 * smoothstep(0.6, 0.0, abs(vUv.y - 0.55));
      gl_FragColor = vec4(vec3(0.55, 0.7, 1.0), a); }`,
  }), (W.x0 + W.x1) / 2, (W.y0 + W.y1) / 2, -0.497);

  // ------------------------------------------------------------- the curved wall of monitors
  const rnd = rng(1998);
  const dTh = (2 * D_MON) / MON_COLS;
  const ch = (MON_Y1 - MON_Y0) / MON_ROWS;
  const gapA = 0.004 / R_MON;
  const quads = [];
  const housings = [];
  let n = 0;
  for (let r = 0; r < MON_ROWS; r++) {
    for (let c = 0; c < MON_COLS; c++) {
      if (c >= 2 && c <= 4 && (r === 1 || r === 2)) continue;   // the big screen goes there
      const dL = -D_MON + c * dTh + gapA, dR = dL + dTh - 2 * gapA;
      const yB = MON_Y0 + r * ch + 0.004, yT = yB + ch - 0.008;
      const tile = n % 8;
      const zoom = [1, 1, 0.72, 0.55][Math.floor(rnd() * 4)];
      const ox = (1 - zoom) * rnd(), oy = (1 - zoom) * rnd();
      const label = n === 13 || n === 6 ? 15 : (n < 8 ? tile : 9 + (n % 6));
      quads.push({
        corners: [polar(R_MON - 0.001, dL, yT), polar(R_MON - 0.001, dR, yT), polar(R_MON - 0.001, dL, yB), polar(R_MON - 0.001, dR, yB)],
        tile, crop: [ox, oy, zoom, zoom], fx: [rnd() < 0.18 ? 1 : 0, rnd() < 0.3 ? 1 : 0, label, n * 1.7],
      });
      housings.push({ d: (dL + dR) / 2, y: (yB + yT) / 2, w: R_MON * (dR - dL) + 0.01, h: yT - yB + 0.01 });
      n++;
    }
  }
  // the big screen: the switcher's programme output
  const bL = -D_MON + 2 * dTh + gapA, bR = -D_MON + 5 * dTh - gapA;
  const bB = MON_Y0 + ch + 0.004, bT = MON_Y0 + 3 * ch - 0.004;
  quads.push({
    corners: [polar(R_MON - 0.004, bL, bT), polar(R_MON - 0.004, bR, bT), polar(R_MON - 0.004, bL, bB), polar(R_MON - 0.004, bR, bB)],
    tile: 8, crop: [0, 0.086, 1, 0.828], fx: [0, 0, 8, 0.5],
  });
  const chord = 2 * R_MON * Math.sin((bR - bL) / 2);
  const wallScreens = new THREE.Mesh(buildScreens(quads), screenMat);
  wallScreens.name = 'MonitorWall';
  shell.add(wallScreens);
  // monitor housings (one instanced mesh)
  const hous = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), panelMat, housings.length + 1);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  housings.forEach((h, i) => {
    pv.fromArray(polar(R_MON + 0.017, h.d, h.y));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -h.d);
    sc.set(0.032, h.h, h.w);
    hous.setMatrixAt(i, m4.compose(pv, q, sc));
  });
  {
    const a = polar(R_MON, bL, 0), b = polar(R_MON, bR, 0);
    pv.set((a[0] + b[0]) / 2 + 0.013, (bB + bT) / 2, (a[2] + b[2]) / 2);
    q.identity();
    sc.set(0.03, bT - bB + 0.02, chord + 0.02);
    hous.setMatrixAt(housings.length, m4.compose(pv, q, sc));
  }
  shell.add(hous);
  // the frame that holds them: a curved back panel and top and bottom rails
  const arcGeo = (r, h, y) => {
    const g = new THREE.CylinderGeometry(r, r, h, 48, 1, true, Math.PI / 2 - D_MON - 0.03, 2 * D_MON + 0.06);
    g.translate(0, y, 0);
    return g;
  };
  add(arcGeo(R_MON + 0.035, MON_Y1 - MON_Y0 + 0.06, (MON_Y0 + MON_Y1) / 2), new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.8, side: THREE.DoubleSide }), C.x, 0, C.z);
  add(arcGeo(R_MON + 0.005, 0.012, MON_Y0 - 0.01), trimMat, C.x, 0, C.z);
  // LED ticker band over the wall and the ON AIR sign
  const tickerU = { uText: { value: tickerTexture(THREE, labelFamily) }, uTime: uniforms.uTime, uOn: { value: 1 } };
  const ticker = add(arcGeo(R_MON - 0.005, 0.07, MON_Y1 + 0.06), new THREE.ShaderMaterial({
    name: 'LedTicker', side: THREE.DoubleSide, uniforms: tickerU, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
      uniform sampler2D uText; uniform float uTime; uniform float uOn; varying vec2 vUv;
      void main() {
        vec2 grid = vec2(190.0, 14.0);
        vec2 uv = vec2(1.0 - vUv.x, vUv.y);
        vec2 cell = floor(uv * grid);
        vec2 f = fract(uv * grid) - 0.5;
        float on = texture2D(uText, vec2((cell.x + 0.5) / grid.x * 0.55 + uTime * 0.03, (cell.y + 0.5) / grid.y)).r;
        float dotm = smoothstep(0.45, 0.2, length(f));
        vec3 col = vec3(0.012, 0.008, 0.006) + dotm * (vec3(0.05, 0.025, 0.01) + vec3(1.0, 0.52, 0.12) * step(0.5, on) * 1.4 * uOn);
        gl_FragColor = vec4(col, 1.0);
        #include <encodings_fragment>
      }`,
  }), C.x, 0, C.z);
  ticker.name = 'Ticker';
  const onAirMat = new THREE.MeshBasicMaterial({ map: makeSignTexture(THREE, labelFamily, 'ON AIR', '#200404', '#ff3b2e'), toneMapped: false, fog: false, name: 'OnAir' });
  const onAir = add(new THREE.PlaneGeometry(0.15, 0.047), onAirMat, C.x + R_MON - 0.02, MON_Y1 + 0.14, 0);
  onAir.rotation.y = -Math.PI / 2;
  add(new THREE.BoxGeometry(0.02, 0.06, 0.165), panelMat, C.x + R_MON - 0.009, MON_Y1 + 0.14, 0);
  // LED strips at the ends of the wall
  [-1, 1].forEach((s) => add(new THREE.BoxGeometry(0.006, MON_Y1 - MON_Y0 + 0.1, 0.006), led(0x3a78ff, 1.4), ...polar(R_MON + 0.01, s * (D_MON + 0.035), (MON_Y0 + MON_Y1) / 2)));

  // ------------------------------------------------------------- the operators' console (curved)
  const profile = [[0.40, F], [0.40, F + 0.085], [0.425, F + 0.10], [0.49, F + 0.10], [0.545, F + 0.15], [0.56, F + 0.15], [0.56, F]];
  const lathe = (pts, mat) => add(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 64, Math.PI / 2 - D_CON, 2 * D_CON), mat, C.x, 0, C.z);
  lathe(profile, new THREE.MeshStandardMaterial({ color: new THREE.Color(0.035, 0.038, 0.046), roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }));
  const buttons = lathe([[0.49, F + 0.1006], [0.545, F + 0.1506]], buttonsMat(150, 6));
  buttons.material.side = THREE.DoubleSide;
  lathe([[0.425, F + 0.1003], [0.49, F + 0.1003]], new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide }));   // desk top
  const capShape = new THREE.Shape();
  profile.forEach(([r, y], i) => (i ? capShape.lineTo(r, y) : capShape.moveTo(r, y)));
  [-1, 1].forEach((s) => {
    const cap = add(new THREE.ShapeGeometry(capShape), new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }), C.x, 0, C.z);
    cap.rotation.y = s * D_CON;
  });
  // floor LED along the console and Christof's step
  add(new THREE.LatheGeometry([new THREE.Vector2(0.385, F + 0.002), new THREE.Vector2(0.392, F + 0.002)], 64, Math.PI / 2 - D_CON, 2 * D_CON), led(0x2f6bff, 1.2), C.x, 0, C.z);

  // operators' own monitors on the console
  const smallQuads = [];
  const OPS = [{ d: -0.5, tiles: [3, 5] }, { d: 0.5, tiles: [6, 7] }];
  OPS.forEach((op, oi) => {
    op.tiles.forEach((tile, i) => {
      const d0 = op.d + (i - 1) * 0.15 + 0.012, d1 = d0 + 0.126;
      const yB = F + 0.158, yT = F + 0.225;
      smallQuads.push({ corners: [polar(0.552, d0, yT), polar(0.552, d1, yT), polar(0.542, d0, yB), polar(0.542, d1, yB)], tile, crop: [0, 0, 1, 1], fx: [0, oi === i ? 1 : 0, tile, 3 + oi * 2 + i] });
      const mid = polar(0.556, (d0 + d1) / 2, (yB + yT) / 2);
      const h = add(new THREE.BoxGeometry(0.012, yT - yB + 0.01, 0.07), panelMat, ...mid);
      h.rotation.y = -(d0 + d1) / 2;
      h.rotation.z = 0.15;
      const stand = add(new THREE.BoxGeometry(0.008, 0.012, 0.02), panelMat, ...polar(0.556, (d0 + d1) / 2, F + 0.152));
      stand.rotation.y = -(d0 + d1) / 2;
    });
  });
  const opScreens = new THREE.Mesh(buildScreens(smallQuads), screenMat);
  opScreens.name = 'OperatorScreens';
  shell.add(opScreens);

  // the two technicians
  const operators = [
    makeOperator(THREE, { shirt: 0x2a3a58, hair: 0x1b1410, seed: 0.3 }),
    makeOperator(THREE, { shirt: 0x4a3a33, hair: 0x6b5236, seed: 1.7 }),
  ];
  operators.forEach((o, i) => {
    const d = OPS[i].d;
    const p = polar(0.33, d, F);
    o.position.set(p[0], p[1], p[2]);
    o.rotation.y = Math.atan2(Math.cos(d), Math.sin(d));
    shell.add(o);
  });

  // ------------------------------------------------------------- the lighting truss, spots and dusty beams
  [-0.2, 0.2].forEach((z) => add(new THREE.BoxGeometry(0.92, 0.025, 0.025), trimMat, 0, 0.44, z));
  [-0.32, 0.0, 0.3].forEach((x) => add(new THREE.BoxGeometry(0.025, 0.025, 0.42), trimMat, x, 0.44, 0));
  const beamMat = (color, k) => new THREE.ShaderMaterial({
    name: 'LightBeam', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: k }, uTime: uniforms.uTime },
    vertexShader: /* glsl */ `
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uK; uniform float uTime;
      varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
        float a = edge * pow(vH, 1.6) * uK * (0.92 + 0.08 * sin(uTime * 1.3 + vH * 9.0));
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  const spots = [];
  const spot = (from, to, color, k, radius) => {
    const A = new THREE.Vector3(...from), B = new THREE.Vector3(...to);
    const can = add(new THREE.CylinderGeometry(0.018, 0.026, 0.05, 14), trimMat, ...from);
    can.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), B.clone().sub(A).normalize());
    add(new THREE.CircleGeometry(0.017, 14), led(0xfff1d6, 2.0), 0, -0.026, 0, can).rotation.x = Math.PI / 2;
    const L = A.distanceTo(B);
    const cone = add(new THREE.ConeGeometry(radius, L, 28, 1, true), beamMat(color, k), 0, 0, 0);
    cone.position.copy(A).add(B).multiplyScalar(0.5);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), A.clone().sub(B).normalize());
    cone.renderOrder = 8;
    spots.push(cone);
    return { A, B };
  };
  const desk = spot([-0.26, 0.43, 0.03], [-0.22, F + 0.12, 0.03], 0xffd9a6, 0.22, 0.13);
  spot([0.02, 0.43, 0.2], [0.12, F + 0.1, 0.16], 0xbcd2ff, 0.13, 0.12);
  spot([0.02, 0.43, -0.2], [0.12, F + 0.1, -0.16], 0xbcd2ff, 0.13, 0.12);
  const deskLight = new THREE.SpotLight(0xffd8a8, 0.32, 0, 0.17, 0.7, 2);   // a tight pool on the desk, not on the floor
  deskLight.position.copy(desk.A);
  deskLight.target.position.copy(desk.B);
  room.add(deskLight);
  room.add(deskLight.target);
  // dust floating in the light
  const DUST = 180;
  const dust = new Float32Array(DUST * 3);
  const dr = rng(5);
  for (let i = 0; i < DUST; i++) { dust[i * 3] = -0.4 + dr() * 0.6; dust[i * 3 + 1] = F + dr() * 0.9; dust[i * 3 + 2] = -0.3 + dr() * 0.6; }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const dustPts = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    uniforms: { uTime: uniforms.uTime },
    vertexShader: /* glsl */ `
      uniform float uTime; varying float vA;
      void main() {
        vec3 p = position;
        float s = fract(sin(dot(p.xz, vec2(12.9898, 78.233))) * 43758.5453);
        p.x += 0.02 * sin(uTime * 0.2 + s * 6.3);
        p.y = ${F.toFixed(3)} + mod(p.y - ${F.toFixed(3)} + uTime * 0.004 * (0.5 + s), 0.9);
        p.z += 0.02 * cos(uTime * 0.17 + s * 4.1);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // brighter inside the desk spot's cone
        vec2 dxz = p.xz - vec2(-0.24, 0.03);
        vA = (0.08 + 0.5 * smoothstep(0.16, 0.0, length(dxz))) * (0.6 + 0.4 * sin(uTime * 2.0 + s * 20.0));
        gl_PointSize = 1.6 + 1.2 * s;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.92, 0.8) * a, a); }',
  }));
  dustPts.frustumCulled = false;
  shell.add(dustPts);
  // ceiling light strips
  [-0.25, 0.05, 0.32].forEach((x) => add(new THREE.PlaneGeometry(0.014, 0.86), led(0x8caeff, 0.55), x, 0.497, 0).rotation.x = Math.PI / 2);

  // ------------------------------------------------------------- racks, the camera map and the timecode (+z wall)
  for (let i = 0; i < 4; i++) {
    const x = -0.36 + i * 0.1;
    add(new THREE.BoxGeometry(0.085, 0.38, 0.06), panelMat, x, F + 0.19, 0.465);
    add(new THREE.PlaneGeometry(0.07, 0.34), buttonsMat(6, 34), x, F + 0.19, 0.4345).rotation.y = Math.PI;
  }
  const dots = [];
  const mapTex = cameraMap(THREE, labelFamily, dots);
  const MAP = { x0: 0.02, x1: 0.30, y0: -0.12, y1: 0.16 };
  const mapW = MAP.x1 - MAP.x0, mapH = MAP.y1 - MAP.y0;
  add(new THREE.BoxGeometry(mapW + 0.02, mapH + 0.02, 0.012), panelMat, (MAP.x0 + MAP.x1) / 2, (MAP.y0 + MAP.y1) / 2, 0.492);
  add(new THREE.PlaneGeometry(mapW, mapH), new THREE.MeshBasicMaterial({ map: mapTex, toneMapped: false, fog: false, color: new THREE.Color(0.9, 0.9, 0.9) }), (MAP.x0 + MAP.x1) / 2, (MAP.y0 + MAP.y1) / 2, 0.4855).rotation.y = Math.PI;
  const dotPos = new Float32Array(dots.length * 3), dotSeed = new Float32Array(dots.length);
  dots.forEach(([u, v], i) => {
    // plane is turned to face -z: u runs from +x to... (mirrored)
    dotPos[i * 3] = MAP.x1 - u * mapW; dotPos[i * 3 + 1] = MAP.y0 + v * mapH; dotPos[i * 3 + 2] = 0.484;
    dotSeed[i] = (i * 0.618) % 1;
  });
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
  dotGeo.setAttribute('aSeed', new THREE.BufferAttribute(dotSeed, 1));
  const mapDotsU = { uTime: uniforms.uTime, uOn: { value: 1 } };
  const mapDots = new THREE.Points(dotGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, uniforms: mapDotsU,
    vertexShader: `uniform float uTime; attribute float aSeed; varying float vA; varying float vR;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = (0.35 + 0.65 * step(0.5, fract(uTime * (0.4 + aSeed) + aSeed * 7.0)));
        vR = step(0.85, aSeed);
        gl_PointSize = 4.5; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOn; varying float vA; varying float vR;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, d) * vA * uOn;
        vec3 c = mix(vec3(0.3, 1.0, 0.45), vec3(1.0, 0.25, 0.15), vR); gl_FragColor = vec4(c * a, a); }`,
  }));
  mapDots.frustumCulled = false;
  shell.add(mapDots);
  // running timecode over the racks
  const tcC = canvas(512, 96);
  const tcTex = new THREE.CanvasTexture(tcC);
  tcTex.encoding = THREE.sRGBEncoding;
  add(new THREE.BoxGeometry(0.30, 0.06, 0.01), panelMat, -0.21, 0.04, 0.493);
  add(new THREE.PlaneGeometry(0.29, 0.052), new THREE.MeshBasicMaterial({ map: tcTex, toneMapped: false, fog: false }), -0.21, 0.04, 0.4875).rotation.y = Math.PI;
  let lastTc = -1;
  const drawTimecode = (time, live) => {
    const t0 = 6 * 3600 + 59 * 60 + 12 + time;   // a little before 7 a.m. in Seahaven
    const fr = Math.floor((t0 % 1) * 25);
    const s = Math.floor(t0) % 60, m = Math.floor(t0 / 60) % 60, h = Math.floor(t0 / 3600) % 24;
    const key = Math.floor(t0 * 10) + (live ? 0 : 0.5);
    if (key === lastTc) return;
    lastTc = key;
    const g = tcC.getContext('2d');
    g.fillStyle = '#060202'; g.fillRect(0, 0, 512, 96);
    const p2 = (v) => String(v).padStart(2, '0');
    g.font = '700 58px monospace'; g.textBaseline = 'middle';
    g.fillStyle = live ? '#ff4030' : '#5a1a14';
    g.fillText(`${p2(h)}:${p2(m)}:${p2(s)}:${p2(fr)}`, 70, 52);
    g.font = '700 22px monospace';
    g.fillStyle = live ? '#ffb070' : '#4a3020';
    g.fillText(live ? 'LIVE' : 'OFF', 8, 52);
    tcTex.needsUpdate = true;
  };

  // ------------------------------------------------------------- light: the room is lit by its screens
  const hemi = new THREE.HemisphereLight(0x33405e, 0x040506, 0.42);
  room.add(hemi);
  const wallGlow = new THREE.DirectionalLight(0x9fc2ff, 1.25);
  wallGlow.position.set(1.0, 0.35, 0.1);
  room.add(wallGlow);
  room.add(wallGlow.target);
  const wallPoint = new THREE.PointLight(0x8fb6ff, 0.10, 0, 2);
  wallPoint.position.set(0.2, -0.05, 0.0);
  room.add(wallPoint);
  const consoleGlow = new THREE.PointLight(0xff9a50, 0.012, 0, 2);
  consoleGlow.position.set(0.18, F + 0.14, 0.0);
  room.add(consoleGlow);
  const rim = new THREE.DirectionalLight(0x5a6c9c, 0.35);
  rim.position.set(-1.0, 0.8, -0.6);
  room.add(rim);
  const onAirLight = new THREE.PointLight(0xff3020, 0.02, 0, 2);
  onAirLight.position.set(C.x + R_MON - 0.06, MON_Y1 + 0.14, 0);
  room.add(onAirLight);
  const windowLight = new THREE.DirectionalLight(0x6f86c8, 0.18);   // moonlight from the window
  windowLight.position.set(-0.1, 0.3, -1.0);
  room.add(windowLight);

  // ------------------------------------------------------------- animation
  const update = (time, dt, live, mic) => {
    tickerU.uOn.value = live ? 1 : 0.15;
    mapDotsU.uOn.value = live ? 1 : 0.2;
    drawTimecode(time, live);
    operators.forEach((o, i) => {
      const { head, body, arms, seed } = o.userData;
      // glance between monitors; the second one turns to Christof now and then
      const look = Math.sin(time * 0.31 + seed * 3) * 0.25 + Math.sin(time * 0.73 + seed) * 0.08;
      const toBoss = i === 1 ? Math.max(0, Math.sin(time * 0.21 + 1.0) - 0.6) * 2.2 : 0;
      head.rotation.y = look + toBoss * 0.7;
      head.rotation.x = 0.05 + 0.05 * Math.sin(time * 0.5 + seed);
      body.rotation.y = toBoss * 0.25;
      body.rotation.x = 0.03 * Math.sin(time * 0.4 + seed * 2);
      arms[0].rotation.x = 0.04 * Math.sin(time * 7.0 + seed);          // typing
      arms[1].rotation.x = 0.05 * Math.sin(time * 5.3 + seed * 1.3);
      arms[1].rotation.y = 0.06 * Math.sin(time * 0.9 + seed);          // the mouse
    });
    deskLight.intensity = 0.32 * (live ? 1 : 0.5);
    void mic;
  };

  return { shell, onAirMat, onAirLight, wallGlow, wallPoint, consoleGlow, update, operators };
}
