// Runtime generated textures (no extra files to download).

// Small deterministic PRNG
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable ripple normal map built from a sum of periodic waves.
// rgb = normal (tangent space, y up in "b"), a = height (for foam/caustics)
export function makeRippleTexture(THREE, size = 256) {
  const rnd = mulberry32(7);
  const comps = [];
  for (let i = 0; i < 46; i++) {
    let fx, fy, f;
    do {
      fx = Math.round((rnd() * 2 - 1) * 22);
      fy = Math.round((rnd() * 2 - 1) * 22);
      f = Math.hypot(fx, fy);
    } while (f < 3 || f > 22);
    const amp = Math.pow(f, -1.35) * (0.6 + 0.8 * rnd());
    comps.push([fx, fy, amp, rnd() * Math.PI * 2]);
  }
  const data = new Uint8Array(size * size * 4);
  const TAU = Math.PI * 2;
  let maxG = 0;
  const gx = new Float32Array(size * size);
  const gy = new Float32Array(size * size);
  const hh = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      let h = 0, dx = 0, dy = 0;
      for (let c = 0; c < comps.length; c++) {
        const [fx, fy, a, p] = comps[c];
        const ph = TAU * (fx * u + fy * v) + p;
        // sharpened ripples (cusp-like crests)
        const s = Math.sin(ph), co = Math.cos(ph);
        h += a * s;
        dx += a * TAU * fx * co;
        dy += a * TAU * fy * co;
      }
      const i = y * size + x;
      gx[i] = dx; gy[i] = dy; hh[i] = h;
      maxG = Math.max(maxG, Math.abs(dx), Math.abs(dy));
    }
  }
  let hmin = Infinity, hmax = -Infinity;
  for (let i = 0; i < hh.length; i++) { hmin = Math.min(hmin, hh[i]); hmax = Math.max(hmax, hh[i]); }
  for (let i = 0; i < size * size; i++) {
    const nx = -gx[i] / maxG, ny = -gy[i] / maxG;
    const nz = 1.0;
    const l = Math.hypot(nx, ny, nz);
    data[i * 4 + 0] = Math.round((nx / l * 0.5 + 0.5) * 255);
    data[i * 4 + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = Math.round((nz / l * 0.5 + 0.5) * 255);
    data[i * 4 + 3] = Math.round(((hh[i] - hmin) / (hmax - hmin)) * 255);
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Tileable value-noise fbm. r = fbm (foam breakup), g = fine fbm, b = ridged (caustics)
export function makeNoiseTexture(THREE, size = 256) {
  const rnd = mulberry32(42);
  const octave = (period) => {
    const g = new Float32Array(period * period);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    return (x, y) => {
      const fx = (x / size) * period, fy = (y / size) * period;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const i00 = g[(y0 % period) * period + (x0 % period)];
      const i10 = g[(y0 % period) * period + ((x0 + 1) % period)];
      const i01 = g[((y0 + 1) % period) * period + (x0 % period)];
      const i11 = g[((y0 + 1) % period) * period + ((x0 + 1) % period)];
      return (i00 * (1 - sx) + i10 * sx) * (1 - sy) + (i01 * (1 - sx) + i11 * sx) * sy;
    };
  };
  const A = [octave(4), octave(8), octave(16), octave(32), octave(64)];
  const B = [octave(16), octave(32), octave(64)];
  const C = [octave(6), octave(12), octave(24)];
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0, w = 0.5, ws = 0;
      for (const o of A) { a += o(x, y) * w; ws += w; w *= 0.5; }
      a /= ws;
      let b = 0; w = 0.5; ws = 0;
      for (const o of B) { b += o(x, y) * w; ws += w; w *= 0.5; }
      b /= ws;
      let c = 0; w = 0.5; ws = 0;
      for (const o of C) { c += (1 - Math.abs(o(x, y) * 2 - 1)) * w; ws += w; w *= 0.5; }
      c /= ws;
      const i = (y * size + x) * 4;
      data[i] = Math.round(a * 255);
      data[i + 1] = Math.round(b * 255);
      data[i + 2] = Math.round(Math.pow(c, 3) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// "EXIT" lettering painted above the door
export async function makeExitTexture(THREE, fontUrl) {
  let family = 'sans-serif';
  try {
    const face = new FontFace('trumanExitDin', `url(${fontUrl})`);
    await face.load();
    document.fonts.add(face);
    family = 'trumanExitDin';
  } catch (e) { /* fallback font */ }
  const w = 512, h = 160;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#0b0d10';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${Math.round(h * 0.92)}px ${family}`;
  // slightly condensed, wide tracking like stencilled set lettering
  const letters = 'EXIT'.split('');
  const spacing = w * 0.215;
  letters.forEach((ch, i) => {
    g.fillText(ch, w / 2 + (i - 1.5) * spacing, h * 0.54);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 8;
  return tex;
}

export function loadTexture(THREE, url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}
