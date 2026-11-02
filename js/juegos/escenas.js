// ¿Te acordás de la escena?: la tele presenta una escena clásica de Los Simpson (por ejemplo, Cleto
// llamando a todos sus hijos) y cada equipo escribe desde los celulares todo lo que se acuerde.
// Lo que escriben los integrantes de un equipo se junta en una sola lista. Quien organiza revisa,
// puede aceptar o sacar respuestas a mano y revela: la tele muestra la lista completa y quién
// se acordó de cada cosa. Gana más quien más recordó.
import { h, montar, vista, selector, esperando, pildoraEquipo, ranking } from './comun.js';
import { ESCENAS } from '../escenas.js';
import { normalizar, distancia, cuentaRegresiva, toast, sonido, vibrar, confeti, guardarLocal, leerLocal } from '../util.js';

const PUNTOS_PUESTO = [100, 60, 40, 20];
const PUNTOS_ACIERTO = 10;
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
    const marcas = ESCENAS.map((e) => h('input', { type: 'checkbox', value: e.id, checked: !!e.fija }));
    const seg = selector('cfg-seg', 'Tiempo para escribir', [[60, '1 minuto'], [90, '1 minuto y medio'], [120, '2 minutos'], [180, '3 minutos']], 90);
    const modo = selector('cfg-puntos', 'Puntos', [['puesto', 'Por puesto: 100, 60, 40 y 20'], ['acierto', `${PUNTOS_ACIERTO} por cada acierto`]], 'puesto');
    return {
      el: h('div', { class: 'pila' },
        h('div', { class: 'pila-s' }, h('span', { class: 'etq' }, 'Escenas (en este orden)'),
          ESCENAS.map((e, i) => h('label', { class: 'fila nowrap escena-opcion' }, marcas[i],
            h('span', null, h('b', null, e.titulo), h('span', { class: 'muted chico' }, ` · ${e.items.length} para recordar`))))),
        h('div', { class: 'grilla-2' }, seg.el, modo.el),
        h('p', { class: 'muted chico' }, 'Cada integrante escribe desde su celular y todo se suma a la lista del equipo. Antes de revelar podés aceptar o sacar respuestas a mano.')),
      leer: () => {
        const ids = marcas.filter((m) => m.checked).map((m) => m.value);
        if (!ids.length) { toast('Elegí al menos una escena', 'error'); return null; }
        return { escenas: ESCENAS.filter((e) => ids.includes(e.id)), seg: Number(seg.valor()), modo: modo.valor() };
      },
    };
  },

  async iniciar(sala, { escenas, seg, modo }) {
    const juego = await sala.iniciarJuego({
      tipo: 'escenas', fase: 'presentar', n: 0, total: escenas.length, seg, modo,
      titulo: escenas[0].titulo, consigna: escenas[0].consigna, cantidad: escenas[0].items.length, hasta: 0,
    });
    await sala.guardarPrivado({ juego, escenas: escenas.map((e) => ({ titulo: e.titulo, consigna: e.consigna, items: e.items.map((it) => ({ a: it })) })), manual: {} });
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

    const empezar = () => accion(() => sala.actualizarJuego({ fase: 'escribiendo', hasta: Date.now() + sala.juego.seg * 1000 }));
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
      const cuentas = Object.fromEntries(Object.entries(res).map(([e, r]) => [e, r.ok.length]));
      const pts = repartirPuntos(cuentas, j.modo);
      const porEquipo = Object.fromEntries(Object.entries(res).map(([e, r]) => [e, { ok: r.ok, pts: pts[e] || 0 }]));
      await sala.actualizarJuego({ fase: 'revelada', items: escena().items.map((it) => it.a[0]), porEquipo }, pts);
    });

    const siguiente = () => accion(async () => {
      const j = sala.juego;
      const n = j.n + 1;
      if (n >= j.total) { await sala.actualizarJuego({ fase: 'fin' }); return; }
      const e = privado.escenas[n];
      await sala.actualizarJuego({ fase: 'presentar', n, titulo: e.titulo, consigna: e.consigna, cantidad: e.items.length, hasta: 0, items: undefined, porEquipo: undefined });
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
          h('div', { class: 'fila entre' }, pildoraEquipo(e), h('b', null, `${r.ok.length} de ${items.length}`),
            h('span', { class: 'muted chico' }, `${r.lista.length} escritas`)),
          j.fase === 'revisar' && h('div', { class: 'fila escena-chips' }, items.map((t, i) =>
            h('button', { class: 'chip' + (ok.has(i) ? ' escena-ok' : ''), title: ok.has(i) ? 'Tocá para sacarla' : 'Tocá para aceptarla',
              onclick: () => marcarMano(e.id, i, !ok.has(i)) }, (ok.has(i) ? '✓ ' : '') + t))),
          r.sueltas.length > 0 && h('p', { class: 'muted chico' }, 'Sin reconocer: ', h('span', { class: 'escena-sueltas' }, r.sueltas.join(' · '))));
      }));
    }

    const v = vista({
      destruir: () => fin?.(),
      clave: () => `${sala.juego.fase}:${sala.juego.n}:${!!privado}`,
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
        if (j.fase === 'presentar') {
          montar(el, cabecera, respuestas,
            h('p', { class: 'muted chico' }, 'La tele muestra la escena. Leé la consigna en voz alta y largá el tiempo.'),
            h('button', { class: 'btn grande', onclick: empezar }, `✍️ ¡A escribir! (${j.seg} s)`));
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
            h('p', { class: 'chico' }, 'Revisá: en verde lo que cuenta. Tocá un nombre para aceptarlo o sacarlo (por ejemplo, si lo escribieron muy distinto).'),
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
      clave: () => `${sala.juego.fase}:${sala.juego.n}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        const mio = sala.data.asignaciones?.[sala.uid];
        const eq = sala.equipo(mio);
        if (j.fase === 'fin') { montar(el, h('h2', null, '¡Terminaron las escenas!'), ranking(sala)); return; }
        if (!mio) { montar(el, esperando('Todavía no tenés equipo', 'Pedile a quien organiza que te sume a uno.')); return; }
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
      clave: () => `${sala.juego.fase}:${sala.juego.n}`,
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
        if (j.fase === 'presentar') {
          montar(el, h('div', { class: 'tv-centro' }, ...cabecera,
            h('p', { class: 'tv-pregunta' }, j.consigna),
            h('p', { class: 'tv-sub' }, `Son ${j.cantidad}. Cada equipo escribe desde los celulares todos los que se acuerde. ¡Repártanse!`)));
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
