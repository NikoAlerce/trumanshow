// Builds the improved Truman Show world on top of the scene exported from EyeJack.
import { WATER_Y, WALL_X, waveHeight, waveFade } from './waves.js';
import { createOcean } from './ocean.js';
import { createWallMaterial, createWallExtensions, createDome, createExitSign } from './skywall.js';
import { makeRippleTexture, makeNoiseTexture, makeExitTexture, loadTexture } from './textures.js';
import { createTruman } from './truman.js';
import { createRoom } from './room.js';
import { createTimeline } from './timeline.js';
import { createSkyVoice, OPEN_POS } from './skywriting.js';
import { dressBoat } from './boat.js';
import { makeRig } from './rig.js';
import { loadTreeAtlas } from './cards.js';
import { createStorm } from './storm.js';
import { createMorning } from './morning.js';
import { createMirror } from './mirror.js';
import { createRainOnTruman } from './rainman.js';

const lin = (THREE, r, g, b) => new THREE.Color(r, g, b);

function findIn(group, name) {
  let found = null;
  group.traverse((o) => { if (!found && o.name === name) found = o; });
  return found;
}

function dimWithStudioLight(material, uniforms) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    shader.uniforms.uLight = uniforms.uLight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLight;')
      .replace('#include <output_fragment>', 'outgoingLight *= uLight;\n#include <output_fragment>');
  };
  material.customProgramCacheKey = () => 'dim-' + material.type;
  material.needsUpdate = true;
}

export async function buildWorld({ THREE, renderer, camera, root, json, base, onProgress, faces, mark = () => {} }) {
  const breathe = () => new Promise((r) => setTimeout(r, 0));     // lets the loading bar repaint
  const progress = (p) => onProgress && onProgress(p);
  const oceanId = faces.front;
  const roomId = faces.back;
  const ocean = root.children.find((c) => c.uuid === oceanId);
  const room = root.children.find((c) => c.uuid === roomId);
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();

  // ------------------------------------------------------------------ textures
  const [skyTex, exitTex, textTex, textInfo] = await Promise.all([
    loadTexture(THREE, new URL('tex/sky_wall.webp', base).href),
    makeExitTexture(THREE, new URL('../fonts/URWDIN-Demi.ttf', base).href),
    loadTexture(THREE, new URL('tex/text_atlas.webp', base).href),
    fetch(new URL('tex/text_atlas.json', base)).then((r) => r.json()),
  ]);
  progress(0.5);
  mark('textures');
  skyTex.encoding = THREE.sRGBEncoding;
  skyTex.wrapS = THREE.RepeatWrapping;
  skyTex.wrapT = THREE.ClampToEdgeWrapping;
  skyTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const rippleTex = makeRippleTexture(THREE, 256);
  const noiseTex = makeNoiseTexture(THREE, 256);
  progress(0.8);

  // ------------------------------------------------------------------ shared uniforms
  const sunDir = new THREE.Vector3(0.55, 0.66, 0.62).normalize();
  const uniforms = {
    uTime: { value: 0 },
    uLight: { value: 1 },
    uWallGlow: { value: 1 },
    uSunDir: { value: sunDir.clone() },
    uSunColor: { value: lin(THREE, 1.0, 0.93, 0.82) },
    uRootRot: { value: new THREE.Matrix3() },
    uOpen: { value: 0 },
    uOpenPos: { value: new THREE.Vector2(OPEN_POS.z, OPEN_POS.y) },
  };

  // ------------------------------------------------------------------ the sea side
  // lights
  ocean.traverse((o) => { if (o.isAmbientLight) { o.intensity = 0.18; o.color.setRGB(1, 1, 1); } });
  const sun = new THREE.DirectionalLight(0xffffff, 3.4);
  sun.color.copy(uniforms.uSunColor.value);
  sun.position.copy(sunDir).multiplyScalar(2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -0.85; sc.right = 0.85; sc.top = 0.85; sc.bottom = -0.85; sc.near = 0.5; sc.far = 4.5;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.0015;
  sun.shadow.radius = 3;
  sun.name = 'StudioSun';
  ocean.add(sun);
  sun.target.position.set(-0.2, -0.2, 0);
  ocean.add(sun.target);
  const hemi = new THREE.HemisphereLight(lin(THREE, 0.42, 0.62, 0.95), lin(THREE, 0.05, 0.22, 0.25), 0.75);
  hemi.name = 'DomeSkyLight';
  ocean.add(hemi);

  // painted wall + stairs
  const wallMesh = findIn(ocean, 'Object_0');
  const doorMesh = findIn(ocean, 'Object_0_1');
  if (wallMesh) {
    wallMesh.material = createWallMaterial(THREE, { skyTex, noiseTex, uniforms });
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
  }
  if (doorMesh) {
    doorMesh.material = new THREE.MeshBasicMaterial({ color: 0x000000, name: 'DoorDark', side: THREE.DoubleSide });
  }
  const ext = createWallExtensions(THREE, { skyTex, noiseTex, uniforms });
  ocean.add(ext.group);
  ocean.add(createDome(THREE, { skyTex, uniforms }));
  const exitSign = createExitSign(THREE, exitTex);
  dimWithStudioLight(exitSign.material, uniforms);
  ocean.add(exitSign);

  // the sea
  const sea = createOcean(THREE, { skyTex, rippleTex, noiseTex, uniforms });
  mark('ocean'); await breathe();
  ocean.add(sea.group);

  // the boat: re-parent every part under a pivot at the bow puncture
  const boatParts = ['Object_4', 'Object_2001', 'Object_3', 'Object_5']
    .map((n) => findIn(ocean, n)).filter(Boolean);
  const boatPivot = new THREE.Group();
  boatPivot.name = 'BoatPivot';
  const bowPoint = new THREE.Vector3(-0.47, -0.313, 0.4245);
  boatPivot.position.copy(bowPoint);
  ocean.add(boatPivot);
  boatPivot.updateMatrixWorld(true);
  boatParts.forEach((p) => boatPivot.attach(p));
  dressBoat(THREE, { boatPivot, bowPoint, uniforms, noiseTex, family: 'trumanExitDin' });

  // the sky speaks: Christof's words of light and the skywriter's smoke
  const oldSubtitles = findIn(ocean, 'letrasd.glb');
  if (oldSubtitles) oldSubtitles.visible = false;
  const skyVoice = createSkyVoice(THREE, { ocean, textTex, textInfo, noiseTex, uniforms });

  // Truman
  const trumanRoot = findIn(ocean, 'truman.glb');
  const truman = createTruman(THREE, { ocean, trumanRoot });
  mark('truman');

  // ------------------------------------------------------------------ the other famous scenes, one per face
  const storm = createStorm(THREE, {
    root, finaleBoat: boatPivot, finaleBowPoint: bowPoint, trumanArmature: truman.armature, trumanClip: truman.clip,
    rippleTex, noiseTex, uniforms, makeRig,
  });
  mark('storm'); await breathe();
  const morning = createMorning(THREE, {
    root, skyTex, noiseTex, uniforms, trumanArmature: truman.armature, trumanClip: truman.clip, makeRig, family: 'trumanExitDin',
    treeAtlas: loadTreeAtlas(THREE, base),
  });
  mark('morning'); await breathe();
  const mirror = createMirror(THREE, {
    root, noiseTex, uniforms, trumanArmature: truman.armature, trumanClip: truman.clip, makeRig,
  });
  mark('mirror'); await breathe();
  const rainy = createRainOnTruman(THREE, {
    root, skyTex, noiseTex, uniforms, trumanArmature: truman.armature, trumanClip: truman.clip, makeRig,
  });
  mark('rain'); await breathe();
  [storm, morning, mirror, rainy].forEach((w) => w.world.updateMatrixWorld(true));

  // ------------------------------------------------------------------ Christof's control room
  const roomCtl = createRoom(THREE, { renderer, root, room, uniforms, labelFamily: 'trumanExitDin' });
  mark('room'); await breathe();

  // ------------------------------------------------------------------ environment maps
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uSky: { value: skyTex } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D uSky; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec3 c;
        if (d.y > 0.0) {
          float v = clamp(d.y * 1.2, 0.0, 0.99);
          c = texture2D(uSky, vec2(atan(d.x, d.z) / 6.2831 * 3.0, v)).rgb * 1.1;
        } else {
          c = mix(vec3(0.05, 0.22, 0.26), vec3(0.01, 0.05, 0.08), clamp(-d.y * 2.0, 0.0, 1.0));
        }
        vec3 s = normalize(vec3(${sunDir.x.toFixed(3)}, ${sunDir.y.toFixed(3)}, ${sunDir.z.toFixed(3)}));
        c += vec3(1.0, 0.92, 0.8) * pow(max(dot(d, s), 0.0), 600.0) * 40.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  envScene.add(envSky);
  const savedTarget = renderer.getRenderTarget();
  const savedScissor = renderer.getScissorTest();
  renderer.setScissorTest(false);
  const oceanEnv = pmrem.fromScene(envScene, 0.02, 0.1, 20).texture;
  const roomEnv = roomCtl.makeEnv ? roomCtl.makeEnv(pmrem) : oceanEnv;
  renderer.setRenderTarget(savedTarget);
  renderer.setScissorTest(savedScissor);
  envSky.geometry.dispose();
  envSky.material.dispose();
  pmrem.dispose();
  mark('env');

  // ------------------------------------------------------------------ timeline (Truman, subtitles, studio light)
  const timeline = createTimeline(THREE, { truman, skyVoice, uniforms, sun, hemi, roomCtl });

  // live broadcast for the monitors in the room (rendered outside of the EJX passes)
  const envOf = (worldGroup) => (worldGroup === storm.world ? roomEnv : oceanEnv);
  let ready = false;              // no monitor feeds until the warm-up is over (they would compile shaders one by one)
  roomCtl.setRenderHelper && roomCtl.setRenderHelper((cam, identQuat, worldGroup) => {
    if (!ready) return;
    const st = {
      tm: renderer.toneMapping, tme: renderer.toneMappingExposure,
      sm: renderer.shadowMap.enabled, smAuto: renderer.shadowMap.autoUpdate, smNeeds: renderer.shadowMap.needsUpdate,
      lc: renderer.localClippingEnabled, env: root.environment,
    };
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    renderer.localClippingEnabled = true;
    root.environment = envOf(worldGroup);
    uniforms.uRootRot.value.identity();
    truman.beforeRender(identQuat);
    if (worldGroup) lastDrawn.set(worldGroup.uuid, frame);
    const fogSave = root.fog;
    root.fog = worldGroup === morning.world ? morningFog : worldGroup === rainy.world ? beachFog : null;   // the same shaders as on the face
    renderer.render(root, cam);
    root.fog = fogSave;
    renderer.toneMapping = st.tm;
    renderer.toneMappingExposure = st.tme;
    renderer.shadowMap.enabled = st.sm;
    renderer.shadowMap.autoUpdate = st.smAuto;
    renderer.shadowMap.needsUpdate = st.smNeeds;
    renderer.localClippingEnabled = st.lc;
    root.environment = st.env;
  });

  // ------------------------------------------------------------------ first view: the iconic shot
  // keep the distance the EJX player chose for this screen (portrait phones get
  // a longer one) and only swing the camera round to the sea side of the cube
  {
    const dist = Math.max(3.5, camera.position.length() || 4.5);
    const az = 24 * Math.PI / 180, el = 7 * Math.PI / 180;
    camera.position.set(dist * Math.cos(el) * Math.cos(az), dist * Math.sin(el), dist * Math.cos(el) * Math.sin(az));
    camera.lookAt(0, 0, 0);
  }

  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // ------------------------------------------------------------------ per frame
  let time = 0;
  let frame = 0;
  const boatState = { pitch: 0, roll: 0, heave: 0 };
  const rotM4 = new THREE.Matrix4();
  const eul = new THREE.Euler();

  // one famous scene per face of the cube
  const facesOut = {
    right: oceanId,                    // the finale: EXIT
    left: roomId,                      // Christof's control room
    front: storm.world.uuid,           // the storm
    back: morning.world.uuid,          // good morning + SIRIUS
    top: mirror.world.uuid,            // Truman at his bathroom mirror (we are the camera behind it)
    bottom: rainy.world.uuid,          // the rain that only falls on him
  };
  const shadowWorlds = new Map([[oceanId, -1], [morning.world.uuid, -1], [mirror.world.uuid, -1], [rainy.world.uuid, -1]]);
  const envFor = new Map([
    [oceanId, () => oceanEnv], [roomId, () => roomEnv], [storm.world.uuid, () => roomEnv],
    [morning.world.uuid, () => oceanEnv], [mirror.world.uuid, () => oceanEnv], [rainy.world.uuid, () => oceanEnv],
  ]);

  // the control room monitors watch every scene of Truman's life
  roomCtl.setFeeds && roomCtl.setFeeds({
    main: { world: ocean, pos: [-0.19, -0.035, -0.105], look: [-0.445, -0.062, -0.148], fov: 30 },
    tiles: [
      { world: ocean, pos: [0.44, 0.02, 0.16], look: [-0.47, -0.13, 0.03], fov: 46 },          // CAM 01
      { world: ocean, pos: [-0.33, -0.33, 0.20], look: [-0.445, -0.10, -0.15], fov: 50 },      // CAM 07
      { world: storm.world, pos: [0.36, 0.06, 0.45], look: [0.0, -0.12, 0.0], fov: 52 },        // CAM 12
      { world: morning.world, pos: [0.12, -0.33, -0.46], look: [0.02, -0.34, -0.05], fov: 44 },  // SKY CAM -> street
      { world: ocean, pos: [0.42, -0.35, -0.38], look: [-0.45, -0.25, 0.15], fov: 55 },        // CAM 23
      { world: storm.world, pos: [0.10, -0.06, 0.26], look: [-0.06, -0.11, 0.0], fov: 40 },     // CAM 31
      { world: mirror.world, frame: mirror.frame, pos: [0.0, 0.08, 0.35], look: [0.12, 0.02, -0.6], fov: 52 },   // behind the mirror
      { world: rainy.world, frame: rainy.frame, pos: [0.02, -0.14, 0.7], look: [0.0, -0.25, -0.8], fov: 46 },     // the beach
    ],
    labels: ['CAM 01', 'CAM 07', 'BOAT CAM', 'CAM 03', 'CAM 23', 'MAST CAM', 'MIRROR CAM', 'BEACH CAM',
      'BUTTON CAM', 'CAM 09', 'CAM 15', 'CAM 28', 'CAM 36', 'CAM 40', 'CAM 61', 'NO SIGNAL'],
  });

  const dbg = { subTime: null, all: false };
  const lastDrawn = new Map(), lastUpdated = new Map();
  const seen = (w) => dbg.all || frame < 4 || frame - (lastDrawn.has(w.uuid) ? lastDrawn.get(w.uuid) : -99) <= 2;
  const sinceLast = (w, fallback) => {          // the time since this scene was last updated
    const t0 = lastUpdated.has(w.uuid) ? lastUpdated.get(w.uuid) : time - fallback;
    lastUpdated.set(w.uuid, time);
    return Math.min(0.25, Math.max(0, time - t0));
  };
  // haze in the control room: linear fog that starts at the face of the cube
  const roomFog = new THREE.Fog(new THREE.Color(0.010, 0.013, 0.024), 1, 6);
  const morningFog = new THREE.Fog(new THREE.Color(0.74, 0.73, 0.68), 1, 10);   // the morning haze: far trees go pale and warm
  const beachFog = new THREE.Fog(new THREE.Color(0.62, 0.7, 0.76), 1, 10);
  const camWorld = new THREE.Vector3(), rootWorld = new THREE.Vector3();
  const warmTarget = new THREE.WebGLRenderTarget(8, 8);

  // ------------------------------------------------------------------ shader warm-up helpers
  // the driver compiles in the background once this extension is on; COMPLETION_STATUS_KHR says when
  const glc = renderer.getContext();
  const parallel = glc.getExtension('KHR_parallel_shader_compile');
  let pending = [], pendingTotal = 0;
  // compile() never sets the clipping state it reads (the last drawn material's): one tiny draw
  // with n clipping planes leaves it at n
  const clipProbe = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1e-4, 0, 0, 0, 1e-4, 0], 3)));
  clipProbe.frustumCulled = false;
  const clipScene = new THREE.Scene().add(clipProbe);
  const clipMats = new Map();
  const setClipState = (n) => {
    if (!clipMats.has(n)) {
      clipMats.set(n, new THREE.MeshBasicMaterial({
        clippingPlanes: Array.from({ length: n }, () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 1e3)) }));
    }
    clipProbe.material = clipMats.get(n);
    renderer.render(clipScene, camera);
  };
  const clipCount = (m) => (m.clippingPlanes ? m.clippingPlanes.length : 0);
  const matsOf = (o) => (Array.isArray(o.material) ? o.material : [o.material]);
  // three's compile() wants a Scene (anything else gets an empty one: no fog, no environment) and
  // compiles every material it reaches: show it the root with just this world in it, once per
  // clipping state, with only the materials that are drawn in that state
  const compileWorld = (w) => {
    const counts = new Set();
    w.traverse((o) => { if (o.material) matsOf(o).forEach((m) => counts.add(clipCount(m))); });
    const kids = root.children;
    root.children = [w];
    try {
      for (const n of counts) {
        setClipState(n);
        const saved = [];
        w.traverse((o) => {
          if (!o.material) return;
          const all = matsOf(o), keep = all.filter((m) => clipCount(m) === n);
          if (keep.length === all.length) return;
          saved.push([o, o.material]);
          o.material = Array.isArray(o.material) ? keep : keep[0] || null;
        });
        try { renderer.compile(root, camera); } finally { saved.forEach(([o, m]) => { o.material = m; }); }
      }
    } finally {
      root.children = kids;
    }
  };

  return {
    faces: facesOut,
    debug: { truman, timeline, uniforms, ocean, room, sun, boatPivot, roomCtl, skyVoice, storm, morning, mirror, rainy, sides: dbg },
    update(dt) {
      time += dt;
      frame++;
      uniforms.uTime.value = time;
      timeline.update(time, dt);

      // boat: stern rides the swell, bow stuck in the wall
      const t = time;
      const hs = waveHeight(0.0, 0.40, t) * waveFade(0.0, 0.40);
      const hm = waveHeight(-0.17, 0.40, t);
      const hl = waveHeight(-0.15, 0.345, t);
      const hr = waveHeight(-0.15, 0.455, t);
      const targetPitch = Math.atan2(hs - waveHeight(-0.33, 0.41, t) * 0.3, 0.47) * 0.85;
      const targetRoll = Math.atan2(hr - hl, 0.11) * 0.35;
      const targetHeave = hm * 0.25;
      const k = 1 - Math.exp(-dt * 3.0);
      boatState.pitch += (targetPitch - boatState.pitch) * k;
      boatState.roll += (targetRoll - boatState.roll) * k;
      boatState.heave += (targetHeave - boatState.heave) * k;
      eul.set(boatState.roll, 0, boatState.pitch);
      boatPivot.quaternion.setFromEuler(eul);
      boatPivot.position.set(bowPoint.x, bowPoint.y + boatState.heave, bowPoint.z);

      truman.update();
      const st = dbg.subTime === null ? time : dbg.subTime;   // debug: freeze the side scenes at a time
      if (seen(storm.world)) storm.update(st, sinceLast(storm.world, dt));
      if (seen(morning.world)) morning.update(st, sinceLast(morning.world, dt));
      if (seen(mirror.world)) mirror.update(st, sinceLast(mirror.world, dt), camera, root.quaternion);
      if (seen(rainy.world)) rainy.update(st, sinceLast(rainy.world, dt), camera, root.quaternion);
      roomCtl.update(time, dt, frame);
    },
    // compile every face's shaders as they will really be drawn (tone mapping, shadows, environment,
    // fog, clipping, into a render target like the player's), hidden things included.
    // step 0 only queues them (see compileProgress); steps 1-3 draw two faces each into a tiny
    // target, which also builds their shadow passes and uploads their textures.
    // Returns how many shaders step 0 queued.
    warmup(step = 0) {
      const ids = Object.values(facesOut);
      const todo = step === 0 ? ids : ids.slice((step - 1) * 2, step * 2);
      if (!todo.length) return;
      // hidden things are compiled too, but a light that is hidden now stays off: lights are part of every shader
      const lit = (o) => { for (let p = o; p && p.parent && p.parent !== root; p = p.parent) if (!p.visible) return false; return true; };
      const dark = [];
      root.traverse((o) => { if (o.isLight && !lit(o)) dark.push(o); });
      const hidden = [];
      root.traverse((o) => { if (!o.visible && !o.isLight && o.parent && o.parent !== root) { hidden.push(o); o.visible = true; } });
      const darkVis = dark.map((l) => l.visible);
      dark.forEach((l) => { l.visible = false; });
      const vis = root.children.map((c) => c.visible);
      const prevTarget = renderer.getRenderTarget();
      const prevScissor = renderer.getScissorTest();
      const before = renderer.info.programs.length;
      try {
        renderer.setScissorTest(false);
        renderer.setRenderTarget(warmTarget);       // shaders are keyed on the target's colour space
        for (const id of todo) {
          root.children.forEach((c) => { c.visible = c.uuid === id; });
          const st = this.beforeRender(id);
          if (step === 0) compileWorld(root.children.find((c) => c.uuid === id));
          else renderer.render(root, camera);
          this.afterRender(st);
        }
      } catch (e) { console.warn('[truman] warm-up', e); }
      renderer.setRenderTarget(prevTarget);
      renderer.setScissorTest(prevScissor);
      root.children.forEach((c, i) => { c.visible = vis[i]; });
      hidden.forEach((o) => { o.visible = false; });
      dark.forEach((l, i) => { l.visible = darkVis[i]; });
      if (step === 0) {
        pending = renderer.info.programs.slice(before);
        pendingTotal = pending.length;
        return pendingTotal;
      }
      return 0;
    },
    // share of the queued shaders the driver has finished (1 without the parallel-compile extension:
    // then the first draw simply waits for them)
    compileProgress() {
      if (!parallel) pending = [];
      while (pending.length && (pending[0].usedTimes === 0 ||                  // released meanwhile
        glc.getProgramParameter(pending[0].program, parallel.COMPLETION_STATUS_KHR))) pending.shift();
      return pendingTotal ? 1 - pending.length / pendingTotal : 1;
    },
    // the warm-up is over: the monitors may start drawing their feeds
    start() { ready = true; },
    beforeRender(contentID) {
      const st = {
        tm: renderer.toneMapping, tme: renderer.toneMappingExposure,
        sm: renderer.shadowMap.enabled, smAuto: renderer.shadowMap.autoUpdate,
        lc: renderer.localClippingEnabled, env: root.environment,
      };
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.autoUpdate = false;
      lastDrawn.set(contentID, frame);
      if (shadowWorlds.has(contentID) && frame - shadowWorlds.get(contentID) >= 2) {      // shadows every other frame
        renderer.shadowMap.needsUpdate = true;
        shadowWorlds.set(contentID, frame);
      }
      renderer.localClippingEnabled = true;
      root.environment = envFor.has(contentID) ? envFor.get(contentID)() : oceanEnv;
      if (contentID === roomId || contentID === 'all') roomCtl.markVisible && roomCtl.markVisible(frame);
      st.fog = root.fog;
      if (contentID === roomId) {
        camera.getWorldPosition(camWorld);
        root.getWorldPosition(rootWorld);
        const d = camWorld.distanceTo(rootWorld) / Math.max(1e-3, root.scale.x);
        roomFog.near = (d - 0.55) * root.scale.x;
        roomFog.far = (d + 4.2) * root.scale.x;
        root.fog = roomFog;
      }
      if (contentID === morning.world.uuid) {
        camera.getWorldPosition(camWorld);
        root.getWorldPosition(rootWorld);
        const d = camWorld.distanceTo(rootWorld) / Math.max(1e-3, root.scale.x);
        morningFog.near = (d + 0.4) * root.scale.x;
        morningFog.far = (d + 11.0) * root.scale.x;
        root.fog = morningFog;
      }
      if (contentID === rainy.world.uuid) {
        camera.getWorldPosition(camWorld);
        root.getWorldPosition(rootWorld);
        const d = camWorld.distanceTo(rootWorld) / Math.max(1e-3, root.scale.x);
        beachFog.color.copy(rainy.haze.color);
        beachFog.near = Math.max(0.1, d + rainy.haze.near) * root.scale.x;
        beachFog.far = (d + rainy.haze.far) * root.scale.x;
        root.fog = beachFog;
      }
      rotM4.makeRotationFromQuaternion(root.quaternion);
      uniforms.uRootRot.value.setFromMatrix4(rotM4);
      truman.beforeRender(root.quaternion);
      return st;
    },
    afterRender(st) {
      renderer.toneMapping = st.tm;
      renderer.toneMappingExposure = st.tme;
      renderer.shadowMap.enabled = st.sm;
      renderer.shadowMap.autoUpdate = st.smAuto;
      renderer.localClippingEnabled = st.lc;
      root.environment = st.env;
      root.fog = st.fog || null;
    },
    resize() {},
    pointer() {},
    key() {},
    dispose() { roomCtl.dispose && roomCtl.dispose(); },
  };
}
