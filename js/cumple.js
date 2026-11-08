// Momento del «Feliz cumpleaños»: se puede poner en cualquier momento de la noche, aunque haya un
// juego en curso. Quien organiza toca el botón fijo del panel (sala.data.cumpleT = marca de tiempo)
// y la tele pasa el video de los Ramones con audio, encima de lo que esté mostrando. Al terminar
// desaparece solo. «Cortar» pone sala.data.cumpleFin y lo saca.
import { h } from './util.js';

export const VIDEO_CUMPLE = 'video/feliz-cumple.mp4';
const VIGENCIA = 90000;      // una marca más vieja que esto (ej.: al recargar la tele) ya no arranca
let vista = null;            // { marca, el }
const pasados = new Set();

export function vigilarCumple(sala) {
  const t = Number(sala.data?.cumpleT || 0);
  const fin = Number(sala.data?.cumpleFin || 0);
  const activo = t > fin;
  if (vista && (!activo || String(t) !== vista.marca)) { vista.el.remove(); vista = null; }
  if (!activo || vista || pasados.has(String(t)) || Date.now() - t > VIGENCIA) return;
  const marca = String(t);
  pasados.add(marca);
  const video = h('video', { class: 'tv-video', src: VIDEO_CUMPLE, autoplay: true, playsinline: true });
  const aviso = h('button', { class: 'tv-cumple-sonido', hidden: true, onclick: () => { video.muted = false; aviso.hidden = true; } }, '🔊 Tocá para el sonido');
  const el = h('div', { class: 'tv-video-marco tv-cumple' }, video, aviso);
  video.addEventListener('ended', () => { if (vista?.marca === marca) { el.remove(); vista = null; } });
  document.body.append(el);
  vista = { marca, el };
  // Si el navegador no deja arrancar con sonido, arranca mudo y ofrece activarlo con un toque.
  video.play?.().catch(() => { video.muted = true; aviso.hidden = false; video.play().catch(() => {}); });
}
