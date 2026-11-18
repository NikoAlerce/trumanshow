// Dev only (never shipped): where the time goes. In a ?debug page after "Tap to start":
//   const p = await import('/tools/dev_profile.js'); await p.profile();
export async function profile({ frames = 40, w = 1280, h = 720 } = {}) {
  const T = window.__truman, THREE = T.THREE, W = T.world, R = T.renderer, D = W.debug;
  const gl = R.getContext();
  const out = {};
  out.canvas = { css: [R.domElement.clientWidth, R.domElement.clientHeight], px: [R.domElement.width, R.domElement.height], dpr: R.getPixelRatio(), devicePixelRatio: window.devicePixelRatio };
  out.programs = R.info.programs ? R.info.programs.length : null;

  // ---- per-frame update: each part on its own
  const parts = { storm: D.storm, morning: D.morning, mirror: D.mirror, rainy: D.rainy, roomCtl: D.roomCtl, timeline: D.timeline, truman: D.truman };
  const acc = {};
  const restore = [];
  Object.entries(parts).forEach(([k, o]) => {
    if (!o || typeof o.update !== 'function') return;
    const f = o.update;
    acc[k] = 0;
    o.update = function (...a) { const t0 = performance.now(); const r = f.apply(this, a); acc[k] += performance.now() - t0; return r; };
    restore.push(() => { o.update = f; });
  });
  let tot = 0;
  for (let i = 0; i < frames; i++) { const t0 = performance.now(); W.update(1 / 60); tot += performance.now() - t0; }
  restore.forEach((r) => r());
  out.updateMsPerFrame = { total: +(tot / frames).toFixed(2) };
  Object.entries(acc).forEach(([k, v]) => { out.updateMsPerFrame[k] = +(v / frames).toFixed(2); });

  // ---- render each face's world, GPU included (a 1px readback waits for the GPU)
  const root = T.root;
  const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
  const px = new Uint8Array(4);
  const cam = T.camera;
  const faces = {};
  Object.entries(W.faces).forEach(([k, id]) => { faces[k] = root.children.find((c) => c.uuid === id) || null; });
  out.renderMsPerFace = {};
  for (const [name, world] of Object.entries(faces)) {
    if (!world) continue;
    const vis = root.children.map((c) => c.visible);
    root.children.forEach((c) => { c.visible = c === world; });
    let t = 0;
    const n = 12;
    for (let i = 0; i < n + 2; i++) {
      W.update(1 / 60);                      // a new frame: shadows are redrawn as in the player
      const st = W.beforeRender(world.uuid);
      R.setRenderTarget(rt); R.clear();
      const t0 = performance.now();
      R.render(root, cam);
      R.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
      const dt = performance.now() - t0;
      W.afterRender(st);
      if (i >= 2) t += dt;                    // skip the first two (compiles, uploads)
    }
    R.setRenderTarget(null);
    root.children.forEach((c, i) => { c.visible = vis[i]; });
    out.renderMsPerFace[name] = +(t / n).toFixed(2);
  }
  rt.dispose();
  out.programsAfter = R.info.programs ? R.info.programs.length : null;
  out.drawInfo = { geometries: R.info.memory.geometries, textures: R.info.memory.textures };
  return out;
}

// time the canvas painting done at load
export async function paintTimes() {
  const THREE = window.__truman.THREE;
  const cards = await import('/dist/content/lib/cards.js?' + Date.now());
  const t = {};
  let t0 = performance.now(); cards.paintTreeAtlas(THREE); t.treeAtlas = performance.now() - t0;
  t0 = performance.now(); cards.paintCarFlat(THREE); t.carFlat = performance.now() - t0;
  t0 = performance.now(); cards.paintBirdStrip(THREE, 'gull'); t.birds = performance.now() - t0;
  Object.keys(t).forEach((k) => { t[k] = +t[k].toFixed(1); });
  return t;
}
