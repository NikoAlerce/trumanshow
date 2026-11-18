// Truman: the waving clip from the original scene + procedural bow and the
// final walk through the EXIT door (all bones driven on top of the clip).

const DOOR_Z = -0.1875;
const DOOR_PLANE_X = -0.4985;   // the black doorway quad sits at x = -0.499

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export function createTruman(THREE, { ocean, trumanRoot }) {
  const armature = ocean.getObjectByName('Armature');
  const clip = trumanRoot && trumanRoot.animations && trumanRoot.animations[0];
  if (!armature || !clip) {
    return { update() {}, setState() {}, beforeRender() {}, meshes: [] };
  }
  const bones = {};
  const byName = {};
  armature.traverse((o) => { if (o.isBone) { bones[o.name.replace('mixamorig', '')] = o; byName[o.name] = o; } });

  // The clip is sampled directly every frame (an AnimationMixer only writes
  // values that changed, which would let the procedural offsets accumulate).
  const channels = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const node = byName[track.name.slice(0, dot)];
    const prop = track.name.slice(dot + 1);
    if (!node || !(prop in node)) continue;
    channels.push({ target: node[prop], interp: track.createInterpolant() });
  }
  const sampleClip = (t) => {
    for (const c of channels) c.target.fromArray(c.interp.evaluate(t));
  };

  // pivot at Truman's feet, in sea/content space (no scale, no shear)
  ocean.updateMatrixWorld(true);
  const oceanInv = new THREE.Matrix4().copy(ocean.matrixWorld).invert();
  const footL = new THREE.Vector3(), footR = new THREE.Vector3();
  bones.LeftFoot.getWorldPosition(footL).applyMatrix4(oceanInv);
  bones.RightFoot.getWorldPosition(footR).applyMatrix4(oceanInv);
  const home = new THREE.Vector3((footL.x + footR.x) / 2, -0.110, (footL.z + footR.z) / 2);
  const pivot = new THREE.Group();
  pivot.name = 'TrumanPivot';
  pivot.position.copy(home);
  ocean.add(pivot);
  pivot.updateMatrixWorld(true);
  pivot.attach(armature);

  // clipping plane: everything beyond the doorway is dark interior
  const clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -DOOR_PLANE_X);
  const meshes = [];
  armature.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        m.clippingPlanes = [clipPlane];
        m.clipShadows = true;
        if (m.map) m.roughness = Math.max(m.roughness, 0.75);
        m.metalness = 0;
        m.needsUpdate = true;
      });
      meshes.push(o);
    }
  });

  // walking path: quadratic bezier from home to beyond the doorway
  const P0 = new THREE.Vector2(home.x, home.z);
  const C = new THREE.Vector2(home.x, DOOR_Z);
  const P2 = new THREE.Vector2(-0.585, DOOR_Z);
  const bez = (t, out) => {
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    return out.set(a * P0.x + b * C.x + c * P2.x, a * P0.y + b * C.y + c * P2.y);
  };
  const bezTan = (t, out) => out.set(
    2 * (1 - t) * (C.x - P0.x) + 2 * t * (P2.x - C.x),
    2 * (1 - t) * (C.y - P0.y) + 2 * t * (P2.y - C.y),
  ).normalize();
  // arc length table
  const N = 64;
  const lengths = [0];
  const tmp1 = new THREE.Vector2(), tmp2 = new THREE.Vector2();
  bez(0, tmp1);
  for (let i = 1; i <= N; i++) { bez(i / N, tmp2); lengths.push(lengths[i - 1] + tmp2.distanceTo(tmp1)); tmp1.copy(tmp2); }
  const pathLen = lengths[N];
  const tAtLen = (s) => {
    s = Math.min(pathLen, Math.max(0, s));
    let i = 1;
    while (i < N && lengths[i] < s) i++;
    const f = (s - lengths[i - 1]) / Math.max(1e-6, lengths[i] - lengths[i - 1]);
    return (i - 1 + f) / N;
  };

  // ---------------------------------------------------------------- bone helpers
  const qParent = new THREE.Quaternion();
  const qOcean = new THREE.Quaternion();
  const qRot = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();   // up x forward: rotating +angle about it pitches "up" towards "forward"

  // rotate a bone about an axis given in sea/content space
  const turnBone = (name, axisContent, angle) => {
    const b = bones[name];
    if (!b || Math.abs(angle) < 1e-5) return;
    b.parent.getWorldQuaternion(qParent);
    axis.copy(axisContent).applyQuaternion(qOcean).applyQuaternion(qParent.invert()).normalize();
    qRot.setFromAxisAngle(axis, angle);
    b.quaternion.premultiply(qRot);
  };

  const D = Math.PI / 180;
  const state = { clipTime: 0, bow: 0, walk: -1, turn: 0, visible: true, look: 0 };
  const pos2 = new THREE.Vector2(), tan2 = new THREE.Vector2();

  return {
    meshes,
    bones,
    pivot,
    armature,
    clip,
    pathLen,
    // timeline sets the high level state; update() turns it into a pose
    setState(s) { Object.assign(state, s); },
    update() {
      // base pose from the clip
      sampleClip(state.clipTime);

      // root: position + heading
      let yaw = 0;
      if (state.walk >= 0) {
        const s = state.walk * pathLen;
        const t = tAtLen(s);
        bez(t, pos2);
        bezTan(t, tan2);
        yaw = Math.atan2(-tan2.y, tan2.x);   // heading of +x rotated by yaw around +y
        const bob = Math.abs(Math.sin(s / 0.0175 * Math.PI)) * 0.0022;
        pivot.position.set(pos2.x, home.y + bob, pos2.y);
      } else {
        yaw = state.turn * (Math.PI / 2);
        pivot.position.copy(home);
      }
      pivot.rotation.set(0, yaw, 0);
      pivot.visible = state.visible && !(state.walk >= 0 && pivot.position.x < -0.57);
      pivot.updateMatrixWorld(true);

      ocean.getWorldQuaternion(qOcean);
      fwd.set(Math.cos(yaw), 0, -Math.sin(yaw));
      side.crossVectors(UP, fwd).normalize();

      // ---- looking up at the light in the sky (to his right, above)
      if (state.look > 0) {
        turnBone('Spine2', side, -5 * D * state.look);
        turnBone('Neck', side, -14 * D * state.look);
        turnBone('Head', side, -17 * D * state.look);
        turnBone('Head', UP, -12 * D * state.look);
      }

      // ---- bow: spine chain pitches forward, arms follow a little
      const bow = state.bow;
      if (bow > 0) {
        turnBone('Spine', side, 13 * D * bow);
        turnBone('Spine1', side, 15 * D * bow);
        turnBone('Spine2', side, 15 * D * bow);
        turnBone('Neck', side, 8 * D * bow);
        turnBone('Head', side, 6 * D * bow);
        // theatrical flourish: right arm sweeps across the waist, left arm back
        turnBone('RightArm', side, -38 * D * bow);
        turnBone('RightForeArm', UP, -55 * D * bow);
        turnBone('LeftArm', side, 18 * D * bow);
      }

      // ---- walk cycle
      if (state.walk >= 0) {
        const s = state.walk * pathLen;
        const ph = (s / 0.035) * Math.PI * 2;           // one stride = two steps
        const ramp = smooth(clamp01(state.walk * 6)) * (1 - smooth(clamp01((state.walk - 0.9) * 10)));
        const sw = Math.sin(ph) * ramp;
        turnBone('LeftUpLeg', side, -24 * D * sw);
        turnBone('RightUpLeg', side, 24 * D * sw);
        turnBone('LeftLeg', side, 38 * D * Math.max(0, Math.sin(ph + 1.2)) * ramp);
        turnBone('RightLeg', side, 38 * D * Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * ramp);
        turnBone('LeftArm', side, 14 * D * sw);
        turnBone('RightArm', side, -14 * D * sw);
        turnBone('Spine', side, 4 * D * ramp);
      }
      for (const [n, ax, deg] of this.debugExtra) turnBone(n, ax === 'side' ? side : ax === 'fwd' ? fwd : UP, deg * D);
    },
    // debug: extra rotations [bone, 'side'|'fwd'|'up', degrees]
    debugExtra: [],
    beforeRender(rootQuat) {
      // keep the doorway clip plane in world space
      clipPlane.normal.set(1, 0, 0).applyQuaternion(rootQuat);
      clipPlane.constant = -DOOR_PLANE_X;
    },
  };
}
