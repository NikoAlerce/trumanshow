// A world seen through the TOP or BOTTOM face of the cube, built in a "window
// frame": the face is the plane z = 0, +z points out of the cube towards the
// viewer, +y is that world's up. The scene is fixed to its face, like a picture
// in a frame: turn the cube and the scene turns with it. Its up is the cube's
// back edge on the top face and the front edge on the bottom face, so it reads
// upright when you tip your view over the cube from the front. Everything inside
// must stay at z <= 0, i.e. behind the face.

export function createFaceFrame(THREE, { root, face, name }) {
  const world = new THREE.Group();          // root child (one per cube face)
  world.name = name;
  root.add(world);
  const frame = new THREE.Group();          // the window frame described above
  world.add(frame);
  const sgn = face === 'top' ? 1 : -1;
  frame.position.set(0, 0.5 * sgn, 0);
  frame.rotation.order = 'YXZ';
  frame.rotation.x = -sgn * Math.PI / 2;
  frame.updateMatrixWorld(true);

  return {
    world,
    frame,
    // kept for the callers: the frame no longer follows the camera
    orient() {},
  };
}
