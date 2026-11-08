// Intro de la noche: la tele muestra la apertura con fanfarria antes de empezar los juegos.
// Se dispara desde la escaleta (sala.data.pantalla = 'intro', sala.data.introT = marca de tiempo,
// que cambia cada vez para poder repetirla). Suena audio/tema.mp3 (el tema que eligió Alexis); si no carga, la fanfarria.
import { h, montar } from './util.js';
import { tocar, FANFARRIA } from './audio.js';
import { LOGOS } from './config.js';

// El tema suena una vez; si la tele sale de la intro antes de que termine, se corta.
let tema = null;
export function pararIntro() { if (tema) { tema.pause(); tema = null; } }

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
        h('span', { class: 'in-equipo', style: { '--c': e.color, '--i': i } }, LOGOS[e.id] && h('img', { class: 'in-logo', src: LOGOS[e.id], alt: '' }), e.nombre))),
      h('div', { class: 'in-final' }, '¡Que empiece la fiesta!'))));
  pararIntro();
  const a = new Audio('audio/tema.mp3');
  tema = a;
  a.addEventListener('error', () => { if (tema === a) { tema = null; tocar(FANFARRIA); } }, { once: true });
  a.addEventListener('ended', () => { if (tema === a) tema = null; }, { once: true });
  a.play().catch(() => { if (tema === a) { tema = null; tocar(FANFARRIA); } });
}
