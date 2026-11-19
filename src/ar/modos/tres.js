// amAr · modo 3D: una escena en el lugar, sin camara, para girarla con el dedo o el mouse.

import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';
import { iluminar } from '../escena.js';

export async function arrancar({ renderer, est, escena, ui }) {
  ui.hud(true); ui.listo(); ui.estado('cargando...'); ui.sinReubicar();
  renderer.setClearColor(0xf4f5f7, 1);
  const tres = new THREE.Scene(); tres.add(est.raiz); est.reproducir(); iluminar(tres, renderer);
  const camara = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 1000);
  const alto = Math.max(est.caja.max.y, 0.5), centro = new THREE.Vector3(0, alto * 0.5, 0);
  // se encuadra por el tamaño entero del modelo, no solo por su alto: un auto de 1,4 m de alto mide 3,6 de largo
  const tam = est.caja.getSize(new THREE.Vector3()), medida = Math.max(alto, tam.x * 0.75, tam.z * 0.75);
  const lejos = (medida * 0.62) / Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) / Math.min(1, camara.aspect) * 1.15;
  camara.position.set(lejos * 0.45, alto * 0.75, lejos * 0.9);
  tres.add(new THREE.GridHelper(Math.max(4, medida * 2.5), 20, 0xc9ccd2, 0xe3e5ea));
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.target.copy(centro); controles.enableDamping = true; controles.autoRotate = true; controles.autoRotateSpeed = 0.8; controles.maxPolarAngle = Math.PI * 0.52;
  controles.addEventListener('start', () => { controles.autoRotate = false; });
  ui.estado(escena.titulo + ' · ' + alto.toFixed(1) + ' m de alto', 'ok');
  ui.salir(() => { est.detener(); location.reload(); });
  window.addEventListener('resize', () => { camara.aspect = window.innerWidth / window.innerHeight; camara.updateProjectionMatrix(); });
  const reloj = new THREE.Clock();
  renderer.setAnimationLoop(() => { est.actualizar(Math.min(reloj.getDelta(), 0.1), camara); controles.update(); renderer.render(tres, camara); });
}
