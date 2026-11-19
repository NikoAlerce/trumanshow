// amAr · la pieza (v0.4, 13 de octubre de 2026)
//
// Lo que abre el visitante al escanear un QR. Tres usos, segun el link:
//   ?o=<id>  una OBRA que se anima: apuntar a la imagen impresa y el video se calza encima
//   ?c=<id>  una COLECCION: un solo QR para varias obras; se apunta a cualquiera
//   ?e=<id>  una ESCENA en el lugar: paneles y objetos que aparecen en el piso, anclados
//   ?p=<id>  un PORTAL: una puerta en el piso; del otro lado, un lugar de SPLATMACHINE en su propio mundo
// Las obras y colecciones van con 8th Wall (image targets) en Android y iPhone; sin camara, se ven
// una debajo de la otra. Las escenas van con WebXR (Android), 8th Wall (iPhone), ventana (giroscopio)
// o en 3D. El motor de 8th Wall es un proveedor de pose opcional: si falla se cae al modo siguiente.

import * as THREE from 'three';
import { armarObra, armarEscena } from './escena.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const BASE = new URL('.', location.href);

const proyecto = await (await fetch(new URL('proyecto.json', BASE), { cache: 'no-cache' })).json();
const pesos = await fetch(new URL('pesos.json', BASE), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
for (const k of ['obras', 'ventanas', 'colecciones', 'escenas', 'portales']) proyecto[k] = proyecto[k] || [];
// EL IDIOMA (proyecto.idioma): la pieza habla en castellano; con 'en' (una copia que va afuera, como el cubo de Truman
// adentro de su NFT en objkt: ver herramientas/exportar.mjs) lo que lee el visitante pasa por este diccionario. Lo que no
// esta queda igual; un mensaje que empieza con una clave terminada en ': ' (un error con su causa) se traduce hasta ahi
const EN = {
  'Este proyecto todavía no tiene nada publicado.': 'Nothing has been published here yet.',
  'Apuntá a la imagen': 'Point at the image', 'Apuntá a la obra': 'Point at the artwork', 'Apuntá a cualquiera de las obras': 'Point at any of the artworks', 'Mirá hacia adelante': 'Look ahead',
  'VER MÁS': 'SEE MORE', 'APUNTAR CON LA CÁMARA': 'USE THE CAMERA', 'VER CON LA CÁMARA': 'SEE IT WITH THE CAMERA', 'VER SIN CÁMARA': 'SEE IT WITHOUT THE CAMERA', 'VOLVER A INTENTAR': 'TRY AGAIN', 'ver sin cámara': 'see it without the camera',
  'aparece en el lugar, a escala real': 'it appears in your space, life-size', 'apuntá a cualquiera de las obras y mirá lo que pasa': 'point at any of the artworks and see what happens', 'apuntá a la obra y mirá lo que pasa': 'point at the artwork and see what happens',
  'girá el teléfono para mirarlo; no sigue tus pasos': 'turn the phone to look at it; it does not follow your steps', 'girarlo con el dedo': 'turn it with your finger', 'las obras, una debajo de la otra': 'the artworks, one below the other', 'la animación sobre la imagen': 'the animation over the image',
  'Este teléfono tiene realidad aumentada.': 'This phone has augmented reality.', 'iPhone: se usa el motor alternativo.': 'iPhone: the alternative engine is used.', 'Sin ARCore: motor alternativo o cámara con giroscopio.': 'No ARCore: alternative engine or camera with gyroscope.', 'Sin ARCore: cámara con giroscopio.': 'No ARCore: camera with gyroscope.', 'En una computadora se ve sin cámara.': 'On a computer it is shown without the camera.',
  'cargando...': 'loading...', 'Cargando': 'Loading', 'Cargando la escena': 'Loading the scene', 'Cargando la obra': 'Loading the artwork', 'Cargando la colección': 'Loading the collection', 'Cargando la ventana': 'Loading the window', 'Cargando el portal': 'Loading the portal',
  'Tocá para empezar': 'Tap to start', 'Abriendo la cámara': 'Opening the camera', 'abriendo la cámara...': 'opening the camera...', 'ese modo no anduvo acá, probando otro...': 'that mode did not work here, trying another one...',
  'No se pudo abrir: ': 'Could not open: ', 'no se pudo abrir la realidad aumentada: ': 'could not open augmented reality: ', 'no se pudo usar la cámara o el giroscopio: ': 'could not use the camera or the gyroscope: ',
};
const idioma = proyecto.idioma === 'en' ? 'en' : 'es';
const tx = (s) => {
  if (idioma === 'es' || typeof s !== 'string') return s;
  if (EN[s]) return EN[s];
  for (const k in EN) if (k.endsWith(': ') && s.startsWith(k)) return EN[k] + s.slice(k.length);
  return s;
};
document.documentElement.lang = idioma;
let tipo, obras = [], coleccion = null, escena = null, portalItem = null, titulo = '', leyenda = '', ayuda = '', portada = '';
if (params.has('o') && proyecto.obras.find((o) => o.id === params.get('o'))) { tipo = 'obra'; obras = [proyecto.obras.find((o) => o.id === params.get('o'))]; }
else if (params.has('v') && proyecto.ventanas.find((o) => o.id === params.get('v'))) { tipo = 'ventana'; obras = [proyecto.ventanas.find((o) => o.id === params.get('v'))]; }
else if (params.has('p') && proyecto.portales.find((x) => x.id === params.get('p'))) { tipo = 'portal'; portalItem = proyecto.portales.find((x) => x.id === params.get('p')); }
else if (params.has('c') && proyecto.colecciones.find((c) => c.id === params.get('c'))) { tipo = 'coleccion'; coleccion = proyecto.colecciones.find((c) => c.id === params.get('c')); obras = coleccion.obras.map((id) => proyecto.obras.find((o) => o.id === id)).filter(Boolean); }
else if (proyecto.escenas.length && (params.has('e') || !proyecto.obras.length)) { tipo = 'escena'; escena = proyecto.escenas.find((e) => e.id === params.get('e')) || proyecto.escenas[0]; }
else if (proyecto.obras.length) { tipo = 'obra'; obras = [proyecto.obras[0]]; }
else { document.body.innerHTML = '<p style="padding:30px">' + tx('Este proyecto todavía no tiene nada publicado.') + '</p>'; throw new Error('vacío'); }

if (tipo === 'obra' || tipo === 'ventana') { const o = obras[0]; titulo = o.titulo; leyenda = o.leyenda || tx(tipo === 'ventana' ? 'Apuntá a la imagen' : 'Apuntá a la obra'); ayuda = o.descripcion || ''; portada = o.imagen; }
else if (tipo === 'coleccion') { titulo = coleccion.titulo; leyenda = coleccion.leyenda || tx('Apuntá a cualquiera de las obras'); ayuda = coleccion.descripcion || (obras.length + (idioma === 'es' ? ' obras' : ' artworks')); portada = coleccion.portada || (obras[0] && obras[0].imagen) || ''; }
else if (tipo === 'portal') { titulo = portalItem.titulo; leyenda = portalItem.leyenda || tx('Mirá hacia adelante'); ayuda = portalItem.descripcion || ''; portada = portalItem.miniatura || ''; }
else { titulo = escena.titulo; leyenda = escena.leyenda || ''; ayuda = escena.ayuda || ''; portada = escena.miniatura || ''; }
document.title = titulo + ' · ' + (proyecto.nombre || 'amAr');
$('marca').textContent = proyecto.marca || 'amAr'; $('pieMarca').textContent = proyecto.marca || 'amAr';
$('titulo').textContent = titulo; $('leyenda').textContent = leyenda; $('ayuda').textContent = ayuda;
if (portada) $('portada').style.backgroundImage = 'url("' + new URL(portada.split('?')[0], BASE).href + '")'; else $('portada').textContent = (proyecto.marca || 'amAr').toUpperCase();
const llamado = tipo === 'escena' ? escena.llamado : tipo === 'portal' ? portalItem.llamado : (tipo === 'coleccion' ? coleccion.llamado : obras[0].llamado);
if (llamado && llamado.url) { for (const id of ['bLlamado', 'menuLlamado']) { const b = $(id); b.textContent = llamado.texto || tx('VER MÁS'); b.href = llamado.url; b.style.display = ''; } }
// LA PANTALLA COMPLETA: sin la barra del navegador. El navegador solo la da en un toque del visitante, por eso la
// camara arranca con un toque; la cruz la deja. En el iPhone no existe para una pagina: se ignora
function pantallaCompleta() { const d = document.documentElement; try { const f = d.requestFullscreen || d.webkitRequestFullscreen; const p = f && f.call(d, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* no se puede */ } }
function salirPantallaCompleta() { try { if (document.fullscreenElement) { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* ya salio */ } }

// lo que puede el telefono
const CAP = { webxr: !!navigator.xr, ar: false, giro: typeof DeviceOrientationEvent !== 'undefined', camara: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), tactil: matchMedia('(pointer: coarse)').matches, iphone: /iPhone|iPad/.test(navigator.userAgent) };
try { CAP.ar = CAP.webxr && (await navigator.xr.isSessionSupported('immersive-ar')); } catch (e) { CAP.ar = false; }
const sin8 = params.has('sin8') || proyecto.sin8 === true;   // proyecto.sin8: una copia sin el motor de 8th Wall (exportar.mjs)

// que modos ofrecer, en orden
const modos = [];
if (tipo === 'portal') { if (CAP.ar) modos.push('portalxr'); modos.push('portal3d'); }   // con ARCore, la AR; si no (la compu, el iPhone), el portal en 3D para caminarlo
else if (tipo !== 'escena') { if (params.get('ventana') === 'prueba') modos.push('pruebaventana'); if (CAP.camara && CAP.tactil && !sin8) modos.push('ochowall'); modos.push('ver'); }
else { if (CAP.ar) modos.push('webxr'); else if (CAP.camara && CAP.tactil) { if (!sin8) modos.push('ochowall'); if (CAP.giro) modos.push('ventana'); } modos.push('tres'); }
$('bAR').style.display = modos.includes('webxr') || modos.includes('ochowall') ? '' : 'none';
$('bAR').querySelector('small').textContent = tx(tipo === 'escena' ? 'aparece en el lugar, a escala real' : (tipo === 'coleccion' ? 'apuntá a cualquiera de las obras y mirá lo que pasa' : 'apuntá a la obra y mirá lo que pasa'));
$('bVentana').style.display = modos.includes('ventana') ? '' : 'none';
$('b3D').querySelector('small').textContent = tx(tipo === 'escena' ? 'girarlo con el dedo' : (tipo === 'coleccion' ? 'las obras, una debajo de la otra' : 'la animación sobre la imagen'));
$('capacidades').textContent = tx(CAP.tactil ? (CAP.ar ? 'Este teléfono tiene realidad aumentada.' : (sin8 ? 'Sin ARCore: cámara con giroscopio.' : (CAP.iphone ? 'iPhone: se usa el motor alternativo.' : 'Sin ARCore: motor alternativo o cámara con giroscopio.'))) : 'En una computadora se ve sin cámara.');
if (idioma !== 'es') for (const id of ['bAR', 'bVentana', 'b3D', 'bReintentar', 'bSinCamara']) { const b = $(id), s = b.querySelector('small'); if (b.firstChild && b.firstChild.nodeType === 3) b.firstChild.textContent = tx(b.firstChild.textContent); if (s && s.textContent) s.textContent = tx(s.textContent); }

// el lienzo y la interfaz que comparten los modos
const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: !CAP.tactil, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));   // a la densidad real: con menos, la camara se ve borrosa
renderer.setSize(window.innerWidth, window.innerHeight, false);   // (estaba al final del comentario de arriba: el lienzo quedaba en 300 x 150 hasta girar el telefono)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // la sombra del sol de las escenas
window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight, false));
// En camara no hay texto: la obra manda. Los mensajes de estado solo aparecen en las escenas mientras el
// telefono busca el piso (y se van solos), o si algo falla. Con ?debug=1 se ve la linea tecnica.
const silencio = true;   // en la camara no hay texto, tampoco en las escenas (Niko: solo una cruz)
let temporizadorEstado = null;
const ui = {
  raizHud: $('hud'),
  // hud(true) muestra la interfaz de la camara; la pantalla de inicio sigue tapando hasta listo()
  hud(si) { $('hud').style.display = si ? 'block' : 'none'; document.body.classList.toggle('camara', !!si); if (!si) { $('inicio').style.display = 'grid'; $('inicio').classList.remove('silencio', 'tocar', 'tarda'); $('botones').classList.remove('auto'); } },
  listo() { $('inicio').style.display = 'none'; $('inicio').classList.remove('fallo'); },
  // un fallo se dice en la pantalla, con la causa, y se ofrece reintentar o ver sin camara; nunca un cuelgue mudo
  fallo(t) {
    console.warn('amAr fallo:', t);
    const inicio = $('inicio'); inicio.style.display = 'grid'; inicio.classList.add('silencio', 'fallo'); inicio.classList.remove('tocar');
    $('botones').classList.add('auto'); $('hud').style.display = 'none'; document.body.classList.remove('camara');
    ui.carga(null); $('arranqueTexto').textContent = tx(t);
  },
  estado(t, clase) {
    const e = $('estado'); clearTimeout(temporizadorEstado);
    if (clase === 'mal') { ui.fallo(t); return; }
    // mientras tapa la pantalla de carga, las etapas se leen ahi (cargando el motor, esperando el permiso...)
    if ($('inicio').style.display !== 'none' && !$('inicio').classList.contains('tocar')) $('arranqueTexto').textContent = tx(t);
    if (silencio) { e.style.display = 'none'; return; }
    e.textContent = tx(t); e.className = clase || ''; e.style.display = 'block';
    temporizadorEstado = setTimeout(() => { e.style.display = 'none'; }, clase === 'ok' ? 2500 : 6000);
  },
  reubicar(fn) { $('bReubicar').style.display = ''; $('bReubicar').onclick = fn; },
  sinReubicar() { $('bReubicar').style.display = 'none'; },
  salir(fn) { $('bSalir').onclick = () => { salirPantallaCompleta(); fn(); }; },   // vuelve a la misma pantalla: "Tocá para empezar"

  llamado(l) { const b = $('bLlamado'); b.textContent = l.texto || tx('VER MÁS'); b.href = l.url; b.style.display = ''; },
  haciaDonde() { return leyenda ? leyenda.replace(/^apunt[áa] (hacia |a |al )?/i, '') : 'adelante'; },
  tecnico(t) { $('tecnico').textContent = t || ''; },
  carga(f, t) { const c = $('carga'); c.style.display = f == null ? 'none' : 'block'; if (f != null) c.querySelector('i').style.width = Math.round(f * 100) + '%'; $('cargaTexto').textContent = t || ''; },
  progreso(f) { const b = $('cargando'); b.style.display = f == null ? 'none' : 'block'; if (f != null) b.firstElementChild.style.width = Math.round(f * 100) + '%'; },
};
if (params.has('debug')) document.body.classList.add('debug');

// lo que se prepara ANTES del toque (el modulo del modo y la escena armada), para que el toque abra la AR al instante
let preparado = null;
async function preparar(modo) {
  const m = await import('./modos/' + modo + '.js');
  preparado = { modo, m, est: tipo === 'escena' ? await armarEscena(escena, BASE, { progreso: ui.progreso, renderer }) : (tipo === 'portal' && m.preparar ? await m.preparar({ item: portalItem, BASE, ui }) : null) };
}
async function correr(modo, opc = {}) {
  ui.estado('cargando...'); ui.hud(true);
  if (window.amar) window.amar.modo = modo;   // el modo que corre (el cubo se gira con el dedo solo en la realidad aumentada)
  const pre = preparado && preparado.modo === modo ? preparado : null;
  const m = pre ? pre.m : await import('./modos/' + modo + '.js');
  if (tipo === 'portal') {   // el portal dibuja en su propio lienzo (el motor de splats y three en un mismo contexto)
    renderer.dispose(); lienzo.style.display = 'none';
    await m.arrancar({ est: pre && pre.est ? pre.est : null, item: portalItem, ui, BASE, sesion: opc.sesion });
    return;
  }
  if (tipo === 'escena') {
    // el renderer que va a dibujar (un cubo se arma con el); 8th Wall trae el suyo, y el cubo se arma en su primer cuadro
    const est = pre && pre.est ? pre.est : await armarEscena(escena, BASE, { progreso: ui.progreso, renderer: modo === 'ochowall' ? null : renderer });
    if (modo === 'ochowall') renderer.dispose();
    await m.arrancar({ renderer, est, escena, ui, BASE, lienzo, video: $('video'), CAP, sesion: opc.sesion });
  } else {
    if (modo === 'ver') { await m.arrancar({ obras: obras.map((o) => ({ id: o.id, obra: o })), ui, BASE, contenedor: $('ver') }); return; }
    const lista = [];
    for (const o of obras) lista.push({ id: o.id, obra: o, target: o.target, est: await armarObra(o, BASE, { progreso: ui.progreso, estado: (t) => ui.estado(t) }) });
    if (modo === 'pruebaventana') { await m.arrancar({ renderer, obras: lista, ui, BASE, lienzo }); return; }
    renderer.dispose();
    await m.arrancar({ obras: lista, ui, BASE, lienzo });
  }
}
// la AR rechazada por el toque se vuelve a pedir, pero no para siempre: si el navegador la niega (sin permiso, o en un
// marco que no la deja), despues del segundo reintento se sigue con el modo siguiente
let reintentosAR = 0;
async function conRespaldo(lista, auto, opc = {}) {
  for (let i = 0; i < lista.length; i++) {
    try { await correr(lista[i], i === 0 ? opc : {}); return; }
    catch (e) {
      console.warn('modo ' + lista[i] + ' falló:', e);
      // la AR se rechazo por el toque (el navegador no lo conto como gesto): se vuelve a pedir el toque, no se cae sin camara
      if ((lista[i] === 'webxr' || lista[i] === 'portalxr') && e.activacion && opc.otraVez && reintentosAR++ < 2) { opc.otraVez(); return; }
      if (lista[i] === 'ochowall') { location.search = location.search + '&sin8=1'; return; }
      if (i === lista.length - 1) {
        if (auto) { ui.hud(false); $('capacidades').textContent = tx('No se pudo abrir: ') + tx(String(e.message || e)); }
        else { alert(tx('No se pudo abrir: ') + tx(String(e.message || e))); location.reload(); }
      } else ui.estado('ese modo no anduvo acá, probando otro...', 'mal');
    }
  }
}
const modoSinCamara = tipo === 'escena' ? 'tres' : tipo === 'portal' ? 'portal3d' : 'ver';
const listaAR = () => modos.filter((x) => x !== 'tres' && x !== 'ver' && x !== 'ventana' && x !== 'portal3d').concat(modos.includes('ventana') ? ['ventana'] : [], [modoSinCamara]);
const sinCamara = () => [modoSinCamara];
$('bAR').onclick = () => { if (listaAR()[0] !== 'webxr') pantallaCompleta(); conRespaldo(listaAR()); };   // la AR de WebXR necesita el gesto entero
$('bVentana').onclick = () => conRespaldo(['ventana', 'tres']);
$('b3D').onclick = () => conRespaldo(sinCamara());
$('bSinCamara').onclick = (ev) => { ev.stopPropagation(); try { sessionStorage.setItem('amar.modo', sinCamara()[0]); } catch (e) { /* sin memoria */ } location.reload(); };

// Arranque directo: el QR lleva a la camara, sin menu previo (la leyenda va impresa abajo del QR).
// El menu solo aparece al SALIR de la camara, o si nada anduvo.
let pedido = null, menu = params.has('menu');
try { pedido = sessionStorage.getItem('amar.modo'); sessionStorage.removeItem('amar.modo'); if (sessionStorage.getItem('amar.menu') === '1') menu = true; sessionStorage.removeItem('amar.menu'); } catch (e) { /* sin memoria */ }
// Antes de abrir la camara se baja todo lo que hace falta, con una barra que cuenta los bytes de verdad: el
// motor y, en una coleccion, todas sus obras (videos y reconocimiento). Asi el visitante ve que avanza, y
// despues cada obra responde al instante aunque sean veinte.
function planDeDescarga(modo) {
  const lista = [];
  if (tipo === 'portal') { if (modo === 'portalxr' || modo === 'portal3d') lista.push([portalItem.portal.glb || portalItem.portal.spz, true]); return lista; }   // con su version: un modelo nuevo con el mismo nombre no sale de la cache vieja
  if (modo === 'ochowall') lista.push(['lib/8thwall/xr.js', false], ['lib/8thwall/xr-slam.js', false]);
  if (tipo !== 'escena') {
    // una obra sola: solo el reconocimiento; el video se reproduce en streaming (faststart) apenas la camara la ve.
    // una coleccion: tambien los videos de todas sus obras, para que cada una responda al instante
    if (modo === 'ochowall') for (const o of obras) { if (o.target) { const [r, q] = o.target.split('?'); lista.push([o.target, false], [r.replace(/\.json$/, '_luminance.jpg') + (q ? '?' + q : ''), false]); } if (o.video && tipo === 'coleccion') lista.push([o.video.split('?')[0], true]); }
    if (modo === 'ochowall' || modo === 'pruebaventana') for (const o of obras) if (o.ventana && o.ventana.spz) lista.push([o.ventana.spz.split('?')[0], true]);
  } else if (modo !== 'ver') for (const c of escena.contenidos || []) {
    if (c.archivo) lista.push([c.archivo.split('?')[0], true]); if (c.tipo === 'panel' && c.imagen) lista.push([c.imagen.split('?')[0], true]);
    // un cubo: su escena (app.json, scene.bin) en memoria; sus texturas y su codigo, a la cache del navegador
    if (c.tipo === 'cubo') for (const f of c.archivos || []) lista.push([(c.carpeta || 'cubo/') + f, /\.(json|bin)$/.test(f)]);
  }
  return lista;
}
async function descargarTodo(modo) {
  const D = window.amarDescargas, lista = planDeDescarga(modo);
  if (!D || !lista.length) return;
  const sinV = (r) => String(r).split('?')[0];
  const peso = (r) => (pesos[sinV(r)] && pesos[sinV(r)].bytes) || D.total[r] || 0;        // bytes desempaquetados (lo que cuenta el lector)
  const aire = (r) => (pesos[sinV(r)] && pesos[sinV(r)].aire) || peso(r);                   // bytes que viajan (comprimidos)
  const fraccion = (r) => (D.listo[r] ? 1 : Math.min(1, (D.recibido[r] || 0) / (peso(r) || Infinity)));
  const total = () => lista.reduce((s, [r]) => s + peso(r), 0);
  const hecho = () => lista.reduce((s, [r]) => s + fraccion(r) * peso(r), 0);
  const totalAire = () => lista.reduce((s, [r]) => s + aire(r), 0);
  const hechoAire = () => lista.reduce((s, [r]) => s + fraccion(r) * aire(r), 0);
  const mb = (b) => (b / 1e6).toFixed(b < 10e6 ? 1 : 0).replace('.', idioma === 'es' ? ',' : '.');
  let i = 0;
  const obreros = Array.from({ length: 3 }, async () => { while (i < lista.length) { const [r, b] = lista[i++]; await D.bajar(r, b); } });
  const reloj = setInterval(() => { const t = total(); ui.carga(t ? hecho() / t : 0, t ? mb(hechoAire()) + (idioma === 'es' ? ' de ' : ' of ') + mb(totalAire()) + ' MB' : ''); }, 150);
  await Promise.all(obreros); clearInterval(reloj); ui.carga(1, '');
  window.amarUrls = D.blobs;
}
async function arrancar(lista, modo) {
  try { await descargarTodo(modo); } catch (e) { console.warn('descarga', e); }
  ui.carga(null); $('arranqueTexto').textContent = tx(modo === 'ochowall' || modo === 'webxr' || modo === 'ventana' ? 'Abriendo la cámara' : 'Cargando');
  return conRespaldo(lista, true);
}
const queCarga = tx(tipo === 'coleccion' ? 'Cargando la colección' : tipo === 'obra' ? 'Cargando la obra' : tipo === 'ventana' ? 'Cargando la ventana' : tipo === 'portal' ? 'Cargando el portal' : 'Cargando la escena');
if (menu && !pedido) { $('inicio').classList.remove('silencio'); $('botones').classList.remove('auto'); }   // el menu, solo para quien salio de la camara
if (pedido) { $('botones').classList.add('auto'); $('inicio').classList.add('silencio'); $('arranqueTexto').textContent = queCarga; arrancar([pedido], pedido); }
else if (!menu) {
  $('botones').classList.add('auto'); $('inicio').classList.add('silencio'); $('arranqueTexto').textContent = queCarga;
  const primero = modos[0];
  setTimeout(() => $('inicio').classList.add('tarda'), 25000);   // si nada aparece, al menos la salida sin camara
  if (primero === 'ver' || primero === 'tres' || primero === 'pruebaventana' || primero === 'portal3d') arrancar([primero], primero);
  else {
    // LA CAMARA ARRANCA CON UN TOQUE (Niko, 14/10): primero se baja todo con la barra, despues toda la pantalla es el
    // boton. En el toque se pide la pantalla completa (sin la barra del navegador) y recien ahi se abre la camara.
    // WebXR y el giroscopio ademas exigen ese toque
    // la AR de las escenas (WebXR) se pide en el mismo toque: el modulo y la escena se preparan antes de mostrar
    // "Tocá para empezar", y en el toque no se pide la pantalla completa (la AR ya ocupa toda la pantalla y pedirla
    // gasta el gesto que la AR necesita). Las obras (8th Wall) si van a pantalla completa
    descargarTodo(primero).catch(() => {}).then(() => (primero === 'webxr' || primero === 'portalxr' ? preparar(primero).catch((e) => console.warn('preparar', e)) : null)).then(() => {
      let tocado = false;
      const pedirToque = () => { tocado = false; ui.hud(false); $('inicio').style.display = 'grid'; $('inicio').classList.add('silencio', 'tocar'); $('botones').classList.add('auto'); ui.carga(null); $('arranqueTexto').textContent = tx('Tocá para empezar'); };
      pedirToque();
      $('inicio').addEventListener('click', () => {
        if (tocado) return; tocado = true;
        const opc = { otraVez: pedirToque };
        if ((primero === 'webxr' || primero === 'portalxr') && preparado && preparado.m.pedirSesion) { try { opc.sesion = preparado.m.pedirSesion(ui.raizHud); opc.sesion.catch(() => {}); } catch (e) { /* se pide de nuevo adentro */ } }
        else pantallaCompleta();
        $('inicio').classList.remove('tocar'); $('arranqueTexto').textContent = tx('Abriendo la cámara');
        conRespaldo(listaAR(), true, opc);
      });
    });
  }
}
window.amar = { proyecto, tipo, obras, coleccion, escena, portal: portalItem, CAP, modos };
console.log('amAr', proyecto.nombre, '·', tipo, '·', (escena || coleccion || portalItem || obras[0]).id, '· modos', modos.join(', '), CAP);
