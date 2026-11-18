// Dev only (never shipped): offscreen frame capture of one face's world.
// In the page (index.html?debug, after "Tap to start"):
//   const m = await import('/tools/dev_capture.js'); m.install();
//   await __seqCap({ world: __truman.world.debug.morning.world, times: [1, 2], prefix: 'x' });
// Frames go to captures/ through tools/serve.py (POST /__capture?name=).
// Works with the Browser pane hidden: it renders into a render target, not the canvas.
export function install() {
  const T = window.__truman;
  if (!T || !T.world) throw new Error('load the cube with ?debug first');
  const THREE = T.THREE, W = T.world, R = T.renderer;
  const toSRGB = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; toSRGB[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }
  // render one world from a camera given in root-local coordinates
  window.__shot = (opts) => {
    const { world, w = 480, h = 480, cam = [0, 0, -3.2], target = [0, -0.05, 0], fov = 24 } = opts;
    const root = T.root;
    root.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(fov, w / h, 0.01, 200);
    camera.position.copy(root.localToWorld(new THREE.Vector3(...cam)));
    camera.up.set(0, 1, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
    camera.lookAt(root.localToWorld(new THREE.Vector3(...target)));
    camera.updateMatrixWorld(true);
    const rt = window.__rt && window.__rt.width === w && window.__rt.height === h ? window.__rt : (window.__rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 }));
    const vis = root.children.map((c) => c.visible);
    root.children.forEach((c) => { c.visible = c === world; });
    const st = W.beforeRender(world.uuid);
    const prevRT = R.getRenderTarget();
    R.setRenderTarget(rt); R.setClearColor(0x000000, 1); R.clear(true, true, true);
    R.render(root, camera);
    W.afterRender(st);
    const px = new Uint8Array(w * h * 4);
    R.readRenderTargetPixels(rt, 0, 0, w, h, px);
    R.setRenderTarget(prevRT);
    root.children.forEach((c, i) => { c.visible = vis[i]; });
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4, d = (y * w + x) * 4;
      img.data[d] = toSRGB[px[s]]; img.data[d + 1] = toSRGB[px[s + 1]]; img.data[d + 2] = toSRGB[px[s + 2]]; img.data[d + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  };
  window.__post = async (cv, name) => {
    const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.9));
    return (await fetch('/__capture?name=' + encodeURIComponent(name), { method: 'POST', body: blob })).status;
  };
  // a side scene frozen at each time (stepping a few frames first), shot and saved
  window.__seqCap = async (opts) => {
    const { world, times, prefix, steps = 3 } = opts;
    const dbg = W.debug.sides;
    const out = [];
    for (const t of times) {
      for (let s = 0; s < steps; s++) { dbg.subTime = t - (steps - 1 - s) * (1 / 60); W.update(1 / 60); }
      out.push(await window.__post(window.__shot({ ...opts, world }), `${prefix}_${t.toFixed(2).replace('.', '_')}.jpg`));
    }
    dbg.subTime = null;
    return out;
  };
  return 'installed';
}
