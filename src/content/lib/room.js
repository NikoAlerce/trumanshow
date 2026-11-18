import { buildControlRoom } from './controlroom.js';

// Christof's control room (the "left" face of the cube).
// The viewer from the original scene (the ghost with beret and headset) is
// Christof: scaled down, sat at his desk in a dark room, facing a wall of
// monitors that show the hidden cameras of the dome live. When the show is
// cut the screens fall to static and the ON AIR light goes out.

// ---------------------------------------------------------------- layout
const FLOOR_Y = -0.49;
const FURN_SCALE = 0.46;
const FURN_PIVOT = [0.08, -0.458, 0.0];      // centre of the original set, on top of its floor slab
const FURN_TARGET = [-0.19, -0.458, 0.03];   // where that centre goes now (behind the operators' console)
const WALL_SCREENS_X = 0.462;                // monitor wall plane (faces -x, towards Christof)

// hidden cameras on the sea side (content space, inside the cube)
const CAMS = [
  { pos: [0.44, 0.02, 0.16], look: [-0.47, -0.13, 0.03], fov: 46 },     // 0 CAM 01 wide
  { pos: [-0.33, -0.33, 0.20], look: [-0.445, -0.10, -0.15], fov: 50 },  // 1 CAM 07 up the stairs
  { pos: [0.10, -0.26, 0.36], look: [-0.47, -0.31, 0.43], fov: 50 },    // 2 CAM 12 the bow
  { pos: [-0.28, 0.40, -0.10], look: [-0.44, -0.11, -0.14], fov: 40 },  // 3 SKY CAM
  { pos: [0.42, -0.35, -0.38], look: [-0.45, -0.25, 0.15], fov: 55 },   // 4 CAM 23 sea level
  { pos: [-0.36, -0.05, 0.10], look: [-0.44, -0.06, -0.13], fov: 40 },  // 5 CAM 31 profile
  { pos: [0.40, 0.12, -0.45], look: [-0.45, -0.15, 0.12], fov: 50 },    // 6 CAM 44 wide right
  { pos: [-0.36, -0.33, -0.40], look: [-0.40, -0.33, 0.45], fov: 55 },  // 7 CAM 52 the ledge
];
const MAIN_CAM = { pos: [-0.19, -0.035, -0.105], look: [-0.445, -0.062, -0.148], fov: 30 };  // BUTTON CAM
const LABELS = ['CAM 01', 'CAM 07', 'CAM 12', 'SKY CAM', 'CAM 23', 'CAM 31', 'CAM 44', 'CAM 52',
  'BUTTON CAM', 'CAM 09', 'CAM 15', 'CAM 28', 'CAM 36', 'CAM 40', 'CAM 61', 'NO SIGNAL'];

// dual monitor on Christof's desk, measured on the model (content space,
// before scaling): TL, TR, BL, BR seen from the chair
const DESK_SCREENS = [
  [[0.364, 0.216, -0.275], [0.364, 0.217, 0.022], [0.336, 0.019, -0.276], [0.336, 0.020, 0.023]],
  [[0.364, 0.217, 0.027], [0.348, 0.217, 0.325], [0.336, 0.020, 0.023], [0.322, 0.019, 0.323]],
];

const TILE_W = 256, TILE_H = 192, ATLAS_COLS = 4, ATLAS_ROWS = 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawLabels(c, labels, family) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = '#ffffff';
  g.textBaseline = 'middle';
  g.font = `600 22px ${family}, monospace`;
  labels.forEach((txt, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    g.fillText(txt, col * 256 + 10, row * 32 + 17);
  });
}

function makeLabelTexture(THREE, family) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  drawLabels(c, LABELS, family);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

function makeSignTexture(THREE, family, text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 160);
  g.strokeStyle = fg; g.lineWidth = 6;
  g.strokeRect(10, 10, 492, 140);
  g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 92px ${family}, sans-serif`;
  g.fillText(text, 256, 86);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}

// ---------------------------------------------------------------- screen shader
const SCREEN_VERT = /* glsl */ `
  attribute float aTile;
  attribute vec4 aCrop;
  attribute vec4 aFx;
  varying vec2 vUv;
  varying float vTile;
  varying vec4 vCrop;
  varying vec4 vFx;
  void main() {
    vUv = uv; vTile = aTile; vCrop = aCrop; vFx = aFx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const SCREEN_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform sampler2D uMain;
  uniform sampler2D uLabels;
  uniform float uSignal;
  uniform float uTime;
  uniform float uBright;
  varying vec2 vUv;
  varying float vTile;
  varying vec4 vCrop;
  varying vec4 vFx;   // x: porthole, y: monochrome, z: label index, w: seed
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 bars(vec2 uv) {
    float i = floor(uv.x * 7.0);
    vec3 c = vec3(mod(i + 1.0, 2.0) < 1.0 ? 0.0 : 0.75, (i < 4.0) ? 0.75 : 0.0, mod(i, 2.0) < 1.0 ? 0.75 : 0.0);
    if (i == 0.0) c = vec3(0.75);
    return uv.y < 0.22 ? vec3(0.08 + 0.1 * step(0.5, fract(uv.x * 4.0))) : c;
  }
  void main() {
    vec2 inner = (vUv - 0.5) / vec2(0.90, 0.86) + 0.5;      // bezel
    float inside = step(0.0, inner.x) * step(inner.x, 1.0) * step(0.0, inner.y) * step(inner.y, 1.0);
    vec2 c = inner - 0.5;
    float r2 = dot(c, c);
    vec2 cu = 0.5 + c * (1.0 + 0.10 * r2);                  // CRT curvature
    vec2 tuv = clamp(vCrop.xy + cu * vCrop.zw, 0.001, 0.999);
    vec3 col;
    if (vTile > 7.5) col = texture2D(uMain, tuv).rgb;
    else {
      vec2 cell = vec2(mod(vTile, 4.0), 1.0 - floor(vTile / 4.0));
      col = texture2D(uAtlas, (cell + tuv) / vec2(4.0, 2.0)).rgb;
    }
    if (vFx.y > 0.5) { float l = dot(col, vec3(0.299, 0.587, 0.114)); col = vec3(l) * vec3(0.82, 1.0, 0.88); }
    col *= 0.86 + 0.14 * sin(cu.y * 360.0 - uTime * 3.0);   // scanlines
    float round = smoothstep(0.50, 0.40, length(c * vec2(1.33, 1.0)));
    col *= mix(1.0 - 0.75 * r2, round, vFx.x);
    // camera label, top-left
    vec2 lp = vec2(cu.x / 0.42, (cu.y - 0.86) / 0.11);
    if (lp.x > 0.0 && lp.x < 1.0 && lp.y > 0.0 && lp.y < 1.0) {
      float li = vFx.z;
      vec2 cell = vec2(mod(li, 2.0), 7.0 - floor(li / 2.0));
      float a = texture2D(uLabels, (cell + lp) / vec2(2.0, 8.0)).a;
      col = mix(col, vec3(0.95), a * 0.9);
    }
    // LIVE dot on the main screen
    if (vTile > 7.5) {
      float d = length((cu - vec2(0.90, 0.90)) * vec2(1.33, 1.0));
      float blink = step(0.5, fract(uTime * 0.8));
      col = mix(col, vec3(1.0, 0.08, 0.05), (1.0 - smoothstep(0.018, 0.024, d)) * blink * uSignal);
    }
    // static when the broadcast is cut, colour bars on the dead monitors
    float n = hash(floor(cu * vec2(150.0, 112.0)) + floor(uTime * 24.0) * 1.37 + vFx.w);
    float roll = 0.75 + 0.25 * smoothstep(0.0, 0.05, abs(fract(cu.y - uTime * 0.45 + vFx.w) - 0.5));
    vec3 snow = vec3(n * roll * 0.8);
    float dead = step(14.5, vFx.z);
    col = mix(col, bars(cu), dead);
    col = mix(snow, col, max(uSignal, 0.0));
    // bezel with a hint of bevel light
    float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    vec3 bezel = vec3(0.022, 0.024, 0.028) + vec3(0.05) * smoothstep(0.02, 0.0, edge);
    gl_FragColor = vec4(mix(bezel, col * uBright, inside), 1.0);
    #include <encodings_fragment>
  }`;

// a procedural panel of console buttons / rack LEDs
const BUTTONS_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec2 uGrid;
  uniform float uSignal;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.31, 289.13))) * 15731.743); }
  void main() {
    vec2 g = vUv * uGrid;
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(cell);
    float h2 = hash(cell + 7.1);
    float on = step(0.35, h);
    float blink = step(0.5, fract(uTime * (0.3 + h2 * 2.5) + h * 10.0));
    on *= mix(1.0, blink, step(0.8, h2));
    vec3 tint = h < 0.55 ? vec3(1.0, 0.45, 0.12) : (h < 0.75 ? vec3(0.25, 1.0, 0.45) : (h < 0.92 ? vec3(0.4, 0.75, 1.0) : vec3(1.0, 0.12, 0.08)));
    float shape = 1.0 - smoothstep(0.26, 0.32, max(abs(f.x) * 0.9, abs(f.y) * 1.25));
    vec3 col = vec3(0.018, 0.02, 0.024) + vec3(0.03) * shape;
    col += tint * shape * on * (0.55 + 0.45 * uSignal) * 1.6;
    gl_FragColor = vec4(col, 1.0);
    #include <encodings_fragment>
  }`;

export function createRoom(THREE, { renderer, root, room, uniforms, labelFamily = 'sans-serif' }) {
  const ctl = { update() {}, setSignal() {}, setMic() {}, dispose() {}, makeEnv: null, markVisible() {} };
  if (!room) return ctl;
  const rnd = mulberry32(1998);

  // ------------------------------------------------------------- Christof (the viewer) and his desk
  const roomRoot = room.children.find((c) => c.animations && c.animations.length);
  const mixer = roomRoot ? new THREE.AnimationMixer(roomRoot) : null;
  if (mixer) mixer.clipAction(roomRoot.animations[0]).play();

  room.traverse((o) => {
    if (o.isAmbientLight) { o.intensity = 0.10; o.color.setRGB(0.55, 0.65, 1.0); }
    if (o.name === 'Sphere' && o.material) {           // the old white backdrop: now the dark of the moon
      o.material.color.setRGB(0.006, 0.008, 0.012);
      o.material.toneMapped = false;
      o.material.needsUpdate = true;
    }
  });

  // ------------------------------------------------------------- shared screen material bits
  const atlas = new THREE.WebGLRenderTarget(TILE_W * ATLAS_COLS, TILE_H * ATLAS_ROWS, { depthBuffer: true });
  atlas.texture.encoding = THREE.sRGBEncoding;
  atlas.texture.generateMipmaps = false;
  atlas.texture.minFilter = THREE.LinearFilter;
  atlas.scissorTest = true;
  const mainRT = new THREE.WebGLRenderTarget(512, 384, { depthBuffer: true });
  mainRT.texture.encoding = THREE.sRGBEncoding;
  mainRT.texture.generateMipmaps = false;
  mainRT.texture.minFilter = THREE.LinearFilter;
  const labelTex = makeLabelTexture(THREE, labelFamily);
  const screenUniforms = {
    uAtlas: { value: atlas.texture },
    uMain: { value: mainRT.texture },
    uLabels: { value: labelTex },
    uSignal: { value: 1 },
    uTime: uniforms.uTime,
    uBright: { value: 1.25 },
  };
  const screenMat = new THREE.ShaderMaterial({
    name: 'BroadcastScreens', uniforms: screenUniforms, vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG,
    side: THREE.DoubleSide, toneMapped: false,
  });

  // quads: corners TL, TR, BL, BR + per quad screen settings
  const buildScreens = (quads) => {
    const pos = [], uv = [], tile = [], crop = [], fx = [], idx = [];
    quads.forEach((q, i) => {
      const [tl, tr, bl, br] = q.corners;
      [bl, br, tl, tr].forEach((p) => pos.push(p[0], p[1], p[2]));
      uv.push(0, 0, 1, 0, 0, 1, 1, 1);
      for (let k = 0; k < 4; k++) { tile.push(q.tile); crop.push(...q.crop); fx.push(...q.fx); }
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aTile', new THREE.Float32BufferAttribute(tile, 1));
    g.setAttribute('aCrop', new THREE.Float32BufferAttribute(crop, 4));
    g.setAttribute('aFx', new THREE.Float32BufferAttribute(fx, 4));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  };

  // desk monitors (built in the original model space, scaled with the furniture)
  const deskScreens = new THREE.Mesh(buildScreens(DESK_SCREENS.map((c, i) => ({
    corners: c.map((p) => [p[0] - 0.0025, p[1], p[2]]),
    tile: i === 0 ? 0 : 8,
    crop: [0, 0, 1, 1],
    fx: [i === 0 ? 0 : 1, 0, i === 0 ? 0 : 8, i * 3.1],
  }))), screenMat);
  deskScreens.name = 'ChristofDeskScreens';
  room.add(deskScreens);

  // scale Christof's corner down: everything of the original room (and the
  // desk screens) goes under a pivot at the centre of the old set
  room.updateMatrixWorld(true);
  const furniture = new THREE.Group();
  furniture.name = 'ChristofDesk';
  furniture.position.set(...FURN_PIVOT);
  room.add(furniture);
  furniture.updateMatrixWorld(true);
  if (roomRoot) furniture.attach(roomRoot);
  furniture.attach(deskScreens);
  furniture.scale.setScalar(FURN_SCALE);
  furniture.position.set(...FURN_TARGET);

  // ------------------------------------------------------------- the set around him (controlroom.js)
  const buttonsMat = (gx, gy) => new THREE.ShaderMaterial({
    uniforms: { uTime: uniforms.uTime, uGrid: { value: new THREE.Vector2(gx, gy) }, uSignal: screenUniforms.uSignal },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: BUTTONS_FRAG, toneMapped: false,
  });
  const set = buildControlRoom(THREE, { room, uniforms, screenMat, buildScreens, buttonsMat, labelFamily, FLOOR_Y, makeSignTexture });
  const { onAirMat, onAirLight, wallGlow, wallPoint, consoleGlow } = set;
  // Christof's corner of the old set: the white floor slab goes dark like the rest
  room.traverse((o) => {
    if ((o.name === 'Cube001' || o.name === 'Cube001_1') && o.material) {
      o.material = o.material.clone();
      o.material.color.setRGB(0.16, 0.17, 0.2);
    }
  });

  // ------------------------------------------------------------- broadcast rendering
  // a feed = a camera inside one world (a root child); world null = everything but the room
  const makeCam = (c, aspect) => {
    const cam = new THREE.PerspectiveCamera(c.fov, aspect, 0.005, 60);
    cam.position.fromArray(c.pos);
    cam.lookAt(new THREE.Vector3().fromArray(c.look));
    cam.userData.base = cam.quaternion.clone();
    return cam;
  };
  const feeds = {
    main: { cam: makeCam(MAIN_CAM, 512 / 384), world: null },
    tiles: CAMS.map((c) => ({ cam: makeCam(c, TILE_W / TILE_H), world: null })),
  };

  const saved = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3() };
  const ident = new THREE.Quaternion();
  let signal = 1;
  let mic = 0;
  let step = 0;
  let renderFeedFn = null;
  let lastSeenFrame = -1000;

  const drift = (cam, time, k, amount) => {
    cam.quaternion.copy(cam.userData.base);
    cam.rotateY(Math.sin(time * 0.37 + k) * 0.010 * amount);
    cam.rotateX(Math.sin(time * 0.53 + 1.3 * k) * 0.007 * amount);
    cam.updateMatrixWorld(true);
  };
  const visSave = [];
  const _l = new THREE.Vector3();
  const aim = (feed) => {
    if (!feed.frame) return;
    feed.frame.updateMatrixWorld(true);
    const cam = feed.cam;
    cam.position.copy(feed.pos).applyMatrix4(feed.frame.matrixWorld);
    _l.copy(feed.look).applyMatrix4(feed.frame.matrixWorld);
    cam.up.set(0, 1, 0).transformDirection(feed.frame.matrixWorld);
    cam.lookAt(_l);
    cam.userData.base = cam.quaternion.clone();
  };
  const renderInto = (rt, feed, time, k, amount) => {
    // NB: renderer.xr.enabled must not be toggled here (it upsets the EJX compositing)
    const prevTarget = renderer.getRenderTarget();
    const prevScissorTest = renderer.getScissorTest();
    const gl = renderer.getContext();
    const clearValue = gl.getParameter(gl.COLOR_CLEAR_VALUE);
    saved.pos.copy(root.position); saved.quat.copy(root.quaternion); saved.scale.copy(root.scale);
    root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1);
    root.children.forEach((c, i) => {
      visSave[i] = c.visible;
      c.visible = feed.world ? c === feed.world : (c !== room && c.visible);
    });
    root.updateMatrixWorld(true);
    aim(feed);
    drift(feed.cam, time, k, amount);
    try {
      renderer.setScissorTest(false);
      renderer.setRenderTarget(rt);
      renderer.clear(true, true, true);
      renderFeedFn(feed.cam, ident, feed.world);
    } finally {
      root.children.forEach((c, i) => { c.visible = visSave[i]; });
      root.position.copy(saved.pos); root.quaternion.copy(saved.quat); root.scale.copy(saved.scale);
      root.updateMatrixWorld(true);
      renderer.setRenderTarget(prevTarget);
      renderer.setScissorTest(prevScissorTest);
      renderer.state.buffers.color.setClear(clearValue[0], clearValue[1], clearValue[2], clearValue[3]);
    }
  };

  ctl.markVisible = (frame) => { lastSeenFrame = frame; };
  const mkFeed = (f, aspect) => ({
    cam: makeCam(f, aspect), world: f.world || null, frame: f.frame || null,
    pos: new THREE.Vector3().fromArray(f.pos), look: new THREE.Vector3().fromArray(f.look),
  });
  ctl.setFeeds = ({ main, tiles, labels }) => {
    if (main) feeds.main = mkFeed(main, 512 / 384);
    if (tiles) feeds.tiles = tiles.slice(0, ATLAS_COLS * ATLAS_ROWS).map((t) => mkFeed(t, TILE_W / TILE_H));
    if (labels) { drawLabels(labelTex.image, labels, labelFamily); labelTex.needsUpdate = true; }
  };
  ctl.setRenderHelper = (fn) => { renderFeedFn = fn; };
  ctl.setSignal = (s) => { signal = s; };
  ctl.setMic = (m) => { mic = m; };
  ctl.update = (time, dt, frame) => {
    if (mixer) mixer.update(dt);
    const live = signal > 0.5 && !renderer.xr.isPresenting;
    screenUniforms.uSignal.value = live ? 1 : 0;
    onAirMat.color.setScalar(live ? 1.0 : 0.12);
    onAirLight.intensity = live ? 0.02 : 0.0;
    // the monitors light the room; static flickers
    const flick = live ? 1 : 0.75 + 0.25 * Math.random();
    wallGlow.intensity = 1.25 * flick;
    wallPoint.intensity = 0.10 * flick;
    consoleGlow.intensity = 0.012 + 0.03 * mic;
    set.update(time, dt, live, mic);

    if (!renderFeedFn || !live || frame - lastSeenFrame > 30) return;
    // the main feed every other frame, one CCTV tile per frame
    step++;
    if (step % 2 === 0) renderInto(mainRT, feeds.main, time, 9, 1);
    const t = step % feeds.tiles.length;
    const feed = feeds.tiles[t];
    const x = (t % ATLAS_COLS) * TILE_W, y = (ATLAS_ROWS - 1 - Math.floor(t / ATLAS_COLS)) * TILE_H;
    atlas.viewport.set(x, y, TILE_W, TILE_H);
    atlas.scissor.set(x, y, TILE_W, TILE_H);
    renderInto(atlas, feed, time, t, 0.4);
  };
  ctl.dispose = () => { atlas.dispose(); mainRT.dispose(); };

  // dark environment for reflections: the glow of the monitor wall and the ceiling strips
  ctl.makeEnv = (pmrem) => {
    const s = new THREE.Scene();
    const m = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vDir; void main(){
        vec3 d = normalize(vDir);
        vec3 c = vec3(0.004, 0.005, 0.008);
        float wall = smoothstep(0.55, 0.85, d.x) * (1.0 - smoothstep(0.35, 0.6, abs(d.y - 0.05)));
        c += vec3(0.35, 0.5, 0.9) * wall * 1.1;
        c += vec3(0.5, 0.6, 0.9) * smoothstep(0.92, 0.99, d.y) * 0.3;
        gl_FragColor = vec4(c, 1.0); }`,
    }));
    s.add(m);
    const tex = pmrem.fromScene(s, 0.03, 0.1, 20).texture;
    m.geometry.dispose(); m.material.dispose();
    return tex;
  };
  return ctl;
}
