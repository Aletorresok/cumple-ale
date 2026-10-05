// Mímica por equipos (del cumple de Pau): por turnos, alguien del equipo actúa las palabras que
// le aparecen en el celular y su equipo tiene que adivinar antes de que se acabe el tiempo.
// Quien actúa marca «¡Adivinaron!» o «Pasar» desde su celular (o lo marca quien organiza).
import { h, montar, vista, selectorBanco, selector, esperando, pildoraEquipo, ranking } from './comun.js';
import { itemsDe } from '../bancos.js';
import { mezclar, cuentaRegresiva, toast, sonido, vibrar, confeti } from '../util.js';

const PUNTOS_ACIERTO = 10;

export default {
  id: 'mimica',
  nombre: 'Mímica por equipos',
  icono: '🎭',
  resumen: 'Alguien actúa sin hablar y su equipo adivina todas las que pueda antes de que se acabe el tiempo.',
  tipos: ['mimica'],

  configurar({ bancos, sala }) {
    const b = selectorBanco(bancos, 'mimica', 5);
    const seg = selector('cfg-seg', 'Tiempo por turno', [[45, '45 segundos'], [60, '1 minuto'], [90, '1 minuto y medio']], 60);
    const vueltas = selector('cfg-vueltas', 'Vueltas', [[1, '1 turno por equipo'], [2, '2 turnos por equipo'], [3, '3 turnos por equipo']], 2);
    const conGente = sala.equipos().filter((e) => sala.miembros(e.id).length >= 2);
    return {
      el: h('div', { class: 'pila' }, b.el, h('div', { class: 'grilla-2' }, seg.el, vueltas.el),
        h('p', { class: 'muted chico' }, `Cada palabra adivinada suma ${PUNTOS_ACIERTO} puntos. Pasar no resta, pero la palabra se pierde. Actúa una persona distinta en cada turno.`),
        conGente.length < 1 && h('p', { class: 'aviso' }, 'Hace falta al menos un equipo con 2 personas.')),
      leer: () => {
        const banco = b.banco();
        if (!banco) return null;
        const equipos = sala.equipos().filter((e) => sala.miembros(e.id).length >= 2).map((e) => e.id);
        if (!equipos.length) { toast('Hace falta al menos un equipo con 2 personas', 'error'); return null; }
        return { palabras: mezclar(itemsDe(banco, 'mimica').map((i) => i.palabra)), seg: Number(seg.valor()), vueltas: Number(vueltas.valor()), equipos };
      },
    };
  },

  async iniciar(sala, { palabras, seg, vueltas, equipos }) {
    const orden = mezclar(equipos);
    const juego = await sala.iniciarJuego({
      tipo: 'mimica', fase: 'listo', seg, turno: 0, total: orden.length * vueltas, orden,
      equipo: orden[0], actor: null, hasta: 0, n: 0, aciertos: 0, pasadas: 0, ultimas: [], actuaron: [],
    });
    await sala.guardarPrivado({ juego, palabras, pos: 0, turnoPalabras: [] });
  },

  host(el, sala) {
    let privado = null;
    let fin = null;
    let procesando = false;
    const hechos = new Set();

    const cargar = async () => {
      privado = await sala.privadoDelJuego();
      v.actualizar();
    };

    async function empezarTurno() {
      const j = sala.juego;
      const equipo = j.fase === 'fin_turno' ? j.siguiente : j.equipo;
      const miembros = sala.miembros(equipo);
      if (!miembros.length) { toast('Ese equipo no tiene integrantes', 'error'); return; }
      // Actúa alguien que todavía no actuó (si ya actuaron todos, cualquiera).
      const libres = miembros.filter((m) => !j.actuaron.includes(m.uid));
      const actor = mezclar(libres.length ? libres : miembros)[0];
      const turno = j.turno + 1;
      privado.turnoPalabras = [];
      await sala.actualizarJuego({ fase: 'actuando', turno, equipo, actor: { uid: actor.uid, nombre: actor.nombre }, n: 0, aciertos: 0, pasadas: 0, ultimas: [], hasta: Date.now() + j.seg * 1000, actuaron: [...j.actuaron, actor.uid] });
      await darPalabra(turno, 0, actor.uid);
    }

    async function darPalabra(turno, n, uid) {
      if (privado.pos >= privado.palabras.length) { privado.palabras = mezclar(privado.palabras); privado.pos = 0; }
      const palabra = privado.palabras[privado.pos];
      privado.actual = palabra;
      await sala.repartirSecretos({ [uid]: { juego: sala.juego.id, ronda: turno, n, palabra } });
      await sala.guardarPrivado(privado);
    }

    // Acierto o paso, venga del celular de quien actúa o de este panel.
    async function marcar(accion, n) {
      const j = sala.juego;
      if (procesando || j.fase !== 'actuando' || n !== j.n) return;
      procesando = true;
      try {
        privado.turnoPalabras.push({ texto: privado.actual, ok: accion === 'acierto' });
        privado.pos++;
        const campos = accion === 'acierto' ? { aciertos: j.aciertos + 1 } : { pasadas: j.pasadas + 1 };
        await sala.actualizarJuego({ ...campos, n: j.n + 1 });
        await darPalabra(j.turno, j.n + 1, j.actor.uid);
        sonido(accion === 'acierto' ? 'bien' : 'mal');
      } catch (e) { toast(e.message, 'error'); }
      procesando = false;
    }

    async function terminarTurno() {
      const j = sala.juego;
      if (j.fase !== 'actuando') return;
      const siguiente = j.turno < j.total ? j.orden[j.turno % j.orden.length] : null;
      await sala.sumar({ [j.equipo]: j.aciertos * PUNTOS_ACIERTO });
      await sala.actualizarJuego({ fase: siguiente ? 'fin_turno' : 'fin', ultimas: privado.turnoPalabras, siguiente });
      await sala.repartirSecretos({ [j.actor.uid]: { juego: j.id, ronda: j.turno, n: -1, palabra: '' } });
    }

    let contador;
    const v = vista({
      destruir: () => fin?.(),
      clave: () => `${sala.juego.fase}:${sala.juego.turno}:${!!privado}`,
      dibujar() {
        const j = sala.juego;
        fin?.(); fin = null; contador = null;
        if (!privado) { montar(el, esperando('Preparando…')); cargar(); return; }
        const eq = sala.equipo(j.equipo);
        if (j.fase === 'listo' || j.fase === 'fin_turno') {
          montar(el,
            j.fase === 'fin_turno' && h('p', null, `Turno ${j.turno}: `, h('b', null, `${j.aciertos} adivinadas`), ` (+${j.aciertos * PUNTOS_ACIERTO})`),
            h('p', null, `Turno ${j.turno + 1} de ${j.total}: le toca a `, pildoraEquipo(sala.equipo(j.fase === 'fin_turno' ? j.siguiente : j.equipo))),
            h('p', { class: 'muted chico' }, 'Al empezar, la app elige quién actúa y le muestra la palabra en su celular.'),
            h('button', { class: 'btn grande', onclick: empezarTurno }, '🎭 Empezar turno'));
          return;
        }
        if (j.fase === 'fin') {
          montar(el, h('p', { class: 'grande' }, '¡Terminó la mímica!'), ranking(sala));
          return;
        }
        const reloj = h('span', { class: 'reloj grande' });
        contador = h('div', { class: 'pila-s' });
        montar(el,
          h('div', { class: 'fila entre' }, pildoraEquipo(eq), reloj),
          h('p', null, 'Actúa ', h('b', null, j.actor.nombre)),
          contador,
          h('div', { class: 'fila' },
            h('button', { class: 'btn ok', onclick: () => marcar('acierto', sala.juego.n) }, '✓ Adivinaron'),
            h('button', { class: 'btn sec', onclick: () => marcar('paso', sala.juego.n) }, '⏭ Pasar')),
          h('button', { class: 'btn-link', onclick: terminarTurno }, 'Terminar el turno ya'));
        fin = cuentaRegresiva(reloj, j.hasta, { alTerminar: terminarTurno });
      },
      refrescar() {
        const j = sala.juego;
        if (j.fase !== 'actuando' || !privado) return;
        // Botones del celular de quien actúa.
        const r = sala.respuestasJuego(j.turno).get(j.actor.uid);
        const clave = r && `${j.turno}:${r.paso}:${r.accion}`;
        if (r && r.paso === j.n && !hechos.has(clave)) { hechos.add(clave); marcar(r.accion, r.paso); }
        if (contador) montar(contador, h('p', { class: 'muted' }, 'Palabra: ', h('b', null, privado.actual || '…')),
          h('p', null, `${j.aciertos} adivinadas · ${j.pasadas} pasadas`));
      },
    });
    return v;
  },

  alumno(el, sala) {
    let secreto = null;
    let v;
    const dejar = sala.escucharDoc('secretos', sala.uid, (s) => { secreto = s; v?.actualizar('secreto'); });
    v = vista({
      destruir: () => dejar(),
      clave: () => {
        const j = sala.juego;
        return `${j.fase}:${j.turno}:${j.equipo}:${j.actor?.uid === sala.uid ? `${secreto?.ronda}:${secreto?.n}` : ''}`;
      },
      dibujar(alLimpiar) {
        const j = sala.juego;
        const mio = sala.data.asignaciones?.[sala.uid];
        const eq = sala.equipo(j.equipo);
        if (j.fase === 'fin') { montar(el, h('h2', null, '¡Terminó la mímica!'), ranking(sala)); return; }
        if (j.fase !== 'actuando') {
          montar(el, j.fase === 'fin_turno' && h('div', { class: 'resultado' + (j.equipo === mio ? ' bien' : '') },
            h('div', { class: 'resultado-titulo' }, `${eq?.nombre}: ${j.aciertos} adivinadas`)),
          esperando(mio === (j.fase === 'fin_turno' ? j.siguiente : j.equipo) ? '¡Ahora le toca a tu equipo!' : 'Esperando el próximo turno…'));
          return;
        }
        if (j.actor.uid === sala.uid) {
          const valida = secreto && secreto.juego === j.id && secreto.ronda === j.turno && secreto.n === j.n;
          if (!valida) { montar(el, esperando('Cargando la palabra…')); return; }
          vibrar(60);
          let enviado = false;
          const mandar = async (accion) => {
            if (enviado) return;
            enviado = true;
            el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
            try { await sala.responder({ ronda: j.turno, paso: secreto.n, accion }); } catch (e) { toast(e.message, 'error'); enviado = false; }
          };
          const reloj = h('span', { class: 'reloj' });
          montar(el,
            h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, 'Actuá sin hablar'), reloj),
            h('div', { class: 'palabra-secreta' }, h('div', { class: 'palabra' }, secreto.palabra)),
            h('div', { class: 'mimica-botones' },
              h('button', { class: 'btn ok grande', onclick: () => mandar('acierto') }, '✓ ¡Adivinaron!'),
              h('button', { class: 'btn sec grande', onclick: () => mandar('paso') }, '⏭ Pasar')));
          alLimpiar(cuentaRegresiva(reloj, j.hasta));
          return;
        }
        if (mio === j.equipo) {
          montar(el, h('div', { class: 'resultado bien' }, h('div', { class: 'resultado-titulo' }, '¡Adiviná!'),
            h('p', null, `${j.actor.nombre} está actuando. Gritá lo que se te ocurra.`)));
          return;
        }
        montar(el, esperando(`Turno del equipo ${eq?.nombre}`, 'Sin soplar 🤫'));
      },
    });
    return v;
  },

  tv(el, sala) {
    let cuenta;
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.turno}:${sala.juego.equipo}:${sala.juego.siguiente}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        cuenta = null;
        const eq = sala.equipo(j.equipo);
        if (j.fase === 'fin') {
          sonido('fin'); confeti();
          montar(el, h('div', { class: 'tv-centro' }, h('div', { class: 'tv-icono' }, '🎭'), h('h1', { class: 'tv-titulo' }, '¡Terminó la mímica!'), ranking(sala)));
          return;
        }
        if (j.fase === 'listo' || j.fase === 'fin_turno') {
          const prox = sala.equipo(j.fase === 'fin_turno' ? j.siguiente : j.equipo);
          montar(el, h('div', { class: 'tv-centro' },
            j.fase === 'fin_turno'
              ? [h('div', { class: 'tv-etiqueta' }, `${eq?.nombre} adivinó`), h('h1', { class: 'tv-titulo enorme', style: { color: eq?.color } }, j.aciertos),
                j.ultimas?.length > 0 && h('ul', { class: 'tv-mimica-lista' }, j.ultimas.map((p) => h('li', { class: p.ok ? 'ok' : 'paso' }, p.texto)))]
              : [h('div', { class: 'tv-icono' }, '🎭'), h('h1', { class: 'tv-titulo' }, 'Mímica por equipos'),
                h('p', { class: 'tv-sub' }, 'Alguien del equipo actúa sin hablar. El resto adivina. ¡Todas las que puedan!')],
            h('p', { class: 'tv-sub' }, 'Próximo turno: ', pildoraEquipo(prox))));
          if (j.fase === 'fin_turno') sonido('fin');
          return;
        }
        const reloj = h('div', { class: 'tv-reloj' });
        cuenta = h('div', { class: 'tv-contador enorme', style: { color: eq?.color } });
        montar(el, h('div', { class: 'tv-centro' },
          h('div', { class: 'tv-etiqueta' }, `Turno de ${eq?.nombre} · actúa`),
          h('h1', { class: 'tv-titulo', style: { color: eq?.color } }, j.actor.nombre),
          h('div', { class: 'fila' }, h('span', { class: 'tv-etiqueta' }, '⏱ segundos'), reloj),
          cuenta, h('p', { class: 'tv-sub' }, 'adivinadas')));
        alLimpiar(cuentaRegresiva(reloj, j.hasta, { cadaSegundo: (falta) => reloj.classList.toggle('urgente', falta < 10000) }));
      },
      refrescar() {
        if (cuenta) cuenta.textContent = sala.juego.aciertos;
      },
    });
  },
};
