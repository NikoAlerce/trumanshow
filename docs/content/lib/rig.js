// Re-usable Truman: clone the rigged model (like SkeletonUtils.clone) and pose
// it with the waving clip plus procedural rotations, in any world.
//
// Every bit of bone maths here happens in the ARMATURE's own space. The model's
// armature carries a slightly non-uniform scale (0.0008, 0.0008, 0.0007), so in
// world space its bones are sheared and quaternion maths done there is a little
// off — enough to make an IK arm wander and shiver from frame to frame. Inside
// the armature the bone chain is rigid, and the maths is exact.

function parallelTraverse(a, b, cb) {
  cb(a, b);
  for (let i = 0; i < a.children.length; i++) parallelTraverse(a.children[i], b.children[i], cb);
}

export function cloneSkinned(source) {
  const srcOf = new Map();
  const cloneOf = new Map();
  const clone = source.clone();
  parallelTraverse(source, clone, (a, b) => { srcOf.set(b, a); cloneOf.set(a, b); });
  clone.traverse((node) => {
    if (!node.isSkinnedMesh) return;
    const src = srcOf.get(node);
    const skeleton = src.skeleton.clone();
    skeleton.bones = src.skeleton.bones.map((b) => cloneOf.get(b));
    node.bind(skeleton, src.bindMatrix);
    node.frustumCulled = false;
  });
  return clone;
}

// pivot (in `space`) <- armature clone; returns pose helpers
export function makeRig(THREE, { armature, clip, space, position, yaw = 0 }) {
  const pivot = new THREE.Group();
  pivot.position.copy(position);
  pivot.rotation.y = yaw;
  space.add(pivot);
  const arm = cloneSkinned(armature);
  // keep the armature's transform relative to its old pivot (scale, rotation)
  arm.position.copy(armature.position);
  arm.quaternion.copy(armature.quaternion);
  arm.scale.copy(armature.scale);
  pivot.add(arm);
  arm.traverse((o) => { if (o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const bones = {};
  const byName = {};
  arm.traverse((o) => { if (o.isBone) { bones[o.name.replace('mixamorig', '')] = o; byName[o.name] = o; } });
  const channels = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const node = byName[track.name.slice(0, dot)];
    const prop = track.name.slice(dot + 1);
    if (!node || !(prop in node)) continue;
    channels.push({ target: node[prop], interp: track.createInterpolant() });
  }

  const D = Math.PI / 180;
  const UP = new THREE.Vector3(0, 1, 0);
  const fwd = new THREE.Vector3();
  const side = new THREE.Vector3();
  const qSpace = new THREE.Quaternion();

  // ------------------------------------------------------------ armature space
  const _amInv = new THREE.Matrix4(), _bm = new THREE.Matrix4();
  const _tp = new THREE.Vector3(), _ts = new THREE.Vector3();
  const _qd = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
  const _id = new THREE.Quaternion();
  const _rax = new THREE.Vector3(), _ax = new THREE.Vector3();
  const armBegin = () => { arm.updateWorldMatrix(true, true); _amInv.copy(arm.matrixWorld).invert(); };
  const posA = (obj, out) => out.setFromMatrixPosition(_bm.multiplyMatrices(_amInv, obj.matrixWorld));
  const quatA = (obj, out) => { _bm.multiplyMatrices(_amInv, obj.matrixWorld); _bm.decompose(_tp, out, _ts); return out; };
  const toA = (pointWorld, out) => out.copy(pointWorld).applyMatrix4(_amInv);
  const dirA = (dirWorld, out) => out.copy(dirWorld).transformDirection(_amInv);
  // rotate a bone about an axis given in armature space
  const rotA = (bone, axisA, rad) => {
    quatA(bone.parent, _qp);
    _rax.copy(axisA).applyQuaternion(_qp.invert()).normalize();
    _qd.setFromAxisAngle(_rax, rad);
    bone.quaternion.premultiply(_qd);
    bone.updateMatrixWorld(true);
  };
  // turn a bone so that a direction it carries (fromA) points along toA (armature space)
  const aimA = (bone, fromA, toAv, w) => {
    _qd.setFromUnitVectors(fromA, toAv);
    if (w < 1) _qd.slerp(_id, 1 - w);
    quatA(bone, _qw);
    quatA(bone.parent, _qp);
    _qw.premultiply(_qd);
    bone.quaternion.copy(_qp.invert().multiply(_qw));
    bone.updateMatrixWorld(true);
  };

  const turn = (name, axisSpace, deg) => {
    const b = bones[name];
    if (!b || Math.abs(deg) < 1e-4) return;
    _ax.copy(axisSpace).applyQuaternion(qSpace);           // space -> world
    rotA(b, dirA(_ax, _ax), deg * D);                      // world -> armature
  };

  // ------------------------------------------------------------ IK
  const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _W = new THREE.Vector3();
  const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _el = new THREE.Vector3(), _T = new THREE.Vector3(), _P = new THREE.Vector3();
  const _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _tw = new THREE.Vector3();
  const poleMem = {};
  // the classic two-bone solve, all points in armature space; `tip` gives the
  // current end point (armature space) after each change
  const solve2 = (key, upper, lower, tip, targetA, poleA, weight) => {
    posA(upper, _S); posA(lower, _E); tip(_W);
    const L1 = _S.distanceTo(_E), L2 = _E.distanceTo(_W);
    _u.subVectors(targetA, _S);
    const d = Math.min(Math.max(_u.length(), Math.abs(L1 - L2) + 1e-6), (L1 + L2) * 0.999);
    _u.normalize();
    _T.copy(_S).addScaledVector(_u, d);
    _v.subVectors(poleA, _S);
    _v.addScaledVector(_u, -_v.dot(_u));
    // if the pole lines up with the reach its side is undefined: keep the last one
    const lastV = poleMem[key] || (poleMem[key] = new THREE.Vector3());
    if (_v.lengthSq() > 1e-12) { _v.normalize(); lastV.copy(_v); } else _v.copy(lastV);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    _el.copy(_S).addScaledVector(_u, a).addScaledVector(_v, h);
    aimA(upper, _d1.subVectors(_E, _S).normalize(), _d2.subVectors(_el, _S).normalize(), weight);
    posA(lower, _E); tip(_W);
    aimA(lower, _d1.subVectors(_W, _E).normalize(), _d2.subVectors(_T, _E).normalize(), weight);
  };
  // wrist -> target (world), elbow towards the pole (world)
  const reach = (sideName, target, weight, pole) => {
    if (!(weight > 0)) return;
    const upper = bones[sideName + 'Arm'], lower = bones[sideName + 'ForeArm'], hand = bones[sideName + 'Hand'];
    if (!upper || !lower || !hand) return;
    armBegin();
    toA(target, _tw);
    toA(pole, _P);
    solve2('w' + sideName, upper, lower, (out) => posA(hand, out), _tw.clone(), _P.clone(), weight);
  };
  // the end point is something the hand holds (tipWorld fills a world point):
  // the wrist keeps its angle and the arm puts that point on the target
  const _tipW = new THREE.Vector3();
  const reachTip = (sideName, tipWorld, target, pole) => {
    const upper = bones[sideName + 'Arm'], lower = bones[sideName + 'ForeArm'];
    if (!upper || !lower) return;
    armBegin();
    const tA = toA(target, new THREE.Vector3()), pA = toA(pole, new THREE.Vector3());
    solve2('t' + sideName, upper, lower, (out) => toA(tipWorld(_tipW), out), tA, pA, 1);
  };

  // turn the hand at the wrist so that one of its bones (a fingertip) points at a target
  const aimHand = (sideName, target, tipName, weight = 1, maxDeg = 35) => {
    const hand = bones[sideName + 'Hand'], tipB = bones[tipName];
    if (!hand || !tipB || !(weight > 0)) return;
    armBegin();
    posA(hand, _S); posA(tipB, _W); toA(target, _T);
    _d1.subVectors(_W, _S).normalize();
    _d2.subVectors(_T, _S).normalize();
    // a wrist only bends so far: past maxDeg the hand would look broken
    const ang = Math.acos(Math.min(1, Math.max(-1, _d1.dot(_d2))));
    const lim = maxDeg * D;
    aimA(hand, _d1, _d2, ang > lim ? weight * lim / ang : weight);
  };

  // rotate one bone about an axis given in world space (degrees)
  const rotateBone = (name, axisWorld, deg) => {
    const bone = bones[name];
    if (!bone || Math.abs(deg) < 1e-4) return;
    armBegin();
    rotA(bone, dirA(axisWorld, _ax), deg * D);
  };

  // close the fingers of a hand (0 = as in the clip, 1 = a fist)
  const _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _acr = new THREE.Vector3();
  const _fn = new THREE.Vector3(), _fax = new THREE.Vector3(), _fdir = new THREE.Vector3();
  const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
  const BEND = [62, 92, 66], THUMB = [18, 34, 30];
  const bendBone = (bone, child, across, flip, deg) => {
    posA(bone, _fa); posA(child, _fb);
    _fdir.subVectors(_fb, _fa).normalize();
    _fn.crossVectors(_fdir, across);
    if (flip) _fn.negate();
    _fax.crossVectors(_fdir, _fn).normalize();
    rotA(bone, _fax, deg * D);
  };
  const curl = (sideName, amount, thumb = amount * 0.7, per = null) => {
    if (!(amount > 0) && !per) return;
    const h = sideName + 'Hand';
    const i1 = bones[h + 'Index1'], p1 = bones[h + 'Pinky1'];
    if (!i1 || !p1 || !bones[h]) return;
    armBegin();
    posA(i1, _fa); posA(p1, _fb);
    _acr.subVectors(_fa, _fb).normalize();      // across the palm, towards the thumb
    const flip = sideName === 'Right';            // right-handed maths: the right palm needs the other sign
    for (const f of FINGERS) {
      const a = per && per[f] !== undefined ? per[f] : amount;   // e.g. { Index: 0 } to point
      if (!(a > 0)) continue;
      for (let j = 1; j <= 3; j++) {
        const bone = bones[h + f + j], child = bones[h + f + (j + 1)];
        if (bone && child) bendBone(bone, child, _acr, flip, BEND[j - 1] * a);
      }
    }
    if (thumb > 0) for (let j = 1; j <= 3; j++) {
      const bone = bones[h + 'Thumb' + j], child = bones[h + 'Thumb' + (j + 1)];
      if (bone && child) bendBone(bone, child, _acr, flip, THUMB[j - 1] * thumb);
    }
  };

  return {
    pivot,
    armature: arm,
    bones,
    reach,
    reachTip,
    aimHand,
    rotateBone,
    curl,
    // world position of a bone (for props held in the hands)
    bonePos(name, out) { return bones[name].getWorldPosition(out); },
    // shoulder->elbow + elbow->wrist, in world units
    armLength(sideName) {
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      pivot.updateMatrixWorld(true);
      bones[sideName + 'Arm'].getWorldPosition(a); bones[sideName + 'ForeArm'].getWorldPosition(b); bones[sideName + 'Hand'].getWorldPosition(c);
      return a.distanceTo(b) + b.distanceTo(c);
    },
    // clipTime: sample of the waving clip; then the procedural layers
    pose(clipTime, layers = {}) {
      for (const c of channels) c.target.fromArray(c.interp.evaluate(clipTime));
      pivot.updateMatrixWorld(true);
      space.getWorldQuaternion(qSpace);
      armBegin();
      const yawNow = pivot.rotation.y;
      fwd.set(Math.cos(yawNow), 0, -Math.sin(yawNow));
      side.crossVectors(UP, fwd).normalize();
      const L = layers;
      if (L.lookUp) {
        turn('Spine2', side, -6 * L.lookUp);
        turn('Neck', side, -16 * L.lookUp);
        turn('Head', side, -18 * L.lookUp);
      }
      if (L.lookSide) turn('Head', UP, L.lookSide);
      if (L.lookDown) { turn('Neck', side, 12 * L.lookDown); turn('Head', side, 14 * L.lookDown); }
      if (L.lean) { turn('Spine', side, L.lean * 0.4); turn('Spine1', side, L.lean * 0.3); turn('Spine2', side, L.lean * 0.3); }
      if (L.sway) { turn('Spine', fwd, L.sway); turn('Spine2', fwd, L.sway * 0.6); }
      if (L.armsBack) { turn('LeftArm', side, L.armsBack); turn('RightArm', side, L.armsBack); }
      if (L.leftArmUp) turn('LeftArm', fwd, -L.leftArmUp);
      if (L.brace) { turn('LeftUpLeg', fwd, -L.brace); turn('RightUpLeg', fwd, L.brace); turn('LeftLeg', side, L.brace * 0.8); turn('RightLeg', side, L.brace * 0.8); }
      if (L.extra) for (const [n, ax, deg] of L.extra) turn(n, ax === 'side' ? side : ax === 'fwd' ? fwd : UP, deg);
    },
  };
}

// plain deep clone of a static group that shares materials (boat, furniture)
export function cloneStatic(source) {
  return source.clone(true);
}
