// The AR button of the cube: the same cube standing in your space, through amAr (ar/, next to content/ in the zip).
//
// On a phone or tablet with the piece open on its own (a gateway, objkt's file server, GitHub Pages) the button opens
// ar/ right away. Anywhere else it shows a QR code to ar/, and the link to copy:
//  * on a computer the AR is on the phone anyway (scan it);
//  * inside objkt the piece runs in a sandboxed frame without its own origin, and there the browser keeps the camera
//    closed: Chrome answers "Invalid security origin" although objkt's frame allows camera and xr-spatial-tracking
//    (checked 19/11/2026). So a phone on objkt gets the link, to open in the browser.
// The address is this piece's own (wherever it is served from), so it keeps working after the mint.

import { qr, qrSvg } from './qrcode.js';

const URL_AR = new URL('../../ar/index.html', import.meta.url).href;
const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4zM4 7.4l8 4.6 8-4.6M12 12v9.2"/></svg>';
const CSS = `
#truman-ar{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(14px,calc(env(safe-area-inset-bottom) + 10px));z-index:310;
  display:flex;align-items:center;gap:8px;margin:0;padding:9px 15px 9px 12px;border:1px solid rgba(255,255,255,.2);border-radius:999px;
  background:rgba(8,10,14,.66);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 2px 18px rgba(0,0,0,.35);color:#fff;
  font:12px/1 tl-din,urwdin,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;
  cursor:pointer;opacity:0;transition:opacity .8s ease;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
#truman-ar.on{opacity:.88}#truman-ar.on:hover,#truman-ar.on:focus-visible{opacity:1}
#truman-ar svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:1.5;stroke-linejoin:round}
#truman-ar-panel{position:fixed;inset:0;z-index:320;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.55);
  font:13px/1.45 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#fff}
#truman-ar-panel .box{position:relative;box-sizing:border-box;width:min(340px,100%);max-height:100%;overflow:auto;padding:22px 20px 18px;border-radius:16px;
  background:rgba(8,10,14,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 8px 40px rgba(0,0,0,.5);text-align:center}
#truman-ar-panel h2{margin:2px 26px 14px;font:14px/1.25 tl-din,urwdin,system-ui,sans-serif;font-weight:400;letter-spacing:.16em;text-transform:uppercase}
#truman-ar-panel .qr{width:min(210px,58vw);margin:0 auto 14px;border-radius:8px;overflow:hidden;line-height:0}
#truman-ar-panel .qr svg{width:100%;height:auto;display:block}
#truman-ar-panel p{margin:0 0 12px;opacity:.86}
#truman-ar-panel .link{display:flex;gap:6px}
#truman-ar-panel input{flex:1;min-width:0;box-sizing:border-box;padding:8px 9px;border:1px solid rgba(255,255,255,.2);border-radius:8px;
  background:rgba(255,255,255,.07);color:#fff;font:11px/1.2 ui-monospace,Consolas,monospace}
#truman-ar-panel button{border:1px solid rgba(255,255,255,.25);border-radius:8px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;
  font:11px/1 tl-din,urwdin,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:0 12px;-webkit-tap-highlight-color:transparent}
#truman-ar-panel small{display:block;margin-top:13px;opacity:.55;font-size:11px;line-height:1.4}
#truman-ar-panel .close{position:absolute;top:12px;right:12px;width:30px;height:30px;padding:0;border-radius:50%;font:16px/1 system-ui,sans-serif;letter-spacing:0}`;

const inFrame = () => { try { return window.self !== window.top; } catch (e) { return true; } };
// a sandboxed frame without allow-same-origin (objkt) has no origin of its own: no camera there
const noOrigin = () => self.origin === 'null' || location.origin === 'null';
const touch = () => matchMedia('(pointer: coarse)').matches;

async function copy(text, input) {
  const legacy = () => { try { input.focus(); input.select(); input.setSelectionRange(0, text.length); return document.execCommand('copy'); } catch (e) { return false; } };
  // objkt's frame blocks the Clipboard API (permissions policy): there the old way goes first
  if (noOrigin() && legacy()) return true;
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* not allowed here */ }
  return legacy();
}

function panel() {
  if (document.getElementById('truman-ar-panel')) return;
  const onObjkt = touch() && noOrigin();          // a phone inside objkt: the link, to open in the browser
  const el = document.createElement('div');
  el.id = 'truman-ar-panel';
  el.innerHTML = '<div class="box" role="dialog" aria-modal="true" aria-label="See it in your space">'
    + '<button class="close" aria-label="Close">×</button>'
    + '<h2>See it in your space</h2>'
    + '<div class="qr"></div>'
    + '<p>' + (onObjkt
      ? 'Inside objkt the browser keeps the camera closed. Open this link in your browser:'
      : 'Scan it with your phone. The cube stands in your room: walk around it and look into each face.') + '</p>'
    + '<div class="link"><input readonly aria-label="Link to the AR view"><button class="copy">Copy</button></div>'
    + '<small>Android with Chrome: augmented reality, it stays where you put it. iPhone: over the camera, turning with the phone.</small>'
    + '</div>';
  el.querySelector('.qr').innerHTML = qrSvg(qr(URL_AR, 'M'));
  const input = el.querySelector('input');
  input.value = URL_AR;
  const close = () => { el.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === el) close(); });
  el.querySelector('.close').onclick = close;
  input.onclick = () => input.select();
  el.querySelector('.copy').onclick = async (e) => {
    const b = e.currentTarget;
    b.textContent = (await copy(URL_AR, input)) ? 'Copied' : 'Select it';
    if (b.textContent === 'Select it') input.select();
    setTimeout(() => { b.textContent = 'Copy'; }, 2200);
  };
  document.addEventListener('keydown', esc);
  document.body.appendChild(el);
}

// shown once the cube is loaded, if this build has the AR view
export async function showArButton() {
  if (document.getElementById('truman-ar')) return;
  try { const r = await fetch(new URL('../../ar/proyecto.json', import.meta.url), { method: 'HEAD' }); if (!r.ok) return; } catch (e) { return; }
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const b = document.createElement('button');
  b.id = 'truman-ar';
  b.type = 'button';
  b.innerHTML = ICON + '<span>View in AR</span>';
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (touch() && !noOrigin()) {
      // on its own (or in a frame that lets it have its origin): straight to the AR, in a new tab if it can
      if (!inFrame()) { const w = window.open(URL_AR, '_blank'); if (w) return; }
      location.href = URL_AR;
      return;
    }
    panel();
  });
  document.body.appendChild(b);
  requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('on')));
}
