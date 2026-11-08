// Quiz por equipos. Dos modos:
//  · puntos: todos responden desde el celular; cada equipo suma según qué proporción acertó.
//  · castigo: sin celulares. Cada equipo discute en voz alta y uno dice la respuesta; quien
//    organiza marca bien o mal por equipo. Al que se equivoca le sale una cruz roja en la tele
//    (el castigo va por fuera de la app). Cada acierto vale 1 punto.
import { h, montar, vista, selectorBanco, selector, pildoraEquipo, ranking, esperando } from './comun.js';
import { itemsDe } from '../bancos.js';
import { mezclar, cuentaRegresiva, letraOpcion, toast, sonido, vibrar, idAzar } from '../util.js';

const PUNTOS = 100;
const PUNTOS_CASTIGO = 1;
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
    const modo = selector('cfg-modo', 'Modo', [['puntos', 'Puntos por acierto'], ['castigo', 'Con castigo: responden en voz alta y vos marcás bien o mal']], 'castigo');
    const cant = selector('cfg-cantidad', 'Cantidad de preguntas', [[5, '5'], [8, '8'], [10, '10'], [15, '15'], [20, '20'], [0, 'Todas']], 8);
    const seg = selector('cfg-segundos', 'Tiempo por pregunta', [[15, '15 segundos'], [20, '20 segundos'], [30, '30 segundos'], [45, '45 segundos'], [60, '1 minuto'], [90, '1 minuto y medio']], 20);
    const intro = h('input', { type: 'checkbox', id: 'cfg-intro', checked: true });
    return {
      el: h('div', { class: 'pila' }, b.el, modo.el, h('div', { class: 'grilla-2' }, cant.el, seg.el),
        h('label', { class: 'fila nowrap' }, intro, h('span', null, '🎬 Antes de empezar, pasar el video «Nosotros castigamos la ignorancia» (solo con castigo)')),
        h('p', { class: 'muted chico' }, `Con castigo: nadie usa el celular. Cada equipo dice su respuesta en voz alta, vos marcás ✓ o ✗ y cada acierto vale ${PUNTOS_CASTIGO} punto. En «puntos», responden todos desde el celular y cada equipo suma hasta ${PUNTOS} según qué parte acertó.`)),
      leer: () => {
        const banco = b.banco();
        if (!banco) return null;
        return { banco, cantidad: Number(cant.valor()), segundos: Number(seg.valor()), modo: modo.valor(), intro: intro.checked };
      },
    };
  },

  async iniciar(sala, { banco, cantidad, segundos, modo = 'puntos', intro = false }) {
    const conIntro = intro && modo === 'castigo';
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
            h('span', { class: 'tv-etiqueta' }, `${j.titulo || 'Quiz'} · Pregunta ${j.n + 1} de ${j.total}`),
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
