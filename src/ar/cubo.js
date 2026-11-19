// amAr · el cubo: una caja de seis ventanas, y detras de cada cara un mundo distinto.
//
// Es el "EJX Cube" de EyeJack hecho en casa (la pieza Truman Show · EJX Cube): su contenido tal como sale de su
// build (la carpeta content/: app.json, scene.bin, ejx.json, tex/, lib/) y esto, que hace lo que hacia el
// reproductor de EyeJack: lo carga y en cada cara dibuja su mundo.
//
// COMO SE VE UN MUNDO A TRAVES DE UNA CARA. Justo antes de dibujarse, cada cara dibuja su mundo con la misma camara en
// una textura (como los espejos de three.js) y despues la muestra calzada pixel a pixel: se ve el mundo a traves del
// vidrio. No les pide nada a los modos: anda igual en WebXR, 8th Wall, ventana y 3D.
// El mundo se dibuja donde el contenido lo espera, como en el reproductor de EyeJack: el cubo mide 1 y esta en el
// origen (sus sombreadores pasan al espacio del contenido deshaciendo solo el giro). Lo que se mueve es la camara: se
// la lleva al espacio del cubo, rigida y con la posicion dividida por el lado, que da la misma imagen.
//
// EL RENDERER. El cubo se arma con el renderer que lo va a dibujar (sus texturas, su luz de ambiente y sus sombreadores
// viven en ese contexto): en WebXR, 3D y ventana, el de la pieza, antes del toque; con 8th Wall (y en el editor), el
// que lo dibuja, en su primer cuadro, mientras las caras se ven como vidrio oscuro.
//
// EL TONO. three r160 no aplica el tono de cine (ACES) al dibujar en una textura (la r151 del reproductor de EyeJack
// si): la textura de cada cara es de 16 bits (no se recortan las luces altas) y el tono se aplica al mostrarla.
//
// En la escena: { tipo: 'cubo', carpeta: 'cubo/', lado_m: 0.6, x_m, y_m (el centro, sobre el piso), z_m, giro_grados }
// (y fuentes: la carpeta de URWDIN-Demi.ttf, si no esta en carpeta + 'fonts/'; la copia del NFT usa '../fonts/')

import * as THREE from 'three';

// las caras en el orden del reproductor de EyeJack (getFaceNormals), y como se gira un plano para que mire hacia afuera
const CARAS = [
  { nombre: 'front', n: [0, 0, 1], giro: [0, 0, 0] },
  { nombre: 'right', n: [1, 0, 0], giro: [0, Math.PI / 2, 0] },
  { nombre: 'back', n: [0, 0, -1], giro: [0, Math.PI, 0] },
  { nombre: 'left', n: [-1, 0, 0], giro: [0, -Math.PI / 2, 0] },
  { nombre: 'top', n: [0, 1, 0], giro: [-Math.PI / 2, 0, 0] },
  { nombre: 'bottom', n: [0, -1, 0], giro: [Math.PI / 2, 0, 0] },
];
// cuanto avanza la barra en cada etapa del armado (las marcas de buildWorld)
const ETAPAS = { textures: 0.44, ocean: 0.5, truman: 0.52, storm: 0.55, morning: 0.58, mirror: 0.63, rain: 0.67, room: 0.69, env: 0.74 };
// EN UN TELEFONO O UNA TABLET (o con ?movil, para probarlo en la compu), EL MODO LIVIANO: las caras se dibujan a menos
// resolucion (que se ajusta sola, ver ajustar), sin antialias de cuatro muestras (en Chrome de Android cada cara pagaba
// una copia entera de la textura), las sombras de los mundos cada cuatro cuadros y en mapas de 1024, los monitores de la
// sala de control unas tres veces por segundo, y en el piso solo la sombra de contacto (sin la del sol, que se recalcula
// en cada cuadro). En una tablet, el 19/11, el cubo completo andaba a 4 cuadros por segundo y el rastreo de 8th Wall
// perdia el piso: el cubo saltaba de lugar. Medido con una placa de software del tamaño de esa tablet: 2 cuadros por
// segundo el completo, 9 el liviano solo con la resolucion, 12 a 14 con lo demas.
const MOVIL = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('movil');
const PRESUPUESTO = MOVIL ? 2.5e6 : 3.5e6;   // los pixeles de la textura de las caras, como mucho (la memoria)

// LO QUE ESTA DELANTE LO TAPA (a prueba, WebXR con ARCore): el telefono mide la profundidad del lugar y donde algo real
// (una persona) queda mas cerca que el cubo, el cubo no se dibuja. La profundidad llega en metros por pixel de la
// pantalla (uProfMat lleva de la pantalla, con el origen arriba a la izquierda, a esa imagen). ?prof=ver la pinta encima,
// en franjas de un metro, para ver si calza; ?prof_y=0 cuenta la pantalla desde abajo (si quedara dada vuelta).
const OCLUSION = /* glsl */ `
uniform float uConProf;
uniform sampler2D tProf;
uniform mat4 uProfMat;
uniform float uProfY;
uniform float uProfVer;
uniform vec4 uVista;
float profundidadReal() {
  vec2 nv = (gl_FragCoord.xy - uVista.xy) / uVista.zw;
  vec2 p = (uProfMat * vec4(nv.x, mix(nv.y, 1.0 - nv.y, uProfY), 0.0, 1.0)).xy;
  return texture2D(tProf, p).r;
}`;
// tapa: 1 donde lo real esta delante del cubo; en el borde baja de a poco (la profundidad llega interpolada)
const TAPAR = (distancia) => /* glsl */ `
  float real = uConProf > 0.5 ? profundidadReal() : 0.0;
  float tapa = real > 0.05 ? 1.0 - smoothstep(${distancia} - 0.3, ${distancia} - 0.02, real) : 0.0;
  if (tapa > 0.98) discard;`;

const caraVertex = 'varying float vDistancia;\nvoid main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vDistancia = -mv.z; gl_Position = projectionMatrix * mv; }';
const caraFragment = /* glsl */ `
varying float vDistancia;   // de la cara a la camara, en metros
${OCLUSION}
uniform sampler2D tMundo;
uniform float uListo;    // 0: vidrio oscuro, 1: el mundo
uniform vec3 uVidrio;
// el tono de cine de three.js (ACESFilmicToneMapping, MIT), con exposicion 1, como lo usaba el cubo en EyeJack
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 entrada = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 salida = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  return clamp(salida * RRTAndODTFit(entrada * (c / 0.6)), 0.0, 1.0);
}
uniform vec2 uTam;      // la textura, en pixeles
uniform vec2 uRegion;   // la parte de la textura que se dibujo en este cuadro (la resolucion cambia con el cubo en pantalla)
uniform float uSuave;   // cuanto suavizar (0: nada; 1: el filtro entero), solo con la resolucion muy baja
uniform float uNitidez; // cuanto afilar (la mascara de enfoque), con la resolucion intermedia
void main() {
${TAPAR('vDistancia')}
  vec2 uv = (gl_FragCoord.xy - uVista.xy) / uVista.zw * uRegion;   // uVista: los pixeles de este dibujo (x, y, ancho, alto)
  vec3 c = texture2D(tMundo, uv).rgb;
  // AL AGRANDAR LAS CARAS (el mundo se dibuja a menos resolucion que la pantalla): con la resolucion muy baja se suaviza
  // (el centro y cuatro muestras en diagonal a medio pixel; con el filtro lineal, una carpa de 3 x 3), asi los bordes no
  // hacen escalones; con la intermedia se afila (la misma carpa, restada: una mascara de enfoque), mas nitido que
  // agrandar a secas; a resolucion entera, nada (Niko, 19/11: "no me molestaria un poco mas de nitidez")
  if (uSuave > 0.01 || uNitidez > 0.01) {
    vec2 t = 0.5 / uTam;
    vec3 c5 = c * 0.4 + (texture2D(tMundo, uv + t).rgb + texture2D(tMundo, uv - t).rgb
           + texture2D(tMundo, uv + vec2(t.x, -t.y)).rgb + texture2D(tMundo, uv + vec2(-t.x, t.y)).rgb) * 0.15;
    c = mix(c, c5, uSuave);
    c = max(c + (c - c5) * uNitidez, 0.0);
  }
  gl_FragColor = vec4(mix(uVidrio, aces(c), uListo), 1.0);
  if (uProfVer > 0.5 && real > 0.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(fract(real), 0.4, 1.0 - fract(real)), 0.55);
  #include <colorspace_fragment>
  gl_FragColor *= 1.0 - tapa;   // (alfa premultiplicado) en el borde de lo que esta delante se ve la camara, sin escalon
}`;

export async function armarCubo(c, BASE, { progreso = () => {}, renderer = null, sombra = null } = {}) {
  const carpetaRel = c.carpeta || 'cubo/';
  const carpeta = new URL(carpetaRel, BASE);
  // si la pieza ya bajo el archivo (la barra de progreso), esa copia; si no, la direccion de siempre
  const direccion = (f) => (window.amarUrls && window.amarUrls[carpetaRel + f]) || new URL(f, carpeta).href;
  const q = new URLSearchParams(location.search);
  const fija = q.get('cubo');   // ?cubo=0.6: la resolucion de las caras, fija (para comparar); si no, se ajusta sola
  // para medir en la compu (?prueba=sombras,monitores,mundo,sol): apaga partes del trabajo de cada cuadro
  const prueba = new Set((q.get('prueba') || '').split(','));
  const calidad = Math.max(0.2, Math.min(1, +(fija || c.calidad || 1)));
  // LA RESOLUCION, SEGUN CUANTO OCUPA EL CUBO EN LA PANTALLA: en cada cuadro se reparte un presupuesto de pixeles entre
  // las caras que se ven. Lejos el cubo es chico y sus caras se dibujan nitidas; cerca ocupa toda la pantalla y se
  // dibujan a menos resolucion, asi el costo no crece al acercarse (el 19/11, en la tablet, se trababa de cerca). El
  // presupuesto se ajusta solo, para sostener unos 30 cuadros por segundo en el telefono (50 en la compu). Sube solo si
  // estaba limitando (si no, lejos crecia sin freno y al acercarse se trababa hasta volver a bajar).
  // SE AJUSTA CON LA PLACA, NO CON EL RELOJ (19/11): en un telefono el codigo iba a 60-76 cuadros por segundo mientras
  // la placa entregaba 8 a 10, y se veia a tirones; medido con el reloj de JS, el ajuste subia la resolucion y lo
  // empeoraba. Cada cuadro deja una marca (fenceSync) y se cuentan las que la placa va cumpliendo: los cuadros por
  // segundo que de verdad termina. Si termina menos de los que el codigo le manda (o menos de 28), esta saturada y el
  // presupuesto baja; si los termina todos con holgura, sube. (Contar cuantos cuadros atras iba no servia: en Android la
  // placa siempre trabaja dos o tres cuadros detras del codigo aunque ande perfecto, y el ajuste lo dejaba todo borroso.)
  // (en el telefono: hasta la resolucion entera cuando el cubo se ve chico, y hasta 900 mil pixeles si la placa da)
  const K_MAX = 1, K_MIN = 0.2, META_FPS = MOVIL ? 28 : 45;
  const P_MIN = MOVIL ? 5e4 : 1e6, P_MAX = MOVIL ? 9e5 : 8e6;
  let presupuesto = MOVIL ? 2.5e5 : 4e6, kCuadro = MOVIL ? 0.5 : 1, limitado = false;
  let tAjuste = 0, tInicio = 0, tLinea = 0, tVentana = 0, cumplidas = 0, mandados = 0, fpsPlaca = 60, fpsCodigo = 60;
  const marcas = [];
  function medirPlaca() {
    const gl = rendererDelMundo && rendererDelMundo.getContext(), ahora = performance.now();
    if (gl && gl.fenceSync) {
      while (marcas.length && gl.getSyncParameter(marcas[0], gl.SYNC_STATUS) === gl.SIGNALED) { gl.deleteSync(marcas.shift()); cumplidas++; }
      while (marcas.length > 20) gl.deleteSync(marcas.shift());   // muy atrasada: esas ya no cuentan
      marcas.push(gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0));
    } else cumplidas++;   // sin marcas (WebGL 1): se la supone al dia
    mandados++;
    if (!tVentana) tVentana = ahora;
    const s = (ahora - tVentana) / 1000;
    if (s >= 0.5) {   // cada medio segundo, promediado con lo anterior
      fpsPlaca += (cumplidas / s - fpsPlaca) * 0.5; fpsCodigo += (mandados / s - fpsCodigo) * 0.5;
      cumplidas = 0; mandados = 0; tVentana = ahora;
    }
  }
  // ?debug=1: una linea en la pantalla con lo que cuesta cada cuadro (para medir en el telefono). Va adentro del hud: en
  // WebXR es lo unico de la pagina que se ve
  const cuenta = { caras: 0, dibujos: 0, triangulos: 0 }, ultima = { caras: 0, dibujos: 0, triangulos: 0 };
  let lineaDebug = null;
  if (q.has('debug')) {
    lineaDebug = document.createElement('div');
    lineaDebug.style.cssText = 'position:absolute;left:10px;bottom:10px;z-index:9;color:#fff;font:12px/1.45 ui-monospace,Menlo,monospace;background:rgba(0,0,0,.6);padding:5px 9px;border-radius:7px;pointer-events:none;white-space:pre';
    (document.getElementById('hud') || document.body).appendChild(lineaDebug);
  }
  function ajustar() {
    const ahora = performance.now();
    if (!tInicio) tInicio = ahora;
    medirPlaca();
    if (window.amar) window.amar.cubo = { fps: Math.round(fpsCodigo), placa: Math.round(fpsPlaca), resolucion: +kCuadro.toFixed(2), presupuesto: Math.round(presupuesto / 1e3), movil: MOVIL, orientacion: cubo.quaternion.toArray().map((x) => +x.toFixed(3)), ...ultima };
    if (lineaDebug && ahora - tLinea > 500) {
      tLinea = ahora;
      lineaDebug.textContent = 'código ' + Math.round(fpsCodigo) + ' · placa ' + Math.round(fpsPlaca) + ' cuadros/s · resolución ' + kCuadro.toFixed(2) + (MOVIL ? ' · liviano' : '') + String.fromCharCode(10)
        + ultima.caras + ' caras · ' + ultima.dibujos + ' dibujos · ' + Math.round(ultima.triangulos / 1000) + ' mil triángulos' + String.fromCharCode(10)
        + 'profundidad: ' + (occ.uConProf.value ? 'sí' : 'no') + ' · presupuesto ' + Math.round(presupuesto / 1000) + ' mil px';
    }
    // los primeros dos segundos no cuentan (las primeras sombras y texturas siempre tardan)
    if (fija || ahora - tInicio < 2000) return;
    // (entre una y otra, un margen: con la realidad aumentada a 30 cuadros por segundo no oscila arriba y abajo)
    const saturada = fpsPlaca < fpsCodigo * 0.85 || fpsPlaca < META_FPS - 3;
    const holgada = fpsPlaca >= fpsCodigo * 0.92 && fpsPlaca >= META_FPS;
    if (saturada && ahora - tAjuste > 400) { tAjuste = ahora; presupuesto = Math.max(P_MIN, presupuesto * (fpsPlaca < META_FPS * 0.6 ? 0.65 : 0.85)); }
    else if (holgada && limitado && ahora - tAjuste > 600) { tAjuste = ahora; presupuesto = Math.min(P_MAX, presupuesto * 1.15); }
  }

  // ------------------------------------------------------------ lo que se ve en el lugar: la caja y su sombra
  // EN DIAMANTE (pose: 'diamante'): parado sobre una punta, con la diagonal del cubo vertical. Las tres caras de arriba
  // miran un poco hacia arriba y las tres de abajo un poco hacia abajo (35 grados): caminando alrededor se ven las seis,
  // sin agacharse ni subirse. Las escenas siguen fijas a sus caras, asi que se inclinan con ellas.
  const diamante = c.pose === 'diamante';
  const raiz = new THREE.Group(); raiz.name = 'cubo:' + carpetaRel;
  raiz.position.set(c.x_m || 0, c.y_m == null ? (diamante ? 1.3 : 1.1) : c.y_m, c.z_m || 0);
  // de frente al visitante, la cara del final (EXIT): derecho -66 (con la tormenta asomando); en diamante -105 (con la
  // playa y la mañana a los costados, abajo)
  raiz.rotation.y = THREE.MathUtils.degToRad(c.giro_grados == null ? (diamante ? -105 : -66) : c.giro_grados);
  const cubo = new THREE.Group(); cubo.name = 'caja'; raiz.add(cubo);
  if (diamante) cubo.quaternion.setFromUnitVectors(new THREE.Vector3(1, 1, 1).normalize(), new THREE.Vector3(0, 1, 0));
  // LAS ESCENAS, DERECHAS (en diamante; Niko, 19/11: "quiero que las escenas siempre se vean derecho"): cada cara queda
  // inclinada y con una punta para arriba, y su escena se veia girada e inclinada con ella. Ahora cada mundo queda
  // vertical de verdad (su arriba, el de la gravedad) y se lo mira de frente, en horizontal, a traves de la cara: como
  // por una ventana inclinada. Por cara: el giro que lleva "mirar hacia adentro" de la escena a la horizontal de su cara y
  // su arriba a la vertical, y el agrandado justo para que la ventana, vista asi, quede adentro del cuadrado de la escena
  // (sin mostrar lo que hay mas alla de sus bordes: la calle cortada, las paredes del cuarto). La ventana sigue fija a la
  // cara: lo que se acomoda es el mundo de atras. Con escenas: 'fijas' quedan como antes, inclinadas con el cubo.
  const derechas = diamante && c.escenas !== 'fijas';
  const ARRIBA_ESCENA = { front: [0, 1, 0], right: [0, 1, 0], back: [0, 1, 0], left: [0, 1, 0], top: [0, 0, -1], bottom: [0, 0, 1] };   // (faceframe.js)
  // del contenido al espacio del cubo, cara por cara (se rehace cada vez que el cubo gira: ver acomodarMundos)
  const AJUSTE = CARAS.map(() => new THREE.Matrix4());
  const CARA_EJES = CARAS.map((d) => {
    const n = new THREE.Vector3(d.n[0], d.n[1], d.n[2]), v = n.clone().negate();   // v: hacia adentro de la escena
    const u = new THREE.Vector3(...ARRIBA_ESCENA[d.nombre]), s = new THREE.Vector3().crossVectors(v, u);
    const ejes = d.n[0] !== 0 ? [0, 1, 2] : d.n[1] !== 0 ? [1, 0, 2] : [2, 0, 1], esquinas = [];
    for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) { const p = [0, 0, 0]; p[ejes[0]] = d.n[ejes[0]] * 0.5; p[ejes[1]] = a; p[ejes[2]] = b; esquinas.push(new THREE.Vector3(p[0], p[1], p[2])); }
    return { n, u, v, centro: n.clone().multiplyScalar(0.5), esquinas, base: new THREE.Matrix4().makeBasis(v, u, s).transpose(), rumbo: null };
  });
  const _Rv = new THREE.Vector3(), _h = new THREE.Vector3(), _t = new THREE.Vector3(), _e = new THREE.Vector3(), _Rc = new THREE.Vector3();
  const _qi = new THREE.Quaternion(), _Q = new THREE.Matrix4(), _A = new THREE.Matrix4(), _Y = new THREE.Vector3(0, 1, 0);
  const _qA = new THREE.Quaternion(), _qB = new THREE.Quaternion(), _up = new THREE.Vector3(), _w = new THREE.Vector3(), _qc = new THREE.Quaternion();
  let camActual = null;   // la camara del ultimo cuadro (el arriba de la pantalla, el giro con el dedo)
  // con la orientacion de ahora, cada cara:
  //  - de costado (lo normal): su mundo vertical, mirado en la horizontal de la cara (su rumbo) y agrandado lo justo para
  //    que la ventana, vista asi, quede adentro de su escena. El rumbo gira de a poco: al pasar una cara por arriba o por
  //    abajo su horizontal da media vuelta, y el mundo daba un salto
  //  - mirando arriba o abajo (girando el cubo con el dedo): un mundo vertical detras de una ventana horizontal se veia
  //    negro (se miraba hacia donde no hay nada). Ahi la escena va pegada a su cara, como fue hecha, y girada dentro de
  //    ella para que su arriba sea el de la pantalla: mirandola desde arriba se lee derecha
  //  - entre una y otra, mezcladas, sin saltos
  function acomodarMundos(dt) {
    if (!derechas) return;
    const R = cubo.quaternion;
    _qi.copy(R).invert();
    // el arriba de la pantalla, en el espacio del cubo
    if (camActual) { _up.setFromMatrixColumn(camActual.matrixWorld, 1); cubo.getWorldQuaternion(_qc).invert(); _up.applyQuaternion(_qc); } else _up.set(0, 1, 0).applyQuaternion(_qi);
    CARA_EJES.forEach((f, i) => {
      _Rv.copy(f.v).applyQuaternion(R);
      let meta = f.rumbo;
      if (Math.hypot(_Rv.x, _Rv.z) > 0.2 || meta === null) meta = Math.atan2(_Rv.x, _Rv.z);   // casi vertical: se queda el que tenia
      if (f.rumbo === null || dt <= 0) f.rumbo = meta;
      else { const d = Math.atan2(Math.sin(meta - f.rumbo), Math.cos(meta - f.rumbo)); f.rumbo += d * (1 - Math.exp(-dt * 8)); }
      // de costado: vertical (giro en el espacio del cubo: R^-1 * Q)
      _h.set(Math.sin(f.rumbo), 0, Math.cos(f.rumbo)); _t.crossVectors(_h, _Y);
      _Q.makeBasis(_h, _Y, _t).multiply(f.base);
      _qA.setFromRotationMatrix(_Q).premultiply(_qi);
      _Rc.copy(f.centro).applyQuaternion(R);
      let alcance = 0.5;   // la ventana vista en horizontal: cuanto ocupa a lo ancho (_t) y a lo alto
      for (const p of f.esquinas) { _e.copy(p).applyQuaternion(R).sub(_Rc); alcance = Math.max(alcance, Math.abs(_e.dot(_t)), Math.abs(_e.y)); }
      const kA = 2 * alcance;
      // arriba o abajo: pegada a la cara, girada para que su arriba sea el de la pantalla
      _w.copy(_up).addScaledVector(f.n, -_up.dot(f.n));
      let giro = 0;
      if (_w.lengthSq() > 1e-6) { _w.normalize(); giro = Math.atan2(_e.crossVectors(f.u, _w).dot(f.n), f.u.dot(_w)); }
      _qB.setFromAxisAngle(f.n, giro);
      const kB = Math.abs(Math.cos(giro)) + Math.abs(Math.sin(giro));
      // la mezcla, segun cuanto mira la cara hacia arriba o abajo
      const m = THREE.MathUtils.smoothstep(Math.abs(_Rv.y), 0.62, 0.9);
      _qA.slerp(_qB, m);
      const k = kA + (kB - kA) * m;
      AJUSTE[i].makeTranslation(f.centro.x, f.centro.y, f.centro.z).multiply(_A.makeRotationFromQuaternion(_qA))
        .multiply(_A.makeScale(k, k, k)).multiply(_A.makeTranslation(-f.centro.x, -f.centro.y, -f.centro.z));
    });
  }
  acomodarMundos(0);
  // la oclusion (ver OCLUSION): la comparten las caras y el marco
  const occ = {
    uConProf: { value: 0 }, tProf: { value: null }, uProfMat: { value: new THREE.Matrix4() },
    uProfY: { value: q.get('prof_y') === '0' ? 0 : 1 }, uProfVer: { value: q.get('prof') === 'ver' ? 1 : 0 },
    uVista: { value: new THREE.Vector4(0, 0, 1, 1) },
  };
  let profTex = null, profPrev = null, profCuadro = -9;
  const material = new THREE.ShaderMaterial({
    uniforms: { ...occ, tMundo: { value: null }, uListo: { value: 0 }, uVidrio: { value: new THREE.Color(0x07090c) }, uTam: { value: new THREE.Vector2(1, 1) }, uRegion: { value: new THREE.Vector2(1, 1) }, uSuave: { value: 0 }, uNitidez: { value: 0 } },
    vertexShader: caraVertex, fragmentShader: caraFragment, toneMapped: false,
  });
  const plano = new THREE.PlaneGeometry(1, 1);
  CARAS.forEach((d, i) => {
    const m = new THREE.Mesh(plano, material);
    m.name = 'cara:' + d.nombre;
    m.position.set(d.n[0] * 0.5, d.n[1] * 0.5, d.n[2] * 0.5);
    m.rotation.set(d.giro[0], d.giro[1], d.giro[2]);
    m.castShadow = true;
    m.onBeforeRender = (r, escena, camara) => antesDeLaCara(r, camara, i);
    cubo.add(m);
  });
  // el marco: doce aristas blancas y finas (el borde del cubo de EyeJack), iluminadas por la luz de la escena
  const g = 0.012, marco = new THREE.MeshStandardMaterial({ color: 0xf2f2ef, roughness: 0.38, metalness: 0.05 });
  marco.onBeforeCompile = (s) => {   // tambien lo tapa lo que esta delante (vViewPosition.z: la distancia, en metros)
    Object.assign(s.uniforms, occ);
    s.fragmentShader = s.fragmentShader.replace('void main() {', OCLUSION + '\nvoid main() {\n' + TAPAR('vViewPosition.z'));
  };
  for (const eje of [0, 1, 2]) for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) {
    const t = [g, g, g]; t[eje] = 1 + g;
    const arista = new THREE.Mesh(new THREE.BoxGeometry(t[0], t[1], t[2]), marco);
    const p = [0, 0, 0], otros = [0, 1, 2].filter((k) => k !== eje); p[otros[0]] = a; p[otros[1]] = b;
    arista.position.set(p[0], p[1], p[2]); arista.castShadow = true; cubo.add(arista);
  }
  // en el piso, la sombra de contacto: mas suave cuanto mas alto flota
  const sombraPiso = sombra ? sombra(1, 1) : null;
  if (sombraPiso) raiz.add(sombraPiso);
  let lado = 0;
  const ponerLado = (l) => {
    lado = l; cubo.scale.setScalar(l);
    const abajo = raiz.position.y - l * (diamante ? Math.sqrt(3) / 2 : 0.5);   // la punta (o la cara) de abajo, sobre el piso
    if (sombraPiso) { sombraPiso.scale.set(l * (diamante ? 1.75 : 1.5), l * (diamante ? 1.75 : 1.5), 1); sombraPiso.material.opacity = THREE.MathUtils.clamp(1.15 - abajo / 1.2, 0.25, 1); }
  };
  ponerLado(c.lado_m || 0.6);
  raiz.userData.ponerLado = ponerLado;   // el editor lo agranda sin rearmar el contenido

  // ------------------------------------------------------------ el contenido: se baja y se lee sin renderer
  const bajar = async (f, como) => { const r = await fetch(direccion(f)); if (!r.ok) throw new Error(carpetaRel + f + ': ' + r.status); return como === 'texto' ? r.text() : r.arrayBuffer(); };
  progreso(0.02);
  const [texto, bin] = await Promise.all([bajar('app.json', 'texto'), bajar('scene.bin', 'bin')]);
  progreso(0.3);
  const json = JSON.parse(texto);
  const [{ decodeBinaryRefs }, { buildWorld }] = await Promise.all([import(new URL('lib/decode.js', carpeta).href), import(new URL('lib/world.js', carpeta).href)]);
  decodeBinaryRefs(json, bin);
  const loader = new THREE.ObjectLoader(); loader.setResourcePath(carpeta.href);
  const contenido = await new Promise((ok) => { let hecho = false; const o = loader.parse(json.scene, (x) => { hecho = true; ok(x); }); if (hecho) ok(o); });
  if (q.has('debug') && window.amar) window.amar.cuboContenido = contenido;   // para medir desde la consola
  progreso(0.4);

  // ------------------------------------------------------------ el mundo: con el renderer que lo dibuja
  const camCubo = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);   // la camara del visitante, en el espacio del cubo (las caras)
  // la que mira el contenido: la del visitante en el espacio del mundo de cada cara (ver AJUSTE); con ella se dibuja y se
  // calcula la niebla. camCaras: una por cara, para las escenas que miran a la camara (el espejo, la playa)
  const camMundo = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  const camCaras = CARAS.map(() => new THREE.PerspectiveCamera(50, 1, 0.01, 1000));
  let mundo = null, rendererDelMundo = null, armando = null, listo = false, mezcla = 0, detenido = false;
  let ids = [];
  const espera = (ms = 16) => new Promise((ok) => setTimeout(ok, ms));
  // en una sesion de WebXR, three cambia la camara por la del casco en cada render: para los dibujos propios, apagado
  const sinXR = (r, fn) => { const x = r.xr.enabled; r.xr.enabled = false; try { return fn(); } finally { r.xr.enabled = x; } };
  async function montar(r) {
    rendererDelMundo = r;
    r.resetState();
    const p = json.project || {};
    const porCara = { front: p.faceFront, right: p.faceRight, back: p.faceBack, left: p.faceLeft, top: p.faceTop, bottom: p.faceBottom };
    mundo = await buildWorld({
      THREE, renderer: r, camera: camMundo, root: contenido, json, base: carpeta, faces: porCara, onProgress: () => {},
      fonts: c.fuentes ? new URL(c.fuentes, BASE) : new URL('fonts/', carpeta),   // la letra del cartel EXIT (c.fuentes: su carpeta, si no esta adentro de la del cubo; en el zip de EyeJack esta al lado de content/)
      detail: MOVIL ? 0.5 : 1,   // los dos mares (113 mil y 74 mil triangulos): en el telefono, un cuarto
      mark: (n) => { const k = String(n).split(':')[0]; if (ETAPAS[k]) progreso(ETAPAS[k]); },
      // entre escena y escena: un respiro, y el estado de three de nuevo en limpio (con 8th Wall el motor dibuja en el
      // mismo contexto entre medio)
      pause: () => espera(0).then(() => r.resetState()),
    });
    ids = CARAS.map((d) => (mundo.faces || porCara)[d.nombre]);
    if (mundo.quality) mundo.quality.feedsInXR = true;   // las pantallas de Christof, en vivo tambien en la realidad aumentada
    if (mundo.quality && prueba.has('sombras')) mundo.quality.shadowEvery = 1e9;
    if (mundo.quality && prueba.has('monitores')) mundo.quality.feedEvery = 1e9;
    if (MOVIL) {   // el modo liviano: sombras cada tres cuadros y en mapas de 1024, monitores mas lentos
      if (mundo.quality) { mundo.quality.shadowEvery = Math.max(mundo.quality.shadowEvery, 4); mundo.quality.feedEvery = Math.max(mundo.quality.feedEvery || 1, 3); }
      contenido.traverse((o) => { if (o.isLight && o.shadow && o.shadow.mapSize.x > 1024) { o.shadow.mapSize.set(1024, 1024); if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } } });
      contenido.traverse((o) => { if (o.isMesh && /^Eyes/.test(o.name)) o.castShadow = false; });   // los ojos de Truman (unos 25 mil triangulos) no dan sombra que se vea
    }
    // los sombreadores: todos a la vez, compilados en paralelo sin trabar la pagina; despues tres dibujos chicos
    // (las sombras y las texturas de dos caras cada uno)
    await espera(); r.resetState();
    sinXR(r, () => mundo.warmup(0));
    const t0 = performance.now();
    for (let f = mundo.compileProgress(); f < 1 && performance.now() - t0 < 30000; f = mundo.compileProgress()) { progreso(0.76 + 0.2 * f); await espera(); }
    for (const paso of [1, 2, 3]) { await espera(); r.resetState(); sinXR(r, () => mundo.warmup(paso)); progreso(0.96 + 0.013 * paso); }
    mundo.start();
    listo = true;
    progreso(1);
  }
  if (renderer) await montar(renderer);

  // ------------------------------------------------------------ cada cuadro
  const _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _v = new THREE.Vector4(), _cc = new THREE.Color(), _p = new THREE.Vector3();
  // la camara del visitante llevada al espacio del cubo: rigida (sin escala), con la posicion dividida por el lado
  function camaraEnElCubo(cam) {
    cubo.updateWorldMatrix(true, false);
    _m.copy(cubo.matrixWorld).invert().multiply(cam.matrixWorld);
    _m.decompose(camCubo.position, camCubo.quaternion, _s);
    camCubo.scale.set(1, 1, 1);
    camCubo.updateMatrixWorld(true);
    camCubo.projectionMatrix.copy(cam.projectionMatrix);
    camCubo.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
  }
  // la camara del visitante en el espacio del mundo de la cara i (el cubo y el ajuste que pone derecha su escena)
  function camaraDeCara(i, cam, destino) {
    cubo.updateWorldMatrix(true, false);
    _m.copy(cubo.matrixWorld).multiply(AJUSTE[i]).invert().multiply(cam.matrixWorld);
    _m.decompose(destino.position, destino.quaternion, _s);
    destino.scale.set(1, 1, 1);
    destino.updateMatrixWorld(true);
    destino.projectionMatrix.copy(cam.projectionMatrix);
    destino.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
    return destino;
  }
  let rt = null;
  function textura(r, w, h) {
    if (rt && rt.width === w && rt.height === h) return rt;
    if (rt) { rt.setSize(w, h); return rt; }
    const flotante = r.capabilities.isWebGL2 && (r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float'));
    rt = new THREE.WebGLRenderTarget(w, h, { type: flotante ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: !MOVIL && r.capabilities.isWebGL2 ? 4 : 0 });
    return rt;
  }
  // las cuatro esquinas de cada cara (en el espacio del cubo), dando la vuelta
  const ESQUINAS = CARAS.map((d) => {
    const u = d.n[0] !== 0 ? [0, 1, 2] : d.n[1] !== 0 ? [1, 0, 2] : [2, 0, 1];   // el eje de la cara y los otros dos
    return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([a, b]) => { const v = [0, 0, 0]; v[u[0]] = d.n[u[0]] * 0.5; v[u[1]] = a; v[u[2]] = b; return new THREE.Vector3(v[0], v[1], v[2]); });
  });
  const _q = [0, 1, 2, 3].map(() => new THREE.Vector3()), _poli = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector3());
  // el rectangulo de la cara en la textura (w x h): sus esquinas proyectadas, y un margen. Lo que queda detras de la
  // camara se corta antes (de cerca, una esquina pasa por detras y antes se tomaba la textura entera)
  function rectangulo(i, w, h) {
    for (let k = 0; k < 4; k++) _q[k].copy(ESQUINAS[i][k]).applyMatrix4(camCubo.matrixWorldInverse);
    const z0 = -0.01;
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const a = _q[k], b = _q[(k + 1) % 4];
      if (a.z < z0) _poli[n++].copy(a);
      if ((a.z < z0) !== (b.z < z0)) _poli[n++].copy(a).lerp(b, (z0 - a.z) / (b.z - a.z));
    }
    if (!n) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const p = _poli[k].applyMatrix4(camCubo.projectionMatrix);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const px = (t, m) => (Math.max(-1, Math.min(1, t)) * 0.5 + 0.5) * m;
    const a = Math.max(0, Math.floor(px(x0, w)) - 2), b = Math.max(0, Math.floor(px(y0, h)) - 2);
    const c2 = Math.min(w, Math.ceil(px(x1, w)) + 2), d2 = Math.min(h, Math.ceil(px(y1, h)) + 2);
    return c2 > a && d2 > b ? [a, b, c2 - a, d2 - b] : null;
  }
  // la cara mira hacia la camara (del otro lado no se ve nada)
  const deFrente = (d) => { const p = camCubo.position; return d.n[0] * (p.x - d.n[0] * 0.5) + d.n[1] * (p.y - d.n[1] * 0.5) + d.n[2] * (p.z - d.n[2] * 0.5) > 0; };
  // la resolucion de este cuadro: el presupuesto repartido entre las caras que se ven. Baja rapido (al acercarse) y sube
  // despacio (sin saltos de nitidez)
  let cuadro = 0, cuadroK = -1;
  function resolucionDelCuadro(vw, vh) {
    if (fija) { kCuadro = calidad; return; }
    let area = 0;
    CARAS.forEach((d, i) => { if (ids[i] && deFrente(d)) { const r = rectangulo(i, vw, vh); if (r) area += r[2] * r[3]; } });
    const k = Math.min(K_MAX, Math.max(K_MIN, Math.sqrt(presupuesto / Math.max(1, area))));
    limitado = k < K_MAX - 1e-3;
    kCuadro += (k - kCuadro) * (k < kCuadro ? 0.6 : 0.15);
  }
  function antesDeLaCara(r, cam, i) {
    if (detenido) return;
    r.getCurrentViewport(_v);
    occ.uVista.value.copy(_v);   // los pixeles de este dibujo (las caras y el marco los usan para la oclusion)
    // sin armar: se arma con este renderer, despues de este cuadro (no en medio de un dibujo)
    if (!listo) { if (!rendererDelMundo && !armando) armando = espera(0).then(() => montar(r)).catch((e) => console.warn('amAr: el cubo no se armó', e)); material.uniforms.uListo.value = 0; return; }
    if (r !== rendererDelMundo) return;   // armado en otro contexto: no se puede dibujar aca
    material.uniforms.uListo.value = mezcla;
    const d = CARAS[i], id = ids[i];
    if (!id) return;
    camaraEnElCubo(cam);
    if (!deFrente(d)) return;
    if (cuadroK !== cuadro) { cuadroK = cuadro; resolucionDelCuadro(_v.z, _v.w); material.uniforms.uSuave.value = 1 - THREE.MathUtils.smoothstep(kCuadro, 0.25, 0.42); material.uniforms.uNitidez.value = 0.45 * THREE.MathUtils.smoothstep(kCuadro, 0.3, 0.45) * (1 - THREE.MathUtils.smoothstep(kCuadro, 0.85, 0.99)); }
    // la textura alcanza para la resolucion mas alta (no se rearma al acercarse); en cada cuadro se usa una parte
    const kTex = Math.min(K_MAX, Math.sqrt(PRESUPUESTO / Math.max(1, _v.z * _v.w)));
    const W = Math.max(16, Math.ceil(_v.z * kTex)), H = Math.max(16, Math.ceil(_v.w * kTex));
    const t = textura(r, W, H);
    const w = Math.min(W, Math.max(16, Math.round(_v.z * kCuadro))), h = Math.min(H, Math.max(16, Math.round(_v.w * kCuadro)));
    const rect = rectangulo(i, w, h);
    if (!rect) return;
    t.viewport.set(0, 0, w, h);
    t.scissor.set(rect[0], rect[1], rect[2], rect[3]); t.scissorTest = true;
    material.uniforms.uRegion.value.set(w / W, h / H);
    const antes = { rt: r.getRenderTarget(), xr: r.xr.enabled, autoClear: r.autoClear, alfa: r.getClearAlpha() };
    r.getClearColor(_cc);
    const vis = contenido.children.map((h2) => h2.visible);
    contenido.children.forEach((h2) => { if (h2.visible) h2.visible = h2.uuid === id || id === 'all'; });
    r.xr.enabled = false; r.autoClear = false;
    try {
      camaraDeCara(i, cam, camMundo);   // el mundo de esta cara (derecho, si el cubo esta en diamante)
      const st = mundo.beforeRender(id);
      r.setRenderTarget(t);
      r.setClearColor(0x000000, 1);
      r.clear(true, true, true);
      r.render(contenido, camMundo);
      cuenta.caras++; cuenta.dibujos += r.info.render.calls; cuenta.triangulos += r.info.render.triangles;
      mundo.afterRender(st);
    } finally {
      contenido.children.forEach((h2, n) => { h2.visible = vis[n]; });
      r.setClearColor(_cc, antes.alfa); r.autoClear = antes.autoClear; r.xr.enabled = antes.xr;
      r.setRenderTarget(antes.rt);
      if (cam.viewport) r.state.viewport(cam.viewport);   // en WebXR, la vista de este ojo (como los espejos de three)
    }
    material.uniforms.tMundo.value = t.texture;
    material.uniforms.uTam.value.set(t.width, t.height);
    material.uniformsNeedUpdate = true;
  }

  // ------------------------------------------------------------ girarlo con el dedo
  // En la realidad aumentada el dedo GIRA el cubo: arrastrar de costado lo hace girar sobre su eje vertical, y al soltarlo
  // sigue un poco por la inercia. Para moverlo de lugar esta el boton de la mira (REUBICAR): el toque de "ponelo aca"
  // chocaba con el giro (Niko, 19/11). Con 8th Wall el lienzo no recibe los toques (se los saca la captura de aca); con
  // WebXR el modo mira window.amar.cuboGira. Con WebXR los toques no llegan a la pagina: el dedo se lee de la sesion
  // (gamepad.axes: la posicion en la pantalla).
  const UMBRAL = 4;   // los pixeles que hay que mover el dedo para que empiece a girar (sin temblores)
  // GIRA EN TODAS LAS DIRECCIONES (Niko, 19/11): de costado, sobre la vertical; de arriba abajo, sobre la horizontal de
  // la camara (lo vuelca hacia uno o hacia atras), como una bola de control. Las escenas siguen derechas: los mundos se
  // reacomodan en cada cuadro (acomodarMundos)
  let velX = 0, velY = 0, dedo = null;   // velX/velY: el giro que sigue al soltar (radianes por segundo)
  const enAR = () => { const m = window.amar && window.amar.modo; return m === 'ochowall' || m === 'webxr' || m === 'ventana'; };
  const _qa = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _eje = new THREE.Vector3();
  function girar(ax, ay) {
    if (ax) { _qa.setFromAxisAngle(_Y, ax); cubo.quaternion.premultiply(_qa); }
    if (ay && camActual) {
      _eje.setFromMatrixColumn(camActual.matrixWorld, 0); _eje.y = 0;   // la derecha de la camara, en horizontal
      if (_eje.lengthSq() > 1e-6) { raiz.getWorldQuaternion(_qr).invert(); _eje.normalize().applyQuaternion(_qr); _qa.setFromAxisAngle(_eje, ay); cubo.quaternion.premultiply(_qa); }
    }
    cubo.quaternion.normalize();
  }
  function tocar(id, x, y) { dedo = { id, x0: x, y0: y, x, y, t: performance.now(), arrastre: false }; velX = velY = 0; }
  function mover(x, y, ancho) {   // en pixeles (ancho: el de la pantalla), o en -1..1 (ancho 2)
    const ahora = performance.now(), dx = x - dedo.x, dy = y - dedo.y;
    if (!dedo.arrastre && Math.hypot(x - dedo.x0, y - dedo.y0) > UMBRAL * ancho / innerWidth) dedo.arrastre = true;
    if (dedo.arrastre && (dx || dy)) {
      const ax = (dx / ancho) * Math.PI * 1.2, ay = (dy / ancho) * Math.PI * 1.2;   // un barrido de lado a lado: algo mas de media vuelta
      girar(ax, ay);
      const dts = Math.max(0.008, (ahora - dedo.t) / 1000);
      velX = 0.5 * velX + 0.5 * ax / dts; velY = 0.5 * velY + 0.5 * ay / dts;
    }
    dedo.x = x; dedo.y = y; dedo.t = ahora;
  }
  function soltar() {
    if (!dedo || performance.now() - dedo.t > 80) velX = velY = 0;   // quieto antes de soltar: sin inercia
    const v = Math.hypot(velX, velY);
    if (v > 3.5) { velX *= 3.5 / v; velY *= 3.5 / v; }   // un barrido rapido no lo deja girando como un trompo
    dedo = null;
  }
  const alTocar = (e) => { if (enAR() && !detenido && !dedo && e.isPrimary) tocar(e.pointerId, e.clientX, e.clientY); };
  const alMover = (e) => { if (dedo && e.pointerId === dedo.id) mover(e.clientX, e.clientY, innerWidth); };
  const alSoltar = (e) => {
    if (dedo && e.pointerId === dedo.id) soltar();
    if (enAR() && !detenido && e.target && e.target.tagName === 'CANVAS') e.stopPropagation();   // (en captura) el modo no lo toma como "ponelo aca"
  };
  addEventListener('pointerdown', alTocar, true); addEventListener('pointermove', alMover, true);
  addEventListener('pointerup', alSoltar, true); addEventListener('pointercancel', alSoltar, true);
  function dedoDeWebXR() {
    const s = rendererDelMundo && rendererDelMundo.xr.isPresenting ? rendererDelMundo.xr.getSession() : null;
    if (!s || !enAR()) return;
    let ejes = null;
    for (const f of s.inputSources) if (f.targetRayMode === 'screen' && f.gamepad && f.gamepad.axes.length > 1) { ejes = f.gamepad.axes; break; }
    if (ejes && !dedo) tocar('xr', ejes[0], ejes[1]);
    else if (ejes && dedo && dedo.id === 'xr') mover(ejes[0], ejes[1], 2);
    else if (!ejes && dedo && dedo.id === 'xr') soltar();
  }

  return {
    raiz,
    liviano: MOVIL,   // en el modo liviano la escena no le pone la sombra del sol (ver arriba)
    actualizar(dt, camara) {
      cuadro++;
      Object.assign(ultima, cuenta); cuenta.caras = cuenta.dibujos = cuenta.triangulos = 0;   // lo del cuadro anterior
      if (sombraPiso) sombraPiso.position.y = 0.006 - raiz.position.y;   // en el piso, aunque el cubo flote
      dedoDeWebXR();
      if (!dedo && (velX || velY)) { girar(velX * dt, velY * dt); const f = Math.exp(-dt * 3); velX *= f; velY *= f; if (Math.hypot(velX, velY) < 0.02) velX = velY = 0; }
      if (!listo && !rendererDelMundo && !armando) {
        // con 8th Wall el renderer es el del motor: el cubo se arma apenas se abre la camara, sin esperar a ubicarse
        let r8 = null; try { r8 = window.XR8 && XR8.Threejs.xrScene().renderer; } catch (e) { /* el motor todavia no arranco */ }
        if (r8) armando = espera(0).then(() => montar(r8)).catch((e) => console.warn('amAr: el cubo no se armó', e));
      }
      if (window.amar && enAR()) window.amar.cuboGira = true;   // el dedo es del cubo: WebXR no lo toma como "ponelo aca"
      if (!listo || detenido) return;
      ajustar();
      mezcla = Math.min(1, mezcla + dt / 0.8);   // el mundo aparece de a poco detras del vidrio
      const cam = camara && (camara.isArrayCamera && camara.cameras.length ? camara.cameras[0] : camara);
      if (cam) { camActual = cam; camaraEnElCubo(cam); }
      acomodarMundos(dt);   // los mundos se reacomodan, derechos (seis caras: es poca cuenta)
      if (prueba.has('sol') && raiz.parent) raiz.parent.traverse((o) => { if (o.isDirectionalLight) o.castShadow = false; });
      // las escenas que miran a la camara (el espejo, la playa) la ven desde su propia cara
      const camDe = (w) => { const i = ids.indexOf(w.uuid); return cam && i >= 0 ? camaraDeCara(i, cam, camCaras[i]) : null; };
      if (!prueba.has('mundo')) sinXR(rendererDelMundo, () => mundo.update(dt, camDe));
    },
    // LA PROFUNDIDAD DEL LUGAR (WebXR con ARCore, 'cpu-optimized'): en metros, cuadro a cuadro; null la apaga
    profundidad(info) {
      if (!info || !info.data) { occ.uConProf.value = 0; return; }
      if (occ.uConProf.value && cuadro - profCuadro < 2) return;   // cada dos cuadros alcanza: cambia despacio
      profCuadro = cuadro;
      const w = info.width, h = info.height, n = w * h;
      if (!profTex || profTex.image.width !== w || profTex.image.height !== h) {
        if (profTex) profTex.dispose();
        // en 16 bits (se puede filtrar): interpolada, el borde de la persona es una linea suave y no cuadraditos
        profTex = new THREE.DataTexture(new Uint16Array(n), w, h, THREE.RedFormat, THREE.HalfFloatType);
        profTex.minFilter = profTex.magFilter = THREE.LinearFilter;
        profPrev = new Float32Array(n);
        occ.tProf.value = profTex;
      }
      const datos = info.formato === 'float32' ? new Float32Array(info.data) : new Uint16Array(info.data), destino = profTex.image.data, k = info.rawValueToMeters;
      for (let j = 0; j < n; j++) {
        // el ruido de cuadro a cuadro se promedia; un cambio grande (alguien que se mueve) pasa enseguida
        const m = datos[j] * k, a = profPrev[j], v = Math.abs(m - a) < 0.25 ? a + (m - a) * 0.5 : m;
        profPrev[j] = v; destino[j] = THREE.DataUtils.toHalfFloat(v);
      }
      profTex.needsUpdate = true;
      occ.uProfMat.value.fromArray(info.normDepthBufferFromNormView.matrix);
      occ.uConProf.value = 1;
    },
    detener() {
      detenido = true; if (rt) rt.dispose();
      removeEventListener('pointerdown', alTocar, true); removeEventListener('pointermove', alMover, true);
      removeEventListener('pointerup', alSoltar, true); removeEventListener('pointercancel', alSoltar, true);
    },
  };
}
