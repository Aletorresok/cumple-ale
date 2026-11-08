// Completá la frase: la tele muestra una frase célebre de Los Simpson con palabras ocultas. El equipo
// al que le toca la completa en voz alta y quien organiza marca cada palabra correcta (1 punto cada
// una). Si el equipo no la sabe, cualquier otro puede robarla gritando: el panel marca quién la dijo.
// Las frases se escriben con las palabras ocultas entre corchetes: «¡Multiplícate por [cero]!».
// Dentro de los corchetes, «/» separa otras formas que también valen: «[donas/rosquillas]».
import { h, montar, vista, selector, pildoraEquipo, ranking, logoEquipo } from './comun.js';
import { mezclar, toast, sonido, confeti, guardarLocal, leerLocal } from '../util.js';

const PUNTOS = 1;
const CLAVE_PROPIAS = 'frases-propias';

export const FRASES = [
  '¡Multiplícate por [cero]!',
  '¡Ay, [caramba]!',
  '¡Cómete mis [shorts/calzones]!',
  '¡Cállate, [Flanders]!',
  'En esta casa obedecemos las leyes de la [termodinámica]',
  'El alcohol: la causa y la [solución] de todos los [problemas] de la vida',
  'Sin [tele] y sin [cerveza], Homero pierde la [cabeza]',
  'Lisa, los [vampiros] son seres de ficción, como los duendes, los gremlins y los [esquimales]',
  'Lo intentaron y fracasaron miserablemente. La lección es: nunca lo [intenten]',
  'Smithers, suelta a los [perros/sabuesos]',
  'Hola, soy Troy [McClure]. Tal vez me recuerden de…',
  'Si no te gusta tu trabajo no hacés [huelga]: vas todos los días y lo hacés [mal]',
];

// «Hola [mundo]» → [{ t: 'Hola ' }, { oculta: true, palabra: 'mundo', largo: 5 }]
export function partir(frase) {
  const partes = [];
  const re = /\[([^\]]+)\]/g;
  let i = 0, m;
  while ((m = re.exec(frase))) {
    if (m.index > i) partes.push({ t: frase.slice(i, m.index) });
    const formas = m[1].split('/').map((x) => x.trim()).filter(Boolean);
    partes.push({ oculta: true, palabra: formas[0] || '', otras: formas.slice(1), largo: (formas[0] || '').length });
    i = re.lastIndex;
  }
  if (i < frase.length) partes.push({ t: frase.slice(i) });
  return partes;
}

const frasesPropias = () => { const l = leerLocal(CLAVE_PROPIAS, []); return Array.isArray(l) ? l.filter((f) => typeof f === 'string' && f.includes('[')) : []; };

export default {
  id: 'frase',
  nombre: 'Completá la frase',
  icono: '💬',
  resumen: 'Una frase célebre con palabras ocultas en la tele: el equipo la completa a los gritos, 1 punto por palabra.',
  tipos: [],

  configurar({ sala }) {
    const propias = h('textarea', { class: 'campo', id: 'cfg-frases', rows: 5, value: frasesPropias().join('\n'),
      placeholder: 'Una frase por línea, con las palabras ocultas entre corchetes:\n¡Multiplícate por [cero]!\nMmm… [donas/rosquillas]' });
    const conClasicas = h('input', { type: 'checkbox', id: 'cfg-clasicas', checked: true });
    const cuantas = selector('cfg-cuantas', 'Frases', [[4, '4 (una por equipo)'], [8, '8 (dos por equipo)'], [12, '12'], [0, 'Todas']], 8);
    return {
      el: h('div', { class: 'pila' },
        h('label', { class: 'pila-s' }, h('span', { class: 'etq' }, 'Tus frases (van primero, en este orden)'), propias),
        h('label', { class: 'check' }, conClasicas, `Sumar las ${FRASES.length} frases que vienen con el juego (al azar)`),
        cuantas.el,
        h('p', { class: 'muted chico' }, `Le toca a un equipo por frase, rotando. Responde en voz alta y vos marcás cada palabra correcta (${PUNTOS} punto). Si no la sabe, pueden robarla los demás: tocás el equipo que la dijo.`)),
      leer: () => {
        const mias = propias.value.split('\n').map((l) => l.trim()).filter(Boolean);
        const malas = mias.filter((f) => !f.includes('['));
        if (malas.length) { toast(`Esta frase no tiene palabras entre corchetes: «${malas[0]}»`, 'error'); propias.focus(); return null; }
        guardarLocal(CLAVE_PROPIAS, mias);
        let lista = [...mias, ...(conClasicas.checked ? mezclar(FRASES.filter((f) => !mias.includes(f))) : [])];
        const n = Number(cuantas.valor());
        if (n) lista = lista.slice(0, n);
        if (!lista.length) { toast('Escribí al menos una frase o sumá las que vienen', 'error'); return null; }
        const equipos = sala.equipos().map((e) => e.id);
        return { frases: lista, equipos };
      },
    };
  },

  async iniciar(sala, { frases, equipos }) {
    const orden = mezclar(equipos);
    const partes = partir(frases[0]);
    const id = await sala.iniciarJuego({ tipo: 'frase', fase: 'jugando', n: 0, total: frases.length, orden, turno: orden[0], ...publico(partes) });
    await sala.guardarPrivado({ juego: id, frases });
  },

  host(el, sala) {
    let privado = null;
    let ocupado = false;
    sala.privadoDelJuego().then((p) => { privado = p; v.actualizar(); });
    const partesActuales = () => partir(privado.frases[sala.juego.n]);

    async function accion(f) {
      if (ocupado) return;
      ocupado = true;
      try { await f(); } catch (e) { toast(e.message, 'error'); }
      ocupado = false;
    }

    // Palabra i adivinada por el equipo eid (o por nadie: se revela sin punto).
    const marcar = (i, eid) => accion(async () => {
      const j = sala.juego;
      if (j.palabras?.[i] !== undefined) return;
      const p = partesActuales()[i];
      await sala.actualizarJuego({ ['palabras.' + i]: p.palabra, ['quien.' + i]: eid || 'nadie' }, eid ? { [eid]: PUNTOS } : {});
      sonido(eid ? 'bien' : 'mal');
    });

    const revelarTodo = () => accion(async () => {
      const j = sala.juego;
      const patch = {};
      partesActuales().forEach((p, i) => { if (p.oculta && j.palabras?.[i] === undefined) { patch['palabras.' + i] = p.palabra; patch['quien.' + i] = 'nadie'; } });
      if (Object.keys(patch).length) await sala.actualizarJuego(patch);
    });

    const siguiente = () => accion(async () => {
      const j = sala.juego;
      const n = j.n + 1;
      if (n >= j.total) { await sala.actualizarJuego({ fase: 'fin' }); return; }
      await sala.actualizarJuego({ n, turno: j.orden[n % j.orden.length], ...publico(partir(privado.frases[n])) });
    });

    const v = vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${!!privado}:${JSON.stringify(sala.juego.quien || {})}`,
      dibujar() {
        const j = sala.juego;
        if (!privado) { montar(el, h('p', { class: 'muted' }, 'Preparando…')); return; }
        if (j.fase === 'fin') { montar(el, h('p', { class: 'grande' }, '¡Terminó Completá la frase!'), ranking(sala)); return; }
        const partes = partesActuales();
        const ocultas = partes.map((p, i) => [p, i]).filter(([p]) => p.oculta);
        const faltan = ocultas.filter(([, i]) => j.palabras?.[i] === undefined).length;
        const turno = sala.equipo(j.turno);
        montar(el,
          h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, `Frase ${j.n + 1} de ${j.total}`), h('span', null, 'Responde ', pildoraEquipo(turno))),
          h('p', { class: 'grande frase-host' }, partes.map((p) => (p.oculta ? h('b', { class: 'frase-oculta-host' }, p.palabra) : p.t))),
          h('div', { class: 'pila-s' }, ocultas.map(([p, i]) => {
            const ya = j.palabras?.[i] !== undefined;
            const quien = j.quien?.[i];
            return h('div', { class: 'tarjeta pila-s frase-palabra' + (ya ? ' hecha' : '') },
              h('div', { class: 'fila entre' }, h('b', null, p.palabra), p.otras.length > 0 && h('span', { class: 'muted chico' }, 'también: ' + p.otras.join(', ')),
                ya && (quien !== 'nadie' ? pildoraEquipo(sala.equipo(quien), ` +${PUNTOS}`) : h('span', { class: 'muted chico' }, 'nadie'))),
              !ya && h('div', { class: 'fila' },
                h('button', { class: 'btn ok', onclick: () => marcar(i, j.turno) }, `✓ La dijo ${turno?.nombre || ''}`),
                sala.equipos().filter((e) => e.id !== j.turno).map((e) => h('button', { class: 'pildora-boton', style: { '--c': e.color }, onclick: () => marcar(i, e.id) }, 'Robó ' + e.nombre)),
                h('button', { class: 'btn-link', onclick: () => marcar(i, null) }, 'Nadie: revelar')));
          })),
          faltan > 0 && h('button', { class: 'btn-link', onclick: revelarTodo }, 'Revelar lo que falta'),
          h('button', { class: 'btn grande' + (faltan ? ' sec' : ''), onclick: siguiente }, j.n + 1 >= j.total ? 'Ver resultados' : 'Siguiente frase →'));
      },
    });
    return v;
  },

  alumno(el, sala) {
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${sala.juego.turno}`,
      dibujar() {
        const j = sala.juego;
        if (j.fase === 'fin') { montar(el, h('h2', null, '¡Terminó Completá la frase!'), ranking(sala)); return; }
        const mio = sala.data.asignaciones?.[sala.uid];
        const turno = sala.equipo(j.turno);
        montar(el, h('div', { class: 'resultado' + (mio === j.turno ? ' bien' : '') },
          h('div', { class: 'resultado-titulo' }, '📺 ¡Miren la tele!'),
          h('p', null, mio === j.turno ? '¡Le toca a tu equipo! Completen la frase en voz alta.' : `Le toca a ${turno?.nombre}. Si no la saben, griten para robarla.`)));
      },
    });
  },

  tv(el, sala) {
    let zonaFrase = null;
    let ultimas = '';
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}`,
      dibujar() {
        const j = sala.juego;
        zonaFrase = null; ultimas = '';
        if (j.fase === 'fin') {
          sonido('fin'); confeti();
          montar(el, h('div', { class: 'tv-centro' }, h('div', { class: 'tv-icono' }, '💬'), h('h1', { class: 'tv-titulo' }, '¡Terminó Completá la frase!'), ranking(sala)));
          return;
        }
        const turno = sala.equipo(j.turno);
        zonaFrase = h('p', { class: 'tv-frase' });
        montar(el, h('div', { class: 'tv-centro' },
          h('div', { class: 'tv-etiqueta' }, `💬 Completá la frase · ${j.n + 1} de ${j.total}`),
          h('div', { class: 'tv-sub fila nowrap', style: { justifyContent: 'center', gap: '.4em' } }, 'Responde', logoEquipo(turno), h('b', { style: { color: turno?.color } }, turno?.nombre)),
          zonaFrase,
          h('p', { class: 'tv-sub chico' }, `Cada palabra correcta vale ${PUNTOS} punto. Si no la saben, ¡los demás pueden robarla!`)));
        pintar();
      },
      refrescar() { pintar(); },
    });

    function pintar() {
      if (!zonaFrase) return;
      const j = sala.juego;
      const k = JSON.stringify(j.palabras || {});
      if (k === ultimas) return;
      const antes = ultimas ? Object.keys(JSON.parse(ultimas)) : null;
      ultimas = k;
      montar(zonaFrase, (j.partes || []).map((p, i) => {
        if (!p.oculta) return h('span', null, p.t);
        const palabra = j.palabras?.[i];
        if (palabra === undefined) return h('span', { class: 'tv-frase-hueco', style: { '--n': Math.max(3, p.largo) } }, ' ');
        const quien = j.quien?.[i];
        const eq = quien && quien !== 'nadie' ? sala.equipo(quien) : null;
        const nueva = antes && !antes.includes(String(i));
        return h('span', { class: 'tv-frase-palabra' + (eq ? '' : ' nadie') + (nueva ? ' nueva' : ''), style: { '--c': eq?.color || '#888' } }, palabra);
      }));
      const todas = (j.partes || []).every((p, i) => !p.oculta || j.palabras?.[i] !== undefined);
      if (antes && todas) confeti();
    }
  },
};

// Lo que ven la tele y los celulares: el texto visible y el largo de cada palabra oculta (no la palabra).
function publico(partes) {
  return { partes: partes.map((p) => (p.oculta ? { oculta: true, largo: p.largo } : { t: p.t })), palabras: {}, quien: {} };
}
