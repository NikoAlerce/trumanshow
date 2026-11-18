// Decodes the quantized binary chunks written by tools/build.py back into the
// plain typed arrays that THREE.ObjectLoader expects.

function decodeChunk(c, buffer) {
  const { o, n, q } = c;
  switch (q) {
    case 'float32': return new Float32Array(buffer, o, n);
    case 'uint8': return new Uint8Array(buffer, o, n);
    case 'uint16': return new Uint16Array(buffer, o, n);
    case 'uint32': return new Uint32Array(buffer, o, n);
    case 'int8': return new Int8Array(buffer, o, n);
    case 'int16': return new Int16Array(buffer, o, n);
    case 'i8n': {
      const r = new Int8Array(buffer, o, n);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = r[i] / 127;
      return out;
    }
    case 'i16n': {
      const r = new Int16Array(buffer, o, n);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = r[i] / 32767;
      return out;
    }
    case 'u8w': { // skin weights, renormalized so every vertex sums to 1
      const r = new Uint8Array(buffer, o, n);
      const k = c.k;
      const out = new Float32Array(n);
      for (let v = 0; v < n; v += k) {
        let s = 0;
        for (let j = 0; j < k; j++) s += r[v + j];
        const inv = s > 0 ? 1 / s : 0;
        for (let j = 0; j < k; j++) out[v + j] = r[v + j] * inv;
      }
      return out;
    }
    case 'u16r': { // uint16 with per-component range
      const r = new Uint16Array(buffer, o, n);
      const k = c.k, mn = c.min, st = c.step;
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const j = i % k;
        out[i] = mn[j] + r[i] * st[j];
      }
      return out;
    }
    default:
      throw new Error('Unknown chunk encoding ' + q);
  }
}

export function decodeBinaryRefs(json, buffer) {
  const sc = json.scene;
  for (const g of sc.geometries) {
    const d = g.data;
    if (!d) continue;
    for (const name in d.attributes) {
      const a = d.attributes[name];
      if (a.bin) { a.array = decodeChunk(a.bin, buffer); delete a.bin; }
    }
    if (d.index && d.index.bin) { d.index.array = decodeChunk(d.index.bin, buffer); delete d.index.bin; }
  }
  for (const an of sc.animations || []) {
    for (const t of an.tracks) {
      if (t.times_bin) { t.times = decodeChunk(t.times_bin, buffer); delete t.times_bin; }
      if (t.values_bin) { t.values = decodeChunk(t.values_bin, buffer); delete t.values_bin; }
    }
  }
}
