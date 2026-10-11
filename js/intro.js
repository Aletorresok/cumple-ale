// Intro de la noche: la tele muestra la apertura con fanfarria antes de empezar los juegos.
// Se dispara desde la escaleta (sala.data.pantalla = 'intro', sala.data.introT = marca de tiempo,
// que cambia cada vez para poder repetirla). Si existe audio/tema.mp3 suena ese; si no, la fanfarria.
import { h, montar } from './util.js';
import { reproducir, tocar, FANFARRIA } from './audio.js';

export function intro(el, sala) {
  const marca = String(sala.data?.introT || 0);
  if (el.querySelector('.tv-intro')?.getAttribute('data-t') === marca) return; // ya está pasando
  const equipos = sala.equipos();
  montar(el, h('div', { class: 'tv-intro', 'data-t': marca },
    h('div', { class: 'in-nubes', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
    h('div', { class: 'in-centro' },
      h('div', { class: 'in-antes' }, 'Springfield presenta'),
      h('h1', { class: 'in-titulo' }, 'El cumple de Ale'),
      h('div', { class: 'in-equipos' }, equipos.map((e, i) =>
        h('span', { class: 'in-equipo', style: { '--c': e.color, '--i': i } }, e.nombre))),
      h('div', { class: 'in-final' }, '¡Que empiece la fiesta!'))));
  reproducir('audio/tema.mp3').then((sono) => { if (!sono) tocar(FANFARRIA); });
}
