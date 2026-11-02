// Quiz por equipos: todos responden desde el celular. Dos modos:
//  · puntos: suma cada equipo según qué proporción de sus integrantes acertó.
//  · castigo (estilo programa japonés): cada integrante vota, la opción más votada es la
//    respuesta del equipo (si empatan, desempata el capitán de la pregunta) y el equipo que
//    se equivoca paga una prenda.
import { h, montar, vista, selectorBanco, selector, pildoraEquipo, ranking, esperando } from './comun.js';
import { itemsDe } from '../bancos.js';
import { mezclar, cuentaRegresiva, letraOpcion, toast, sonido, vibrar, idAzar } from '../util.js';

const PUNTOS = 100;

// Prendas suaves y de tema; todas tienen versión sin alcohol.
export const PRENDAS = [
  'Todo el equipo toma un trago de Duff (o de Buzz Cola).',
  'Todo el equipo grita «¡Ay, caramba!» con voz de Bart.',
  'Todo el equipo hace el «¡Doh!» de Homero a la vez.',
  'Un integrante canta el tema de Los Simpson tarareando.',
  'Un integrante come una dona sin usar las manos.',
  'Todo el equipo imita la risa de Nelson: «¡Ja, ja!».',
  'Un integrante imita al Sr. Burns diciendo «Excelente».',
  'El equipo se saca una foto del sillón: se apiñan en el sofá más cercano.',
  'Un integrante dice «Gracias, vuelva pronto» con acento de Apu.',
  'Todo el equipo baila 10 segundos como Homero.',
];

// Elige al capitán de cada equipo para una pregunta: alguien conectado, al azar.
function capitanes(sala) {
  const out = {};
  for (const e of sala.equipos()) {
    const m = sala.miembrosActivos(e.id);
    if (m.length) out[e.id] = mezclar(m)[0].uid;
  }
  return out;
}

// Respuesta del equipo: la opción más votada. Con empate gana la que votó el capitán; si no
// votó ninguna de las empatadas, la primera. Sin votos no hay respuesta.
export function respuestaDeEquipo(votos, voto_capitan) {
  const cuenta = new Map();
  votos.forEach((v) => cuenta.set(v, (cuenta.get(v) || 0) + 1));
  if (!cuenta.size) return null;
  const mayor = Math.max(...cuenta.values());
  const empatadas = [...cuenta].filter(([, n]) => n === mayor).map(([v]) => v).sort((a, b) => a - b);
  return empatadas.includes(voto_capitan) ? voto_capitan : empatadas[0];
}

export default {
  id: 'quiz',
  nombre: 'Trivia por equipos',
  icono: '⚡',
  resumen: 'Pregunta en la pantalla, todos responden desde el celular.',
  tipos: ['pregunta'],

  configurar({ bancos }) {
    const b = selectorBanco(bancos, 'pregunta', 1);
    const modo = selector('cfg-modo', 'Modo', [['puntos', 'Puntos por acierto'], ['castigo', 'Con castigo: el equipo que se equivoca paga una prenda']], 'puntos');
    const cant = selector('cfg-cantidad', 'Cantidad de preguntas', [[5, '5'], [10, '10'], [15, '15'], [20, '20'], [0, 'Todas']], 10);
    const seg = selector('cfg-segundos', 'Tiempo por pregunta', [[15, '15 segundos'], [20, '20 segundos'], [30, '30 segundos'], [45, '45 segundos'], [60, '1 minuto'], [90, '1 minuto y medio']], 30);
    return {
      el: h('div', { class: 'pila' }, b.el, modo.el, h('div', { class: 'grilla-2' }, cant.el, seg.el),
        h('p', { class: 'muted chico' }, `Cada equipo suma hasta ${PUNTOS} puntos por pregunta, según qué parte del equipo acertó (así no importa si un equipo tiene más integrantes).`)),
      leer: () => {
        const banco = b.banco();
        if (!banco) return null;
        return { banco, cantidad: Number(cant.valor()), segundos: Number(seg.valor()), modo: modo.valor() };
      },
    };
  },

  async iniciar(sala, { banco, cantidad, segundos, modo = 'puntos' }) {
    let items = mezclar(itemsDe(banco, 'pregunta'));
    // Las preguntas marcadas como «sale siempre» entran aunque se sorteen menos.
    if (cantidad) {
      const fijas = items.filter((it) => it.fija);
      items = mezclar([...fijas, ...items.filter((it) => !it.fija)].slice(0, Math.max(cantidad, fijas.length)));
    }
    const preguntas = items.map((it) => {
      const opciones = mezclar([it.correcta, ...it.incorrectas]);
      return { pregunta: it.pregunta, opciones, correcta: opciones.indexOf(it.correcta) };
    });
    const id = idAzar();
    await sala.guardarPrivado({ juego: id, preguntas });
    await sala.iniciarJuego({
      tipo: 'quiz', fase: 'pregunta', n: 0, total: preguntas.length, titulo: banco.titulo, modo,
      capitanes: modo === 'castigo' ? capitanes(sala) : null,
      pregunta: preguntas[0].pregunta, opciones: preguntas[0].opciones,
      duracion: segundos * 1000, terminaEn: Date.now() + segundos * 1000,
    }, id);
  },

  host(el, sala) {
    let privado = null;
    let revelando = -1;
    sala.privadoDelJuego().then((p) => { privado = p; v.actualizar(); });

    const participantes = () => sala.activos().filter((j) => j.equipo);

    async function revelar() {
      const j = sala.juego;
      if (!privado || j.fase !== 'pregunta' || revelando === j.n) return;
      revelando = j.n;
      const correcta = privado.preguntas[j.n].correcta;
      const resp = sala.respuestasJuego(j.n);
      const conteo = j.opciones.map(() => 0);
      resp.forEach((r) => { if (r.valor >= 0 && r.valor < conteo.length) conteo[r.valor]++; });
      const porEquipo = {};
      const sumas = {};
      for (const e of sala.equipos()) {
        // Cuentan los que siguen conectados, o los que respondieron aunque ya se hayan ido.
        const miembros = sala.miembros(e.id).filter((m) => m.presente || resp.has(m.uid));
        const ok = miembros.filter((m) => resp.get(m.uid)?.valor === correcta).length;
        let pts = miembros.length ? Math.round((PUNTOS * ok) / miembros.length) : 0;
        porEquipo[e.id] = { ok, n: miembros.length, pts };
        if (j.modo === 'castigo') {
          // Responde el equipo, no cada uno: la opción más votada decide.
          const votos = miembros.map((m) => resp.get(m.uid)?.valor).filter((x) => Number.isInteger(x));
          const elegida = respuestaDeEquipo(votos, resp.get(j.capitanes?.[e.id])?.valor);
          const acerto = elegida === correcta;
          pts = acerto ? PUNTOS : 0;
          porEquipo[e.id] = { ok, n: miembros.length, pts, elegida, acerto, prenda: acerto || !miembros.length ? null : mezclar(PRENDAS)[0] };
        }
        sumas[e.id] = pts;
      }
      try {
        await sala.actualizarJuego({ fase: 'revelada', correcta, conteo, porEquipo }, sumas);
      } catch (e) { revelando = -1; toast('No se pudo revelar: ' + e.message, 'error'); }
    }

    async function siguiente() {
      const j = sala.juego;
      const n = j.n + 1;
      if (n >= j.total) { await sala.actualizarJuego({ fase: 'fin' }); return; }
      const p = privado.preguntas[n];
      await sala.actualizarJuego({
        fase: 'pregunta', n, pregunta: p.pregunta, opciones: p.opciones,
        terminaEn: Date.now() + j.duracion, correcta: undefined, conteo: undefined, porEquipo: undefined,
        capitanes: j.modo === 'castigo' ? capitanes(sala) : null,
      });
    }

    let contador, reloj;
    const v = vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${!!privado}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        if (!privado) { montar(el, esperando('Cargando el quiz…')); return; }
        if (j.fase === 'fin') {
          montar(el, h('h3', null, '¡Terminó el quiz!'), ranking(sala));
          return;
        }
        const p = privado.preguntas[j.n];
        contador = h('span', { class: 'mono' });
        reloj = h('span', { class: 'reloj' });
        const opciones = h('ol', { class: 'opciones-host' }, j.opciones.map((o, i) =>
          h('li', { class: i === p.correcta ? 'correcta' : '' }, h('b', null, letraOpcion(i)), ' ', o,
            j.fase === 'revelada' && h('span', { class: 'mono muted' }, ` · ${j.conteo[i]}`))));
        montar(el,
          h('div', { class: 'fila entre' },
            h('span', { class: 'etiqueta' }, `Pregunta ${j.n + 1} de ${j.total}`),
            j.fase === 'pregunta' && reloj),
          h('p', { class: 'pregunta-host' }, j.pregunta),
          opciones,
          j.fase === 'pregunta'
            ? h('div', { class: 'fila entre' }, h('span', null, contador, ' respondieron'),
              h('button', { class: 'btn', onclick: revelar }, 'Revelar respuesta'))
            : h('div', { class: 'pila' },
              h('div', { class: 'fila' }, sala.equipos().map((e) => pildoraEquipo(e, ` +${j.porEquipo?.[e.id]?.pts ?? 0}`))),
              ...sala.equipos().filter((e) => j.porEquipo?.[e.id]?.prenda).map((e) => h('p', { class: 'prenda' }, `🍩 ${e.nombre}: ${j.porEquipo[e.id].prenda}`)),
              h('button', { class: 'btn grande', onclick: siguiente }, j.n + 1 >= j.total ? 'Ver resultados' : 'Siguiente pregunta →')));
        if (j.fase === 'pregunta') alLimpiar(cuentaRegresiva(reloj, j.terminaEn, { alTerminar: revelar }));
      },
      refrescar() {
        const j = sala.juego;
        if (!privado || j.fase !== 'pregunta' || !contador) return;
        const total = participantes().length;
        const resp = [...sala.respuestasJuego(j.n).keys()].filter((uid) => sala.data.asignaciones?.[uid] && sala.presente(uid)).length;
        contador.textContent = `${resp}/${total}`;
        if (total > 0 && resp >= total) setTimeout(revelar, 800);
      },
    });
    return v;
  },

  alumno(el, sala) {
    const elegida = {};
    const miEquipo = () => sala.data.asignaciones?.[sala.uid];
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        if (j.fase === 'fin') {
          montar(el, h('h2', null, '¡Terminó el quiz!'), ranking(sala));
          return;
        }
        if (j.fase === 'revelada') {
          const mia = elegida[j.n];
          const acerto = mia === j.correcta;
          const pe = j.porEquipo?.[miEquipo()];
          if (mia !== undefined) { vibrar(acerto ? 60 : [60, 60, 60]); }
          montar(el, h('div', { class: 'resultado ' + (mia === undefined ? '' : acerto ? 'bien' : 'mal') },
            h('div', { class: 'resultado-titulo' }, mia === undefined ? 'Se terminó el tiempo' : acerto ? '¡Correcto!' : 'Incorrecto'),
            h('p', null, 'La respuesta era ', h('b', null, `${letraOpcion(j.correcta)}. ${j.opciones[j.correcta]}`)),
            j.modo === 'castigo' && pe
              ? h('div', { class: 'pila-s' },
                h('p', null, pe.elegida == null ? 'Tu equipo no votó.' : `Tu equipo eligió ${letraOpcion(pe.elegida)}: ${pe.acerto ? '¡acertó!' : 'se equivocó.'}`),
                pe.prenda && h('p', { class: 'prenda' }, '🍩 Prenda: ', pe.prenda))
              : pe && h('p', { class: 'muted' }, `Tu equipo: ${pe.ok} de ${pe.n} acertaron · +${pe.pts} puntos`)));
          return;
        }
        const reloj = h('span', { class: 'reloj' });
        const botones = j.opciones.map((o, i) => h('button', {
          class: 'opcion op' + i + (elegida[j.n] === i ? ' elegida' : ''),
          onclick: async () => {
            elegida[j.n] = i;
            botones.forEach((b, k) => b.classList.toggle('elegida', k === i));
            estado.textContent = 'Respuesta enviada. Podés cambiarla hasta que termine el tiempo.';
            vibrar(30);
            try { await sala.responder({ ronda: j.n, valor: i }); } catch (e) { toast('No se pudo enviar: ' + e.message, 'error'); }
          },
        }, h('span', { class: 'op-letra' }, letraOpcion(i)), h('span', null, o)));
        const estado = h('p', { class: 'muted chico centro' }, elegida[j.n] !== undefined ? 'Respuesta enviada.' : 'Elegí una opción.');
        const capitan = j.modo === 'castigo' && j.capitanes?.[miEquipo()] === sala.uid;
        montar(el,
          j.modo === 'castigo' && h('p', { class: 'muted chico centro' }, capitan ? '👑 Sos el capitán: si hay empate, tu voto desempata.' : 'Hablen en el equipo y voten: gana la opción más votada.'),
          h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, `Pregunta ${j.n + 1}/${j.total}`), reloj),
          h('p', { class: 'pregunta-alumno' }, j.pregunta),
          h('div', { class: 'opciones' }, botones),
          estado);
        alLimpiar(cuentaRegresiva(reloj, j.terminaEn));
      },
    });
  },

  tv(el, sala) {
    let barras = null;
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        barras = null;
        if (j.fase === 'fin') {
          sonido('fin');
          montar(el, h('div', { class: 'tv-centro' }, h('h1', { class: 'tv-titulo' }, '¡Terminó el quiz!'), ranking(sala)));
          return;
        }
        const revelada = j.fase === 'revelada';
        if (revelada) sonido('bien');
        const max = revelada ? Math.max(1, ...j.conteo) : 1;
        const reloj = h('div', { class: 'tv-reloj' });
        barras = h('div', { class: 'tv-equipos' });
        montar(el,
          h('div', { class: 'tv-cabecera' },
            h('span', { class: 'tv-etiqueta' }, `${j.titulo || 'Quiz'} · Pregunta ${j.n + 1} de ${j.total}`),
            !revelada && reloj),
          h('div', { class: 'tv-pregunta' }, j.pregunta),
          h('div', { class: 'tv-opciones' }, j.opciones.map((o, i) =>
            h('div', { class: 'tv-opcion op' + i + (revelada ? (i === j.correcta ? ' correcta' : ' apagada') : '') },
              h('span', { class: 'op-letra' }, letraOpcion(i)),
              h('span', { class: 'tv-op-txt' }, o),
              revelada && h('span', { class: 'tv-op-n' }, j.conteo[i]),
              revelada && h('span', { class: 'tv-op-barra', style: { width: (100 * j.conteo[i]) / max + '%' } })))),
          revelada
            ? h('div', { class: 'tv-equipos' }, sala.equipos().map((e) => {
              const pe = j.porEquipo?.[e.id] || { ok: 0, n: 0, pts: 0 };
              if (j.modo === 'castigo') {
                return h('div', { class: 'tv-eq' + (pe.prenda ? ' penado' : ''), style: { '--c': e.color } },
                  h('span', { class: 'tv-eq-nombre' }, e.nombre),
                  h('span', { class: 'tv-eq-dato' }, pe.elegida == null ? 'sin voto' : `${letraOpcion(pe.elegida)} ${pe.acerto ? '✓' : '✗'}`),
                  pe.prenda ? h('span', { class: 'tv-prenda' }, `🍩 ${pe.prenda}`) : h('span', { class: 'tv-eq-pts' }, `+${pe.pts}`));
              }
              return h('div', { class: 'tv-eq', style: { '--c': e.color } },
                h('span', { class: 'tv-eq-nombre' }, e.nombre),
                h('span', { class: 'tv-eq-dato' }, `${pe.ok}/${pe.n} ✓`),
                h('span', { class: 'tv-eq-pts' }, `+${pe.pts}`));
            }))
            : barras);
        if (!revelada) alLimpiar(cuentaRegresiva(reloj, j.terminaEn, { cadaSegundo: (f) => reloj.classList.toggle('urgente', f < 5500) }));
      },
      refrescar() {
        const j = sala.juego;
        if (!barras || j.fase !== 'pregunta') return;
        const resp = sala.respuestasJuego(j.n);
        montar(barras, sala.equipos().map((e) => {
          const m = sala.miembros(e.id).filter((x) => x.presente || resp.has(x.uid));
          const r = m.filter((x) => resp.has(x.uid)).length;
          return h('div', { class: 'tv-eq', style: { '--c': e.color } },
            h('span', { class: 'tv-eq-nombre' }, e.nombre),
            h('span', { class: 'tv-eq-barra' }, h('b', { style: { width: (m.length ? (100 * r) / m.length : 0) + '%' } })),
            h('span', { class: 'tv-eq-dato' }, `${r}/${m.length}`));
        }));
      },
    });
  },
};
