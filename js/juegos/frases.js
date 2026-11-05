// Frases en argentino: la tele muestra una frase famosa de Los Simpson reescrita en rioplatense
// y los equipos tienen que adivinar cuál es la original.
// Dos modos:
//  - «celular»: cada invitado elige la original entre cuatro opciones; el equipo suma según qué
//    parte de sus integrantes acertó (como la trivia, así no importa el tamaño del equipo).
//  - «voz»: los equipos la gritan y quien organiza marca desde el panel qué equipo la dijo primero.
import { h, montar, vista, selector, pildoraEquipo, ranking, esperando } from './comun.js';
import { FRASES } from '../frases.js';
import { mezclar, cuentaRegresiva, letraOpcion, toast, sonido, vibrar, idAzar, confeti } from '../util.js';

const PUNTOS = 100;

// Estilos propios del juego en su archivo, para no tocar los de todos.
if (typeof document !== 'undefined' && !document.querySelector('link[data-frases]')) {
  document.head.append(h('link', { rel: 'stylesheet', href: new URL('../../css/frases.css', import.meta.url).href, 'data-frases': '' }));
}

const cita = (t) => `«${t}»`;
// Las frases largas se achican para que todo entre en la tele.
const largo = (t, base) => base + (t.length > 95 ? ' larga' : t.length > 55 ? ' media' : '');
const opcionesLargas = (ops) => (ops.some((o) => o.length > 60) ? ' compacta' : '');

export default {
  id: 'frases',
  nombre: 'Frases en argentino',
  icono: '🧉',
  resumen: 'Una frase de Los Simpson dicha en argentino: hay que adivinar la original.',
  tipos: [],

  configurar() {
    const modo = selector('cfg-modo', 'Cómo se responde', [['celular', 'Cada uno elige en el celular (4 opciones)'], ['voz', 'A los gritos: el panel marca quién la dijo']], 'voz');
    const cant = selector('cfg-cantidad', 'Cantidad de frases', [[6, '6'], [8, '8'], [10, '10'], [12, '12'], [15, '15'], [0, `Todas (${FRASES.length})`]], 8);
    const seg = selector('cfg-segundos', 'Tiempo por frase', [[20, '20 segundos'], [30, '30 segundos'], [45, '45 segundos'], [60, '1 minuto']], 30);
    const ayuda = h('p', { class: 'muted chico' });
    const explicar = () => {
      ayuda.textContent = modo.valor() === 'voz'
        ? `El primer equipo que dice la frase original suma ${PUNTOS}. Vos marcás quién fue desde el panel; el reloj es solo para apurarlos.`
        : `Cada equipo suma hasta ${PUNTOS} por frase, según qué parte del equipo eligió la original. Las otras opciones son frases de otros personajes.`;
    };
    modo.el.querySelector('select').addEventListener('change', explicar);
    explicar();
    return {
      el: h('div', { class: 'pila' }, modo.el, h('div', { class: 'grilla-2' }, cant.el, seg.el), ayuda,
        h('p', { class: 'muted chico' }, `Hay ${FRASES.length} frases. Con 💡 Pista la tele muestra quién la dice.`)),
      leer: () => ({ modo: modo.valor(), cantidad: Number(cant.valor()), segundos: Number(seg.valor()) }),
    };
  },

  async iniciar(sala, { modo, cantidad, segundos }) {
    const elegidas = mezclar(FRASES).slice(0, cantidad || FRASES.length);
    const frases = elegidas.map((fr) => {
      if (modo !== 'celular') return { ...fr };
      // Las opciones falsas son otras frases originales del banco.
      const otras = mezclar(FRASES.filter((x) => x.original !== fr.original)).slice(0, 3).map((x) => x.original);
      const opciones = mezclar([fr.original, ...otras]);
      return { ...fr, opciones, correcta: opciones.indexOf(fr.original) };
    });
    const id = idAzar();
    await sala.guardarPrivado({ juego: id, frases });
    await sala.iniciarJuego({ tipo: 'frases', modo, total: frases.length, duracion: segundos * 1000, ...publica(frases[0], 0, segundos * 1000) }, id);
  },

  host(el, sala) {
    let privado = null;
    let revelando = -1;
    sala.privadoDelJuego().then((p) => { privado = p; v.actualizar(); });

    const participantes = () => sala.activos().filter((j) => j.equipo);

    // Modo celular: puntos según qué parte de cada equipo acertó.
    async function revelarCelular() {
      const j = sala.juego;
      if (!privado || j.fase !== 'frase' || revelando === j.n) return;
      revelando = j.n;
      const fr = privado.frases[j.n];
      const resp = sala.respuestasJuego(j.n);
      const conteo = fr.opciones.map(() => 0);
      resp.forEach((r) => { if (r.valor >= 0 && r.valor < conteo.length) conteo[r.valor]++; });
      const porEquipo = {};
      const sumas = {};
      for (const e of sala.equipos()) {
        const miembros = sala.miembros(e.id).filter((m) => m.presente || resp.has(m.uid));
        const ok = miembros.filter((m) => resp.get(m.uid)?.valor === fr.correcta).length;
        const pts = miembros.length ? Math.round((PUNTOS * ok) / miembros.length) : 0;
        porEquipo[e.id] = { ok, n: miembros.length, pts };
        sumas[e.id] = pts;
      }
      try {
        await sala.actualizarJuego({ fase: 'revelada', ...revelacion(fr), correcta: fr.correcta, conteo, porEquipo }, sumas);
      } catch (e) { revelando = -1; toast('No se pudo revelar: ' + e.message, 'error'); }
    }

    // Modo voz: el equipo que la dijo primero se lleva los puntos (o nadie).
    async function revelarVoz(eid) {
      const j = sala.juego;
      if (!privado || j.fase !== 'frase' || revelando === j.n) return;
      revelando = j.n;
      const fr = privado.frases[j.n];
      try {
        await sala.actualizarJuego({ fase: 'revelada', ...revelacion(fr), ganador: eid || null }, eid ? { [eid]: PUNTOS } : {});
      } catch (e) { revelando = -1; toast('No se pudo revelar: ' + e.message, 'error'); }
    }

    const pista = () => sala.actualizarJuego({ pista: privado.frases[sala.juego.n].quien }).catch((e) => toast(e.message, 'error'));

    async function siguiente() {
      const j = sala.juego;
      const n = j.n + 1;
      if (n >= j.total) { await sala.actualizarJuego({ fase: 'fin' }); return; }
      const limpiar = { original: undefined, quien: undefined, nota: undefined, correcta: undefined, conteo: undefined, porEquipo: undefined, ganador: undefined, pista: undefined };
      await sala.actualizarJuego({ ...limpiar, ...publica(privado.frases[n], n, j.duracion) });
    }

    let contador;
    const v = vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${!!privado}:${!!sala.juego.pista}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        contador = null;
        if (!privado) { montar(el, esperando('Cargando las frases…')); return; }
        if (j.fase === 'fin') { montar(el, h('h3', null, '¡Terminaron las frases!'), ranking(sala)); return; }
        const fr = privado.frases[j.n];
        const voz = j.modo === 'voz';
        const reloj = h('span', { class: 'reloj' });
        const respuesta = h('div', { class: 'fa-host-original' },
          h('span', { class: 'etiqueta' }, 'La original'),
          h('p', { class: 'grande' }, cita(fr.original)),
          h('p', { class: 'muted chico' }, `— ${fr.quien}${fr.nota ? ' · ' + fr.nota : ''}`));
        const cabecera = h('div', { class: 'fila entre' },
          h('span', { class: 'etiqueta' }, `Frase ${j.n + 1} de ${j.total}`),
          j.fase === 'frase' && reloj);
        const argento = h('p', { class: 'fa-host-argento' }, '🧉 ', cita(fr.argento));

        if (j.fase === 'revelada') {
          montar(el, cabecera, argento, respuesta,
            voz
              ? h('p', null, j.ganador ? ['Se la llevó ', pildoraEquipo(sala.equipo(j.ganador), ` +${PUNTOS}`)] : 'Nadie la sacó.')
              : h('div', { class: 'fila' }, sala.equipos().map((e) => pildoraEquipo(e, ` +${j.porEquipo?.[e.id]?.pts ?? 0}`))),
            h('button', { class: 'btn grande', onclick: siguiente }, j.n + 1 >= j.total ? 'Ver resultados' : 'Siguiente frase →'));
          return;
        }

        const botonPista = h('button', { class: 'btn sec', disabled: !!j.pista, onclick: pista }, j.pista ? `💡 Pista en la tele: ${j.pista}` : '💡 Pista: quién lo dice');
        if (voz) {
          montar(el, cabecera, argento, respuesta,
            h('p', { class: 'muted chico' }, '¿Qué equipo dijo primero la frase original?'),
            h('div', { class: 'fa-ganadores' }, sala.equipos().map((e) =>
              h('button', { class: 'btn', style: { '--c': e.color }, onclick: () => revelarVoz(e.id) }, `🗣 ${e.nombre}`))),
            h('div', { class: 'fila entre' }, botonPista,
              h('button', { class: 'btn sec', onclick: () => revelarVoz(null) }, 'Nadie: revelar')));
          alLimpiar(cuentaRegresiva(reloj, j.terminaEn));
          return;
        }
        contador = h('span', { class: 'mono' });
        montar(el, cabecera, argento,
          h('ol', { class: 'opciones-host' }, fr.opciones.map((o, i) =>
            h('li', { class: i === fr.correcta ? 'correcta' : '' }, h('b', null, letraOpcion(i)), ' ', o))),
          h('p', { class: 'muted chico' }, `— ${fr.quien}${fr.nota ? ' · ' + fr.nota : ''}`),
          h('div', { class: 'fila entre' }, botonPista, h('span', null, contador, ' respondieron'),
            h('button', { class: 'btn', onclick: revelarCelular }, 'Revelar')));
        alLimpiar(cuentaRegresiva(reloj, j.terminaEn, { alTerminar: revelarCelular }));
      },
      refrescar() {
        const j = sala.juego;
        if (!privado || j.fase !== 'frase' || j.modo !== 'celular' || !contador) return;
        const total = participantes().length;
        const resp = [...sala.respuestasJuego(j.n).keys()].filter((uid) => sala.data.asignaciones?.[uid] && sala.presente(uid)).length;
        contador.textContent = `${resp}/${total}`;
        if (total > 0 && resp >= total) setTimeout(revelarCelular, 800);
      },
    });
    return v;
  },

  alumno(el, sala) {
    const elegida = {};
    const miEquipo = () => sala.data.asignaciones?.[sala.uid];
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${!!sala.juego.pista}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        if (j.fase === 'fin') { montar(el, h('h2', null, '¡Terminaron las frases!'), ranking(sala)); return; }
        const pista = j.pista && h('p', { class: 'fa-pista' }, '💡 La dice ', h('b', null, j.pista));
        if (j.fase === 'revelada') {
          let clase = '', titulo = 'La original era';
          if (j.modo === 'voz') {
            const mio = j.ganador && j.ganador === miEquipo();
            clase = j.ganador ? (mio ? 'bien' : 'mal') : '';
            titulo = j.ganador ? (mio ? '¡La sacó tu equipo!' : `La sacó ${sala.equipo(j.ganador)?.nombre || 'otro equipo'}`) : 'Nadie la sacó';
            if (j.ganador) vibrar(mio ? 60 : [60, 60, 60]);
          } else {
            const mia = elegida[j.n];
            if (mia !== undefined) { clase = mia === j.correcta ? 'bien' : 'mal'; titulo = mia === j.correcta ? '¡Correcto!' : 'Incorrecto'; vibrar(mia === j.correcta ? 60 : [60, 60, 60]); }
            else titulo = 'Se terminó el tiempo';
          }
          const pe = j.porEquipo?.[miEquipo()];
          montar(el, h('div', { class: 'resultado ' + clase },
            h('div', { class: 'resultado-titulo' }, titulo),
            h('p', { class: 'fa-original' }, cita(j.original)),
            h('p', { class: 'muted' }, `— ${j.quien}`),
            pe && h('p', { class: 'muted' }, `Tu equipo: ${pe.ok} de ${pe.n} acertaron · +${pe.pts} puntos`)));
          return;
        }
        const reloj = h('span', { class: 'reloj' });
        const cabecera = h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, `Frase ${j.n + 1}/${j.total}`), reloj);
        const argento = h('p', { class: 'fa-argento-cel' }, cita(j.argento));
        if (j.modo === 'voz') {
          montar(el, cabecera, argento, pista,
            h('div', { class: 'esperando' }, h('p', { class: 'grande' }, '🗣 ¡Griten la frase original!'),
              h('p', { class: 'muted' }, 'El primer equipo que la dice bien se lleva los puntos.')));
          alLimpiar(cuentaRegresiva(reloj, j.terminaEn));
          return;
        }
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
        const estado = h('p', { class: 'muted chico centro' }, elegida[j.n] !== undefined ? 'Respuesta enviada.' : '¿Cuál es la original? Charlenlo con el equipo.');
        montar(el, cabecera, argento, pista, h('div', { class: 'opciones' }, botones), estado);
        alLimpiar(cuentaRegresiva(reloj, j.terminaEn));
      },
    });
  },

  tv(el, sala) {
    let barras = null;
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${!!sala.juego.pista}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        barras = null;
        if (j.fase === 'fin') {
          sonido('fin');
          montar(el, h('div', { class: 'tv-centro' }, h('h1', { class: 'tv-titulo' }, '¡Terminaron las frases!'), ranking(sala)));
          return;
        }
        const revelada = j.fase === 'revelada';
        const cabecera = h('div', { class: 'tv-cabecera fa-cab' },
          h('span', { class: 'tv-etiqueta' }, `🧉 Frases en argentino · ${j.n + 1} de ${j.total}`),
          !revelada && h('div', { class: 'tv-reloj' }));
        const pista = !revelada && j.pista && h('div', { class: 'fa-tv-pista' }, '💡 La dice ', h('b', null, j.pista));

        if (revelada) {
          sonido('bien');
          if (j.modo === 'voz' && j.ganador) confeti([sala.equipo(j.ganador)?.color || '#FED90F', '#FED90F', '#FFFFFF']);
          const max = j.conteo ? Math.max(1, ...j.conteo) : 1;
          montar(el, cabecera,
            h('div', { class: 'fa-tv-revelada' },
              h('div', { class: 'fa-tv-argento-chica' }, cita(j.argento)),
              h('span', { class: 'fa-tv-etq' }, 'La original'),
              h('div', { class: largo(j.original, 'fa-tv-original') }, cita(j.original)),
              h('div', { class: 'fa-tv-quien' }, `— ${j.quien}${j.nota ? ' · ' + j.nota : ''}`)),
            j.modo === 'voz'
              ? h('div', { class: 'fa-tv-ganador' }, j.ganador
                ? h('div', { class: 'tv-eq', style: { '--c': sala.equipo(j.ganador)?.color } },
                  h('span', { class: 'tv-eq-nombre' }, sala.equipo(j.ganador)?.nombre), h('span', { class: 'tv-eq-pts' }, `+${PUNTOS}`))
                : h('p', { class: 'tv-muted' }, 'Nadie la sacó'))
              : h('div', { class: 'pila' },
                h('div', { class: 'tv-opciones fa-tv-opciones compacta' }, j.opciones.map((o, i) =>
                  h('div', { class: 'tv-opcion op' + i + (i === j.correcta ? ' correcta' : ' apagada') },
                    h('span', { class: 'op-letra' }, letraOpcion(i)),
                    h('span', { class: 'tv-op-txt' }, o),
                    h('span', { class: 'tv-op-n' }, j.conteo[i]),
                    h('span', { class: 'tv-op-barra', style: { width: (100 * j.conteo[i]) / max + '%' } })))),
                h('div', { class: 'tv-equipos' }, sala.equipos().map((e) => {
                  const pe = j.porEquipo?.[e.id] || { ok: 0, n: 0, pts: 0 };
                  return h('div', { class: 'tv-eq', style: { '--c': e.color } },
                    h('span', { class: 'tv-eq-nombre' }, e.nombre),
                    h('span', { class: 'tv-eq-dato' }, `${pe.ok}/${pe.n} ✓`),
                    h('span', { class: 'tv-eq-pts' }, `+${pe.pts}`));
                }))));
          return;
        }

        const reloj = cabecera.querySelector('.tv-reloj');
        if (j.modo === 'voz') {
          montar(el, cabecera,
            h('div', { class: largo(j.argento, 'fa-tv') }, cita(j.argento)), pista,
            h('div', { class: 'fa-tv-grito' }, '🗣 ¿Cuál es la frase original? ¡Grítenla!'));
        } else {
          barras = h('div', { class: 'tv-equipos' });
          montar(el, cabecera,
            h('div', { class: largo(j.argento, 'fa-tv') }, cita(j.argento)), pista,
            h('div', { class: 'tv-opciones fa-tv-opciones' + opcionesLargas(j.opciones) }, j.opciones.map((o, i) =>
              h('div', { class: 'tv-opcion op' + i }, h('span', { class: 'op-letra' }, letraOpcion(i)), h('span', { class: 'tv-op-txt' }, o)))),
            barras);
        }
        alLimpiar(cuentaRegresiva(reloj, j.terminaEn, { cadaSegundo: (f) => reloj.classList.toggle('urgente', f < 5500) }));
      },
      refrescar() {
        const j = sala.juego;
        if (!barras || j.fase !== 'frase') return;
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

// Lo que ven todos mientras se juega una frase (sin la original).
function publica(fr, n, duracion) {
  const p = { fase: 'frase', n, argento: fr.argento, terminaEn: Date.now() + duracion };
  if (fr.opciones) p.opciones = fr.opciones;
  return p;
}

// Lo que se agrega al revelar.
function revelacion(fr) {
  return { original: fr.original, quien: fr.quien, nota: fr.nota || '' };
}
