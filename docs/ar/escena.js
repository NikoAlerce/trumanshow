// amAr · la escena: lo que se dibuja en cada caso.
//
//   armarObra(obra, BASE)      una obra que se anima: el video (o imagen) calzado sobre la imagen impresa,
//                              en un grupo cuyo origen es el centro del papel (x derecha, y arriba, z hacia
//                              el que mira), escalado en metros reales por el motor que la rastrea.
//   armarEscena(escena, BASE)  una escena en el lugar (panel): paneles, glb, video, imagen en un grupo cuyo
//                              origen es el punto del piso donde se posa; x derecha, y arriba, z hacia el visitante.
//
// Contenidos de una escena: panel (titulo, texto, imagen, ancho_cm, alto_cm, mirar_al_visitante, x_m, y_m, z_m),
// glb (altura_m, animacion, giro_grados, mirar_al_visitante, sombra, x_m, z_m), video (ancho_m, alto_m, loop,
// sonido, x_m, y_m, z_m), imagen (archivo, ancho_m, alto_m, x_m, y_m, z_m), cubo (carpeta, lado_m, giro_grados,
// x_m, y_m, z_m: un cubo de seis ventanas como los de EyeJack, ver cubo.js).
//
// opciones.renderer: el renderer que va a dibujar la escena, si ya se sabe (el cubo se arma con el; sin el, se arma
// en su primer cuadro con el que lo dibuje).

import * as THREE from 'three';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { MeshoptDecoder } from './lib/meshopt_decoder.module.js';
import { RoomEnvironment } from './lib/RoomEnvironment.js';

// LA LUZ DE AMBIENTE: un cuarto neutro (RoomEnvironment de three, MIT) como reflejo para los materiales PBR. Sin esto
// un auto o cualquier cosa con brillo se ve plana y oscura sobre la camara. Se arma una vez por renderer
const ambientes = new WeakMap();
export function iluminar(scene, renderer) {
  try {
    if (!ambientes.has(renderer)) { const pm = new THREE.PMREMGenerator(renderer); ambientes.set(renderer, pm.fromScene(new RoomEnvironment(), 0.04).texture); pm.dispose(); }
    scene.environment = ambientes.get(renderer);
  } catch (e) { console.warn('sin luz de ambiente', e); }
}

// si la pieza ya bajo el archivo (la barra de progreso), usa esa copia; si no, la direccion normal
const direccion = (rel, BASE) => (window.amarUrls && window.amarUrls[String(rel).split('?')[0]]) || new URL(rel, BASE).href;

// la mascara de la pluma: blanco adentro y un borde que baja a negro (en alfa). Pixel por pixel y no con el filtro de
// desenfoque del lienzo, que Safari no tenia hasta hace poco. Cada eje por su lado, multiplicado (con el minimo de los
// cuatro bordes, en las esquinas quedaba una diagonal marcada). La caida, bien marcada (la curva de quinto grado): la
// pluma ancha y blanda dejaba ver la lamina de abajo un poco corrida, un borde sucio como de doble imagen (Niko, 28/10)
function mascaraPluma(proporcion, pluma) {
  const H = 512, W = Math.max(16, Math.round(H * proporcion)), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), p = pluma * Math.min(W, H);
  const caida = (d) => { const t = Math.min(1, Math.max(0, d / p)); return t * t * t * (t * (6 * t - 15) + 10); };
  for (let y = 0; y < H; y++) { const fy = caida(Math.min(y + 0.5, H - y - 0.5));
    for (let x = 0; x < W; x++) {
      const a = Math.round(255 * fy * caida(Math.min(x + 0.5, W - x - 0.5))), i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = a; img.data[i + 3] = 255;
    } }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
}
// la mascara de la sombra: oscura debajo de la obra y bajando suave hasta m afuera de su borde
function mascaraSombra(ancho, alto, m) {
  const H = 256, W = Math.max(16, Math.round(H * (ancho + 2 * m) / (alto + 2 * m))), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), px = W / (ancho + 2 * m), mp = m * px;
  const caida = (d) => { const t = Math.min(1, Math.max(0, d / mp)); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) { const fy = caida(Math.min(y + 0.5, H - y - 0.5));
    for (let x = 0; x < W; x++) { const a = Math.round(255 * fy * caida(Math.min(x + 0.5, W - x - 0.5))), i = (y * W + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = a; img.data[i + 3] = 255; } }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
}
// el color de una luz de tantos grados Kelvin, normalizado (el canal mas fuerte en 1), relativo a la luz de dia (6500 K)
function tinteDeKelvin(k, salida) {
  const rgb = (K) => { const t = Math.max(10, Math.min(400, K / 100)); let r, g, b;
    if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
    else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
    return [r, g, b].map((x) => Math.max(1, Math.min(255, x)) / 255); };
  const a = rgb(k), d = rgb(6500), r = [a[0] / d[0], a[1] / d[1], a[2] / d[2]], m = Math.max(...r);
  return salida.setRGB(r[0] / m, r[1] / m, r[2] / m);
}

export async function armarObra(obra, BASE, opciones = {}) {
  const raiz = new THREE.Group(); raiz.name = 'obra:' + obra.id;
  // el plano mide 1 de alto y la proporcion de la imagen de ancho; cuanto es eso en la escena lo dice el motor
  // que la rastrea (no importa cuanto mide impresa)
  const proporcion = obra.ancho_px && obra.alto_px ? obra.ancho_px / obra.alto_px : (obra.ancho_cm && obra.alto_cm ? obra.ancho_cm / obra.alto_cm : 0.8);
  const ancho = proporcion, alto = 1;
  const videos = [];
  if (obra.ventana && obra.ventana.spz) {
    // la ventana: el lugar (gaussian splat) visto a traves del papel; ver ventana.js
    const { cargarVentana } = await import('./ventana.js');
    const ventana = await cargarVentana(obra.ventana, BASE, proporcion, { progreso: opciones.progreso, estado: opciones.estado });
    return { raiz, videos, ancho, alto, obra, ventana, actualizar() {}, reproducir() {}, pausar() {}, sonido() {}, detener() { ventana.detener(); } };
  }
  let plano = null;
  // LA PLUMA: los bordes del video se funden con la lamina impresa (que es la misma imagen), apenas: un 1,2 % del lado
  // corto. Sin pluma el borde era duro (Niko, 27/10); ancha, se veia la lamina corrida por debajo (28/10).
  // ?pluma=0 la saca, ?pluma=0.03 la agranda; la obra puede traer la suya
  const q = new URLSearchParams(location.search), qp = q.get('pluma'), pluma = Math.max(0, Math.min(0.2, qp != null ? +qp : (obra.pluma != null ? +obra.pluma : 0.012)));
  const alphaMap = pluma > 0 ? mascaraPluma(proporcion, pluma) : null;
  if (obra.video) {
    // una variante del video, para comparar en la lamina de verdad sin reimprimir (?video=<nombre>, de obra.variantes)
    const variante = q.get('video'), src = (variante && obra.variantes && obra.variantes[variante]) || obra.video;
    const v = document.createElement('video');
    v.src = direccion(src, BASE); v.crossOrigin = 'anonymous'; v.loop = obra.loop !== false; v.muted = !obra.sonido; v.playsInline = true; v.preload = 'metadata';
    videos.push(v);
    const tex = new THREE.VideoTexture(v); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;   // nitido tambien mirando de costado
    plano = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, alphaMap, transparent: true, depthWrite: false }));   // transparente siempre: aparece y se va de a poco
  } else if (obra.imagen_animada) {
    const tex = await new THREE.TextureLoader().loadAsync(direccion(obra.imagen_animada, BASE)); tex.colorSpace = THREE.SRGBColorSpace;
    plano = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, alphaMap }));
  }
  if (plano) { plano.position.z = 0.002; raiz.add(plano); }
  // LA SOMBRA, a prueba (?sombra=0.3, la fuerza): una sombra suave apenas afuera del borde de la obra, sobre el papel,
  // como si la imagen estuviera un poquito apoyada encima (idea de Niko, 28/10). Detras del video: solo se ve afuera
  const fuerzaSombra = Math.max(0, Math.min(1, +(q.get('sombra') || obra.sombra || 0)));
  if (plano && fuerzaSombra > 0) {
    const m = 0.035 * Math.min(ancho, alto), sombra = new THREE.Mesh(new THREE.PlaneGeometry(ancho + 2 * m, alto + 2 * m), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: mascaraSombra(ancho, alto, m), transparent: true, opacity: fuerzaSombra, depthWrite: false, toneMapped: false }));
    sombra.position.set(0.004, -0.006, 0.001); raiz.add(sombra);   // corrida apenas hacia abajo, como la luz de arriba
  }
  const _tinte = new THREE.Color();
  return {
    raiz, videos, ancho, alto, obra,
    // LA LUZ DEL LUGAR (a prueba, ?luz=1): la exposicion (-1 a 1) y la temperatura de color (K) que estima la camara.
    // El video brilla como una pantalla; el papel de al lado no: con poca luz se oscurece y con luz calida se entibia
    luz(exposicion, temperatura) {
      if (!plano) return;
      const b = THREE.MathUtils.clamp(1 + 0.6 * (exposicion || 0), 0.5, 1.1);
      tinteDeKelvin(temperatura || 6500, _tinte);
      plano.material.color.setRGB(b * (0.6 + 0.4 * _tinte.r), b * (0.6 + 0.4 * _tinte.g), b * (0.6 + 0.4 * _tinte.b));
    },
    // cuanto se ve (0 a 1): la obra aparece y se va de a poco, no de golpe
    presencia(a) { if (plano) plano.material.opacity = a; },
    actualizar() {},
    reproducir() { for (const v of videos) v.play().catch(() => {}); },
    pausar() { for (const v of videos) v.pause(); },
    sonido(si) { for (const v of videos) v.muted = !si; },
    detener() { for (const v of videos) { v.pause(); v.removeAttribute('src'); v.load(); } },
  };
}

export async function armarEscena(escena, BASE, opciones = {}) {
  const avisar = opciones.progreso || (() => {});
  const raiz = new THREE.Group(); raiz.name = 'escena:' + escena.id;
  raiz.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.6));   // mas baja: la luz de ambiente (iluminar) suma el resto
  // el sol: casi desde arriba, un poco de costado; es el que proyecta la sombra de verdad (se ajusta al final)
  const sol = new THREE.DirectionalLight(0xffffff, 1.6); sol.position.set(3, 10, 4); raiz.add(sol); raiz.add(sol.target);
  let conSombra = false;
  const mezclas = [], billboards = [], videos = [], cubos = [];
  const caja = new THREE.Box3(); caja.makeEmpty();
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const lista = escena.contenidos || []; const total = lista.length || 1; let hechos = 0;
  for (const c of lista) {
    let obj = null;
    try {
      if (c.tipo === 'glb') {
        const gltf = await new Promise((ok, mal) => loader.load(direccion(c.archivo, BASE), ok, (ev) => { if (ev.total) avisar((hechos + ev.loaded / ev.total) / total); }, mal));
        const modelo = gltf.scene;
        // LA MEDIDA DE VERDAD: con el esqueleto aplicado (precisa), no la de la malla sin deformar. El bailarin esta hecho
        // en centimetros adentro de su esqueleto: la malla sola daba un tercio del alto real, y al pedirle 1,80 m quedaba
        // de 6 m (Niko, 15/10: "esta gigante"). Para un modelo sin esqueleto da lo mismo que la medida rapida
        const medir = (o) => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o, true); };
        const b = medir(modelo), tam = b.getSize(new THREE.Vector3());
        modelo.scale.setScalar(c.altura_m ? c.altura_m / Math.max(tam.y, 1e-6) : (c.escala || 1));
        const b2 = medir(modelo), centro = b2.getCenter(new THREE.Vector3());
        const grupo = new THREE.Group();
        // el modelo se centra (muchos GLB vienen corridos del origen: el Clio, 17 m) y el giro va en un pivote aparte,
        // sobre su centro. Antes el giro se aplicaba al modelo mismo, alrededor de su origen lejano, y lo hacia orbitar
        modelo.position.set(-centro.x, -b2.min.y, -centro.z);
        const pivote = new THREE.Group(); pivote.add(modelo);
        if (c.giro_grados) pivote.rotation.y = THREE.MathUtils.degToRad(c.giro_grados);
        grupo.add(pivote);
        const alto = b2.max.y - b2.min.y;
        // proyecta sombra (la recibe un piso invisible que se pone al final)
        modelo.traverse((o) => { if (o.isMesh) { o.castShadow = c.sombra !== false; o.receiveShadow = false; } });
        grupo.position.set(c.x_m || 0, c.y_m || 0, c.z_m || 0);
        if (gltf.animations && gltf.animations.length) {
          c._animaciones = gltf.animations.map((a) => a.name);
          const mezcla = new THREE.AnimationMixer(modelo);
          const clip = gltf.animations.find((a) => a.name === c.animacion) || gltf.animations[0];
          mezcla.clipAction(clip).play(); mezclas.push(mezcla);
          // EL PISO CON LA ANIMACION PUESTA (Niko, 15/10: el bailarin bailaba en el aire). El modelo se apoya segun su
          // pose de reposo, pero un baile puede subir o bajar todo el cuerpo. Se recorre la animacion en 12 momentos,
          // se mide el punto mas bajo del cuerpo deformado (pies) y ese punto se apoya en el piso
          // y, de paso, el centro: si la animacion corre todo el cuerpo hacia un costado, el baile se centra sobre su sombra
          try {
            let minimo = Infinity, sx = 0, sz = 0, n = 0;
            for (let i = 0; i < 12; i++) {
              mezcla.setTime(clip.duration * i / 12); grupo.updateMatrixWorld(true);
              const bb = new THREE.Box3().setFromObject(modelo, true);
              if (!bb.isEmpty()) { minimo = Math.min(minimo, bb.min.y - grupo.position.y); sx += (bb.min.x + bb.max.x) / 2 - grupo.position.x; sz += (bb.min.z + bb.max.z) / 2 - grupo.position.z; n++; }
            }
            mezcla.setTime(0);
            if (Number.isFinite(minimo) && Math.abs(minimo) > 0.005) modelo.position.y -= minimo;
            if (n) { pivote.position.x -= sx / n; pivote.position.z -= sz / n; }
          } catch (e) { console.warn('piso de la animacion', e); }
        }
        // LA SOMBRA DE CONTACTO: la huella del modelo (no un disco de su lado mayor), oscura en el medio. Es lo que lo
        // "apoya" en el piso: el oscurecimiento justo debajo, donde no llega la luz. La sombra del sol va aparte
        if (c.sombra !== false) {
          conSombra = true;
          const bh = medir(pivote).translate(grupo.position.clone().negate());
          const s0 = sombra((bh.max.x - bh.min.x) / 2, (bh.max.z - bh.min.z) / 2);
          s0.position.x = (bh.min.x + bh.max.x) / 2; s0.position.z = (bh.min.z + bh.max.z) / 2; grupo.add(s0);
        }
        if (c.mirar_al_visitante) billboards.push(grupo);
        grupo.userData.alto = alto;
        obj = grupo;
      } else if (c.tipo === 'video') {
        const v = document.createElement('video');
        v.src = direccion(c.archivo, BASE); v.crossOrigin = 'anonymous'; v.loop = c.loop !== false; v.muted = !c.sonido; v.playsInline = true; v.preload = 'auto';
        videos.push(v);
        const tex = new THREE.VideoTexture(v); tex.colorSpace = THREE.SRGBColorSpace;
        const w = c.ancho_m || 1.6, h = c.alto_m || w * 9 / 16;
        obj = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
        obj.position.set(c.x_m || 0, c.y_m == null ? h / 2 : c.y_m, c.z_m || 0);
        if (c.mirar_al_visitante !== false) billboards.push(obj);
      } else if (c.tipo === 'imagen') {
        const tex = await new THREE.TextureLoader().loadAsync(direccion(c.archivo, BASE)); tex.colorSpace = THREE.SRGBColorSpace;
        const w = c.ancho_m || 1, h = c.alto_m || w * (tex.image.height / tex.image.width);
        obj = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, side: THREE.DoubleSide }));
        obj.position.set(c.x_m || 0, c.y_m == null ? h / 2 : c.y_m, c.z_m || 0);
        if (c.mirar_al_visitante !== false) billboards.push(obj);
      } else if (c.tipo === 'panel') {
        obj = panel(c, BASE);
        obj.position.set(c.x_m || 0, c.y_m == null ? 1.4 : c.y_m, c.z_m || 0);
        if (c.mirar_al_visitante !== false) billboards.push(obj);
      } else if (c.tipo === 'cubo') {
        // el cubo de seis ventanas (cubo.js): flota con su centro a y_m, y su sombra cae al piso
        const { armarCubo } = await import('./cubo.js');
        const cubo = await armarCubo(c, BASE, { progreso: (f) => avisar((hechos + f) / total), renderer: opciones.renderer || null, sombra });
        cubos.push(cubo);
        obj = cubo.raiz;
        if (!cubo.liviano) conSombra = true;   // en el telefono, solo su sombra de contacto: la del sol cuesta un tercio de los cuadros
      }
    } catch (e) { console.warn('contenido que no cargó', c, e); }
    if (obj) { obj.userData.contenido = c; obj.userData.indice = hechos; raiz.add(obj); caja.union(new THREE.Box3().setFromObject(obj)); }   // indice: el lugar en escena.contenidos (el editor lo usa para elegir)
    hechos++; avisar(hechos / total);
  }
  avisar(null);
  // LA SOMBRA DEL SOL: un piso invisible que solo muestra sombra (ShadowMaterial) y el sol con su camara de sombra
  // ajustada a la escena. El renderer tiene que tener shadowMap encendido (amar.js y el modo 8th Wall lo hacen)
  if (conSombra && !caja.isEmpty()) {
    const cen = caja.getCenter(new THREE.Vector3()), tam = caja.getSize(new THREE.Vector3());
    const r = Math.max(tam.x, tam.z, tam.y * 0.6) * 0.9 + 0.3;
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(r * 3, r * 3), new THREE.ShadowMaterial({ opacity: 0.32, depthWrite: false }));
    piso.rotation.x = -Math.PI / 2; piso.position.set(cen.x, 0.004, cen.z); piso.receiveShadow = true; piso.renderOrder = -1;
    piso.raycast = () => {};   // invisible tambien para los clics: en el editor se llevaba la seleccion y no dejaba elegir (ni escalar) el modelo
    raiz.add(piso);
    const dir = new THREE.Vector3(0.35, 1, 0.25).normalize(), lejos = Math.max(tam.y, r) * 3 + 2;
    sol.position.copy(cen).addScaledVector(dir, lejos); sol.target.position.copy(cen);
    sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
    const cs = sol.shadow.camera; cs.left = -r * 1.2; cs.right = r * 1.2; cs.top = r * 1.2; cs.bottom = -r * 1.2; cs.near = 0.1; cs.far = lejos + tam.y + r * 2; cs.updateProjectionMatrix();
    sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.02; sol.shadow.radius = 3;
  }
  const vCam = new THREE.Vector3(), vObj = new THREE.Vector3();
  return {
    raiz, caja, videos, escena,
    actualizar(dt, camara) {
      for (const m of mezclas) m.update(dt);
      for (const k of cubos) k.actualizar(dt, camara);
      if (camara && billboards.length) {
        camara.getWorldPosition(vCam);
        for (const b of billboards) { b.getWorldPosition(vObj); b.rotation.y = Math.atan2(vCam.x - vObj.x, vCam.z - vObj.z) - raiz.rotation.y; }
      }
    },
    reproducir() { for (const v of videos) v.play().catch(() => {}); },
    sonido(si) { for (const v of videos) v.muted = !si; },
    // la profundidad del lugar (WebXR con ARCore): los cubos la usan para que lo que esta delante los tape
    profundidad(info) { for (const k of cubos) if (k.profundidad) k.profundidad(info); },
    detener() { for (const v of videos) { v.pause(); v.removeAttribute('src'); v.load(); } for (const k of cubos) k.detener(); },
  };
}

// la sombra de contacto: una elipse del tamaño de la huella (semiejes rx, rz), oscura en el centro y que se apaga hacia
// afuera, un poco mas grande que la huella para que asome por los costados
export function sombra(rx, rz = rx) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,.62)'); grad.addColorStop(0.55, 'rgba(0,0,0,.42)'); grad.addColorStop(0.8, 'rgba(0,0,0,.14)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.scale.set(Math.max(0.2, rx * 2 * 1.18), Math.max(0.2, rz * 2 * 1.18), 1);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.006; m.renderOrder = -2;
  m.raycast = () => {};   // la sombra no se elige con un clic: se elige el modelo
  return m;
}

// un panel informativo: titulo, texto e imagen opcional, dibujado en un canvas, con medidas en centimetros
export function panel(c, BASE) {
  const ancho = (c.ancho_cm || 60) / 100, alto = (c.alto_cm || 40) / 100;
  const W = 1024, H = Math.max(128, Math.round(W * alto / ancho));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.fillStyle = c.fondo || '#ffffff'; redondear(g, 0, 0, W, H, 30); g.fill();
  g.strokeStyle = c.borde || '#e6e6e6'; g.lineWidth = 6; redondear(g, 3, 3, W - 6, H - 6, 28); g.stroke();
  const margen = 60; let y = margen;
  g.fillStyle = c.color || '#1c1c1c'; g.textBaseline = 'top';
  if (c.titulo) { g.font = '600 ' + Math.round(W * 0.055) + 'px "Segoe UI", Arial, sans-serif'; for (const l of partir(g, c.titulo, W - margen * 2)) { g.fillText(l, margen, y); y += W * 0.066; } y += W * 0.018; }
  if (c.texto) { g.font = Math.round(W * 0.036) + 'px "Segoe UI", Arial, sans-serif'; g.fillStyle = c.color || '#333'; for (const l of partir(g, c.texto, W - margen * 2)) { if (y > H - margen) break; g.fillText(l, margen, y); y += W * 0.048; } }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  if (c.imagen && BASE) new THREE.TextureLoader().load(direccion(c.imagen, BASE), (t) => { t.colorSpace = THREE.SRGBColorSpace; const r = t.image.width / t.image.height, iw = ancho * 0.9, ih = Math.min(iw / r, alto * 0.45); const im = new THREE.Mesh(new THREE.PlaneGeometry(ih * r, ih), new THREE.MeshBasicMaterial({ map: t, toneMapped: false })); im.position.set(0, -alto / 2 + ih / 2 + 0.03, 0.001); m.add(im); });
  return m;
}
function redondear(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function partir(g, texto, ancho) {
  const out = [];
  for (const parrafo of String(texto).split('\n')) {
    let linea = '';
    for (const p of parrafo.split(/\s+/)) { const prueba = (linea + ' ' + p).trim(); if (g.measureText(prueba).width > ancho && linea) { out.push(linea); linea = p; } else linea = prueba; }
    out.push(linea);
  }
  return out;
}
