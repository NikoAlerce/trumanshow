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
  let frameCounter = 0;
  let loaded = false;
  let failed = false;

  // ------------------------------------------------------------ loading
  const loadT0 = performance.now(), loadMarks = [];        // ms since main(), per phase (shown in ?debug)
  const mark = (name) => loadMarks.push([name, Math.round(performance.now() - loadT0)]);
  window.__trumanLoad = loadMarks;                            // how long each phase took (for checking load times)
  const progress = { json: 0, bin: 0, extra: 0 };
  let expected = { json: 300000, bin: 3000000 };
  const loadProgress = () => {
    const p = 0.08 * Math.min(1, progress.json / expected.json) +
              0.62 * Math.min(1, progress.bin / expected.bin) +
              0.30 * progress.extra;
    return Math.min(0.999, p);
  };

  const start = async () => {
    try {
      const ejx = await fetch(new URL('ejx.json', BASE)).then((r) => r.json());
      if (ejx['app-json-length']) expected.json = ejx['app-json-length'];
      if (ejx['scene-bin-length']) expected.bin = ejx['scene-bin-length'];
      if (ejx.box) box.set(new THREE.Vector3().copy(ejx.box.min), new THREE.Vector3().copy(ejx.box.max));

      const [appText, bin] = await Promise.all([
        fetchWithProgress(new URL('app.json', BASE).href, 'text', (l) => { progress.json = l; }),
        fetchWithProgress(new URL('scene.bin', BASE).href, 'arraybuffer', (l) => { progress.bin = l; }),
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

  const sceneMatrix = new THREE.Matrix4();
  const render = (contentID) => {
    if (sceneLoaded === null) return;
    frameCounter += 1;
    // shaders for every face, as they will be drawn, before the cube is shown:
    // step 0 compiles them all, steps 1-3 draw two faces each into a tiny target
    if (frameCounter <= 4) { const w0 = performance.now(); world.warmup(frameCounter - 1); mark(`warm${frameCounter - 1}:${Math.round(performance.now() - w0)}ms`); }
    if (frameCounter === 6) loaded = true;

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
