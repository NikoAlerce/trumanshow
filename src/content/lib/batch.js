// Fewer draw calls: merge the static meshes of a world that look the same (same
// kind of material, colour, maps, shadows) into one mesh each. Every merged piece
// keeps its place: its transform is baked into the geometry, in the world's space.
// Things that move, animate, blend or are instanced are left alone.

const custom = (THREE, m) => m.onBeforeCompile && m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile;

function signature(THREE, m) {
  if (custom(THREE, m) || m.isShaderMaterial) return m.uuid;     // custom shaders: only the same material merges
  const hex = (c) => (c ? c.getHex() : '');
  const id = (t) => (t ? t.uuid : '');
  return [m.type, hex(m.color), m.roughness, m.metalness, id(m.map), id(m.bumpMap), m.bumpScale, id(m.normalMap),
    hex(m.emissive), m.emissiveIntensity, m.side, m.envMapIntensity, m.alphaTest, m.vertexColors, m.flatShading,
    m.fog, m.toneMapped, m.wireframe].join('|');
}

export function mergeStatic(THREE, group, { skip = new Set() } = {}) {
  group.updateMatrixWorld(true);
  const toGroup = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const visit = (o) => {
    if (skip.has(o) || !o.visible) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && !o.material.transparent &&
        o.geometry.attributes.position && o.geometry.attributes.normal && o.children.length === 0 &&
        o.onBeforeRender === THREE.Object3D.prototype.onBeforeRender && o.renderOrder === 0 && !o.customDepthMaterial) {
      const key = signature(THREE, o.material) + '|' + o.castShadow + '|' + o.receiveShadow;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(o);
      return;
    }
    o.children.slice().forEach(visit);
  };
  group.children.slice().forEach(visit);

  let before = 0, after = 0;
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  for (const list of buckets.values()) {
    before += list.length;
    if (list.length < 2) { after += list.length; continue; }
    const parts = list.map((o) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      m.multiplyMatrices(toGroup, o.matrixWorld);
      nm.getNormalMatrix(m);
      return { g, m: m.clone(), nm: nm.clone() };
    });
    const n = parts.reduce((s, p) => s + p.g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let k = 0;
    for (const p of parts) {
      const P = p.g.attributes.position, N = p.g.attributes.normal, U = p.g.attributes.uv;
      for (let i = 0; i < P.count; i++, k++) {
        v.fromBufferAttribute(P, i).applyMatrix4(p.m);
        pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
        v.fromBufferAttribute(N, i).applyMatrix3(p.nm).normalize();
        nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z;
        if (U) { uv[k * 2] = U.getX(i); uv[k * 2 + 1] = U.getY(i); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, list[0].material);
    mesh.castShadow = list[0].castShadow;
    mesh.receiveShadow = list[0].receiveShadow;
    mesh.name = 'Merged:' + (list[0].material.name || list[0].material.type);
    group.add(mesh);
    list.forEach((o) => o.removeFromParent());
    after += 1;
  }
  return { before, after };
}
