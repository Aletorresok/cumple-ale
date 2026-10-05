// Escape: los equipos abren candados resolviendo desafíos.
// Modo carrera: cada equipo hace todo el escape y gana el primero en salir.
// Modo propio: como la carrera, pero cada equipo tiene un escape distinto (j.propios[eid]).
// Modo cooperativo: los candados se reparten entre los equipos y el último (el final)
// se abre recién cuando el curso abrió todos los demás; escapan todos juntos.
// Un código incorrecto traba el candado unos segundos; las pistas se piden desde el celular.
import { h, montar, vista, selector, ranking, esperando, pildoraEquipo } from './comun.js';
import { itemsDe } from '../bancos.js';
import { codigoCorrecto, largoCandado, textoCodigo, compositor, imprimirTarjetas, TIPOS_CANDADO } from '../escapes.js';
import { mezclar, cuentaRegresiva, toast, sonido, vibrar, idAzar, segundos } from '../util.js';

const PUNTOS_LLEGADA = [100, 70, 50];
const PUNTOS_ESCAPAR = 30;
const PUNTOS_COOP = 50;
const DESCUENTO_PISTA = 5;
const PUNTOS_CANDADO = 10;

function reloj(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Cuenta regresiva en formato mm:ss.
function relojRegresivo(el, hasta, alTerminar) {
  let fin = false;
  const tic = () => {
    const falta = hasta - Date.now();
    el.textContent = reloj(falta);
    el.classList.toggle('urgente', falta < 60000);
    if (falta <= 0 && !fin) { fin = true; clearInterval(t); alTerminar?.(); }
  };
  const t = setInterval(tic, 500);
  tic();
  return () => clearInterval(t);
}

const esCoop = (j) => j.modo === 'coop';
// Candados y datos privados del equipo: en el modo propio cada equipo tiene los suyos.
const cands = (j, eid) => j.propios?.[eid]?.candados || j.candados;
const privDe = (privado, eid) => privado?.propios?.[eid] || privado;
const datoDe = (j, eid, k) => j.propios?.[eid]?.[k] ?? j[k];
const ultimo = (j) => j.candados.length - 1;

// Candado que tiene que resolver el equipo: un índice, -1 si espera a los demás, o null si ya escapó.
export function candadoActual(j, eid) {
  const p = j.progreso[eid];
  if (!p) return null;
  if (!esCoop(j)) return p.termino ? null : p.n;
  if (j.escapado) return null;
  const propio = (j.asignados?.[eid] || []).find((ci) => !j.abiertos?.[ci]);
  if (propio !== undefined) return propio;
  const faltan = j.candados.some((_, ci) => ci < ultimo(j) && !j.abiertos?.[ci]);
  return faltan ? -1 : ultimo(j);
}

const logrosDe = (j, eid) => (esCoop(j) ? j.logros?.todos : j.logros?.[eid]) || {};

function filaCandados(cs, p) {
  return h('div', { class: 'candados-fila' }, cs.map((_, i) =>
    h('span', { class: 'cand ' + (i < p.n ? 'abierto' : i === p.n && !p.termino ? 'actual' : ''), 'aria-label': `Candado ${i + 1}${i < p.n ? ' abierto' : ''}` }, i < p.n ? '✓' : i + 1)));
}

// Mapa de candados del modo cooperativo: cada uno con el color del equipo que lo tiene.
function grillaCoop(sala, j, { tv = false } = {}) {
  const final = ultimo(j);
  const listoFinal = j.candados.every((_, ci) => ci === final || j.abiertos?.[ci]);
  return h('div', { class: 'coop-grilla' + (tv ? ' en-tv' : '') },
    j.candados.map((c, ci) => {
      if (ci === final) {
        return h('div', { class: 'coop-cand final ' + (j.escapado ? 'abierto' : listoFinal ? 'actual' : '') },
          h('span', { class: 'coop-num' }, j.escapado ? '🔓' : '🔐'), h('span', null, 'Candado final'));
      }
      const eid = Object.keys(j.asignados || {}).find((e) => j.asignados[e].includes(ci));
      const eq = sala.equipo(eid);
      return h('div', { class: 'coop-cand ' + (j.abiertos?.[ci] ? 'abierto' : ''), style: { '--c': eq?.color } },
        h('span', { class: 'coop-num' }, j.abiertos?.[ci] ? '✓' : ci + 1), h('span', null, eq?.nombre || ''));
    }));
}

function listaLogros(logros, titulo = 'Lo que encontraron') {
  const items = Object.entries(logros).sort((a, b) => a[0] - b[0]);
  if (!items.length) return null;
  return h('div', { class: 'logros' }, h('div', { class: 'etiqueta' }, `🏆 ${titulo}`),
    items.map(([ci, t]) => h('p', null, h('b', null, `Candado ${Number(ci) + 1}: `), t)));
}

function puntosFinales(j) {
  const puntos = {};
  for (const eid of j.orden) {
    const p = j.progreso[eid];
    if (esCoop(j)) {
      puntos[eid] = j.escapado ? Math.max(PUNTOS_CANDADO, PUNTOS_COOP - DESCUENTO_PISTA * p.pistas) + PUNTOS_CANDADO * p.abiertos : PUNTOS_CANDADO * p.abiertos;
      continue;
    }
    const lugar = (j.llegada || []).indexOf(eid);
    if (lugar >= 0) puntos[eid] = Math.max(PUNTOS_CANDADO, (PUNTOS_LLEGADA[lugar] ?? PUNTOS_ESCAPAR) - DESCUENTO_PISTA * p.pistas);
    else puntos[eid] = PUNTOS_CANDADO * p.abiertos;
  }
  return puntos;
}

function resultados(sala, j, { tv = false } = {}) {
  const filas = j.orden.map((eid) => ({ eid, p: j.progreso[eid], lugar: (j.llegada || []).indexOf(eid) }))
    .sort((a, b) => (a.lugar < 0) - (b.lugar < 0) || a.lugar - b.lugar || b.p.abiertos - a.p.abiertos);
  return h('ol', { class: tv ? 'tv-escape-res' : 'escape-res' }, filas.map(({ eid, p, lugar }) => {
    const e = sala.equipo(eid);
    const dato = esCoop(j)
      ? `${p.abiertos} ${p.abiertos === 1 ? 'candado abierto' : 'candados abiertos'}`
      : lugar >= 0 ? `🔓 Escaparon en ${reloj(p.termino - j.inicio)}` : `${p.abiertos} de ${cands(j, eid).length} candados`;
    return h('li', { style: { '--c': e?.color } },
      h('span', { class: 'res-nombre' }, e?.nombre),
      h('span', { class: 'res-dato' }, dato),
      h('span', { class: 'res-dato' }, `${p.pistas} ${p.pistas === 1 ? 'pista' : 'pistas'}`),
      j.puntos && h('span', { class: 'res-pts' }, `+${j.puntos[eid]}`));
  }));
}

// Imágenes: las subidas se guardan aparte (una por documento) y se leen una sola vez.
const cacheImagenes = new Map();
function imagenCandado(sala, j, eid, ci) {
  const c = cands(j, eid)[ci];
  if (!c.imagen) return null;
  const img = h('img', { class: 'desafio-img', alt: 'Imagen del desafío' });
  if (c.imagen !== 'recurso') { img.src = c.imagen; return img; }
  const clave = j.propios ? `${j.id}-${eid}-${ci}` : `${j.id}-${ci}`;
  if (cacheImagenes.has(clave)) img.src = cacheImagenes.get(clave);
  else {
    sala.leerRecurso(clave).then((d) => { if (d?.img) { cacheImagenes.set(clave, d.img); img.src = d.img; } }).catch(() => {});
  }
  return img;
}

// Qué parte de la información dividida le toca a este alumno.
function miParte(sala, j, eid, ci) {
  const partes = cands(j, eid)[ci].partes || [];
  if (!partes.length) return [];
  const asig = sala.data.asignaciones || {};
  const miembros = Object.keys(asig).filter((u) => asig[u] === eid).sort();
  const yo = Math.max(0, miembros.indexOf(sala.uid));
  const n = Math.max(1, miembros.length);
  return partes.filter((_, i) => i % n === yo % n);
}

export default {
  id: 'escape',
  nombre: 'Sala de escape',
  icono: '🔐',
  resumen: 'Escape room por equipos, en carrera o todo el grupo junto.',
  tipos: ['escape'],

  configurar({ bancos, sala }) {
    const aptos = bancos.flatMap((b) => itemsDe(b, 'escape').map((e, i) => ({ b, e, clave: `${b.id}:${i}` })));
    if (!aptos.length) {
      return {
        el: h('p', { class: 'aviso' }, 'Necesitás un escape. Agregá uno desde «Bancos listos para usar» o creá uno en la pestaña «Escapes» de un banco.'),
        leer: () => null,
      };
    }
    const sel = h('select', { class: 'campo', id: 'cfg-escape' }, aptos.map((a) =>
      h('option', { value: a.clave }, `${a.e.titulo} — ${a.e.candados.length} candados (${a.b.titulo})`)));
    const modo = selector('cfg-modo-escape', 'Modo', [['carrera', 'Carrera: cada equipo hace todo el escape'], ['propio', 'Cada equipo su escape: uno distinto por equipo, en carrera'], ['coop', 'Cooperativo: el grupo escapa junto']], 'carrera');
    const minutos = selector('cfg-minutos', 'Tiempo', [[0, 'El que trae el escape'], [15, '15 minutos'], [20, '20 minutos'], [30, '30 minutos'], [40, '40 minutos'], [60, '1 hora']], 0);
    const espera = selector('cfg-espera', 'Espera tras un código incorrecto', [[10, '10 segundos'], [20, '20 segundos'], [30, '30 segundos']], 20);
    const conGente = sala.equipos().filter((e) => sala.miembros(e.id).length).map((e) => e.id);
    const checks = sala.equipos().map((e) => ({ e, input: h('input', { type: 'checkbox', id: 'cfg-eq-' + e.id, checked: !conGente.length || conGente.includes(e.id) }) }));
    const explicacion = h('p', { class: 'muted chico' });
    const selModo = modo.el.querySelector('select');
    // Modo propio: un escape por equipo. Por defecto, el que lleva el nombre del equipo en el
    // título (Planta Nuclear → «La planta nuclear») y, si no hay, uno distinto sin usar.
    const eqs = sala.equipos();
    const deNombre = eqs.map((e) => aptos.findIndex((a) => a.e.titulo.toLowerCase().includes(e.nombre.toLowerCase())));
    const banco = aptos[deNombre.find((k) => k >= 0)]?.b.id ?? aptos[0].b.id;
    const usados = new Set(deNombre.filter((k) => k >= 0));
    const libres = [...aptos.keys()].filter((k) => !usados.has(k)).sort((x, y) => (aptos[y].b.id === banco) - (aptos[x].b.id === banco));
    const elegido = deNombre.map((k, i) => (k >= 0 ? k : libres.shift() ?? i % aptos.length));
    const porEquipo = eqs.map((e, i) => {
      const s = h('select', { class: 'campo', id: 'cfg-escape-' + e.id }, aptos.map((a, k) =>
        h('option', { value: a.clave, selected: k === elegido[i] }, a.e.titulo)));
      return { e, s };
    });
    const zonaPropio = h('div', { class: 'pila-s', hidden: true },
      h('span', { class: 'etq' }, 'Escape de cada equipo'),
      porEquipo.map(({ e, s }) => h('label', { class: 'fila nowrap' }, pildoraEquipo(e), s)),
      aptos.length < sala.equipos().length && h('p', { class: 'aviso chico' }, `Hay ${aptos.length} escapes para ${sala.equipos().length} equipos: alguno se va a repetir.`));
    const zonaUno = h('label', { class: 'pila-s' }, h('span', { class: 'etq' }, 'Escape'), sel);
    const explicar = () => {
      zonaPropio.hidden = selModo.value !== 'propio';
      zonaUno.hidden = selModo.value === 'propio';
      explicacion.textContent = selModo.value === 'coop'
        ? `Los candados se reparten entre los equipos y el último se abre entre todos cuando el grupo abrió los demás. Si escapan, cada equipo suma ${PUNTOS_COOP} (−${DESCUENTO_PISTA} por pista) más ${PUNTOS_CANDADO} por candado que abrió.`
        : `Puntos: ${PUNTOS_LLEGADA.join(', ')} para los tres primeros en escapar y ${PUNTOS_ESCAPAR} para el resto (−${DESCUENTO_PISTA} por pista); si no escapan, ${PUNTOS_CANDADO} por candado abierto.`;
    };
    selModo.addEventListener('change', explicar);
    explicar();
    return {
      el: h('div', { class: 'pila' },
        modo.el,
        zonaUno,
        zonaPropio,
        h('div', { class: 'grilla-2' }, minutos.el, espera.el),
        h('fieldset', { class: 'pila-s' }, h('legend', { class: 'etq' }, 'Equipos que juegan'),
          h('div', { class: 'fila' }, checks.map(({ e, input }) => h('label', { class: 'check' }, input, pildoraEquipo(e))))),
        explicacion),
      leer: () => {
        const a = aptos.find((x) => x.clave === sel.value);
        const equipos = checks.filter((c) => c.input.checked).map((c) => c.e.id);
        if (!equipos.length) { toast('Elegí al menos un equipo', 'error'); return null; }
        const propios = selModo.value === 'propio'
          ? Object.fromEntries(porEquipo.filter(({ e }) => equipos.includes(e.id)).map(({ e, s }) => [e.id, aptos.find((x) => x.clave === s.value).e]))
          : null;
        const base = propios ? propios[equipos[0]] : a.e;
        return { escape: base, propios, modo: selModo.value, equipos, minutos: Number(minutos.valor()) || base.minutos || 30, espera: Number(espera.valor()) };
      },
    };
  },

  async iniciar(sala, { escape, propios, modo, equipos, minutos, espera }) {
    const id = idAzar();
    const orden = mezclar(equipos);
    const secreto = (cs) => {
      const porIndice = (f) => Object.fromEntries(cs.map((c, i) => [i, f(c)]).filter(([, v]) => v));
      return {
        respuestas: cs.map((c) => c.respuesta),
        pistas: Object.fromEntries(cs.map((c, i) => [i, c.pistas || []])),
        recompensas: porIndice((c) => c.recompensa?.trim()),
        fisicas: porIndice((c) => c.fisica?.trim()),
      };
    };
    const publico = (cs) => cs.map((c) => ({
      titulo: c.titulo || '', desafio: c.desafio, tipo: c.tipo, largo: largoCandado(c), pistas: (c.pistas || []).length,
      partes: c.partes || [], fisica: !!c.fisica?.trim(),
      imagen: c.imagen ? (c.imagen.startsWith('data:') ? 'recurso' : c.imagen) : null,
    }));
    const cs = escape.candados;
    await sala.guardarPrivado({
      juego: id, ...secreto(cs),
      ...(propios ? { propios: Object.fromEntries(orden.map((e) => [e, { ...secreto(propios[e].candados), titulo: propios[e].titulo }])) } : {}),
    });
    const imagenes = propios ? orden.flatMap((e) => propios[e].candados.map((c, i) => [`${id}-${e}-${i}`, c])) : cs.map((c, i) => [`${id}-${i}`, c]);
    for (const [clave, c] of imagenes) {
      if (c.imagen?.startsWith('data:')) await sala.guardarRecurso(clave, { juego: id, img: c.imagen });
    }
    const asignados = Object.fromEntries(orden.map((e) => [e, []]));
    if (modo === 'coop') cs.slice(0, -1).forEach((_, i) => asignados[orden[i % orden.length]].push(i));
    await sala.iniciarJuego({
      tipo: 'escape', modo, fase: 'intro',
      titulo: propios ? (escape.marco ? escape.marco.titulo : 'Cada equipo su escape') : escape.titulo,
      intro: propios ? (escape.marco?.intro || 'Cada equipo tiene su propio escape. Gana el primero en salir.') : escape.intro || '',
      final: (propios ? escape.marco?.final : escape.final) || '',
      candados: publico(cs),
      ...(propios ? { propios: Object.fromEntries(orden.map((e) => [e, {
        titulo: propios[e].titulo, intro: propios[e].intro || '', final: propios[e].final || '', candados: publico(propios[e].candados),
      }])) } : {}),
      orden, minutos, espera: espera * 1000, inicio: 0, terminaEn: 0, llegada: [], pistasVistas: {}, logros: {},
      asignados, abiertos: {}, escapado: 0,
      progreso: Object.fromEntries(orden.map((e) => [e, { n: 0, abiertos: 0, errores: 0, pistas: 0, bloqueoHasta: 0, termino: 0, vistos: {}, ultimo: null }])),
    }, id);
  },

  host(el, sala) {
    let privado = null;
    let ocupado = false;
    let otraVez = false;
    let temporizador = null;
    let terminado = false;
    sala.privadoDelJuego().then((p) => { privado = p; v.actualizar('privado'); });

    function darPista(eid, e) {
      const ci = candadoActual(e, eid);
      if (ci === null || ci < 0) return false;
      const lista = privDe(privado, eid).pistas[ci] || [];
      const ya = e.pistasVistas[eid]?.[ci]?.length || 0;
      if (ya >= lista.length) return false;
      e.pistasVistas[eid] = { ...(e.pistasVistas[eid] || {}), [ci]: lista.slice(0, ya + 1) };
      e.progreso[eid].pistas++;
      return true;
    }

    function abrir(eid, e, valor = '') {
      const ci = candadoActual(e, eid);
      if (ci === null || ci < 0) return false;
      const p = e.progreso[eid];
      const ahora = Date.now();
      p.abiertos++;
      p.ultimo = { ok: true, valor, ci };
      const premio = privDe(privado, eid).recompensas?.[ci];
      if (premio) {
        const clave = esCoop(e) ? 'todos' : eid;
        e.logros[clave] = { ...(e.logros[clave] || {}), [ci]: premio };
      }
      if (esCoop(e)) {
        e.abiertos[ci] = eid;
        if (ci === ultimo(e)) {
          e.escapado = ahora;
          e.orden.forEach((x) => { e.progreso[x].termino = ahora; });
        }
      } else {
        p.n++;
        if (p.n >= cands(e, eid).length && !p.termino) { p.termino = ahora; e.llegada.push(eid); }
      }
      return true;
    }

    // Aplica un cambio sobre una copia del estado y guarda solo lo que cambia durante el juego.
    async function aplicar(cambio) {
      const j = sala.juego;
      if (!privado || j.fase !== 'jugando') return;
      const e = structuredClone(j);
      e.pistasVistas ||= {}; e.logros ||= {}; e.abiertos ||= {}; e.llegada ||= [];
      if (!cambio(e)) return;
      await sala.actualizarJuego({ progreso: e.progreso, pistasVistas: e.pistasVistas, logros: e.logros, abiertos: e.abiertos, escapado: e.escapado || 0, llegada: e.llegada });
      if (e.escapado || e.orden.every((x) => e.progreso[x].termino)) await terminar(e);
    }

    async function procesar() {
      if (ocupado) { otraVez = true; return; }
      ocupado = true;
      try {
        await aplicar((e) => {
          let hubo = false;
          const ahora = Date.now();
          const resps = [...sala.respuestasJuego().entries()].sort((a, b) => a[1].t - b[1].t);
          for (const [uid, r] of resps) {
            const p = e.progreso[r.equipo];
            if (!p || r.t <= (p.vistos[uid] || 0)) continue;
            p.vistos[uid] = r.t;
            hubo = true;
            const ci = candadoActual(e, r.equipo);
            if (ci === null || ci < 0 || r.ronda !== ci) continue;
            if (r.accion === 'pista') { darPista(r.equipo, e); continue; }
            if (r.accion !== 'probar' || ahora < p.bloqueoHasta) continue;
            if (codigoCorrecto(cands(e, r.equipo)[ci].tipo, r.valor, privDe(privado, r.equipo).respuestas[ci])) abrir(r.equipo, e, r.valor);
            else { p.errores++; p.bloqueoHasta = ahora + e.espera; p.ultimo = { ok: false, valor: r.valor, ci }; }
          }
          return hubo;
        });
      } catch (err) { toast('No se pudo guardar: ' + err.message, 'error'); }
      ocupado = false;
      if (otraVez) { otraVez = false; procesar(); }
    }

    async function empezar() {
      const j = sala.juego;
      const inicio = Date.now();
      await sala.actualizarJuego({ fase: 'jugando', inicio, terminaEn: inicio + j.minutos * 60000 });
    }

    async function terminar(actual) {
      const j = actual || sala.juego;
      if (j.fase === 'fin' || terminado) return;
      terminado = true;
      const puntos = puntosFinales(j);
      await sala.actualizarJuego({ fase: 'fin', puntos });
      await sala.sumar(puntos);
    }

    const v = vista({
      clave: () => { const j = sala.juego; return `${j.fase}:${JSON.stringify(j.progreso)}:${JSON.stringify(j.pistasVistas)}:${JSON.stringify(j.abiertos)}:${!!privado}`; },
      dibujar(alLimpiar) {
        const j = sala.juego;
        clearTimeout(temporizador);
        if (!privado) { montar(el, esperando('Cargando el escape…')); return; }
        const listaSol = (eid) => h('ol', { class: 'soluciones' }, cands(j, eid).map((c, i) => h('li', null,
          h('b', null, textoCodigo(c.tipo, privDe(privado, eid).respuestas[i])), h('span', { class: 'muted chico' }, ` · ${TIPOS_CANDADO[c.tipo].nombre}`))));
        const solucion = h('details', { class: 'tarjeta suave secreto-organizador' },
          h('summary', null, 'Ver soluciones (no lo proyectes)'),
          j.propios
            ? j.orden.map((eid) => h('div', { class: 'pila-s' }, h('div', { class: 'fila' }, pildoraEquipo(sala.equipo(eid)), h('b', null, j.propios[eid].titulo)), listaSol(eid)))
            : listaSol(null));
        // Pistas físicas para imprimir: las de todos los escapes que se juegan.
        const fisicas = (j.propios ? j.orden : [null]).flatMap((eid) => cands(j, eid).map((c, i) => ({
          ...c, n: i + 1, titulo: `${j.propios ? j.propios[eid].titulo + ' · ' : ''}${c.titulo || ''}`, fisica: privDe(privado, eid).fisicas?.[i] || '',
        })));
        const hayFisicas = fisicas.some((c) => c.fisica);
        if (j.fase === 'intro') {
          montar(el, h('h3', null, '🔐 ', j.titulo),
            j.intro && h('p', { class: 'historia' }, j.intro),
            h('p', { class: 'muted' }, `${esCoop(j) ? 'Modo cooperativo' : j.propios ? 'Cada equipo su escape' : 'Modo carrera'} · ${j.propios ? '' : j.candados.length + ' candados · '}${j.minutos} minutos. Leé la historia en voz alta mientras se ve en la pantalla grande.`),
            hayFisicas && h('div', { class: 'aviso pila-s' },
              h('span', null, '📦 Este escape tiene pistas físicas. Imprimí las tarjetas y escondelas en la fiesta antes de empezar.'),
              h('button', { class: 'btn sec chico', onclick: () => imprimirTarjetas({ titulo: j.titulo, candados: fisicas }) }, '🖨 Imprimir tarjetas')),
            solucion,
            h('button', { class: 'btn grande', onclick: empezar }, `▶ Empezar (${j.minutos} min)`));
          return;
        }
        if (j.fase === 'fin') {
          montar(el, h('h3', null, esCoop(j) ? (j.escapado ? '¡El grupo escapó!' : 'No llegaron a escapar') : 'Terminó el escape'), resultados(sala, j), ranking(sala));
          return;
        }
        const r = h('span', { class: 'reloj grande' });
        alLimpiar(relojRegresivo(r, j.terminaEn));
        temporizador = setTimeout(() => terminar(), Math.max(0, j.terminaEn - Date.now()) + 300);
        alLimpiar(() => clearTimeout(temporizador));
        montar(el,
          h('div', { class: 'fila entre' }, h('b', null, j.titulo), r),
          esCoop(j) && grillaCoop(sala, j),
          h('div', { class: 'escape-equipos' }, j.orden.map((eid) => {
            const p = j.progreso[eid];
            const ci = candadoActual(j, eid);
            const c = ci >= 0 ? cands(j, eid)[ci] : null;
            const quedan = c ? c.pistas - (j.pistasVistas?.[eid]?.[ci]?.length || 0) : 0;
            return h('div', { class: 'tarjeta pila-s', style: { '--c': sala.equipo(eid)?.color } },
              h('div', { class: 'fila entre' }, pildoraEquipo(sala.equipo(eid)),
                h('span', { class: 'muted chico' }, `${p.errores} errores · ${p.pistas} pistas`)),
              j.propios && h('span', { class: 'chico' }, j.propios[eid].titulo),
              !esCoop(j) && filaCandados(cands(j, eid), p),
              ci === null
                ? h('p', { class: 'ok-txt' }, esCoop(j) ? '🔓 ¡Escaparon!' : `🔓 ¡Escaparon en ${reloj(p.termino - j.inicio)}!`)
                : ci < 0
                  ? h('p', { class: 'muted chico' }, 'Abrieron sus candados; esperan el final.')
                  : h('div', { class: 'fila' },
                    h('span', { class: 'chico' }, `Candado ${ci + 1}: `, h('b', null, textoCodigo(c.tipo, privDe(privado, eid).respuestas[ci]))),
                    quedan > 0 && h('button', { class: 'btn sec chico', onclick: () => aplicar((e) => darPista(eid, e)) }, 'Dar pista'),
                    h('button', { class: 'btn sec chico', onclick: () => aplicar((e) => abrir(eid, e)) }, 'Abrir candado')));
          })),
          solucion,
          h('button', { class: 'btn-link peligro', onclick: () => terminar() }, 'Terminar el escape ahora'));
      },
      refrescar(motivo) {
        if (motivo === 'respuestas' || motivo === 'privado' || motivo === 'sala') procesar();
      },
      destruir() { clearTimeout(temporizador); },
    });
    return v;
  },

  alumno(el, sala) {
    return vista({
      clave: () => {
        const j = sala.juego;
        const mio = sala.data.asignaciones?.[sala.uid];
        const p = j.progreso?.[mio];
        const miembros = Object.values(sala.data.asignaciones || {}).filter((e) => e === mio).length;
        return `${j.fase}:${mio}:${miembros}:${p?.bloqueoHasta}:${p?.termino}:${j.progreso && candadoActual(j, mio)}:${JSON.stringify(j.pistasVistas?.[mio] || {})}:${JSON.stringify(logrosDe(j, mio))}:${JSON.stringify(j.abiertos || {})}`;
      },
      dibujar(alLimpiar) {
        const j = sala.juego;
        const mio = sala.data.asignaciones?.[sala.uid];
        const p = j.progreso?.[mio];
        if (!p) { montar(el, esperando('Tu equipo no juega este escape', 'Mirá la pantalla grande.')); return; }
        const titulo = datoDe(j, mio, 'titulo');
        const intro = datoDe(j, mio, 'intro');
        const final = datoDe(j, mio, 'final');
        const cs = cands(j, mio);
        if (j.fase === 'intro') {
          montar(el, h('div', { class: 'etiqueta' }, esCoop(j) ? 'Escape · todo el grupo junto' : j.propios ? 'Escape · el de tu equipo' : 'Escape'), h('h2', null, '🔐 ', titulo),
            intro && h('p', { class: 'historia' }, intro),
            esperando('Esperá la señal para empezar', `${cs.length} candados · ${j.minutos} minutos`));
          return;
        }
        const logros = listaLogros(logrosDe(j, mio), esCoop(j) ? 'Lo que encontró el grupo' : 'Lo que encontraron');
        if (j.fase === 'fin') {
          const salio = esCoop(j) ? !!j.escapado : !!p.termino;
          montar(el, h('div', { class: 'resultado ' + (salio ? 'bien' : 'mal') },
            h('div', { class: 'resultado-titulo' }, salio ? '¡Escaparon!' : 'Se terminó el tiempo'),
            salio && final && h('p', { class: 'historia' }, final),
            j.puntos && h('p', null, `Tu equipo suma ${j.puntos[mio]} puntos`)), resultados(sala, j));
          return;
        }
        const r = h('span', { class: 'reloj' });
        alLimpiar(relojRegresivo(r, j.terminaEn));
        const ci = candadoActual(j, mio);
        if (ci === null) {
          vibrar([100, 60, 100]);
          montar(el, h('div', { class: 'resultado bien' },
            h('div', { class: 'resultado-titulo' }, '🔓 ¡Escaparon!'),
            !esCoop(j) && h('p', null, `Tiempo: ${reloj(p.termino - j.inicio)}`),
            final && h('p', { class: 'historia' }, final)),
            !esCoop(j) && h('p', { class: 'muted centro' }, 'Esperen a que terminen los demás equipos.'));
          return;
        }
        if (ci < 0) {
          montar(el, h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, 'Modo cooperativo'), r),
            h('div', { class: 'resultado bien' }, h('div', { class: 'resultado-titulo' }, '¡Abrieron sus candados!'),
              h('p', null, 'Ayuden a los demás equipos: cuando el grupo abra todos, se habilita el candado final.')),
            grillaCoop(sala, j), logros);
          return;
        }
        const c = cs[ci];
        const vistas = j.pistasVistas?.[mio]?.[ci] || [];
        const quedan = c.pistas - vistas.length;
        const partes = miParte(sala, j, mio, ci);
        if (p.ultimo && p.ultimo.ci === ci && !p.ultimo.ok) vibrar([80, 60, 80]);

        let leer;
        let entrada;
        if (c.tipo === 'direccion' || c.tipo === 'color') {
          const comp = compositor(c.tipo, { max: c.largo });
          entrada = comp.el;
          leer = comp.valor;
        } else {
          const input = h('input', {
            class: 'campo grande mono codigo-escape', id: 'escape-codigo', autocomplete: 'off', autocapitalize: 'off', spellcheck: false,
            inputmode: c.tipo === 'numero' ? 'numeric' : 'text', maxlength: c.tipo === 'numero' ? c.largo : 60,
            placeholder: c.tipo === 'numero' ? '_ '.repeat(c.largo).trim() : `${c.largo} letras`,
          });
          entrada = input;
          leer = () => input.value.trim();
          setTimeout(() => input.focus(), 50);
        }
        const bloqueo = h('p', { class: 'bloqueo', hidden: true });
        const probar = h('button', { class: 'btn grande', type: 'submit' }, '🔑 Probar código');
        const bloquear = (hasta) => {
          if (hasta - Date.now() <= 0) return;
          probar.disabled = true;
          bloqueo.hidden = false;
          alLimpiar(cuentaRegresiva(h('span'), hasta, {
            cadaSegundo: (f) => { bloqueo.textContent = `Código incorrecto. El candado se trabó: esperá ${segundos(f)} s.`; },
            alTerminar: () => { probar.disabled = false; bloqueo.hidden = true; },
          }));
        };
        const form = h('form', { class: 'pila', onsubmit: async (e) => {
          e.preventDefault();
          const valor = leer();
          if (!valor) return;
          probar.disabled = true;
          const reintento = setTimeout(() => { probar.disabled = false; }, 4000);
          alLimpiar(() => clearTimeout(reintento));
          try { await sala.responder({ ronda: ci, accion: 'probar', valor }); } catch (err) { toast(err.message, 'error'); probar.disabled = false; }
        } }, entrada, probar, bloqueo);
        const esFinal = esCoop(j) && ci === ultimo(j);
        montar(el,
          h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, esFinal ? 'Candado final · todo el grupo' : esCoop(j) ? `Candado ${ci + 1} · de tu equipo` : `Candado ${ci + 1} de ${cs.length}`), r),
          j.propios && h('p', { class: 'muted chico' }, '🔐 ', titulo),
          esCoop(j) ? grillaCoop(sala, j) : filaCandados(cs, p),
          p.ultimo?.ok && h('p', { class: 'ultimo bien' }, '🔓 ¡Candado abierto!'),
          h('div', { class: 'candado-tarjeta pila-s' },
            h('div', { class: 'etiqueta' }, `🔒 ${c.titulo || TIPOS_CANDADO[c.tipo].nombre}`),
            h('p', { class: 'desafio' }, c.desafio),
            imagenCandado(sala, j, mio, ci),
            h('p', { class: 'muted chico' }, c.tipo === 'numero' ? `Código de ${c.largo} números` : c.tipo === 'palabra' ? `Palabra de ${c.largo} letras` : `Secuencia de ${c.largo}`)),
          !j.propios && ci === ultimo(j) && sala.textoPiezas(mio) && h('div', { class: 'mi-parte' },
            h('div', { class: 'etiqueta' }, '🧩 Las piezas que ganó tu equipo en la noche'),
            h('p', { class: 'mono piezas-grande' }, sala.textoPiezas(mio)),
            esCoop(j) && h('p', { class: 'muted chico' }, 'Los otros equipos tienen las piezas que les faltan: ¡junten todo!')),
          partes.length > 0 && h('div', { class: 'mi-parte' }, h('div', { class: 'etiqueta' }, '🧩 Solo lo ves vos: compartilo con tu equipo'), partes.map((t) => h('p', null, t))),
          c.fisica && h('p', { class: 'aviso' }, '📦 Hay una pista escondida en la fiesta. Busquen la tarjeta con el QR de este candado y escanéenla con la cámara.'),
          logros,
          vistas.length > 0 && h('div', { class: 'pistas' }, vistas.map((t, i) => h('p', null, h('b', null, `💡 Pista ${i + 1}: `), t))),
          form,
          quedan > 0 && h('button', { class: 'btn-link', onclick: async (e) => {
            e.currentTarget.disabled = true;
            try { await sala.responder({ ronda: ci, accion: 'pista', valor: '' }); } catch (err) { toast(err.message, 'error'); }
          } }, `💡 Pedir una pista (quedan ${quedan}, cuesta ${DESCUENTO_PISTA} puntos)`));
        if (p.bloqueoHasta > Date.now()) bloquear(p.bloqueoHasta);
      },
    });
  },

  tv(el, sala) {
    let abiertos = 0, errores = 0;
    return vista({
      clave: () => { const j = sala.juego; return `${j.fase}:${JSON.stringify(j.progreso)}:${JSON.stringify(j.abiertos)}:${JSON.stringify(j.logros?.todos || {})}`; },
      dibujar(alLimpiar) {
        const j = sala.juego;
        if (j.fase === 'intro') {
          montar(el, h('div', { class: 'tv-centro tv-escape-intro' },
            h('div', { class: 'tv-etiqueta' }, esCoop(j) ? 'Escape · todo el grupo junto' : j.propios ? 'Escape · cada equipo el suyo' : 'Escape'),
            h('h1', { class: 'tv-titulo enorme' }, j.titulo),
            j.intro && h('p', { class: 'tv-historia' }, j.intro),
            j.propios
              ? h('div', { class: 'tv-propios' }, j.orden.map((eid) => h('div', { class: 'tv-propio', style: { '--c': sala.equipo(eid)?.color } },
                h('span', { class: 'tv-eq-nombre' }, sala.equipo(eid)?.nombre), h('span', null, j.propios[eid].titulo))))
              : null,
            h('p', { class: 'tv-sub' }, `${j.propios ? '' : `🔒 ${j.candados.length} candados · `}⏱ ${j.minutos} minutos`)));
          return;
        }
        if (j.fase === 'fin') {
          sonido('fin');
          const salieron = esCoop(j) ? !!j.escapado : (j.llegada || []).length > 0;
          montar(el, h('div', { class: 'tv-centro' },
            h('h1', { class: 'tv-titulo' }, esCoop(j) ? (salieron ? '¡El grupo escapó!' : 'Se terminó el tiempo') : salieron ? '¡Se terminó el escape!' : 'Se terminó el tiempo'),
            salieron && j.final && h('p', { class: 'tv-historia' }, j.final),
            resultados(sala, j, { tv: true })));
          return;
        }
        const r = h('div', { class: 'tv-reloj enorme' });
        alLimpiar(relojRegresivo(r, j.terminaEn));
        const ps = Object.values(j.progreso);
        const a = ps.reduce((s, p) => s + p.abiertos, 0);
        const e = ps.reduce((s, p) => s + p.errores, 0);
        if (a > abiertos) sonido('bien'); else if (e > errores) sonido('mal');
        abiertos = a; errores = e;
        if (esCoop(j)) {
          montar(el,
            h('div', { class: 'tv-cabecera' }, h('span', { class: 'tv-etiqueta' }, `🔐 ${j.titulo} · todo el grupo junto`), r),
            h('div', { class: 'tv-coop' }, grillaCoop(sala, j, { tv: true }),
              listaLogros(j.logros?.todos || {}, 'Lo que encontró el grupo')));
          return;
        }
        montar(el,
          h('div', { class: 'tv-cabecera' }, h('span', { class: 'tv-etiqueta' }, `🔐 ${j.titulo}`), r),
          h('div', { class: 'tv-escape' }, j.orden.map((eid) => {
            const p = j.progreso[eid];
            const eq = sala.equipo(eid);
            const lugar = (j.llegada || []).indexOf(eid);
            return h('div', { class: 'tv-escape-eq' + (p.termino ? ' escapo' : ''), style: { '--c': eq?.color } },
              h('span', { class: 'tv-eq-nombre' }, eq?.nombre, j.propios && h('small', { class: 'tv-propio-tit' }, j.propios[eid].titulo)),
              filaCandados(cands(j, eid), p),
              h('span', { class: 'tv-eq-dato' }, p.termino ? `${lugar + 1}° · ${reloj(p.termino - j.inicio)}` : `${p.pistas} 💡`));
          })));
      },
    });
  },
};
