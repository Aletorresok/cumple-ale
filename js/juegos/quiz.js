// Quiz por equipos. Dos modos:
//  · puntos: todos responden desde el celular; cada equipo suma según qué proporción acertó.
//  · castigo (Trivia japonesa): sin celulares. Cada pregunta le toca a un equipo (rotan, sin robos).
//    La pregunta sale sin opciones y vale 2; si el equipo pide opciones, quien organiza las muestra
//    y vale 1. Si arriesgan y fallan, cruz roja y pierden la pregunta. El reloj lo larga quien
//    organiza. Al final, una pregunta de aproximación para todos (la escriben en una hoja): el que
//    más se acerca gana 3.
import { h, montar, vista, selectorBanco, selector, pildoraEquipo, ranking, esperando } from './comun.js';
import { itemsDe } from '../bancos.js';
import { mezclar, cuentaRegresiva, letraOpcion, toast, sonido, vibrar, idAzar } from '../util.js';
import { PREGUNTAS_JAPONESA, APROX_JAPONESA } from '../trivia-japonesa.js';

const PUNTOS = 100;
const PUNTOS_SIN_OPCIONES = 2;
const PUNTOS_CON_OPCIONES = 1;
const PUNTOS_APROX = 3;
// Video que pasa en la tele antes de la primera pregunta del modo con castigo («Nosotros castigamos la ignorancia»).
export const VIDEO_INTRO = 'video/trivia-intro.mp4';

export default {
  id: 'quiz',
  nombre: 'Trivia por equipos',
  icono: '⚡',
  resumen: 'Pregunta en la pantalla, todos responden desde el celular.',
  tipos: ['pregunta'],

  configurar({ bancos }) {
    const b = selectorBanco(bancos, 'pregunta', 1);
    const modo = selector('cfg-modo', 'Modo', [['puntos', 'Puntos por acierto (con el banco elegido)'], ['castigo', `Trivia japonesa: ${PREGUNTAS_JAPONESA.length} preguntas por turno${APROX_JAPONESA ? ' + aproximación' : ''}`]], 'castigo');
    const cant = selector('cfg-cantidad', 'Cantidad de preguntas', [[5, '5'], [8, '8'], [10, '10'], [15, '15'], [20, '20'], [0, 'Todas']], 8);
    const seg = selector('cfg-segundos', 'Tiempo por pregunta', [[15, '15 segundos'], [20, '20 segundos'], [30, '30 segundos'], [45, '45 segundos'], [60, '1 minuto'], [90, '1 minuto y medio']], 30);
    const intro = h('input', { type: 'checkbox', id: 'cfg-intro', checked: true });
    return {
      el: h('div', { class: 'pila' }, b.el, modo.el, h('div', { class: 'grilla-2' }, cant.el, seg.el),
        h('label', { class: 'fila nowrap' }, intro, h('span', null, '🎬 Antes de empezar, pasar el video «Nosotros castigamos la ignorancia» (solo con castigo)')),
        h('p', { class: 'muted chico' }, `Trivia japonesa: nadie usa el celular. Cada pregunta le toca a un equipo; sin opciones vale ${PUNTOS_SIN_OPCIONES} y si piden opciones vale ${PUNTOS_CON_OPCIONES}. El reloj lo largás vos.${APROX_JAPONESA ? ` Al final, aproximación para todos: el que más se acerca gana ${PUNTOS_APROX}.` : ''} (Usa sus propias preguntas: el banco y la cantidad no cuentan.) En «puntos», responden todos desde el celular y cada equipo suma hasta ${PUNTOS} según qué parte acertó.`)),
      leer: () => {
        const banco = b.banco();
        if (modo.valor() === 'castigo') return { banco: banco || { titulo: 'Trivia japonesa', items: [] }, cantidad: 0, segundos: Number(seg.valor()), modo: 'castigo', intro: intro.checked };
        if (!banco) return null;
        return { banco, cantidad: Number(cant.valor()), segundos: Number(seg.valor()), modo: modo.valor(), intro: intro.checked };
      },
    };
  },

  async iniciar(sala, { banco, cantidad, segundos, modo = 'puntos', intro = false }) {
    if (modo === 'castigo') return iniciarJaponesa(sala, { segundos, intro });
    const conIntro = false;
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
      tipo: 'quiz', fase: conIntro ? 'intro' : 'pregunta', n: 0, total: preguntas.length, titulo: banco.titulo, modo,
      marcas: {},
      pregunta: preguntas[0].pregunta, opciones: preguntas[0].opciones,
      duracion: segundos * 1000, terminaEn: conIntro ? 0 : Date.now() + segundos * 1000,
    }, id);
  },

  host(el, sala) {
    if (sala.juego?.modo === 'castigo') return hostJaponesa(el, sala);
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
        if (j.modo === 'castigo') {
          // Responde el equipo en voz alta: vale lo que marcó quien organiza.
          const acerto = j.marcas?.[e.id] === true;
          porEquipo[e.id] = { marca: j.marcas?.[e.id] ?? null, acerto, pts: acerto ? PUNTOS_CASTIGO : 0 };
          sumas[e.id] = porEquipo[e.id].pts;
          continue;
        }
        // Cuentan los que siguen conectados, o los que respondieron aunque ya se hayan ido.
        const miembros = sala.miembros(e.id).filter((m) => m.presente || resp.has(m.uid));
        const ok = miembros.filter((m) => resp.get(m.uid)?.valor === correcta).length;
        const pts = miembros.length ? Math.round((PUNTOS * ok) / miembros.length) : 0;
        porEquipo[e.id] = { ok, n: miembros.length, pts };
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
        marcas: {},
      });
    }

    // Castigo: ✓ o ✗ por equipo (tocar de nuevo la misma marca la saca).
    async function marcar(eid, valor) {
      const j = sala.juego;
      if (j.fase !== 'pregunta') return;
      const nueva = j.marcas?.[eid] === valor ? null : valor;
      try { await sala.actualizarJuego({ ['marcas.' + eid]: nueva }); } catch (e) { toast(e.message, 'error'); }
    }

    const empezar = async () => {
      const j = sala.juego;
      if (j.fase !== 'intro') return;
      try { await sala.actualizarJuego({ fase: 'pregunta', terminaEn: Date.now() + j.duracion }); } catch (e) { toast(e.message, 'error'); }
    };

    let contador, reloj, marcasEl;
    const v = vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${!!privado}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        marcasEl = null;
        if (!privado) { montar(el, esperando('Cargando el quiz…')); return; }
        if (j.fase === 'intro') {
          montar(el, h('p', null, '🎬 En la tele está pasando «Nosotros castigamos la ignorancia».'),
            h('p', { class: 'muted chico' }, 'Cuando termine, largá la primera pregunta.'),
            h('button', { class: 'btn grande', onclick: empezar }, '⚡ Empezar la trivia'));
          return;
        }
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
          j.fase === 'pregunta' && j.modo === 'castigo'
            ? h('div', { class: 'pila' },
              h('p', { class: 'muted chico' }, 'Cada equipo dice su respuesta en voz alta. Marcá ✓ o ✗: al que se equivoca le sale la cruz en la tele.'),
              marcasEl = h('div', { class: 'pila-s' }),
              h('button', { class: 'btn', onclick: revelar }, 'Revelar respuesta'))
            : j.fase === 'pregunta'
            ? h('div', { class: 'fila entre' }, h('span', null, contador, ' respondieron'),
              h('button', { class: 'btn', onclick: revelar }, 'Revelar respuesta'))
            : h('div', { class: 'pila' },
              h('div', { class: 'fila' }, sala.equipos().map((e) => pildoraEquipo(e, ` +${j.porEquipo?.[e.id]?.pts ?? 0}`))),
              h('button', { class: 'btn grande', onclick: siguiente }, j.n + 1 >= j.total ? 'Ver resultados' : 'Siguiente pregunta →')));
        // Con castigo el reloj no revela solo: primero hay que escuchar y marcar a cada equipo.
        if (j.fase === 'pregunta') alLimpiar(cuentaRegresiva(reloj, j.terminaEn, j.modo === 'castigo' ? {} : { alTerminar: revelar }));
      },
      refrescar() {
        const j = sala.juego;
        if (marcasEl) {
          montar(marcasEl, sala.equipos().map((e) => {
            const m = j.marcas?.[e.id];
            return h('div', { class: 'fila entre' }, pildoraEquipo(e),
              h('div', { class: 'fila' },
                h('button', { class: 'btn' + (m === true ? ' ok' : ' sec'), onclick: () => marcar(e.id, true) }, '✓ Bien'),
                h('button', { class: 'btn' + (m === false ? ' peligro' : ' sec'), onclick: () => marcar(e.id, false) }, '✗ Mal')));
          }));
          return;
        }
        if (!privado || j.fase !== 'pregunta' || !contador) return;
        const total = participantes().length;
        const resp = [...sala.respuestasJuego(j.n).keys()].filter((uid) => sala.data.asignaciones?.[uid] && sala.presente(uid)).length;
        contador.textContent = `${resp}/${total}`;
        const listos = total > 0 && resp >= total;
        // Se revela un instante después, solo si sigue siendo la misma pregunta (si quien organiza
        // ya pasó a la siguiente, este aviso viejo no tiene que revelar la nueva).
        if (listos) { const n = j.n; setTimeout(() => { if (sala.juego?.n === n) revelar(); }, 800); }
      },
    });
    return v;
  },

  alumno(el, sala) {
    if (sala.juego?.modo === 'castigo') return alumnoJaponesa(el, sala);
    const elegida = {};
    const miEquipo = () => sala.data.asignaciones?.[sala.uid];
    const v = vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        if (j.fase === 'fin') {
          montar(el, h('h2', null, '¡Terminó el quiz!'), ranking(sala));
          return;
        }
        if (j.fase === 'intro') { montar(el, esperando('📺 ¡Miren la tele!', 'Ya empieza la trivia.')); return; }
        const pe = j.porEquipo?.[miEquipo()];
        // Con castigo nadie usa el celular: discuten mirando la tele y uno responde en voz alta.
        if (j.modo === 'castigo') {
          if (j.fase === 'revelada') {
            if (pe?.marca != null) vibrar(pe.acerto ? 60 : [60, 60, 60]);
            montar(el, h('div', { class: 'resultado ' + (pe?.marca == null ? '' : pe.acerto ? 'bien' : 'mal') },
              h('div', { class: 'resultado-titulo' }, pe?.marca == null ? 'Sin respuesta' : pe.acerto ? '¡Tu equipo acertó! +1' : '✗ Tu equipo se equivocó'),
              h('p', null, 'La respuesta era ', h('b', null, `${letraOpcion(j.correcta)}. ${j.opciones[j.correcta]}`))));
            return;
          }
          const reloj = h('span', { class: 'reloj' });
          montar(el,
            h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, `Pregunta ${j.n + 1}/${j.total}`), reloj),
            esperando('👀 ¡Miren la tele!', 'Discutan en equipo y uno dice la respuesta en voz alta.'));
          alLimpiar(cuentaRegresiva(reloj, j.terminaEn));
          return;
        }
        if (j.fase === 'revelada') {
          const mia = elegida[j.n];
          const acerto = mia === j.correcta;
          if (mia !== undefined) { vibrar(acerto ? 60 : [60, 60, 60]); }
          montar(el, h('div', { class: 'resultado ' + (mia === undefined ? '' : acerto ? 'bien' : 'mal') },
            h('div', { class: 'resultado-titulo' }, mia === undefined ? 'Se terminó el tiempo' : acerto ? '¡Correcto!' : 'Incorrecto'),
            h('p', null, 'La respuesta era ', h('b', null, `${letraOpcion(j.correcta)}. ${j.opciones[j.correcta]}`)),
            pe && h('p', { class: 'muted' }, `Tu equipo: ${pe.ok} de ${pe.n} acertaron · +${pe.pts} puntos`)));
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
        montar(el,
          h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, `Pregunta ${j.n + 1}/${j.total}`), reloj),
          h('p', { class: 'pregunta-alumno' }, j.pregunta),
          h('div', { class: 'opciones' }, botones),
          estado);
        alLimpiar(cuentaRegresiva(reloj, j.terminaEn));
      },
    });
    return v;
  },

  tv(el, sala) {
    if (sala.juego?.modo === 'castigo') return tvJaponesa(el, sala);
    let barras = null;
    let cruz = null;
    let vistas = {};   // marcas ya mostradas: la cruz sale solo cuando aparece un ✗ nuevo
    const tarjetaMarca = (e, m) => h('div', { class: 'tv-eq tv-eq-marca' + (m === false ? ' mal' : m === true ? ' bien' : ''), style: { '--c': e.color } },
      h('span', { class: 'tv-eq-nombre' }, e.nombre),
      h('span', { class: 'tv-eq-marca-ico' }, m === false ? '✗' : m === true ? '✓' : '…'));
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        barras = null;
        vistas = { ...(j.marcas || {}) };
        if (j.fase === 'fin') {
          sonido('fin');
          montar(el, h('div', { class: 'tv-centro' }, h('h1', { class: 'tv-titulo' }, '¡Terminó el quiz!'), ranking(sala)));
          return;
        }
        if (j.fase === 'intro') {
          const video = h('video', { class: 'tv-video', src: VIDEO_INTRO, autoplay: true, playsinline: true });
          video.play?.().catch(() => { video.muted = true; video.play().catch(() => {}); });
          montar(el, h('div', { class: 'tv-video-marco' }, video));
          return;
        }
        const castigo = j.modo === 'castigo';
        const revelada = j.fase === 'revelada';
        if (revelada) sonido('bien');
        const max = revelada ? Math.max(1, ...j.conteo) : 1;
        const reloj = h('div', { class: 'tv-reloj' });
        barras = h('div', { class: 'tv-equipos' });
        cruz = h('div', { class: 'tv-cruz', 'aria-hidden': 'true' });
        montar(el,
          h('div', { class: 'tv-cabecera' },
            castigo
              ? h('div', { class: 'tv-trivia-nombre' }, h('b', null, '⚡ Trivia japonesa'), h('span', null, 'Treinta minutos sobre Tokio'), h('small', null, `Pregunta ${j.n + 1} de ${j.total}`))
              : h('span', { class: 'tv-etiqueta' }, `${j.titulo || 'Quiz'} · Pregunta ${j.n + 1} de ${j.total}`),
            !revelada && reloj),
          h('div', { class: 'tv-pregunta' }, j.pregunta),
          h('div', { class: 'tv-opciones' }, j.opciones.map((o, i) =>
            h('div', { class: 'tv-opcion op' + i + (revelada ? (i === j.correcta ? ' correcta' : ' apagada') : '') },
              h('span', { class: 'op-letra' }, letraOpcion(i)),
              h('span', { class: 'tv-op-txt' }, o),
              revelada && !castigo && h('span', { class: 'tv-op-n' }, j.conteo[i]),
              revelada && !castigo && h('span', { class: 'tv-op-barra', style: { width: (100 * j.conteo[i]) / max + '%' } })))),
          revelada
            ? h('div', { class: 'tv-equipos' }, sala.equipos().map((e) => {
              const pe = j.porEquipo?.[e.id] || { ok: 0, n: 0, pts: 0 };
              if (castigo) {
                return h('div', { class: 'tv-eq tv-eq-marca' + (pe.marca === false ? ' mal' : pe.acerto ? ' bien' : ''), style: { '--c': e.color } },
                  h('span', { class: 'tv-eq-nombre' }, e.nombre),
                  h('span', { class: 'tv-eq-marca-ico' }, pe.marca === false ? '✗' : pe.acerto ? '✓' : '—'),
                  h('span', { class: 'tv-eq-pts' }, `+${pe.pts}`));
              }
              return h('div', { class: 'tv-eq', style: { '--c': e.color } },
                h('span', { class: 'tv-eq-nombre' }, e.nombre),
                h('span', { class: 'tv-eq-dato' }, `${pe.ok}/${pe.n} ✓`),
                h('span', { class: 'tv-eq-pts' }, `+${pe.pts}`));
            }))
            : barras,
          cruz);
        if (!revelada) {
          alLimpiar(cuentaRegresiva(reloj, j.terminaEn, {
            cadaSegundo: (f) => reloj.classList.toggle('urgente', f < 5500),
            alTerminar: castigo ? () => { reloj.textContent = '¡Tiempo!'; } : undefined,
          }));
        }
      },
      refrescar() {
        const j = sala.juego;
        if (!barras || j.fase !== 'pregunta') return;
        if (j.modo === 'castigo') {
          const marcas = j.marcas || {};
          montar(barras, sala.equipos().map((e) => tarjetaMarca(e, marcas[e.id])));
          const nuevo = sala.equipos().find((e) => marcas[e.id] === false && vistas[e.id] !== false);
          vistas = { ...marcas };
          if (nuevo && cruz) {
            sonido('error');
            montar(cruz, h('div', { class: 'tv-cruz-x' }, '✗'), h('div', { class: 'tv-cruz-eq', style: { '--c': nuevo.color } }, nuevo.nombre));
            cruz.classList.remove('activa'); void cruz.offsetWidth; cruz.classList.add('activa');
          }
          return;
        }
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

// ───────────────────────── Trivia japonesa ─────────────────────────

async function iniciarJaponesa(sala, { segundos, intro }) {
  const preguntas = PREGUNTAS_JAPONESA.map((it) => {
    const opciones = mezclar([it.correcta, ...it.incorrectas]);
    return { pregunta: it.pregunta, opciones, correcta: opciones.indexOf(it.correcta), video: it.video || null };
  });
  const orden = sala.equipos().map((e) => e.id);
  const id = idAzar();
  await sala.guardarPrivado({ juego: id, preguntas, aprox: APROX_JAPONESA });
  await sala.iniciarJuego({
    tipo: 'quiz', modo: 'castigo', titulo: 'Trivia japonesa', fase: intro ? 'intro' : 'pregunta',
    n: 0, total: preguntas.length, orden, equipo: orden[0] || null,
    pregunta: preguntas[0].pregunta, opciones: [], conOpciones: false,
    duracion: segundos * 1000, terminaEn: 0,
  }, id);
}

const equipoDe = (sala, eid) => sala.equipos().find((e) => e.id === eid);
const valeAhora = (j) => (j.conOpciones ? PUNTOS_CON_OPCIONES : PUNTOS_SIN_OPCIONES);
const nombreJaponesa = (extra) => h('div', { class: 'tv-trivia-nombre' },
  h('b', null, '⚡ Trivia japonesa'), h('span', null, 'Treinta minutos sobre Tokio'), extra && h('small', null, extra));

function hostJaponesa(el, sala) {
  let privado = null;
  let enviando = false;
  sala.privadoDelJuego().then((p) => { privado = p; v.actualizar(); });

  const act = async (patch, puntos) => {
    if (enviando) return;
    enviando = true;
    try { await sala.actualizarJuego(patch, puntos); } catch (e) { toast(e.message, 'error'); } finally { enviando = false; }
  };
  const empezar = () => sala.juego.fase === 'intro' && act({ fase: 'pregunta' });
  const largarReloj = () => act({ terminaEn: Date.now() + sala.juego.duracion });
  const mostrarOpciones = () => act({ conOpciones: true, opciones: privado.preguntas[sala.juego.n].opciones });
  const responder = (acerto) => {
    const j = sala.juego;
    if (j.fase !== 'pregunta') return;
    const pts = acerto ? valeAhora(j) : 0;
    const p = privado.preguntas[j.n];
    act({ fase: 'revelada', acerto, pts, opciones: p.opciones, correcta: p.correcta, video: p.video || null, terminaEn: 0 }, j.equipo ? { [j.equipo]: pts } : undefined);
  };
  const siguiente = () => {
    const j = sala.juego;
    const n = j.n + 1;
    if (n >= j.total && !privado.aprox) { act({ fase: 'fin' }); return; }
    if (n >= j.total) {
      act({ fase: 'aprox', video: null, pregunta: privado.aprox.pregunta, opciones: [], conOpciones: false, equipo: null, terminaEn: 0, acerto: null, pts: 0, correcta: null, ganadores: {} });
      return;
    }
    const p = privado.preguntas[n];
    act({ fase: 'pregunta', n, equipo: j.orden[n % j.orden.length] || null, pregunta: p.pregunta, opciones: [], conOpciones: false, terminaEn: 0, acerto: null, pts: 0, correcta: null, video: null });
  };
  const revelarAprox = () => act({ fase: 'aprox-revelada', respuesta: privado.aprox.respuesta, terminaEn: 0 });
  const tocarGanador = (eid) => {
    const j = sala.juego;
    if (j.fase !== 'aprox-revelada') return;
    act({ ['ganadores.' + eid]: !j.ganadores?.[eid] });
  };
  const darAprox = () => {
    const j = sala.juego;
    const ganadores = Object.keys(j.ganadores || {}).filter((k) => j.ganadores[k]);
    if (!ganadores.length) { toast('Tocá el equipo que más se acercó.', 'error'); return; }
    act({ fase: 'fin' }, Object.fromEntries(ganadores.map((k) => [k, PUNTOS_APROX])));
  };

  let ganadoresEl;
  const relojOBoton = (j, alLimpiar) => {
    if (j.terminaEn) {
      const reloj = h('span', { class: 'reloj' });
      alLimpiar(cuentaRegresiva(reloj, j.terminaEn, { alTerminar: () => { reloj.textContent = '¡Tiempo!'; } }));
      return reloj;
    }
    return h('button', { class: 'btn sec', onclick: largarReloj }, `⏱ Largar ${j.duracion / 1000} s`);
  };
  const v = vista({
    clave: () => { const j = sala.juego; return `${j.fase}:${j.n}:${!!privado}:${j.terminaEn}:${j.conOpciones}`; },
    dibujar(alLimpiar) {
      const j = sala.juego;
      ganadoresEl = null;
      if (!privado) { montar(el, esperando('Cargando la trivia…')); return; }
      if (j.fase === 'intro') {
        montar(el, h('p', null, '🎬 En la tele está pasando «Nosotros castigamos la ignorancia».'),
          h('p', { class: 'muted chico' }, 'Cuando termine, largá la primera pregunta.'),
          h('button', { class: 'btn grande', onclick: empezar }, '⚡ Empezar la trivia'));
        return;
      }
      if (j.fase === 'fin') { montar(el, h('h3', null, '¡Terminó la trivia!'), ranking(sala)); return; }
      if (j.fase === 'aprox' || j.fase === 'aprox-revelada') {
        const revelada = j.fase === 'aprox-revelada';
        montar(el,
          h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, '🎯 Ronda final: aproximación'), !revelada && relojOBoton(j, alLimpiar)),
          h('p', { class: 'pregunta-host' }, privado.aprox.pregunta),
          h('p', null, 'Respuesta: ', h('b', null, privado.aprox.respuesta)),
          revelada
            ? h('div', { class: 'pila' },
              h('p', { class: 'muted chico' }, `Tocá el equipo que más se acercó (si empatan, tocá los dos). Gana ${PUNTOS_APROX} puntos.`),
              ganadoresEl = h('div', { class: 'pila-s aprox-ganadores' }),
              h('button', { class: 'btn grande', onclick: darAprox }, `🏆 Dar ${PUNTOS_APROX} puntos y terminar`))
            : h('div', { class: 'pila' },
              h('p', { class: 'muted chico' }, 'Cada equipo escribe su número en una hoja. Cuando estén todas, revelá.'),
              h('button', { class: 'btn grande', onclick: revelarAprox }, 'Revelar la respuesta en la tele')));
        return;
      }
      const p = privado.preguntas[j.n];
      const eq = equipoDe(sala, j.equipo);
      const revelada = j.fase === 'revelada';
      const opciones = h('ol', { class: 'opciones-host' }, p.opciones.map((o, i) =>
        h('li', { class: i === p.correcta ? 'correcta' : '' }, h('b', null, letraOpcion(i)), ' ', o)));
      montar(el,
        h('div', { class: 'fila entre' },
          h('span', { class: 'etiqueta' }, `Pregunta ${j.n + 1} de ${j.total}`),
          !revelada && relojOBoton(j, alLimpiar)),
        h('div', { class: 'fila' }, h('span', null, 'Le toca a'), pildoraEquipo(eq)),
        h('p', { class: 'pregunta-host' }, j.pregunta),
        h('p', null, 'Respuesta: ', h('b', null, p.opciones[p.correcta])),
        revelada
          ? h('div', { class: 'pila' },
            h('p', null, j.acerto ? `✓ Acertaron: +${j.pts}` : '✗ Se equivocaron: no suman.'),
            j.video && h('p', { class: 'muted chico' }, '🎬 En la tele pasa la escena para chequear la respuesta.'),
            h('button', { class: 'btn grande', onclick: siguiente }, j.n + 1 >= j.total ? (privado.aprox ? '🎯 Ronda final: aproximación →' : 'Ver resultados') : 'Siguiente pregunta →'))
          : h('div', { class: 'pila' },
            j.conOpciones
              ? h('div', { class: 'pila-s' }, h('span', { class: 'muted chico' }, 'Opciones en la tele (ahora vale 1):'), opciones)
              : h('button', { class: 'btn sec', onclick: mostrarOpciones }, `👀 Mostrar opciones (pasa a valer ${PUNTOS_CON_OPCIONES})`),
            h('div', { class: 'fila' },
              h('button', { class: 'btn ok grande', onclick: () => responder(true) }, `✓ Bien (+${valeAhora(j)})`),
              h('button', { class: 'btn peligro grande', onclick: () => responder(false) }, '✗ Mal'))));
    },
    refrescar() {
      const j = sala.juego;
      if (!ganadoresEl) return;
      montar(ganadoresEl, sala.equipos().map((e) => h('button', {
        class: 'btn' + (j.ganadores?.[e.id] ? ' ok' : ' sec'), onclick: () => tocarGanador(e.id),
      }, (j.ganadores?.[e.id] ? '🏆 ' : '') + e.nombre)));
    },
  });
  return v;
}

function alumnoJaponesa(el, sala) {
  const miEquipo = () => sala.data.asignaciones?.[sala.uid];
  return vista({
    clave: () => `${sala.juego.fase}:${sala.juego.n}`,
    dibujar() {
      const j = sala.juego;
      if (j.fase === 'fin') { montar(el, h('h2', null, '¡Terminó la trivia!'), ranking(sala)); return; }
      if (j.fase === 'intro') { montar(el, esperando('📺 ¡Miren la tele!', 'Ya empieza la trivia.')); return; }
      if (j.fase === 'aprox' || j.fase === 'aprox-revelada') {
        montar(el, esperando('🎯 ¡Miren la tele!', 'Ronda final: escriban su respuesta en la hoja del equipo.'));
        return;
      }
      const mio = j.equipo && j.equipo === miEquipo();
      if (j.fase === 'revelada' && mio) {
        vibrar(j.acerto ? 60 : [60, 60, 60]);
        montar(el, h('div', { class: 'resultado ' + (j.acerto ? 'bien' : 'mal') },
          h('div', { class: 'resultado-titulo' }, j.acerto ? `¡Tu equipo acertó! +${j.pts}` : '✗ Tu equipo se equivocó'),
          h('p', null, 'La respuesta era ', h('b', null, j.opciones[j.correcta]))));
        return;
      }
      const eq = equipoDe(sala, j.equipo);
      montar(el, esperando('👀 ¡Miren la tele!', mio ? 'Les toca a ustedes: discutan y uno responde en voz alta.' : `Le toca a ${eq?.nombre || 'otro equipo'}.`));
    },
  });
}

// Escena que pasa en la tele después de responder, para chequear la respuesta (con sonido). Ocupa la
// pantalla con la respuesta arriba y, cuando termina, deja ver la revelación normal.
function videoChequeo(src, respuesta) {
  const video = h('video', { class: 'tv-trivia-video', src, autoplay: true, playsinline: true, controls: false });
  const marco = h('div', { class: 'tv-chequeo' }, h('div', { class: 'tv-chequeo-resp' }, '✓ ', respuesta), video);
  video.addEventListener('ended', () => marco.remove());
  video.play?.().catch(() => { video.muted = true; video.play().catch(() => {}); });
  return marco;
}

function tvJaponesa(el, sala) {
  let ganadoresEl = null;
  return vista({
    clave: () => { const j = sala.juego; return `${j.fase}:${j.n}:${j.terminaEn}:${j.conOpciones}`; },
    dibujar(alLimpiar) {
      const j = sala.juego;
      ganadoresEl = null;
      if (j.fase === 'fin') {
        sonido('fin');
        montar(el, h('div', { class: 'tv-centro' }, h('h1', { class: 'tv-titulo' }, '¡Terminó la trivia!'), ranking(sala)));
        return;
      }
      if (j.fase === 'intro') {
        const video = h('video', { class: 'tv-video', src: VIDEO_INTRO, autoplay: true, playsinline: true });
        video.play?.().catch(() => { video.muted = true; video.play().catch(() => {}); });
        montar(el, h('div', { class: 'tv-video-marco' }, video));
        return;
      }
      const reloj = j.terminaEn ? h('div', { class: 'tv-reloj' }) : null;
      if (reloj) {
        alLimpiar(cuentaRegresiva(reloj, j.terminaEn, {
          cadaSegundo: (f) => reloj.classList.toggle('urgente', f < 5500),
          alTerminar: () => { reloj.textContent = '¡Tiempo!'; sonido('error'); },
        }));
      }
      if (j.fase === 'aprox' || j.fase === 'aprox-revelada') {
        const revelada = j.fase === 'aprox-revelada';
        if (revelada) sonido('bien');
        montar(el,
          h('div', { class: 'tv-cabecera' }, nombreJaponesa('🎯 Ronda final: aproximación'), reloj),
          h('div', { class: 'tv-pregunta' }, j.pregunta),
          revelada
            ? h('div', { class: 'tv-aprox-respuesta' }, j.respuesta)
            : h('p', { class: 'tv-turno-nota' }, `Cada equipo escribe su respuesta en una hoja. El que más se acerca gana ${PUNTOS_APROX} puntos.`),
          ganadoresEl = h('div', { class: 'tv-equipos' }));
        return;
      }
      const eq = equipoDe(sala, j.equipo);
      const revelada = j.fase === 'revelada';
      const cruz = h('div', { class: 'tv-cruz', 'aria-hidden': 'true' });
      montar(el,
        h('div', { class: 'tv-cabecera' }, nombreJaponesa(`Pregunta ${j.n + 1} de ${j.total}`), !revelada && reloj),
        h('div', { class: 'tv-turno', style: { '--c': eq?.color || '#888' } }, h('span', null, 'Le toca a'), pildoraEquipo(eq)),
        h('div', { class: 'tv-pregunta' }, j.pregunta),
        revelada
          ? h('div', null, h('div', { class: 'tv-opcion correcta' }, h('span', { class: 'tv-op-txt' }, j.opciones[j.correcta])),
            j.video && videoChequeo(j.video, j.opciones[j.correcta]))
          : j.conOpciones
          ? h('div', { class: 'tv-opciones' }, j.opciones.map((o, i) =>
            h('div', { class: 'tv-opcion op' + i }, h('span', { class: 'op-letra' }, letraOpcion(i)), h('span', { class: 'tv-op-txt' }, o))))
          : null,
        h('p', { class: 'tv-turno-nota' }, revelada
          ? (j.acerto ? `✓ ¡Correcto! +${j.pts} para ${eq?.nombre || ''}` : `✗ ${eq?.nombre || ''} no suma`)
          : j.conOpciones ? `Con opciones vale ${PUNTOS_CON_OPCIONES}` : `Sin opciones vale ${PUNTOS_SIN_OPCIONES} · si piden opciones, vale ${PUNTOS_CON_OPCIONES}`),
        cruz);
      if (revelada && j.acerto) sonido('bien');
      if (revelada && !j.acerto) {
        sonido('error');
        montar(cruz, h('div', { class: 'tv-cruz-x' }, '✗'), eq && h('div', { class: 'tv-cruz-eq', style: { '--c': eq.color } }, eq.nombre));
        cruz.classList.add('activa');
      }
    },
    refrescar() {
      const j = sala.juego;
      if (!ganadoresEl) return;
      montar(ganadoresEl, j.fase === 'aprox-revelada'
        ? sala.equipos().filter((e) => j.ganadores?.[e.id]).map((e) => h('div', { class: 'tv-eq tv-eq-marca bien', style: { '--c': e.color } },
          h('span', { class: 'tv-eq-nombre' }, '🏆 ' + e.nombre), h('span', { class: 'tv-eq-pts' }, `+${PUNTOS_APROX}`)))
        : []);
    },
  });
}
