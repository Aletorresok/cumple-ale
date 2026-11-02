// «Los invitados dicen» (al estilo de 100 argentinos dicen): hay que adivinar las respuestas
// más dichas de una encuesta. Cada ronda se enfrentan dos equipos:
//   1. Cara a cara: un integrante de cada equipo; el primero que toca el pulsador responde.
//      Si acierta la más dicha gana; si no, responde el otro y gana la respuesta más alta.
//   2. El que gana el cara a cara elige si su equipo juega o pasa.
//   3. El equipo que juega responde por turnos hasta completar el tablero o sumar 3 errores.
//   4. Con 3 errores, el otro equipo se pone de acuerdo y tiene una sola respuesta para robar el pozo.
// Las encuestas salen de un banco o de lo que responde el propio grupo en el momento.
import { h, montar, vista, selectorBanco, selector, ranking, esperando, pildoraEquipo } from './comun.js';
import { itemsDe } from '../bancos.js';
import { mezclar, respuestaCorrecta, cuentaRegresiva, toast, sonido, vibrar, idAzar } from '../util.js';
import { contarPalabras, ofensiva } from './nube.js';

const MAX_CASILLEROS = 8;
const STRIKES = 3;
const CAMPOS = ['fase', 'reveladas', 'strikes', 'turno', 'duenio', 'pozo', 'paso', 'ultimo', 'gano', 'todas',
  'terminaEn', 'duelo', 'responde', 'giro', 'mult', 'par', 'proximo'];

const visible = (t) => String(t).split('/')[0].trim();
const enJuego = (j) => j.fase === 'jugando' || j.fase === 'robo';
const activa = (j) => enJuego(j) || j.fase === 'duelo' || j.fase === 'elegir';
const rival = (j, eid) => (j.par || []).find((e) => e !== eid) || null;
const vence = (j) => (j.seg ? Date.now() + j.seg * 1000 : 0);

// Todos los cruces posibles entre equipos, ordenados para que nadie juegue dos rondas seguidas
// si se puede y todos jueguen parecido. Se guardan como «e1|e2» (Firestore no guarda listas de listas).
export function emparejar(orden) {
  const todos = [];
  for (let a = 0; a < orden.length; a++) for (let b = a + 1; b < orden.length; b++) todos.push([orden[a], orden[b]]);
  if (!todos.length) return orden.length ? [orden[0]] : [];
  const veces = Object.fromEntries(orden.map((e) => [e, 0]));
  const out = [];
  let ant = [];
  while (todos.length) {
    todos.sort((x, y) => {
      const rx = x.some((e) => ant.includes(e)), ry = y.some((e) => ant.includes(e));
      return (rx - ry) || (veces[x[0]] + veces[x[1]]) - (veces[y[0]] + veces[y[1]]);
    });
    const [p] = todos.splice(0, 1);
    p.forEach((e) => veces[e]++);
    out.push(p.join('|'));
    ant = p;
  }
  return out;
}

// El siguiente integrante (conectado) de un equipo, por turnos.
function persona(sala, giro, eid) {
  const m = sala.miembrosActivos(eid);
  if (!m.length) return null;
  const n = giro[eid] || 0;
  giro[eid] = n + 1;
  const p = m[n % m.length];
  return { uid: p.uid, nombre: p.nombre };
}

function nuevoDuelo(sala, j, intento = 1) {
  const [a, b] = j.par;
  return { reps: { [a]: persona(sala, j.giro, a), [b]: persona(sala, j.giro, b) }, primero: null, resp: {}, intento };
}

// Arma una ronda nueva: elige los dos equipos y arranca el cara a cara.
function armarRonda(sala, j, ronda, pregunta, respuestas) {
  const par = j.proximo?.length ? j.proximo : String(j.pares?.[(ronda - 1) % (j.pares?.length || 1)] || '').split('|').filter(Boolean);
  const r = {
    ronda, pregunta, casilleros: respuestas.length, reveladas: {}, strikes: 0, pozo: 0, paso: (j.paso || 0) + 1,
    ultimo: null, gano: null, todas: null, par, proximo: null, giro: { ...(j.giro || {}) },
    mult: j.doble && j.total && ronda >= j.total ? 2 : 1, seg: j.seg,
  };
  if (par.length < 2) {
    return { ...r, fase: 'jugando', turno: par[0] || null, duenio: par[0] || null, duelo: null, responde: persona(sala, r.giro, par[0]), terminaEn: vence(j) };
  }
  return { ...r, fase: 'duelo', turno: null, duenio: null, responde: null, duelo: nuevoDuelo(sala, r), terminaEn: 0 };
}

function tablero(j, { tv = false } = {}) {
  const celdas = [];
  for (let i = 0; i < j.casilleros; i++) {
    const r = j.reveladas?.[i];
    const perdida = !r && j.todas?.[i];
    const dato = r || perdida;
    celdas.push(h('div', { class: 'casillero' + (r ? ' revelada' : perdida ? ' perdida' : '') },
      h('span', { class: 'cas-num' }, i + 1),
      dato ? [h('span', { class: 'cas-txt' }, dato.texto), h('span', { class: 'cas-pts' }, dato.puntos)] : h('span', { class: 'cas-txt' })));
  }
  return h('div', { class: 'tablero' + (tv ? ' en-tv' : '') }, celdas);
}

function errores(n) {
  return h('span', { class: 'cruces', 'aria-label': `${n} errores` },
    Array.from({ length: STRIKES }, (_, i) => h('b', { class: i < n ? 'on' : '' }, '✗')));
}

function checksEquipos(sala) {
  const conGente = sala.equipos().filter((e) => sala.miembros(e.id).length).map((e) => e.id);
  return sala.equipos().map((e) => ({ e, input: h('input', { type: 'checkbox', id: 'cfg-eq-' + e.id, checked: !conGente.length || conGente.includes(e.id) }) }));
}

// «Krusty Burger vs Planta Nuclear», con el nombre de quien pasa al frente debajo.
function frente(sala, j, { tv = false } = {}) {
  const lado = (eid) => {
    const rep = j.duelo?.reps?.[eid];
    const pulso = j.duelo?.primero === eid;
    return h('div', { class: 'duelo-lado' + (pulso ? ' pulso' : '') }, pildoraEquipo(sala.equipo(eid)),
      h('span', { class: 'duelo-nombre' }, rep?.nombre || 'alguien del equipo'), pulso && h('span', { class: 'duelo-marca' }, '¡Pulsó!'));
  };
  return h('div', { class: 'duelo' + (tv ? ' en-tv' : '') }, lado(j.par[0]), h('span', { class: 'duelo-vs' }, 'vs'), lado(j.par[1]));
}

const doble = (j) => j.mult > 1 && h('span', { class: 'doble' }, '×2 puntos dobles');

export default {
  id: 'encuesta',
  nombre: 'Los invitados dicen',
  icono: '📊',
  resumen: 'Al estilo 100 argentinos dicen: dos equipos, cara a cara y robo del pozo.',
  tipos: ['encuesta'],

  configurar({ bancos, sala }) {
    const fuente = selector('cfg-fuente', 'Preguntas', [['banco', 'De un banco (encuestas ya cargadas)'], ['curso', 'Encuesta en vivo: primero responden todos']], 'banco');
    const b = selectorBanco(bancos, 'encuesta', 1);
    const rondas = selector('cfg-rondas', 'Rondas', [[3, '3'], [4, '4'], [5, '5'], [6, '6'], [0, 'Todas las del banco']], 5);
    const dobleUltima = h('input', { type: 'checkbox', id: 'cfg-doble', checked: true });
    const pregunta = h('input', { class: 'campo', id: 'cfg-pregunta', maxlength: 120, placeholder: 'Nombrá algo que no puede faltar en una fiesta' });
    const seg = selector('cfg-seg', 'Tiempo para responder', [[0, 'Sin límite'], [15, '15 segundos'], [20, '20 segundos'], [30, '30 segundos']], 20);
    const checks = checksEquipos(sala);
    const zonaBanco = h('div', { class: 'pila' }, b.el, rondas.el, h('label', { class: 'check' }, dobleUltima, 'La última ronda vale doble'));
    const zonaCurso = h('div', { class: 'pila', hidden: true },
      h('label', { class: 'pila-s' }, h('span', { class: 'etq' }, 'Primera pregunta'), pregunta),
      h('p', { class: 'muted chico' }, 'Cada invitado responde desde su celular. Con las respuestas más repetidas se arma el tablero: cada una vale tantos puntos como personas la dijeron.'));
    const selFuente = fuente.el.querySelector('select');
    selFuente.addEventListener('change', () => { zonaBanco.hidden = selFuente.value !== 'banco'; zonaCurso.hidden = selFuente.value !== 'curso'; });
    return {
      el: h('div', { class: 'pila' }, fuente.el, zonaBanco, zonaCurso, seg.el,
        h('fieldset', { class: 'pila-s' }, h('legend', { class: 'etq' }, 'Equipos que juegan'),
          h('div', { class: 'fila' }, checks.map(({ e, input }) => h('label', { class: 'check' }, input, pildoraEquipo(e))))),
        h('p', { class: 'muted chico' }, `Cada ronda se enfrentan dos equipos, rotando. Cara a cara con pulsador, el ganador elige si juega o pasa, y con ${STRIKES} errores el otro equipo puede robar el pozo.`)),
      leer: () => {
        const equipos = checks.filter((c) => c.input.checked).map((c) => c.e.id);
        if (!equipos.length) { toast('Elegí al menos un equipo', 'error'); return null; }
        const base = { fuente: fuente.valor(), seg: Number(seg.valor()), equipos };
        if (base.fuente === 'curso') {
          const q = pregunta.value.trim();
          if (!q) { toast('Escribí la pregunta', 'error'); pregunta.focus(); return null; }
          return { ...base, pregunta: q };
        }
        const banco = b.banco();
        if (!banco) return null;
        return { ...base, banco, rondas: Number(rondas.valor()), doble: dobleUltima.checked };
      },
    };
  },

  async iniciar(sala, cfg) {
    const id = idAzar();
    const orden = mezclar(cfg.equipos);
    const base = { tipo: 'encuesta', fuente: cfg.fuente, orden, pares: emparejar(orden), seg: cfg.seg, paso: 0, giro: {}, doble: !!cfg.doble, proximo: null };
    if (cfg.fuente === 'curso') {
      await sala.guardarPrivado({ juego: id, fuente: 'curso', actual: [] });
      await sala.iniciarJuego({ ...base, titulo: 'Encuesta en vivo', total: 0, fase: 'encuesta', ronda: 1, pregunta: cfg.pregunta, casilleros: 0, reveladas: {}, strikes: 0, pozo: 0, mult: 1 }, id);
      return;
    }
    let encuestas = mezclar(itemsDe(cfg.banco, 'encuesta')).map((e) => ({
      pregunta: e.pregunta, respuestas: [...e.respuestas].sort((a, b) => b.puntos - a.puntos).slice(0, MAX_CASILLEROS),
    }));
    if (cfg.rondas) encuestas = encuestas.slice(0, cfg.rondas);
    base.total = encuestas.length;
    await sala.guardarPrivado({ juego: id, fuente: 'banco', encuestas, actual: encuestas[0].respuestas });
    await sala.iniciarJuego({ ...base, titulo: cfg.banco.titulo,
      ...armarRonda(sala, base, 1, encuestas[0].pregunta, encuestas[0].respuestas) }, id);
  },

  host(el, sala) {
    let privado = null;
    let procesado = -1;
    let temporizador = null;
    const excluidas = new Set();
    sala.privadoDelJuego().then((p) => { privado = p; v.actualizar('privado'); });

    async function guardar(j, puntos) {
      const campos = {};
      for (const k of CAMPOS) campos[k] = j[k] ?? null;
      try { await sala.actualizarJuego(campos, puntos); } catch (e) { toast('No se pudo guardar: ' + e.message, 'error'); }
    }

    // Toma el juego actual para una acción, una sola vez por paso.
    function tomar(fases) {
      const j = structuredClone(sala.juego);
      if (!privado || !fases.includes(j.fase) || procesado === j.paso) return null;
      procesado = j.paso;
      return j;
    }

    async function cerrarRonda(j) {
      j.fase = 'fin_ronda';
      j.todas = privado.actual.map((r) => ({ texto: visible(r.texto), puntos: r.puntos }));
      j.terminaEn = 0;
      j.responde = null;
      j.paso++;
      await guardar(j, j.gano && j.pozo ? { [j.gano]: j.pozo * (j.mult || 1) } : {});
      sonido('fin');
    }

    // Busca qué casillero es lo que escribieron (o el que marcó a mano quien organiza).
    // Si coincide con varios, se prefiere uno que todavía no esté en el tablero.
    function buscar(j, { valor, idx, error }) {
      const resp = privado.actual;
      if (error) return -1;
      if (idx !== undefined) return idx;
      const i = resp.findIndex((r, k) => !j.reveladas[k] && respuestaCorrecta(valor, r.texto));
      return i >= 0 ? i : resp.findIndex((r) => respuestaCorrecta(valor, r.texto));
    }

    function revelar(j, i, valor) {
      const r = privado.actual[i];
      j.reveladas[i] = { texto: visible(r.texto), puntos: r.puntos };
      j.pozo += r.puntos;
      j.ultimo = { eid: j.turno, texto: valor || visible(r.texto), ok: true };
    }

    function repetida(j, valor) {
      j.ultimo = { eid: j.turno, texto: valor, repetida: true };
      j.paso++;
      j.terminaEn = vence(j);
      return guardar(j);
    }

    // ── Cara a cara ──
    async function pulsar(eid) {
      const j = tomar(['duelo']);
      if (!j || j.duelo.primero) { procesado = -1; return; }
      j.duelo.primero = eid;
      j.turno = eid;
      j.ultimo = null;
      j.paso++;
      j.terminaEn = vence(j);
      await guardar(j);
    }

    async function ganaDuelo(j, eid) {
      j.turno = eid;
      if (Object.keys(j.reveladas).length >= j.casilleros) { j.gano = eid; await cerrarRonda(j); return; }
      j.fase = 'elegir';
      j.terminaEn = 0;
      j.paso++;
      await guardar(j);
    }

    async function jugarDuelo(jugada) {
      const j = tomar(['duelo']);
      if (!j) return;
      if (!j.duelo.primero) { procesado = -1; return; }
      const yo = j.turno, otro = rival(j, yo);
      const i = buscar(j, jugada);
      if (i >= 0 && j.reveladas[i]) { await repetida(j, jugada.valor); return; }
      if (i >= 0) revelar(j, i, jugada.valor);
      else j.ultimo = { eid: yo, texto: jugada.valor || '', ok: false };
      sonido(i >= 0 ? 'bien' : 'mal');
      j.duelo.resp[yo] = i;
      if (i === 0) { await ganaDuelo(j, yo); return; }
      if (j.duelo.resp[otro] === undefined) {
        j.turno = otro;
        j.paso++;
        j.terminaEn = vence(j);
        await guardar(j);
        return;
      }
      const a = j.duelo.resp[yo], b = j.duelo.resp[otro];
      if (a < 0 && b < 0) {
        // Ninguno acertó: pasan al frente otros dos.
        j.duelo = nuevoDuelo(sala, j, (j.duelo.intento || 1) + 1);
        j.turno = null;
        j.terminaEn = 0;
        j.paso++;
        await guardar(j);
        return;
      }
      await ganaDuelo(j, b < 0 || (a >= 0 && a < b) ? yo : otro);
    }

    // Saltear el cara a cara (por ejemplo, si un celular no anda): el control es para `eid`.
    async function darControl(eid) {
      const j = tomar(['duelo']);
      if (!j) return;
      await ganaDuelo(j, eid);
    }

    async function elegir(juegan) {
      const j = tomar(['elegir']);
      if (!j) return;
      j.duenio = juegan ? j.turno : rival(j, j.turno);
      j.turno = j.duenio;
      j.fase = 'jugando';
      j.strikes = 0;
      j.responde = persona(sala, j.giro, j.turno);
      j.ultimo = { eid: j.turno, texto: juegan ? 'Juegan' : 'Pasan', elige: true, ok: true };
      j.paso++;
      j.terminaEn = vence(j);
      await guardar(j);
    }

    // ── Tablero: responde el equipo que juega, de a uno; con 3 errores roba el otro ──
    async function jugarTablero(jugada) {
      const j = tomar(['jugando', 'robo']);
      if (!j) return;
      const i = buscar(j, jugada);
      if (i >= 0 && j.reveladas[i]) { await repetida(j, jugada.valor); return; }
      const acierto = i >= 0;
      if (acierto) revelar(j, i, jugada.valor);
      else j.ultimo = { eid: j.turno, texto: jugada.valor || '', ok: false };
      sonido(acierto ? 'bien' : 'mal');
      if (j.fase === 'robo') {
        j.gano = acierto ? j.turno : j.duenio;
        await cerrarRonda(j);
        return;
      }
      if (acierto && Object.keys(j.reveladas).length >= j.casilleros) {
        j.gano = j.turno;
        await cerrarRonda(j);
        return;
      }
      if (!acierto) {
        j.strikes++;
        if (j.strikes >= STRIKES) {
          const ladron = rival(j, j.duenio);
          if (!ladron) { j.gano = j.duenio; await cerrarRonda(j); return; }
          j.fase = 'robo';
          j.turno = ladron;
          j.responde = null; // para robar responde cualquiera del equipo, después de ponerse de acuerdo
        }
      }
      if (j.fase === 'jugando') j.responde = persona(sala, j.giro, j.turno);
      j.paso++;
      j.terminaEn = vence(j);
      await guardar(j);
    }

    const jugar = (jugada) => (sala.juego.fase === 'duelo' ? jugarDuelo(jugada) : jugarTablero(jugada));

    async function cambiarDuelo() {
      const j = tomar(['duelo']);
      if (!j) return;
      j.duelo = nuevoDuelo(sala, j, (j.duelo?.intento || 1) + 1);
      j.turno = null;
      j.terminaEn = 0;
      j.ultimo = null;
      j.paso++;
      await guardar(j);
    }

    async function alternarDoble() {
      const j = sala.juego;
      await sala.actualizarJuego({ mult: (j.mult || 1) > 1 ? 1 : 2 });
    }

    async function siguiente() {
      const j = sala.juego;
      if (j.ronda >= privado.encuestas.length) { await sala.actualizarJuego({ fase: 'fin' }); return; }
      const e = privado.encuestas[j.ronda];
      privado = { ...privado, actual: e.respuestas };
      await sala.guardarPrivado(privado);
      const r = armarRonda(sala, structuredClone(j), j.ronda + 1, e.pregunta, e.respuestas);
      await sala.actualizarJuego(r);
    }

    async function nuevaPreguntaCurso(texto) {
      const j = sala.juego;
      excluidas.clear();
      privado = { ...privado, actual: [] };
      await sala.guardarPrivado(privado);
      await sala.actualizarJuego({ fase: 'encuesta', ronda: j.ronda + 1, pregunta: texto, casilleros: 0, reveladas: {}, strikes: 0, pozo: 0, ultimo: null, gano: null, todas: null, duelo: null, responde: null, paso: j.paso + 1, terminaEn: 0, mult: 1 });
    }

    function gruposCurso() {
      const j = sala.juego;
      const resp = [...sala.respuestasJuego(j.ronda).values()].map((r) => ({ palabras: [r.valor] }));
      return contarPalabras(resp).filter((g) => !ofensiva(g.clave)).sort((a, b) => b.n - a.n);
    }

    async function armarTablero() {
      const j = sala.juego;
      const grupos = gruposCurso().filter((g) => !excluidas.has(g.clave)).slice(0, MAX_CASILLEROS);
      if (grupos.length < 2) { toast('Hacen falta al menos 2 respuestas distintas', 'error'); return; }
      const actual = grupos.map((g) => ({ texto: g.texto, puntos: g.n }));
      privado = { ...privado, actual };
      await sala.guardarPrivado(privado);
      await sala.actualizarJuego(armarRonda(sala, structuredClone(j), j.ronda, j.pregunta, actual));
    }

    // Lo que llega de los celulares: pulsador, respuestas y «jugamos / pasamos».
    function procesarRespuestas() {
      const j = sala.juego;
      if (!privado || !activa(j) || procesado === j.paso) return;
      const rs = [...sala.respuestasJuego().entries()].map(([uid, r]) => ({ uid, ...r }))
        .filter((x) => x.paso === j.paso).sort((a, b) => a.t - b.t);
      const de = (eid) => j.duelo?.reps?.[eid]?.uid;
      if (j.fase === 'duelo' && !j.duelo.primero) {
        const r = rs.find((x) => x.accion === 'pulsar' && j.par.some((e) => de(e) === x.uid));
        if (r) pulsar(j.par.find((e) => de(e) === r.uid));
        return;
      }
      if (j.fase === 'elegir') {
        const r = rs.find((x) => x.accion === 'elegir' && x.uid === de(j.turno));
        if (r) elegir(r.valor === 'jugar');
        return;
      }
      const r = rs.find((x) => x.accion === 'resp' && (
        j.fase === 'duelo' ? x.uid === de(j.turno)
          : j.fase === 'jugando' && j.responde ? x.uid === j.responde.uid
            : x.equipo === j.turno));
      if (r) jugar({ valor: r.valor });
    }

    let zonaEncuesta = null;
    function pintarEncuesta() {
      if (!zonaEncuesta) return;
      const grupos = gruposCurso();
      const total = sala.respuestasJuego(sala.juego.ronda).size;
      montar(zonaEncuesta,
        h('p', null, h('b', null, total), ` ${total === 1 ? 'invitado respondió' : 'invitados respondieron'}. Tocá una respuesta para dejarla afuera del tablero.`),
        grupos.length
          ? h('ul', { class: 'votos' }, grupos.map((g) => h('li', { class: excluidas.has(g.clave) ? 'excluida' : '', onclick: () => { excluidas.has(g.clave) ? excluidas.delete(g.clave) : excluidas.add(g.clave); pintarEncuesta(); } },
            h('span', null, g.texto), h('b', null, g.n))))
          : h('p', { class: 'vacio' }, 'Todavía no hay respuestas.'));
    }

    // En «fin de ronda»: qué dos equipos se enfrentan en la próxima.
    function elegirProximo(j) {
      if ((j.orden || []).length < 3) return null;
      const r = j.ronda + 1;
      const sugerido = j.proximo?.length ? j.proximo : String(j.pares[(r - 1) % j.pares.length]).split('|');
      const sel = (id, valor) => h('select', { class: 'campo', id }, j.orden.map((e) => h('option', { value: e, selected: e === valor }, sala.equipo(e)?.nombre || e)));
      const a = sel('prox-a', sugerido[0]), b = sel('prox-b', sugerido[1]);
      const cambio = () => {
        if (a.value === b.value) { toast('Elegí dos equipos distintos', 'error'); return; }
        sala.actualizarJuego({ proximo: [a.value, b.value] });
      };
      a.addEventListener('change', cambio);
      b.addEventListener('change', cambio);
      return h('div', { class: 'pila-s' }, h('span', { class: 'etq' }, 'Próximo cara a cara'), h('div', { class: 'fila' }, a, h('span', null, 'vs'), b));
    }

    const v = vista({
      clave: () => `${sala.juego.fase}:${sala.juego.ronda}:${sala.juego.paso}:${sala.juego.mult}:${!!privado}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        zonaEncuesta = null;
        clearTimeout(temporizador);
        if (!privado) { montar(el, esperando('Cargando…')); return; }
        if (j.fase === 'fin') { montar(el, h('h3', null, '¡Terminó el juego!'), ranking(sala)); return; }
        if (j.fase === 'encuesta') {
          zonaEncuesta = h('div', { class: 'pila-s' });
          montar(el, h('div', { class: 'etiqueta' }, `Ronda ${j.ronda} · encuesta a todos`),
            h('p', { class: 'pregunta-host' }, j.pregunta), zonaEncuesta,
            h('button', { class: 'btn grande', onclick: armarTablero }, 'Cerrar la encuesta y armar el tablero'));
          pintarEncuesta();
          return;
        }
        const eq = sala.equipo(j.turno);
        const reloj = h('span', { class: 'reloj' });
        const conReloj = j.terminaEn && (enJuego(j) || (j.fase === 'duelo' && j.duelo?.primero));
        if (conReloj) {
          alLimpiar(cuentaRegresiva(reloj, j.terminaEn));
          const paso = j.paso;
          temporizador = setTimeout(() => { if (sala.juego.paso === paso) jugar({ error: true }); }, Math.max(0, j.terminaEn - Date.now()) + 200);
          alLimpiar(() => clearTimeout(temporizador));
        }
        const u = j.ultimo;
        const ultimo = u && !u.elige && h('p', { class: 'ultimo ' + (u.repetida ? '' : u.ok ? 'bien' : 'mal') },
          u.repetida ? `«${u.texto}» ya está en el tablero` : u.ok ? `✓ ${u.texto}` : `✗ ${u.texto || 'Error'}`);
        const lista = (botones) => h('ol', { class: 'tablero-host' }, privado.actual.map((r, i) => {
          const rev = j.reveladas[i];
          return h('li', { class: rev ? 'revelada' : '' },
            h('span', null, visible(r.texto), h('span', { class: 'mono muted' }, ` · ${r.puntos}`)),
            botones && !rev && h('button', { class: 'btn sec chico', onclick: () => jugar({ idx: i }) }, 'Acertó'));
        }));
        const etiqueta = h('div', { class: 'fila entre' },
          h('span', { class: 'etiqueta' }, `Ronda ${j.ronda}${j.total ? ' de ' + j.total : ''} · pozo ${j.pozo}`),
          h('button', { class: 'btn-link', onclick: alternarDoble }, j.mult > 1 ? '×2 activado (sacar)' : 'Hacer que valga doble'));
        if (j.fase === 'fin_ronda') {
          const ganador = sala.equipo(j.gano);
          const ultimaRonda = j.fuente === 'banco' && j.ronda >= privado.encuestas.length;
          const otra = h('input', { class: 'campo', id: 'otra-pregunta', maxlength: 120, placeholder: 'Siguiente pregunta para el grupo' });
          montar(el, h('p', { class: 'pregunta-host' }, j.pregunta), ultimo,
            h('p', { class: 'grande' }, ganador ? `${ganador.nombre} se lleva ${j.pozo * (j.mult || 1)} puntos${j.mult > 1 ? ' (doble)' : ''}` : 'Nadie suma en esta ronda'),
            tablero(j),
            !ultimaRonda && elegirProximo(j),
            j.fuente === 'banco'
              ? h('button', { class: 'btn grande', onclick: siguiente }, ultimaRonda ? 'Ver resultados' : 'Siguiente ronda →')
              : h('form', { class: 'pila', onsubmit: (e) => { e.preventDefault(); const t = otra.value.trim(); if (t) nuevaPreguntaCurso(t); } },
                otra, h('button', { class: 'btn', type: 'submit' }, 'Nueva pregunta a todos'),
                h('button', { class: 'btn-link', type: 'button', onclick: () => sala.actualizarJuego({ fase: 'fin' }) }, 'Terminar y ver resultados')));
          return;
        }
        if (j.fase === 'duelo') {
          const pulso = j.duelo.primero;
          const rep = pulso && j.duelo.reps[j.turno];
          montar(el, etiqueta, h('p', { class: 'pregunta-host' }, j.pregunta),
            h('div', { class: 'etiqueta' }, `Cara a cara${j.duelo.intento > 1 ? ` (intento ${j.duelo.intento})` : ''}`),
            frente(sala, j),
            pulso
              ? h('div', { class: 'fila entre' }, h('span', null, 'Responde ', h('b', null, rep?.nombre || 'alguien'), ' de ', pildoraEquipo(eq)), j.terminaEn ? reloj : null)
              : h('div', { class: 'pila-s' }, h('p', { class: 'muted' }, 'Esperando el pulsador de los celulares. Si alguno no anda, marcalo vos:'),
                h('div', { class: 'fila' }, j.par.map((e) => h('button', { class: 'btn sec', onclick: () => pulsar(e) }, `Pulsó ${sala.equipo(e)?.nombre}`)))),
            ultimo,
            lista(!!pulso),
            pulso && h('button', { class: 'btn peligro', onclick: () => jugar({ error: true }) }, '✗ No está en el tablero'),
            h('div', { class: 'fila' },
              h('button', { class: 'btn-link', onclick: cambiarDuelo }, 'Que pasen otros dos'),
              j.par.map((e) => h('button', { class: 'btn-link', onclick: () => darControl(e) }, `Saltear: gana ${sala.equipo(e)?.nombre}`))));
          return;
        }
        if (j.fase === 'elegir') {
          const otro = sala.equipo(rival(j, j.turno));
          montar(el, etiqueta, h('p', { class: 'pregunta-host' }, j.pregunta), ultimo,
            h('p', { class: 'grande' }, `${eq?.nombre} ganó el cara a cara. ¿Juegan o pasan?`),
            h('p', { class: 'muted' }, `Lo elige ${j.duelo?.reps?.[j.turno]?.nombre || 'el equipo'} desde el celular, o tocalo vos.`),
            h('div', { class: 'fila' },
              h('button', { class: 'btn', onclick: () => elegir(true) }, `Juega ${eq?.nombre}`),
              h('button', { class: 'btn sec', onclick: () => elegir(false) }, `Pasan: juega ${otro?.nombre}`)),
            lista(false));
          return;
        }
        montar(el, etiqueta,
          h('p', { class: 'pregunta-host' }, j.pregunta),
          h('div', { class: 'fila entre' },
            h('span', null, j.fase === 'robo' ? 'Roba ' : 'Juega ', pildoraEquipo(eq), j.responde ? [' · responde ', h('b', null, j.responde.nombre)] : null),
            h('span', { class: 'fila nowrap' }, errores(j.strikes), j.terminaEn ? reloj : null)),
          j.fase === 'robo' && h('p', { class: 'aviso' }, `${eq?.nombre} se pone de acuerdo y tiene una sola respuesta para robar el pozo.`),
          ultimo,
          lista(true),
          h('button', { class: 'btn peligro', onclick: () => jugar({ error: true }) }, j.fase === 'robo' ? '✗ No acertó el robo' : '✗ Respuesta incorrecta'));
      },
      refrescar(motivo) {
        if (sala.juego.fase === 'encuesta' && motivo === 'respuestas') pintarEncuesta();
        if (motivo === 'respuestas' || motivo === 'privado' || motivo === 'sala') procesarRespuestas();
      },
      destruir() { clearTimeout(temporizador); },
    });
    return v;
  },

  alumno(el, sala) {
    let enviado = -1;
    const miEncuesta = {};
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.ronda}:${sala.juego.paso}:${sala.juego.mult}:${sala.data.asignaciones?.[sala.uid]}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        const mio = sala.data.asignaciones?.[sala.uid];
        if (j.fase === 'fin') { montar(el, h('h2', null, '¡Terminó el juego!'), ranking(sala)); return; }
        if (j.fase === 'encuesta') {
          const input = h('input', { class: 'campo grande', id: 'encuesta-resp', maxlength: 40, autocomplete: 'off', placeholder: 'Tu respuesta' });
          const estado = h('p', { class: 'muted chico' }, miEncuesta[j.ronda] ? `Respondiste: «${miEncuesta[j.ronda]}». Podés cambiarla.` : 'Respondé lo primero que se te ocurra.');
          montar(el, h('div', { class: 'etiqueta' }, 'Encuesta'), h('p', { class: 'pregunta-alumno' }, j.pregunta),
            h('form', { class: 'pila', onsubmit: async (e) => {
              e.preventDefault();
              const valor = input.value.trim();
              if (!valor) return;
              miEncuesta[j.ronda] = valor; input.value = ''; vibrar(30);
              estado.textContent = `Respondiste: «${valor}». Podés cambiarla.`;
              try { await sala.responder({ ronda: j.ronda, valor }); } catch (err) { toast(err.message, 'error'); }
            } }, input, h('button', { class: 'btn grande', type: 'submit' }, 'Enviar')),
            estado);
          return;
        }
        const eq = sala.equipo(j.turno);
        const u = j.ultimo;
        if (u && u.eid === mio && !u.repetida && !u.elige) vibrar(u.ok ? 50 : [80, 60, 80]);
        const ultimo = u && !u.elige && h('p', { class: 'ultimo ' + (u.repetida ? '' : u.ok ? 'bien' : 'mal') },
          u.repetida ? `«${u.texto}» ya estaba` : u.ok ? `✓ ${u.texto}` : `✗ ${u.texto || 'Error'}`);
        const resumen = h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, `Pozo: ${j.pozo}`), doble(j), errores(j.strikes));
        const enviar = async (datos, deshabilitar) => {
          if (enviado === j.paso) return;
          enviado = j.paso;
          deshabilitar?.();
          vibrar(30);
          try { await sala.responder({ paso: j.paso, ...datos }); } catch (err) { enviado = -1; toast(err.message, 'error'); }
        };
        const formRespuesta = (titulo) => {
          const reloj = h('span', { class: 'reloj' });
          if (j.terminaEn) alLimpiar(cuentaRegresiva(reloj, j.terminaEn));
          const input = h('input', { class: 'campo grande', id: 'encuesta-juego', maxlength: 60, autocomplete: 'off', placeholder: 'Escribí una respuesta' });
          const bloqueado = enviado === j.paso;
          const form = h('form', { class: 'pila', onsubmit: (e) => {
            e.preventDefault();
            const valor = input.value.trim();
            if (valor) enviar({ accion: 'resp', valor }, () => form.querySelectorAll('button,input').forEach((x) => { x.disabled = true; }));
          } }, input, h('button', { class: 'btn grande', type: 'submit', disabled: bloqueado }, 'Responder'));
          if (!bloqueado) setTimeout(() => input.focus(), 50);
          return [h('div', { class: 'fila entre' }, h('h2', null, titulo), j.terminaEn ? reloj : null), h('p', { class: 'pregunta-alumno' }, j.pregunta), form];
        };
        if (j.fase === 'fin_ronda') {
          const g = sala.equipo(j.gano);
          montar(el, h('div', { class: 'resultado ' + (j.gano === mio ? 'bien' : '') },
            h('div', { class: 'resultado-titulo' }, g ? (j.gano === mio ? '¡Ganó tu equipo!' : `Ganó ${g.nombre}`) : 'Nadie suma'),
            g && h('p', null, `+${j.pozo * (j.mult || 1)} puntos`)), tablero(j));
          return;
        }
        if (j.fase === 'duelo') {
          const rep = j.duelo?.reps?.[mio];
          const soyRep = rep?.uid === sala.uid;
          const nombres = j.par.map((e) => sala.equipo(e)?.nombre).join(' vs ');
          if (!j.duelo.primero) {
            if (soyRep) {
              const boton = h('button', { class: 'pulsador', type: 'button', disabled: enviado === j.paso,
                onclick: () => enviar({ accion: 'pulsar' }, () => { boton.disabled = true; boton.textContent = '¡Pulsaste!'; }) },
              enviado === j.paso ? '¡Pulsaste!' : '¡PULSÁ!');
              montar(el, h('div', { class: 'etiqueta' }, 'Cara a cara · ¡pasaste al frente!'), h('p', { class: 'pregunta-alumno' }, j.pregunta),
                boton, h('p', { class: 'muted chico centro' }, 'El primero que pulsa responde. Si acertás la más dicha, tu equipo se queda con el tablero.'));
              return;
            }
            montar(el, esperando(`Cara a cara: ${nombres}`, j.par.includes(mio) ? `Pasa al frente ${rep?.nombre || 'alguien de tu equipo'}. ¡Que pulse rápido!` : j.pregunta), resumen, tablero(j));
            return;
          }
          if (soyRep && j.turno === mio) { montar(el, ultimo, ...formRespuesta('¡Respondé vos!'), resumen, tablero(j)); return; }
          montar(el, ultimo, esperando(`Responde ${j.duelo.reps[j.turno]?.nombre || 'alguien'} (${eq?.nombre})`, j.pregunta), resumen, tablero(j));
          return;
        }
        if (j.fase === 'elegir') {
          const rep = j.duelo?.reps?.[j.turno];
          if (rep?.uid === sala.uid) {
            const botones = h('div', { class: 'pila' },
              h('button', { class: 'btn grande', onclick: () => enviar({ accion: 'elegir', valor: 'jugar' }, () => botones.querySelectorAll('button').forEach((x) => { x.disabled = true; })) }, '¡Jugamos!'),
              h('button', { class: 'btn grande sec', onclick: () => enviar({ accion: 'elegir', valor: 'pasar' }, () => botones.querySelectorAll('button').forEach((x) => { x.disabled = true; })) }, 'Pasamos'));
            montar(el, h('h2', null, '¡Ganaste el cara a cara!'), h('p', null, '¿Tu equipo juega este tablero o se lo pasa al otro?'), botones, tablero(j));
            return;
          }
          montar(el, ultimo, esperando(`${eq?.nombre} ganó el cara a cara`, `${rep?.nombre || 'Su capitán'} decide si juegan o pasan.`), tablero(j));
          return;
        }
        if (j.turno !== mio) {
          montar(el, ultimo, esperando(j.fase === 'robo' ? `${eq?.nombre} intenta robar el pozo` : `Juega ${eq?.nombre}`, j.pregunta), resumen, tablero(j));
          return;
        }
        if (j.fase === 'jugando' && j.responde && j.responde.uid !== sala.uid) {
          montar(el, ultimo, esperando(`Le toca responder a ${j.responde.nombre}`, '¡Ayudalo! Digan respuestas en voz alta.'), resumen, tablero(j));
          return;
        }
        montar(el, ultimo,
          ...formRespuesta(j.fase === 'robo' ? '¡Pueden robar el pozo!' : '¡Te toca responder!'),
          j.fase === 'robo' && h('p', { class: 'aviso' }, 'Pónganse de acuerdo: vale la primera respuesta que mande alguien del equipo.'),
          resumen, tablero(j));
      },
    });
  },

  tv(el, sala) {
    let contador = null;
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.ronda}:${sala.juego.paso}:${sala.juego.mult}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        contador = null;
        if (j.fase === 'fin') {
          sonido('fin');
          montar(el, h('div', { class: 'tv-centro' }, h('h1', { class: 'tv-titulo' }, '¡Terminó el juego!'), ranking(sala)));
          return;
        }
        const cabecera = h('div', { class: 'tv-cabecera' },
          h('span', { class: 'tv-etiqueta' }, `Los invitados dicen · Ronda ${j.ronda}${j.total ? ' de ' + j.total : ''}${j.fase === 'encuesta' ? ' · Encuesta' : ''}`),
          doble(j));
        if (j.fase === 'encuesta') {
          contador = h('div', { class: 'tv-contador enorme' }, '0');
          montar(el, cabecera,
            h('div', { class: 'tv-pregunta' }, j.pregunta),
            h('div', { class: 'tv-centro' }, contador, h('p', { class: 'tv-sub' }, 'respuestas'),
              h('p', { class: 'tv-sub muted' }, 'Respondé desde tu celular. Después hay que adivinar lo que más dijo el grupo.')));
          return;
        }
        const eq = sala.equipo(j.turno);
        const u = j.ultimo;
        const reloj = h('div', { class: 'tv-reloj' });
        const conReloj = j.terminaEn && (enJuego(j) || (j.fase === 'duelo' && j.duelo?.primero));
        if (conReloj) alLimpiar(cuentaRegresiva(reloj, j.terminaEn, { cadaSegundo: (f) => reloj.classList.toggle('urgente', f < 5500) }));
        let estado;
        if (j.fase === 'duelo') {
          const rep = j.duelo.primero && j.duelo.reps[j.turno];
          estado = h('div', { class: 'pila-s centro' }, h('div', { class: 'tv-etiqueta' }, 'Cara a cara'),
            h('div', { class: 'tv-sub centro' }, rep ? `Responde ${rep.nombre}` : '¡Al pulsador!'), conReloj ? reloj : null);
        } else if (j.fase === 'elegir') {
          estado = h('div', { class: 'pila-s centro' }, h('div', { class: 'tv-etiqueta' }, 'Ganó el cara a cara'), pildoraEquipo(eq),
            h('div', { class: 'tv-sub centro' }, '¿Juegan o pasan?'));
        } else if (j.fase === 'fin_ronda') {
          estado = h('div', { class: 'pila-s centro' }, h('div', { class: 'tv-etiqueta' }, j.gano ? 'Se lo lleva' : 'Nadie suma'), j.gano && pildoraEquipo(sala.equipo(j.gano)),
            j.gano && j.mult > 1 && h('div', { class: 'tv-sub centro' }, `${j.pozo} × 2 = ${j.pozo * 2}`));
        } else {
          estado = h('div', { class: 'pila-s centro' }, h('div', { class: 'tv-etiqueta' }, j.fase === 'robo' ? '¡Roba!' : 'Juega'), pildoraEquipo(eq),
            j.responde && h('div', { class: 'tv-sub centro' }, `Responde ${j.responde.nombre}`),
            j.fase === 'robo' && h('div', { class: 'tv-sub centro' }, 'Una sola respuesta'),
            conReloj ? reloj : null);
        }
        const escena = h('div', { class: 'tv-encuesta' },
          tablero(j, { tv: true }),
          h('div', { class: 'tv-encuesta-lado' },
            h('div', { class: 'tv-etiqueta' }, 'Pozo'),
            h('div', { class: 'tv-pozo' }, j.pozo),
            j.fase !== 'duelo' && j.fase !== 'elegir' && errores(j.strikes),
            estado));
        const mostrarUltimo = u && !u.elige;
        montar(el, cabecera,
          h('div', { class: 'tv-pregunta' }, j.pregunta),
          (j.fase === 'duelo' || j.fase === 'elegir') && frente(sala, j, { tv: true }),
          escena,
          mostrarUltimo && !u.repetida && h('div', { class: 'tv-ultimo ' + (u.ok ? 'bien' : 'mal') }, u.ok ? `✓ ${u.texto}` : `✗ ${u.texto || 'No está en el tablero'}`),
          mostrarUltimo && u.repetida && h('div', { class: 'tv-ultimo' }, `«${u.texto}» ya está en el tablero`));
        if (mostrarUltimo && u.ok === false) {
          const n = j.fase === 'jugando' || j.fase === 'robo' || j.fase === 'fin_ronda' ? Math.max(1, Math.min(STRIKES, j.strikes)) : 1;
          const x = h('div', { class: 'tv-strike' }, '✗'.repeat(n));
          el.append(x);
          const t = setTimeout(() => x.remove(), 1300);
          alLimpiar(() => { clearTimeout(t); x.remove(); });
        }
      },
      refrescar() {
        if (!contador) return;
        contador.textContent = sala.respuestasJuego(sala.juego.ronda).size;
      },
    });
  },
};
