// amAr · modo ventana: la camara de fondo y el giroscopio para mirar alrededor. No sigue los pasos
// (no hay rastreo de posicion): es lo que queda en un telefono sin ARCore y sin 8th Wall.

import * as THREE from 'three';

export async function arrancar({ renderer, est, escena, ui, video }) {
  ui.hud(true); ui.estado('abriendo la cámara...');
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const p = await DeviceOrientationEvent.requestPermission(); if (p !== 'granted') throw new Error('sin giroscopio'); }
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
    video.style.display = 'block'; await video.play();
  } catch (e) { ui.hud(false); throw new Error('no se pudo usar la cámara o el giroscopio: ' + (e.message || e)); }
  const tres = new THREE.Scene(); tres.add(est.raiz); est.reproducir();
  const camara = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 300);
  camara.position.set(0, 1.5, 0);
  const q = new THREE.Quaternion(), base = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2), e = new THREE.Euler(), qP = new THREE.Quaternion(), ejeZ = new THREE.Vector3(0, 0, 1);
  let rumbo = null;
  function ubicar() {
    const d = escena.distancia_m || 3, r = rumbo + THREE.MathUtils.degToRad(escena.rumbo_grados || 0);
    est.raiz.position.set(Math.sin(r) * d, 0, -Math.cos(r) * d);
    est.raiz.rotation.y = r + Math.PI;
  }
  function orientar(ev) {
    if (ev.alpha == null) return;
    const pantalla = THREE.MathUtils.degToRad((screen.orientation && screen.orientation.angle) || window.orientation || 0);
    e.set(THREE.MathUtils.degToRad(ev.beta), THREE.MathUtils.degToRad(ev.alpha), -THREE.MathUtils.degToRad(ev.gamma), 'YXZ');
    q.setFromEuler(e); q.multiply(base); q.multiply(qP.setFromAxisAngle(ejeZ, -pantalla));
    camara.quaternion.copy(q);
    if (rumbo == null) { const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(q); rumbo = Math.atan2(dir.x, -dir.z); ubicar(); }
  }
  window.addEventListener('deviceorientation', orientar, true);
  ui.listo(); ui.estado(escena.titulo + ' · girá el teléfono para encontrarlo · REUBICAR lo pone adelante', 'ok');
  ui.reubicar(() => { rumbo = null; });
  ui.salir(() => { window.removeEventListener('deviceorientation', orientar, true); if (video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop()); est.detener(); location.reload(); });
  window.addEventListener('resize', () => { camara.aspect = window.innerWidth / window.innerHeight; camara.updateProjectionMatrix(); });
  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => { est.actualizar(Math.min(reloj.getDelta(), 0.1), camara); renderer.render(tres, camara); });
}
