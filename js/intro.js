// Intro de la noche: la tele muestra la apertura con fanfarria antes de empezar los juegos.
// Se dispara desde la escaleta (sala.data.pantalla = 'intro', sala.data.introT = marca de tiempo,
// que cambia cada vez para poder repetirla). Suena audio/tema.mp3 (el tema que eligió Alexis); si no carga, la fanfarria.
import { h, montar } from './util.js';
import { tocar, FANFARRIA } from './audio.js';
import { LOGOS } from './config.js';

// El tema suena una vez; si la tele sale de la intro antes de que termine, se corta (y sus escenas también).
let tema = null;
let timers = [];
export function pararIntro() {
  if (tema) { tema.pause(); tema = null; }
  timers.forEach(clearTimeout); timers = [];
}
const despues = (ms, f) => timers.push(setTimeout(f, ms));

// La intro dura lo que el tema (1 min 19 s): título, pizarrón de Bart, presentación de cada equipo y final.
const DURACION = 78000;
const TITULO = 9000;
const PIZARRON = 13000;
const FRASE_PIZARRON = 'No me embriagaré en el cumple de Ale';

// Intros que ya pasaron (por marca): al volver de un juego, la tele no la repite; muestra `despuesDe`.
const pasadas = new Set();

export function intro(el, sala, despuesDe) {
  const marca = String(sala.data?.introT || 0);
  if (el.querySelector('.tv-intro')?.getAttribute('data-t') === marca) return; // ya está pasando
  if (pasadas.has(marca)) { despuesDe?.(el, sala); return; }
  pasadas.add(marca);
  pararIntro();
  const equipos = sala.equipos();
  const escena = h('div', { class: 'in-centro' });
  montar(el, h('div', { class: 'tv-intro', 'data-t': marca },
    h('div', { class: 'in-nubes', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
    escena));

  // 1. Título
  montar(escena,
    h('div', { class: 'in-antes' }, 'Springfield presenta'),
    h('h1', { class: 'in-titulo' }, 'El cumple de Ale'),
    h('div', { class: 'in-equipos' }, equipos.map((e, i) =>
      h('span', { class: 'in-equipo', style: { '--c': e.color, '--i': i } }, LOGOS[e.id] && h('img', { class: 'in-logo', src: LOGOS[e.id], alt: '' }), e.nombre))));

  // 2. Pizarrón: la frase se escribe sola, renglón por renglón, como el castigo de Bart.
  despues(TITULO, () => {
    const renglones = Array.from({ length: 5 }, () => h('div', { class: 'in-renglon' }));
    montar(escena, h('div', { class: 'in-pizarron' }, renglones));
    const porRenglon = (PIZARRON - 1500) / renglones.length;
    renglones.forEach((r, k) => {
      for (let c = 1; c <= FRASE_PIZARRON.length; c++) {
        despues(k * porRenglon + (c * (porRenglon * 0.85)) / FRASE_PIZARRON.length, () => { r.textContent = FRASE_PIZARRON.slice(0, c); });
      }
    });
  });

  // 3. Un equipo por vez: logo grande, nombre y sus integrantes.
  const inicioEquipos = TITULO + PIZARRON;
  const final = DURACION - 6000;
  const porEquipo = equipos.length ? (final - inicioEquipos) / equipos.length : 0;
  equipos.forEach((e, i) => despues(inicioEquipos + i * porEquipo, () => {
    const eq = sala.equipo(e.id) || e;
    const miembros = sala.miembros(e.id).map((m) => m.nombre);
    montar(escena, h('div', { class: 'in-presenta', style: { '--c': eq.color } },
      h('div', { class: 'in-antes' }, `Equipo ${i + 1}`),
      LOGOS[e.id] && h('img', { class: 'in-logo-grande', src: LOGOS[e.id], alt: '' }),
      h('h1', { class: 'in-titulo in-nombre-eq' }, eq.nombre),
      h('div', { class: 'in-miembros' }, miembros.length
        ? miembros.map((n, k) => h('span', { style: { '--i': k } }, n))
        : h('span', { class: 'in-sin' }, 'Todavía sin integrantes: armá los equipos antes de la intro'))));
  }));

  // 4. Final: todos los logos juntos.
  despues(final, () => {
    montar(escena,
      h('div', { class: 'in-logos' }, equipos.map((e, i) => LOGOS[e.id] && h('img', { src: LOGOS[e.id], alt: '', style: { '--i': i } }))),
      h('h1', { class: 'in-titulo' }, '¡Que empiece la fiesta!'));
  });
  // Terminada la intro, la tele vuelve sola a su pantalla de espera.
  despues(DURACION + 4000, () => { if (el.querySelector('.tv-intro')?.getAttribute('data-t') === marca) despuesDe?.(el, sala); });

  const a = new Audio('audio/tema.mp3');
  tema = a;
  a.addEventListener('error', () => { if (tema === a) { tema = null; tocar(FANFARRIA); } }, { once: true });
  a.addEventListener('ended', () => { if (tema === a) tema = null; }, { once: true });
  a.play().catch(() => { if (tema === a) { tema = null; tocar(FANFARRIA); } });
}
