// EJX content module — Truman Show cube (objkt edition).
// The EyeJack X player (index.js) imports this file and calls main().
import { decodeBinaryRefs } from './lib/decode.js';
import { buildWorld } from './lib/world.js';

const BASE = new URL('./', import.meta.url);

function fetchWithProgress(url, type, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = type;
    xhr.onprogress = (e) => onProgress(e.loaded, e.lengthComputable ? e.total : 0);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) resolve(xhr.response);
      else reject(new Error(url + ' -> ' + xhr.status));
    };
    xhr.onerror = () => reject(new Error('network error ' + url));
    xhr.send();
  });
}

export const main = ({ renderer, renderTarget, camera, scene, loadingManager, gui }) => {
  const THREE = window.THREE;
  // without the per-shader error check the driver can compile shaders in parallel
  const qs = new URLSearchParams(window.location.search);
  if (!qs.has('debug') || qs.has('fast')) renderer.debug.checkShaderErrors = false;

  let contentPerCubeFace = { front: 'all', right: 'all', back: 'all', left: 'all', top: 'all', bottom: 'all' };
  let cubeConfig = { borderOn: true, borderWidth: 0.0025, borderFeather: 0.5, borderColor: '#ffffff', borderAlpha: 0.25 };
  const box = new THREE.Box3();

  const cameraClone = camera.clone();
  let sceneLoaded = null;
  let sceneLoadedMatrix = null;
  let world = null;
  let loaded = false;
  let failed = false;

  // ------------------------------------------------------------ loading
  const loadT0 = performance.now(), loadMarks = [];        // ms since main(), per phase (shown in ?debug)
  // how far along each phase leaves the load (downloads fill the first 45%)
  // (the shaders fill 0.76-0.96 as the driver reports them ready)
  const STAGES = { fetched: 0.45, decoded: 0.48, parsed: 0.5, textures: 0.53, ocean: 0.58, truman: 0.59, storm: 0.61, morning: 0.63,
    mirror: 0.65, rain: 0.68, room: 0.69, env: 0.72, built: 0.74, warm0: 0.76, compiled: 0.96, warm1: 0.97, warm2: 0.98, warm3: 0.99 };
  let stageP = 0;
  const mark = (name) => {
    loadMarks.push([name, Math.round(performance.now() - loadT0)]);
    const k = name.split(':')[0];
    if (STAGES[k] !== undefined) stageP = Math.max(stageP, STAGES[k]);
    showProgress();
  };
  window.__trumanLoad = loadMarks;                            // how long each phase took (for checking load times)
  const progress = { json: 0, bin: 0, extra: 0 };
  let expected = { json: 300000, bin: 3000000 };
  const loadProgress = () => {
    const dl = 0.06 * Math.min(1, progress.json / expected.json) + 0.39 * Math.min(1, progress.bin / expected.bin);
    return Math.min(0.999, Math.max(stageP, dl));
  };

  // ------------------------------------------------------------ the loading bar (so nobody thinks it is stuck)
  // index.html shows it from the first instant (#truman-loading, styled there); built here if missing
  const bar = (() => {
    let el = document.getElementById('truman-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'truman-loading';
      el.style.cssText = 'position:fixed;left:50%;bottom:max(16px,4vh);transform:translateX(-50%);width:min(300px,72vw);'
        + 'box-sizing:border-box;padding:10px 16px 12px;border-radius:12px;background:rgba(8,10,14,.66);color:#fff;'
        + 'font:12px/1.25 urwdin,"Helvetica Neue",Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;'
        + 'text-align:center;pointer-events:none;z-index:300;transition:opacity .5s ease';
      el.innerHTML = '<div class="tl-label"></div>'
        + '<div class="tl-track" style="height:2px;margin-top:9px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden">'
        + '<div class="tl-fill" style="height:100%;width:0;background:#fff;transition:width .35s ease"></div></div>';
      (document.body || document.documentElement).appendChild(el);
    }
    el.classList.remove('wait');                      // from here on the bar shows how far along it is
    const label = el.querySelector('.tl-label'), fill = el.querySelector('.tl-fill');
    return {
      set(p, text) { fill.style.width = (100 * p).toFixed(1) + '%'; label.textContent = text + ' · ' + Math.floor(100 * p) + '%'; },
      done() {
        fill.style.width = '100%'; label.textContent = 'Good morning!';
        setTimeout(() => { el.style.opacity = '0'; }, 900);
        setTimeout(() => el.remove(), 1600);
      },
      fail() { label.textContent = 'Could not load — please reload'; },
    };
  })();
  const showProgress = () => {
    const p = loadProgress();
    bar.set(p, p < 0.45 ? 'Loading Seahaven' : p < 0.74 ? 'Building the set' : 'Lighting the stage');
  };
  showProgress();

  const start = async () => {
    try {
      const ejx = await fetch(new URL('ejx.json', BASE)).then((r) => r.json());
      if (ejx['app-json-length']) expected.json = ejx['app-json-length'];
      if (ejx['scene-bin-length']) expected.bin = ejx['scene-bin-length'];
      if (ejx.box) box.set(new THREE.Vector3().copy(ejx.box.min), new THREE.Vector3().copy(ejx.box.max));

      const [appText, bin] = await Promise.all([
        fetchWithProgress(new URL('app.json', BASE).href, 'text', (l) => { progress.json = l; showProgress(); }),
        fetchWithProgress(new URL('scene.bin', BASE).href, 'arraybuffer', (l) => { progress.bin = l; showProgress(); }),
      ]);
      mark('fetched');
      const json = JSON.parse(appText);
      decodeBinaryRefs(json, bin);
      mark('decoded');

      const project = json.project;
      contentPerCubeFace = {
        front: project.faceFront, right: project.faceRight, back: project.faceBack,
        left: project.faceLeft, top: project.faceTop, bottom: project.faceBottom,
      };
      if (project.cubeConfig) cubeConfig = project.cubeConfig;

      const loader = new THREE.ObjectLoader();
      loader.setResourcePath(BASE.href);
      const root = await new Promise((resolve) => {
        let parsed = null;
        let done = false;
        parsed = loader.parse(json.scene, (obj) => { done = true; resolve(obj); });
        if (done) resolve(parsed);
      });
      mark('parsed');

      world = await buildWorld({
        THREE, renderer, camera, root, json, base: BASE,
        onProgress: (p) => { progress.extra = p; },
        faces: contentPerCubeFace, mark,
      });
      mark('built');
      if (world.faces) contentPerCubeFace = world.faces;
      sceneLoaded = root;
      sceneLoadedMatrix = new THREE.Matrix4().compose(root.position, root.quaternion, root.scale);
      progress.extra = 1;
    } catch (err) {
      failed = true;
      bar.fail();
      console.error('[truman] load failed', err);
    }
  };
  start();

  // ------------------------------------------------------------ frame
  let prevTime = performance.now();
  const update = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - prevTime) / 1000);
    prevTime = now;
    if (world) world.update(dt, camera);
  };

  // ------------------------------------------------------------ warm-up: every shader before the cube is shown
  // one step per frame: 0 queues every face's shaders (the driver compiles them in parallel and the
  // page stays responsive), 1 waits until the driver has them all, 2-4 draw two faces each into a
  // tiny target (shadow passes, texture uploads, the last few shaders), then the cube is shown.
  // Nothing is drawn before that: a draw would wait for its shaders one by one.
  let warmStep = 0, warmAt = 0, warmFrame = -1, rafFrame = 0;
  const tick = () => { rafFrame += 1; if (!loaded) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const warm = () => {
    if (warmFrame === rafFrame) return;               // render() runs once per face
    warmFrame = rafFrame;
    const t0 = performance.now();
    if (warmStep === 0) {
      const n = world.warmup(0);
      mark(`warm0:${Math.round(performance.now() - t0)}ms:${n}`);
      warmAt = performance.now();
      warmStep = 1;
    } else if (warmStep === 1) {
      const p = world.compileProgress();
      stageP = Math.max(stageP, STAGES.warm0 + (STAGES.compiled - STAGES.warm0) * p);
      showProgress();
      if (p >= 1 || t0 - warmAt > 30000) { mark(`compiled:${Math.round(t0 - warmAt)}ms`); warmStep = 2; }
    } else if (warmStep <= 4) {
      world.warmup(warmStep - 1);
      mark(`warm${warmStep - 1}:${Math.round(performance.now() - t0)}ms`);
      warmStep += 1;
    } else {
      loaded = true;
      world.start();
      bar.done();
      // the AR button: the same cube in your space, through amAr (ar/ next to content/; see lib/arbutton.js)
      import('./lib/arbutton.js').then((m) => m.showArButton()).catch((e) => console.warn('[truman] AR button', e));
    }
  };

  const sceneMatrix = new THREE.Matrix4();
  const render = (contentID) => {
    if (sceneLoaded === null) return;
    if (!loaded) { warm(); return; }

    const visibleSave = [];
    sceneLoaded.children.forEach((child, i) => {
      visibleSave[i] = child.visible;
      if (child.visible) child.visible = (contentID === child.uuid) || (contentID === 'all');
    });

    sceneMatrix.compose(scene.position, scene.quaternion, scene.scale);
    sceneMatrix.multiply(sceneLoadedMatrix);
    sceneMatrix.decompose(sceneLoaded.position, sceneLoaded.quaternion, sceneLoaded.scale);

    cameraClone.copy(camera);
    const state = world.beforeRender(contentID);
    renderer.render(sceneLoaded, cameraClone);
    world.afterRender(state);

    sceneLoaded.children.forEach((child, i) => { child.visible = visibleSave[i]; });
  };

  const dispose = () => { if (world) world.dispose(); };
  const noop = () => {};

  // ?debug in the URL exposes internals for development (inert otherwise)
  if (new URLSearchParams(window.location.search).has('debug')) {
    const dbg = { view: null };
    window.__truman = {
      get world() { return world; },
      get root() { return sceneLoaded; },
      get loadMarks() { return loadMarks; },
      renderer, camera, THREE,
      // fixed camera: azimuth (deg, 0 = +x face), elevation (deg), distance
      setView(az, el, dist = 4.5, target = [0, 0, 0]) { dbg.view = { az, el, dist, target }; },
      freeView() { dbg.view = null; },
    };
    const baseUpdate = update;
    const forced = () => {
      baseUpdate();
      if (dbg.view) {
        const { az, el, dist, target } = dbg.view;
        const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
        camera.position.set(target[0] + dist * Math.cos(e) * Math.cos(a), target[1] + dist * Math.sin(e), target[2] + dist * Math.cos(e) * Math.sin(a));
        camera.lookAt(target[0], target[1], target[2]);
        camera.updateMatrixWorld(true);
      }
    };
    return buildApi(forced);
  }
  return buildApi(update);

  function buildApi(updateFn) {
    return {
      load: noop,
      loaded: () => loaded,
      loadProgress: () => (loaded ? 1 : loadProgress()),
      update: updateFn,
      render,
      resize: (w, h) => { if (world) world.resize(w, h); },
      dispose,
      pointerdown: (e) => { if (world) world.pointer('down', e); },
      pointermove: noop,
      pointerup: noop,
      keydown: (e) => { if (world) world.key(e); },
      keyup: noop,
      cubeStyle: () => 'Plain',
      cubeConfig: () => cubeConfig,
      canGoInsideCube: () => true,
      contentPerCubeFace: () => contentPerCubeFace,
      postProcessing: () => null,
      box: () => box,
      failed: () => failed,
    };
  }
};
