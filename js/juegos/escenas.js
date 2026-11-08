// ¿Te acordás de la escena?: con video (cargado desde el panel), la tele pasa la escena una sola vez y
// después aparece la pregunta. Por defecto nadie escribe: cada equipo dice en voz alta lo que se
// acuerda y quien organiza toca cada cosa que dijeron bien (1 punto cada una). Opcionalmente, Sin video, la tele presenta una escena clásica (por ejemplo, Cleto
// llamando a todos sus hijos) y cada equipo escribe desde los celulares todo lo que se acuerde.
// Lo que escriben los integrantes de un equipo se junta en una sola lista. Quien organiza revisa,
// puede aceptar o sacar respuestas a mano y revela: la tele muestra la lista completa y quién
// se acordó de cada cosa. Gana más quien más recordó.
import { h, montar, vista, selector, esperando, pildoraEquipo, ranking } from './comun.js';
import { ESCENAS } from '../escenas.js';
import { normalizar, distancia, cuentaRegresiva, toast, sonido, vibrar, confeti, guardarLocal, leerLocal } from '../util.js';

const PUNTOS_PUESTO = [100, 60, 40, 20];
const PUNTOS_ACIERTO = 1;  // la fiesta usa puntos chicos: 1 por cada cosa que se acuerden
const CLAVE_PROPIAS = 'escenas-propias'; // escenas con video que carga quien organiza (en este dispositivo)

// Video de una escena: un link de YouTube (watch, youtu.be o shorts, con ?t= para empezar) o un
// archivo .mp4. Devuelve { tipo: 'youtube', src } o { tipo: 'archivo', src } o null.
export function fuenteVideo(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  const m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (m) {
    const t = u.match(/[?&](?:t|start)=(\d+)/);
    const fin = u.match(/[?&]end=(\d+)/);
    const q = new URLSearchParams({ autoplay: '1', controls: '0', rel: '0', modestbranding: '1', playsinline: '1' });
    if (t) q.set('start', t[1]);
    if (fin) q.set('end', fin[1]);
    return { tipo: 'youtube', src: `https://www.youtube-nocookie.com/embed/${m[1]}?${q}` };
  }
  return { tipo: 'archivo', src: u };
}

// Escenas propias guardadas en este dispositivo: { id, titulo, video, consigna, items: [['resp', 'alias'…]] }.
export const escenasPropias = () => { const l = leerLocal(CLAVE_PROPIAS, []); return Array.isArray(l) ? l : []; };
const MAX_LARGO = 40;      // largo máximo de cada respuesta
const TROZO = 200;         // las reglas de Firebase aceptan «valor» de hasta 200 caracteres…
const MAX_TROZOS = 4;      // …y «palabras» con hasta 3 textos más: hasta 800 caracteres por celular

// ── Comparación de respuestas ──
const SOBRA = /^(el|la|los|las|un|una|lo|sr|sra|senor|señora|señor|don|dona) /;
const COMUNES = new Set(['simpson', 'director', 'jefe', 'actor', 'secundario', 'senor', 'señor', 'bouvier']);
const limpio = (s) => normalizar(s).replace(SOBRA, '').replace(/ /g, '');
const tolerancia = (n) => (n >= 9 ? 2 : n >= 5 ? 1 : 0);

// Para cada ítem: sus formas aceptadas y las palabras sueltas que lo identifican sin dudas
// («Patiño» → Bob Patiño), siempre que esa palabra no aparezca en otro ítem de la escena.
export function prepararItems(items) {
  const formas = items.map((it) => [...new Set(it.map(limpio).filter(Boolean))]);
  const palabras = items.map((it) => new Set(it.flatMap((a) => normalizar(a).split(' '))
    .filter((p) => p.length >= 4 && !COMUNES.has(p))));
  const cuenta = new Map();
  palabras.forEach((s) => s.forEach((p) => cuenta.set(p, (cuenta.get(p) || 0) + 1)));
  return items.map((it, i) => ({ texto: it[0], formas: formas[i], sueltas: [...palabras[i]].filter((p) => cuenta.get(p) === 1) }));
}

// Índice del ítem que corresponde a lo escrito, o -1.
export function reconocer(escrito, preparados) {
  const r = limpio(escrito);
  if (!r) return -1;
  let mejor = -1, dMejor = Infinity;
  preparados.forEach((it, i) => {
    for (const f of [...it.formas, ...it.sueltas]) {
      const d = r === f ? 0 : distancia(r, f);
      if (d <= tolerancia(f.length) && d < dMejor) { mejor = i; dMejor = d; }
    }
  });
  if (mejor >= 0) return mejor;
  // Si no, alguna palabra de lo escrito que identifique a un solo ítem («tony gordo» → Gordo Tony).
  const palabras = normalizar(escrito).split(' ').filter((p) => p.length >= 4 && !COMUNES.has(p));
  preparados.forEach((it, i) => {
    for (const p of palabras) for (const f of it.sueltas) {
      const d = distancia(p, f);
      if (d <= tolerancia(f.length) && d < dMejor) { mejor = i; dMejor = d; }
    }
  });
  return mejor;
}

// Lo que escribió un celular: «valor» y «palabras» juntan la lista separada por saltos de línea.
const listaDe = (r) => [r.valor, ...(r.palabras || [])].filter((x) => typeof x === 'string').join('').split('\n').map((s) => s.trim()).filter(Boolean);

// Respuestas de cada equipo en la escena n: { e1: ['Tiffany', 'Cody', …] } sin repetidas.
function listasPorEquipo(sala, n) {
  const out = {};
  for (const r of sala.respuestasJuego(n).values()) {
    if (!r.equipo) continue;
    const vistas = (out[r.equipo] ||= new Map());
    for (const t of listaDe(r)) if (!vistas.has(normalizar(t))) vistas.set(normalizar(t), t);
  }
  return Object.fromEntries(Object.entries(out).map(([e, m]) => [e, [...m.values()]]));
}

// Aciertos de un equipo: los reconocidos más lo que quien organiza aceptó o sacó a mano.
function evaluar(preparados, lista, manual = {}) {
  const ok = new Set();
  const sueltas = [];
  for (const t of lista) {
    const i = reconocer(t, preparados);
    if (i >= 0) ok.add(i); else sueltas.push(t);
  }
  for (const [i, v] of Object.entries(manual)) { if (v) ok.add(Number(i)); else ok.delete(Number(i)); }
  return { ok: [...ok].sort((a, b) => a - b), sueltas };
}

function repartirPuntos(cuentas, modo) {
  if (modo === 'acierto') return Object.fromEntries(Object.entries(cuentas).map(([e, n]) => [e, n * PUNTOS_ACIERTO]));
  const orden = Object.entries(cuentas).sort((a, b) => b[1] - a[1]);
  const pts = {};
  orden.forEach(([e, n]) => {
    const pos = orden.findIndex(([, m]) => m === n); // empatados comparten el mejor puesto
    pts[e] = n > 0 ? (PUNTOS_PUESTO[pos] ?? 0) : 0;
  });
  return pts;
}

export default {
  id: 'escenas',
  nombre: '¿Te acordás de la escena?',
  icono: '📼',
  resumen: 'Una escena clásica en la tele: cada equipo escribe todo lo que se acuerde (los hijos de Cleto, los octillizos de Apu…).',
  tipos: [],

  configurar() {
    // Lista de escenas (las propias con video primero). Se rearma al guardar o borrar una propia.
    let todas = [], marcas = [];
    const elegidas = new Set([...escenasPropias().map((e) => e.id), ...ESCENAS.filter((e) => e.fija).map((e) => e.id)]);
    const zonaLista = h('div', { class: 'pila-s' });
    const pintarLista = () => {
      const propias = escenasPropias();
      todas = [...propias, ...ESCENAS];
      marcas = todas.map((e) => h('input', { type: 'checkbox', value: e.id, checked: elegidas.has(e.id),
        onchange: (ev) => { if (ev.target.checked) elegidas.add(e.id); else elegidas.delete(e.id); } }));
      montar(zonaLista, todas.map((e, i) => h('label', { class: 'fila nowrap escena-opcion' }, marcas[i],
        h('span', null, e.video ? '🎬 ' : '', h('b', null, e.titulo), h('span', { class: 'muted chico' }, ` · ${e.items.length} para recordar`)),
        propias.includes(e) && h('button', { class: 'btn-link peligro chico', type: 'button', onclick: (ev) => { ev.preventDefault(); borrarPropia(e.id); } }, 'Borrar'))));
    };
    const responden = selector('cfg-responden', 'Cómo responden', [['voz', 'En voz alta: vos marcás lo que se acuerdan'], ['celular', 'Escriben desde los celulares']], 'voz');
    const seg = selector('cfg-seg', 'Tiempo para escribir (con celulares)', [[60, '1 minuto'], [90, '1 minuto y medio'], [120, '2 minutos'], [180, '3 minutos']], 60);
    const modo = selector('cfg-puntos', 'Puntos', [['acierto', `${PUNTOS_ACIERTO} punto por cada cosa que se acuerden`], ['puesto', 'Por puesto: 100, 60, 40 y 20']], 'acierto');
    // Formulario para cargar una escena con video.
    const fTitulo = h('input', { class: 'campo', id: 'esc-titulo', maxlength: 60, placeholder: 'Título (ej.: Homero en la feria)' });
    const fVideo = h('input', { class: 'campo', id: 'esc-video', placeholder: 'Link de YouTube (con ?t= para que arranque ahí) o de un .mp4' });
    const fPregunta = h('input', { class: 'campo', id: 'esc-pregunta', maxlength: 200, placeholder: 'Pregunta (ej.: ¿Qué cosas comió Homero?)' });
    const fRespuestas = h('textarea', { class: 'campo', id: 'esc-respuestas', rows: 3, placeholder: 'Respuestas correctas, una por línea. Otras formas de escribirla, separadas con /  (ej.: dona / rosquilla)' });
    const guardarPropia = () => {
      const titulo = fTitulo.value.trim(), video = fVideo.value.trim(), consigna = fPregunta.value.trim();
      const items = fRespuestas.value.split('\n').map((l) => l.split('/').map((x) => x.trim()).filter(Boolean)).filter((x) => x.length);
      if (!video || !fuenteVideo(video)) { toast('Pegá el link del video', 'error'); fVideo.focus(); return; }
      if (!consigna) { toast('Escribí la pregunta', 'error'); fPregunta.focus(); return; }
      if (!items.length) { toast('Escribí al menos una respuesta correcta', 'error'); fRespuestas.focus(); return; }
      const lista = [...escenasPropias(), { id: 'propia-' + Date.now().toString(36), titulo: titulo || consigna.slice(0, 40), video, consigna, items }];
      guardarLocal(CLAVE_PROPIAS, lista);
      elegidas.add(lista[lista.length - 1].id);
      pintarLista();
      toast('Escena guardada y marcada para jugar', 'ok');
      fTitulo.value = fVideo.value = fPregunta.value = fRespuestas.value = '';
    };
    const borrarPropia = (id) => { guardarLocal(CLAVE_PROPIAS, escenasPropias().filter((e) => e.id !== id)); elegidas.delete(id); pintarLista(); toast('Escena borrada'); };
    pintarLista();
    const cargar = h('details', { class: 'pila-s' }, h('summary', null, '🎬 Cargar una escena con video'),
      h('div', { class: 'pila-s' }, fTitulo, fVideo, fPregunta, fRespuestas,
        h('p', { class: 'muted chico' }, 'El video pasa una sola vez en la tele; después aparece la pregunta y cada equipo escribe lo que se acuerde. Se guarda en este dispositivo.'),
        h('button', { class: 'btn sec', type: 'button', onclick: guardarPropia }, 'Guardar escena')));
    return {
      el: h('div', { class: 'pila' },
        h('div', { class: 'pila-s' }, h('span', { class: 'etq' }, 'Escenas (en este orden)'),
          zonaLista),
        cargar,
        responden.el,
        h('div', { class: 'grilla-2' }, seg.el, modo.el),
        h('p', { class: 'muted chico' }, 'En voz alta: cada equipo dice lo que se acuerda y vos tocás cada cosa que dijeron bien. Con celulares, cada integrante escribe y todo se suma a la lista del equipo; antes de revelar podés aceptar o sacar respuestas a mano.')),
      leer: () => {
        // Primero las propias (con video), después las clásicas, en el orden de la lista.
        const ids = marcas.filter((m) => m.checked).map((m) => m.value);
        if (!ids.length) { toast('Elegí al menos una escena', 'error'); return null; }
        return { escenas: todas.filter((e) => ids.includes(e.id)), seg: Number(seg.valor()), modo: modo.valor(), voz: responden.valor() === 'voz' };
      },
    };
  },

  async iniciar(sala, { escenas, seg, modo, voz = false }) {
    const juego = await sala.iniciarJuego({
      tipo: 'escenas', fase: 'presentar', n: 0, total: escenas.length, seg, modo, voz,
      titulo: escenas[0].titulo, consigna: escenas[0].consigna, cantidad: escenas[0].items.length, minimo: escenas[0].minimo || 0, hasta: 0,
      video: escenas[0].video || null, visto: false,
    });
    await sala.guardarPrivado({ juego, escenas: escenas.map((e) => ({ titulo: e.titulo, consigna: e.consigna, video: e.video || null, minimo: e.minimo || 0, items: e.items.map((it) => ({ a: it })) })), manual: {} });
  },

  host(el, sala) {
    let privado = null;
    let fin = null;
    let ocupado = false;
    let zonaEquipos = null;
    let firma = '';
    sala.privadoDelJuego().then((p) => { privado = p; v.actualizar(); });

    const escena = () => privado.escenas[sala.juego.n];
    const preparados = () => prepararItems(escena().items.map((it) => it.a));
    const manualDe = (eid) => privado.manual?.[sala.juego.n]?.[eid] || {};

    function resultados() {
      const listas = listasPorEquipo(sala, sala.juego.n);
      const prep = preparados();
      return Object.fromEntries(sala.equipos().map((e) => [e.id, { lista: listas[e.id] || [], ...evaluar(prep, listas[e.id] || [], manualDe(e.id)) }]));
    }

    async function accion(f) {
      if (ocupado) return;
      ocupado = true;
      try { await f(); } catch (e) { toast(e.message, 'error'); }
      ocupado = false;
    }

    const pasarVideo = () => accion(() => sala.actualizarJuego({ fase: 'video', t: Date.now() }));
    const terminoVideo = () => accion(() => sala.actualizarJuego({ fase: 'presentar', visto: true }));
    const empezar = () => accion(() => sala.actualizarJuego(sala.juego.voz ? { fase: 'revisar', hasta: 0 } : { fase: 'escribiendo', hasta: Date.now() + sala.juego.seg * 1000 }));
    const cortar = () => accion(async () => { if (sala.juego.fase === 'escribiendo') await sala.actualizarJuego({ fase: 'revisar', hasta: 0 }); });

    async function marcarMano(eid, i, valor) {
      const n = sala.juego.n;
      privado.manual ||= {};
      privado.manual[n] ||= {};
      privado.manual[n][eid] = { ...(privado.manual[n][eid] || {}), [i]: valor };
      firma = '';
      dibujarEquipos();
      try { await sala.guardarPrivado(privado); } catch (e) { toast(e.message, 'error'); }
    }

    const revelar = () => accion(async () => {
      const j = sala.juego;
      if (j.fase !== 'revisar') return;
      const res = resultados();
      // Con «mínimo» (ej.: nombrar 6 de 9), la escena vale 1 acierto si llegan, y nada si no.
      const minimo = escena().minimo || 0;
      const cuentas = Object.fromEntries(Object.entries(res).map(([e, r]) => [e, minimo ? (r.ok.length >= minimo ? 1 : 0) : r.ok.length]));
      const pts = repartirPuntos(cuentas, j.modo);
      const porEquipo = Object.fromEntries(Object.entries(res).map(([e, r]) => [e, { ok: r.ok, pts: pts[e] || 0 }]));
      await sala.actualizarJuego({ fase: 'revelada', items: escena().items.map((it) => it.a[0]), porEquipo }, pts);
    });

    const siguiente = () => accion(async () => {
      const j = sala.juego;
      const n = j.n + 1;
      if (n >= j.total) { await sala.actualizarJuego({ fase: 'fin' }); return; }
      const e = privado.escenas[n];
      await sala.actualizarJuego({ fase: 'presentar', n, titulo: e.titulo, consigna: e.consigna, cantidad: e.items.length, minimo: e.minimo || 0, hasta: 0, items: undefined, porEquipo: undefined, video: e.video || null, visto: false });
    });

    // Tarjeta por equipo: cuántas lleva y, al revisar, cada ítem para prender o apagar a mano.
    function dibujarEquipos() {
      if (!zonaEquipos || !privado) return;
      const j = sala.juego;
      const res = resultados();
      const k = JSON.stringify(res) + j.fase;
      if (k === firma) return;
      firma = k;
      const items = escena().items.map((it) => it.a[0]);
      montar(zonaEquipos, sala.equipos().map((e) => {
        const r = res[e.id];
        const ok = new Set(r.ok);
        return h('div', { class: 'tarjeta pila-s escena-equipo', style: { '--c': e.color } },
          h('div', { class: 'fila entre' }, pildoraEquipo(e), h('b', null, `${r.ok.length} de ${items.length}`, j.minimo ? (r.ok.length >= j.minimo ? ' ✓' : ` (necesitan ${j.minimo})`) : ''),
            !j.voz && h('span', { class: 'muted chico' }, `${r.lista.length} escritas`)),
          j.fase === 'revisar' && h('div', { class: 'fila escena-chips' }, items.map((t, i) =>
            h('button', { class: 'chip' + (ok.has(i) ? ' escena-ok' : ''), title: ok.has(i) ? 'Tocá para sacarla' : 'Tocá para aceptarla',
              onclick: () => marcarMano(e.id, i, !ok.has(i)) }, (ok.has(i) ? '✓ ' : '') + t))),
          r.sueltas.length > 0 && h('p', { class: 'muted chico' }, 'Sin reconocer: ', h('span', { class: 'escena-sueltas' }, r.sueltas.join(' · '))));
      }));
    }

    const v = vista({
      destruir: () => fin?.(),
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${!!sala.juego.visto}:${!!privado}`,
      dibujar() {
        const j = sala.juego;
        fin?.(); fin = null; zonaEquipos = null; firma = '';
        if (!privado) { montar(el, esperando('Preparando…')); return; }
        if (j.fase === 'fin') { montar(el, h('p', { class: 'grande' }, '¡Terminaron las escenas!'), ranking(sala)); return; }
        const e = escena();
        const cabecera = h('div', { class: 'pila-s' },
          h('span', { class: 'etiqueta' }, `Escena ${j.n + 1} de ${j.total}`),
          h('b', { class: 'grande' }, e.titulo),
          h('span', { class: 'muted' }, e.consigna));
        const respuestas = h('details', { class: 'mini-palabra' }, h('summary', null, `Ver la lista completa (${e.items.length})`),
          h('p', { class: 'chico' }, e.items.map((it) => it.a[0]).join(' · ')));
        zonaEquipos = h('div', { class: 'pila-s' });
        if (j.fase === 'video') {
          montar(el, cabecera, respuestas,
            h('p', { class: 'muted' }, '🎬 El video está pasando en la tele (una sola vez).'),
            h('button', { class: 'btn grande', onclick: terminoVideo }, 'Terminó el video: mostrar la pregunta'));
          return;
        }
        if (j.fase === 'presentar' && j.video && !j.visto) {
          montar(el, cabecera, respuestas,
            h('p', { class: 'muted chico' }, 'Avisá que la escena pasa una sola vez. La pregunta aparece después del video.'),
            h('button', { class: 'btn grande', onclick: pasarVideo }, '▶ Pasar el video en la tele'),
            h('button', { class: 'btn-link', onclick: terminoVideo }, 'Saltear el video'));
          return;
        }
        if (j.fase === 'presentar') {
          montar(el, cabecera, respuestas,
            h('p', { class: 'muted chico' }, j.voz
              ? 'La tele muestra la pregunta. Leéla en voz alta, dales un ratito para pensar y después escuchá a cada equipo.'
              : 'La tele muestra la escena. Leé la consigna en voz alta y largá el tiempo.'),
            h('button', { class: 'btn grande', onclick: empezar }, j.voz ? '🗣️ ¡Que respondan!' : `✍️ ¡A escribir! (${j.seg} s)`));
          return;
        }
        if (j.fase === 'escribiendo') {
          const reloj = h('span', { class: 'reloj grande' });
          montar(el, h('div', { class: 'fila entre' }, cabecera, reloj), zonaEquipos,
            h('button', { class: 'btn sec', onclick: cortar }, 'Cortar el tiempo ya'));
          fin = cuentaRegresiva(reloj, j.hasta, { alTerminar: cortar });
          dibujarEquipos();
          return;
        }
        if (j.fase === 'revisar') {
          montar(el, cabecera,
            h('p', { class: 'chico' }, j.voz
              ? 'Cada equipo dice en voz alta lo que se acuerda. Tocá cada cosa que digan bien (queda en verde, 1 punto). Se puede sacar tocando de nuevo.'
              : 'Revisá: en verde lo que cuenta. Tocá un nombre para aceptarlo o sacarlo (por ejemplo, si lo escribieron muy distinto).'),
            zonaEquipos,
            h('button', { class: 'btn grande', onclick: revelar }, '📺 Revelar en la tele'));
          dibujarEquipos();
          return;
        }
        // revelada
        montar(el, cabecera,
          h('div', { class: 'fila' }, sala.equipos().map((eq) => pildoraEquipo(eq, ` ${j.porEquipo?.[eq.id]?.ok.length ?? 0} · +${j.porEquipo?.[eq.id]?.pts ?? 0}`))),
          h('button', { class: 'btn grande', onclick: siguiente }, j.n + 1 >= j.total ? 'Ver resultados' : 'Siguiente escena →'));
      },
      refrescar(motivo) {
        if (motivo === 'respuestas' || motivo === 'jugadores' || motivo === undefined) dibujarEquipos();
      },
    });
    return v;
  },

  alumno(el, sala) {
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${!!sala.juego.visto}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        const mio = sala.data.asignaciones?.[sala.uid];
        const eq = sala.equipo(mio);
        if (j.fase === 'fin') { montar(el, h('h2', null, '¡Terminaron las escenas!'), ranking(sala)); return; }
        if (!mio) { montar(el, esperando('Todavía no tenés equipo', 'Pedile a quien organiza que te sume a uno.')); return; }
        if (j.fase === 'video' || (j.fase === 'presentar' && j.video && !j.visto)) {
          montar(el, esperando('📺 ¡Miren la tele!', 'La escena pasa una sola vez. Presten atención a todo.'));
          return;
        }
        if (j.voz && (j.fase === 'presentar' || j.fase === 'revisar')) {
          montar(el, esperando('📺 ¡Miren la tele!', 'Nada de celular: junten en equipo todo lo que se acuerden y díganlo en voz alta.'));
          return;
        }
        if (j.fase === 'presentar') {
          montar(el, h('div', { class: 'pila-s' }, h('span', { class: 'etiqueta' }, `Escena ${j.n + 1} de ${j.total}`), h('h2', null, j.titulo)),
            esperando('¡Miren la tele!', 'En un ratito tu equipo escribe todo lo que se acuerde.'));
          return;
        }
        if (j.fase === 'revisar') { montar(el, h('h2', null, j.titulo), esperando('Contando…', 'Quien organiza está revisando las listas.')); return; }
        if (j.fase === 'revelada') {
          const r = j.porEquipo?.[mio];
          const nombres = (r?.ok || []).map((i) => j.items[i]);
          montar(el, h('div', { class: 'resultado' + (r?.ok.length ? ' bien' : '') },
            h('div', { class: 'resultado-titulo' }, `${r?.ok.length ?? 0} de ${j.items.length}`),
            h('p', null, `${eq?.nombre} se acordó de ${nombres.length ? nombres.join(', ') : 'nada 😅'}.`),
            h('p', null, h('b', null, `+${r?.pts ?? 0} puntos`))),
          esperando('Miren la tele'));
          return;
        }
        // escribiendo: cada uno arma su lista; se guarda en el celular por si se recarga la página.
        const clave = `escenas:${j.id}:${j.n}`;
        let lista = leerLocal(clave, []);
        let enviando = null, pendiente = false;
        const total = () => lista.join('\n').length;
        const enviar = async () => {
          if (enviando) { pendiente = true; return; }
          const texto = lista.join('\n');
          const trozos = Array.from({ length: Math.ceil(texto.length / TROZO) }, (_, i) => texto.slice(i * TROZO, (i + 1) * TROZO));
          enviando = sala.responder({ ronda: j.n, valor: trozos[0] || '', palabras: trozos.slice(1) })
            .catch((e) => toast('No se pudo mandar: ' + e.message, 'error'));
          await enviando;
          enviando = null;
          if (pendiente) { pendiente = false; enviar(); }
        };
        const campo = h('input', { class: 'campo', id: 'escena-respuesta', maxlength: MAX_LARGO, placeholder: 'Escribí un nombre y Enter', autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'send' });
        const zonaLista = h('div', { class: 'fila escena-chips' });
        const reloj = h('span', { class: 'reloj' });
        const dibujarLista = () => {
          montar(zonaLista, lista.length
            ? [...lista].reverse().map((t) => h('span', { class: 'chip-palabra' }, t,
              h('button', { class: 'btn-link', title: 'Borrar', onclick: () => { lista = lista.filter((x) => x !== t); cambiar(); } }, '✕')))
            : h('span', { class: 'muted chico' }, 'Todavía no escribiste nada.'));
        };
        const cambiar = () => { guardarLocal(clave, lista); dibujarLista(); enviar(); };
        const agregar = (ev) => {
          ev.preventDefault();
          const t = campo.value.trim().slice(0, MAX_LARGO);
          campo.value = '';
          campo.focus();
          if (!t) return;
          if (lista.some((x) => normalizar(x) === normalizar(t))) { toast('Ya la escribiste'); return; }
          if (total() + t.length + 1 > TROZO * MAX_TROZOS) { toast('Tu lista está llena: que siga otro de tu equipo', 'error'); return; }
          lista = [...lista, t];
          vibrar(30);
          cambiar();
        };
        montar(el,
          h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, eq?.nombre || ''), reloj),
          h('h2', null, j.titulo),
          h('p', { class: 'muted' }, j.consigna),
          h('form', { class: 'fila nowrap', onsubmit: agregar }, campo, h('button', { class: 'btn', type: 'submit' }, 'Agregar')),
          h('p', { class: 'muted chico' }, 'Lo que escriban entre todos se suma a la lista del equipo. Repetidas no suman de más: repártanse.'),
          zonaLista);
        dibujarLista();
        if (lista.length) enviar();
        alLimpiar(cuentaRegresiva(reloj, j.hasta, { alTerminar: () => { campo.disabled = true; } }));
        setTimeout(() => campo.focus(), 50);
      },
    });
  },

  tv(el, sala) {
    let zonaConteo = null;
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${!!sala.juego.visto}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        zonaConteo = null;
        if (j.fase === 'fin') {
          sonido('fin'); confeti();
          montar(el, h('div', { class: 'tv-centro' }, h('div', { class: 'tv-icono' }, '📼'), h('h1', { class: 'tv-titulo' }, '¡Terminaron las escenas!'), ranking(sala)));
          return;
        }
        const cabecera = [h('div', { class: 'tv-etiqueta' }, `📼 ¿Te acordás de la escena? · ${j.n + 1} de ${j.total}`),
          h('h1', { class: 'tv-titulo' }, j.titulo)];
        if (j.fase === 'video') {
          const f = fuenteVideo(j.video);
          const reproductor = f?.tipo === 'youtube'
            ? h('iframe', { class: 'tv-video', src: f.src, allow: 'autoplay; encrypted-media; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' })
            : h('video', { class: 'tv-video', src: f?.src || '', autoplay: true, playsinline: true });
          if (reproductor.tagName === 'VIDEO') {
            reproductor.addEventListener('ended', () => reproductor.classList.add('terminado'));
            reproductor.play?.().catch(() => { reproductor.muted = true; reproductor.play().catch(() => {}); });
          }
          montar(el, h('div', { class: 'tv-video-marco' }, reproductor));
          return;
        }
        if (j.fase === 'presentar' && j.video && !j.visto) {
          montar(el, h('div', { class: 'tv-centro' }, ...cabecera,
            h('div', { class: 'tv-icono' }, '🎬'),
            h('p', { class: 'tv-pregunta' }, 'Presten atención: la escena pasa una sola vez.'),
            h('p', { class: 'tv-sub' }, 'Después viene la pregunta. Cuanto más se acuerden, más puntos para el equipo.')));
          return;
        }
        if (j.fase === 'presentar') {
          montar(el, h('div', { class: 'tv-centro' }, ...cabecera,
            h('p', { class: 'tv-pregunta' }, j.consigna),
            h('p', { class: 'tv-sub' }, j.minimo ? `Son ${j.cantidad}: si nombran ${j.minimo}, la respuesta es correcta.` : j.voz ? (j.cantidad > 1 ? `Son ${j.cantidad}. Junten en equipo todo lo que se acuerden: lo dicen en voz alta.` : 'Piénsenlo en equipo y díganlo en voz alta.') : j.cantidad > 1 ? `Son ${j.cantidad}. Cada equipo escribe desde los celulares todo lo que se acuerde. ¡Repártanse!` : 'Cada equipo escribe la respuesta desde los celulares.')));
          return;
        }
        if (j.voz && j.fase === 'revisar') {
          montar(el, h('div', { class: 'tv-centro' }, ...cabecera,
            h('p', { class: 'tv-pregunta' }, j.consigna),
            h('p', { class: 'tv-sub' }, j.minimo ? `🗣️ Cada equipo dice lo que se acuerda: con ${j.minimo} de ${j.cantidad}, la respuesta es correcta.` : `🗣️ Cada equipo dice lo que se acuerda${j.cantidad > 1 ? ` (son ${j.cantidad})` : ''}. ¡1 punto por cada una!`)));
          return;
        }
        if (j.fase === 'escribiendo' || j.fase === 'revisar') {
          const reloj = h('div', { class: 'tv-reloj enorme' });
          zonaConteo = h('div', { class: 'tv-equipos' });
          montar(el, h('div', { class: 'tv-centro' }, ...cabecera,
            h('p', { class: 'tv-sub' }, j.consigna),
            j.fase === 'escribiendo' ? reloj : h('p', { class: 'tv-pregunta' }, 'Contando…')), zonaConteo);
          if (j.fase === 'escribiendo') alLimpiar(cuentaRegresiva(reloj, j.hasta, { cadaSegundo: (falta) => reloj.classList.toggle('urgente', falta < 10000) }));
          refrescarConteo();
          return;
        }
        // revelada: la lista completa, ítem por ítem, con los equipos que se acordaron.
        sonido('fin');
        const eqs = sala.equipos();
        const quienes = (i) => eqs.filter((e) => j.porEquipo?.[e.id]?.ok.includes(i));
        const mejor = Math.max(0, ...eqs.map((e) => j.porEquipo?.[e.id]?.ok.length || 0));
        montar(el,
          h('div', { class: 'tv-cabecera' }, h('div', null, ...cabecera)),
          h('ol', { class: 'tv-escena-items', style: { '--cols': j.items.length > 16 ? 4 : j.items.length > 8 ? 3 : 2 } }, j.items.map((t, i) => {
            const q = quienes(i);
            return h('li', { class: q.length ? '' : 'nadie', style: { animationDelay: `${i * 0.25}s` } },
              h('span', { class: 'tv-escena-txt' }, t),
              h('span', { class: 'tv-escena-puntos' }, q.length ? q.map((e) => h('i', { style: { '--c': e.color }, title: e.nombre })) : h('small', null, 'nadie')));
          })),
          h('div', { class: 'tv-equipos' }, eqs.map((e) => {
            const r = j.porEquipo?.[e.id];
            return h('div', { class: 'tv-eq' + (r && r.ok.length === mejor && mejor > 0 ? ' activo' : ''), style: { '--c': e.color } },
              h('i', { class: 'tv-escena-punto', style: { '--c': e.color } }),
              h('b', null, e.nombre), h('span', { class: 'mono' }, `${r?.ok.length ?? 0} · +${r?.pts ?? 0}`));
          })));
        if (mejor > 0) setTimeout(() => confeti(), j.items.length * 250);
      },
      refrescar() { refrescarConteo(); },
    });

    // Mientras escriben, la tele muestra cuántas cosas lleva escritas cada equipo (no si están bien).
    function refrescarConteo() {
      if (!zonaConteo) return;
      const listas = listasPorEquipo(sala, sala.juego.n);
      montar(zonaConteo, sala.equipos().map((e) => h('div', { class: 'tv-eq', style: { '--c': e.color } },
        h('i', { class: 'tv-escena-punto', style: { '--c': e.color } }), h('b', null, e.nombre),
        h('span', { class: 'mono' }, `✍️ ${listas[e.id]?.length || 0}`))));
    }
  },
};
