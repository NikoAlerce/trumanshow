// amAr · modo WebXR: realidad aumentada con ARCore (Android, Chrome), para las escenas en el lugar.
// El contenido se posa en el piso a la distancia y rumbo configurados desde donde esta el visitante;
// queda clavado ahi (anclado al mundo por ARCore); un toque en el piso lo reubica; REUBICAR lo pone adelante.

import * as THREE from 'three';
import { iluminar } from '../escena.js';

// CHROME SOLO ABRE LA AR EN EL INSTANTE DEL TOQUE (activacion del usuario): si antes se pide la pantalla completa
// (que gasta esa activacion) o se espera a cargar el modelo, la rechaza y la pieza caia sin camara. Por eso la
// pieza llama a pedirSesion() en el mismo toque, con el modulo y la escena ya preparados, y le pasa la promesa.
export function pedirSesion(raizHud) {
  // con un cubo en la escena se pide ademas la profundidad del lugar (ARCore, donde la hay): lo que esta delante lo tapa
  // (?oclusion=0 no la pide: para comparar cuanto cuesta)
  const conCubo = !!(window.amar && window.amar.escena && (window.amar.escena.contenidos || []).some((c) => c.tipo === 'cubo'))
    && new URLSearchParams(location.search).get('oclusion') !== '0';
  const opciones = { requiredFeatures: ['hit-test'], optionalFeatures: ['local-floor', 'dom-overlay', 'light-estimation'], domOverlay: { root: raizHud } };
  if (conCubo) { opciones.optionalFeatures.push('depth-sensing'); opciones.depthSensing = { usagePreference: ['cpu-optimized'], dataFormatPreference: ['luminance-alpha', 'float32'] }; }
  return navigator.xr.requestSession('immersive-ar', opciones);
}

export async function arrancar({ renderer, est, escena, ui, sesion: pedida }) {
  ui.hud(true); ui.estado('abriendo la cámara...');
  let sesion;
  try {
    sesion = await (pedida || pedirSesion(ui.raizHud));
  } catch (e) { ui.hud(false); const x = new Error('no se pudo abrir la realidad aumentada: ' + (e.message || e)); x.activacion = /SecurityError|NotAllowedError/.test(e && e.name) || /activation|gesture/i.test(String(e && e.message)); throw x; }
  const conPiso = !sesion.enabledFeatures || sesion.enabledFeatures.includes('local-floor');
  // la escena y su luz de ambiente se arman antes de entrar a la sesion (el PMREM dibuja en texturas propias)
  const tres = new THREE.Scene(); tres.add(est.raiz); est.raiz.visible = false; iluminar(tres, renderer);
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType(conPiso ? 'local-floor' : 'local');
  // con un cubo, la sesion se dibuja al 90 % de la resolucion: sus caras ya llegan a menos resolucion (el modo liviano) y
  // la imagen de la camara la pone el telefono aparte, a la suya. Un cuadro mas liviano, casi sin diferencia a la vista
  if ((escena.contenidos || []).some((c) => c.tipo === 'cubo')) renderer.xr.setFramebufferScaleFactor(0.9);
  await renderer.xr.setSession(sesion);
  est.reproducir();
  let fuente = null, ultimoHit = null, ultimoHorizontal = false, puesto = false, cuadros = 0;
  // EL PISO (Niko, 15/10: "tarda bastante en encontrar el piso" y "no esta bien apoyado"):
  //  1) aparece enseguida: con el telefono ubicado (unos 20 cuadros, medio segundo) se posa donde se estima el piso
  //     (el piso de local-floor, o 1,4 m debajo del telefono), sin esperar a que ARCore encuentre superficies
  //  2) se asienta en el piso DE DEBAJO del modelo: las lecturas horizontales que caen cerca de su huella (y debajo del
  //     telefono) mandan; la primera lo lleva arriba o abajo, despues solo puede bajar (una mesa al costado no lo sube)
  //  3) mientras no haya lecturas cerca, la superficie horizontal mas baja vista en cualquier lado (la primera, en
  //     cualquier sentido; despues solo para abajo)
  //  el cambio de altura es suave, sin saltos
  let pisoGlobal = Infinity, pisoLocal = Infinity, metaY = null, globalUsado = false;
  const _q = new THREE.Quaternion(), _n = new THREE.Vector3();
  const radioHuella = () => { const t = est.caja.getSize(new THREE.Vector3()); return Math.max(1.0, Math.max(t.x, t.z) * 0.7); };
  try { fuente = await sesion.requestHitTestSource({ space: await sesion.requestReferenceSpace('viewer') }); } catch (e) { console.warn('sin hit-test', e); }
  ui.listo();
  const reloj = new THREE.Clock(), camPos = new THREE.Vector3(), camDir = new THREE.Vector3(), arriba = new THREE.Vector3(0, 1, 0);
  function poner(enPunto) {
    const cam = renderer.xr.getCamera(); cam.getWorldPosition(camPos); cam.getWorldDirection(camDir);
    camDir.y = 0; if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, -1); camDir.normalize();
    if (escena.rumbo_grados) camDir.applyAxisAngle(arriba, THREE.MathUtils.degToRad(-escena.rumbo_grados));
    const d = escena.distancia_m || 3;
    const estimado = Number.isFinite(pisoGlobal) ? pisoGlobal : (conPiso ? 0 : camPos.y - 1.4);
    const tocado = enPunto && ultimoHit;
    const destino = tocado ? ultimoHit.clone() : new THREE.Vector3(camPos.x + camDir.x * d, 0, camPos.z + camDir.z * d);
    destino.y = tocado && ultimoHorizontal ? ultimoHit.y : estimado;
    est.raiz.position.copy(destino);
    est.raiz.rotation.y = Math.atan2(camPos.x - destino.x, camPos.z - destino.z);
    metaY = destino.y; pisoLocal = tocado && ultimoHorizontal ? ultimoHit.y : Infinity;
    est.raiz.visible = true; puesto = true;
  }
  sesion.addEventListener('select', () => { if (!(window.amar && window.amar.cuboGira)) poner(!!ultimoHit); });   // con un cubo el dedo lo gira: se mueve con REUBICAR
  ui.reubicar(() => poner(false));
  ui.salir(() => { try { sesion.end(); } catch (e) {} });
  sesion.addEventListener('end', () => { renderer.setAnimationLoop(null); renderer.xr.enabled = false; est.detener(); location.reload(); });
  // LA PROFUNDIDAD DEL LUGAR, si la sesion la dio (ARCore, en los telefonos que la miden): un cubo la usa para que lo
  // que esta delante (una persona) lo tape. Se lee en la memoria (cpu-optimized), cuadro a cuadro
  let conProf = false, formatoProf = '';
  try { conProf = sesion.depthUsage === 'cpu-optimized'; formatoProf = sesion.depthDataFormat; } catch (e) { /* la sesion no tiene profundidad */ }
  console.log('amAr: profundidad del lugar', conProf ? 'sí (' + formatoProf + ')' : 'no');
  ui.tecnico('profundidad: ' + (conProf ? 'sí, ' + formatoProf : 'no'));
  renderer.setAnimationLoop((t, frame) => {
    const dt = Math.min(reloj.getDelta(), 0.1);
    if (conProf && frame && est.profundidad) {
      let info = null;
      try {
        const ref0 = renderer.xr.getReferenceSpace(), pose = ref0 && frame.getViewerPose(ref0);
        const d = pose && pose.views.length ? frame.getDepthInformation(pose.views[0]) : null;
        if (d) info = { width: d.width, height: d.height, data: d.data, rawValueToMeters: d.rawValueToMeters, normDepthBufferFromNormView: d.normDepthBufferFromNormView, formato: formatoProf };
      } catch (e) { /* este cuadro, sin profundidad */ }
      est.profundidad(info);
    }
    const cam = renderer.xr.getCamera(); est.actualizar(dt, cam);
    const ref = renderer.xr.getReferenceSpace();
    if (frame && ref && frame.getViewerPose(ref)) cuadros++;
    if (frame && fuente && ref) {
      const r = frame.getHitTestResults(fuente);
      if (r.length) {
        const p = r[0].getPose(ref);
        if (p) {
          ultimoHit = new THREE.Vector3(p.transform.position.x, p.transform.position.y, p.transform.position.z);
          const o = p.transform.orientation; _q.set(o.x, o.y, o.z, o.w); _n.set(0, 1, 0).applyQuaternion(_q);
          cam.getWorldPosition(camPos);
          // horizontal (mira para arriba) y al menos 30 cm debajo del telefono: un piso posible
          ultimoHorizontal = _n.y > 0.85 && camPos.y - ultimoHit.y > 0.3;
          if (ultimoHorizontal) {
            if (ultimoHit.y < pisoGlobal) pisoGlobal = ultimoHit.y;
            if (puesto) {
              const dx = ultimoHit.x - est.raiz.position.x, dz = ultimoHit.z - est.raiz.position.z, rh = radioHuella();
              if (dx * dx + dz * dz < rh * rh) {
                if (!Number.isFinite(pisoLocal) || ultimoHit.y < pisoLocal - 0.01) pisoLocal = ultimoHit.y;
                metaY = pisoLocal;
              } else if (!Number.isFinite(pisoLocal)) {
                if (!globalUsado) { metaY = pisoGlobal; globalUsado = true; } else if (pisoGlobal < metaY - 0.02) metaY = pisoGlobal;
              }
            }
          }
        }
      }
    }
    if (!puesto && cuadros >= 20) poner(false);
    if (puesto && metaY !== null) est.raiz.position.y += (metaY - est.raiz.position.y) * Math.min(1, dt * 8);
    renderer.render(tres, cam);
  });
}
