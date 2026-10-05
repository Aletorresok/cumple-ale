// Plan B en papel: imprime todo el banco para jugar sin internet (mímica en tarjetas para
// recortar, pares del impostor, encuestas con sus respuestas, preguntas, escape y hoja de puntos).
import { h, toast } from './util.js';
import { itemsDe } from './bancos.js';
import { EQUIPOS_BASE } from './config.js';

const JUEGOS_PUNTOS = ['Los invitados dicen', 'El impostor', 'Mímica', 'Trivia', 'Sala de escape', 'Extra'];

export function imprimirRespaldo(banco, cantidadEquipos = 4) {
  const mimica = itemsDe(banco, 'mimica');
  const pares = itemsDe(banco, 'par');
  const encuestas = itemsDe(banco, 'encuesta');
  const preguntas = itemsDe(banco, 'pregunta');
  const afirmaciones = itemsDe(banco, 'afirmacion');
  const escapes = itemsDe(banco, 'escape');
  const equipos = EQUIPOS_BASE.slice(0, cantidadEquipos);

  const seccion = (titulo, ayuda, ...contenido) => h('section', { class: 'imp-seccion' },
    h('h2', { class: 'imp-h' }, titulo), ayuda && h('p', { class: 'imp-ayuda' }, ayuda), contenido);

  const hoja = h('div', { id: 'impresion', class: 'respaldo' },
    h('div', { class: 'imp-cabecera' }, h('b', null, banco.titulo), ' · plan B en papel, por si se corta internet'),

    seccion('Hoja de puntos', 'Anotá los puntos de cada equipo después de cada juego.',
      h('table', { class: 'imp-tabla' },
        h('thead', null, h('tr', null, h('th', null, 'Juego'), equipos.map((e) => h('th', null, e.nombre)))),
        h('tbody', null,
          JUEGOS_PUNTOS.map((j) => h('tr', null, h('td', null, j), equipos.map(() => h('td')))),
          h('tr', { class: 'imp-total' }, h('td', null, 'Total'), equipos.map(() => h('td')))))),

    mimica.length > 0 && seccion(`Mímica · ${mimica.length} tarjetas`, 'Recortalas y ponelas en una bolsa. Quien actúa saca una; si su equipo adivina en el minuto, suma 10.',
      h('div', { class: 'imp-recortes' }, mimica.map((m) => h('div', { class: 'imp-recorte' }, m.palabra)))),

    pares.length > 0 && seccion('El impostor', 'En cada ronda: escribí la palabra común en papelitos para todos menos uno, que recibe la del impostor. Pistas en voz alta y votación a mano alzada.',
      h('table', { class: 'imp-tabla' },
        h('thead', null, h('tr', null, h('th', null, 'Ronda'), h('th', null, 'Todos'), h('th', null, 'Impostor'))),
        h('tbody', null, pares.map((p, i) => h('tr', null, h('td', null, i + 1), h('td', null, p.a), h('td', null, p.b)))))),

    encuestas.length > 0 && seccion('Los invitados dicen', 'Leé la pregunta; los equipos se turnan para adivinar. Tres errores y el otro equipo puede robar.',
      encuestas.map((e, i) => h('div', { class: 'imp-bloque' },
        h('b', null, `${i + 1}. ${e.pregunta}`),
        h('ol', null, e.respuestas.map((r) => h('li', null, `${r.texto} — ${r.puntos}`)))))),

    preguntas.length > 0 && seccion('Trivia', 'Leé la pregunta y las opciones; cada equipo anota su respuesta en un papel. La correcta está marcada con ✓.',
      preguntas.map((p, i) => h('div', { class: 'imp-bloque' },
        h('b', null, `${i + 1}. ${p.pregunta}`),
        h('div', null, '✓ ', h('b', null, p.correcta), '   ·   ', p.incorrectas.filter(Boolean).join('   ·   '))))),

    afirmaciones.length > 0 && seccion('Verdadero o falso', null,
      afirmaciones.map((a, i) => h('div', { class: 'imp-bloque' },
        h('b', null, `${i + 1}. ${a.texto}`), h('div', null, a.verdadera ? 'Verdadero' : 'Falso', a.explicacion ? ` — ${a.explicacion}` : '')))),

    escapes.map((e) => seccion(`Sala de escape · ${e.titulo}`, 'Leé cada desafío en voz alta; el primer equipo que dice la respuesta abre el candado.',
      e.intro && h('p', { class: 'imp-ayuda' }, e.intro),
      e.candados.map((c, i) => h('div', { class: 'imp-bloque' },
        h('b', null, `🔒 ${i + 1}. ${c.titulo || ''}`),
        h('div', null, c.desafio),
        h('div', null, 'Respuesta: ', h('b', null, c.respuesta)),
        c.pistas?.length > 0 && h('div', { class: 'imp-ayuda' }, 'Pistas: ', c.pistas.join(' · ')))),
      e.final && h('p', null, h('b', null, 'Final: '), e.final))));

  document.body.append(hoja);
  document.body.classList.add('imprimiendo');
  const limpiar = () => { hoja.remove(); document.body.classList.remove('imprimiendo'); };
  window.addEventListener('afterprint', limpiar, { once: true });
  if (!mimica.length && !pares.length && !encuestas.length && !preguntas.length) toast('El banco está casi vacío: solo sale la hoja de puntos');
  setTimeout(() => { window.print(); if (!window.pruebas) setTimeout(limpiar, 1000); }, 100);
}
