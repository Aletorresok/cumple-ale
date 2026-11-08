// Momento del «Feliz cumpleaños»: la tele pasa el video de los Ramones (con audio) a pantalla
// completa y, cuando termina, vuelve sola a su pantalla de espera. Se dispara desde la escaleta
// (sala.data.pantalla = 'cumple', sala.data.cumpleT = marca de tiempo, distinta cada vez para repetirlo).
import { h, montar } from './util.js';

export const VIDEO_CUMPLE = 'video/feliz-cumple.mp4';
const pasados = new Set();   // marcas ya reproducidas: al volver de otra pantalla no se repite

export function cumple(el, sala, despuesDe) {
  const marca = String(sala.data?.cumpleT || 0);
  if (el.querySelector('.tv-cumple')?.getAttribute('data-t') === marca) return; // ya está pasando
  if (pasados.has(marca)) { despuesDe?.(el, sala); return; }
  pasados.add(marca);
  const video = h('video', { class: 'tv-video', src: VIDEO_CUMPLE, autoplay: true, playsinline: true });
  const aviso = h('button', { class: 'tv-cumple-sonido', hidden: true, onclick: () => { video.muted = false; aviso.hidden = true; } }, '🔊 Tocá para el sonido');
  video.addEventListener('ended', () => { if (el.querySelector('.tv-cumple')?.getAttribute('data-t') === marca) despuesDe?.(el, sala); });
  montar(el, h('div', { class: 'tv-video-marco tv-cumple', 'data-t': marca }, video, aviso));
  // Si el navegador no deja arrancar con sonido, arranca mudo y ofrece activarlo con un toque.
  video.play?.().catch(() => { video.muted = true; aviso.hidden = false; video.play().catch(() => {}); });
}
