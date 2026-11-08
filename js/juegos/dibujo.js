// Dibujá en Springfield (estilo Pictionary). Modo pizarra (el de la fiesta): quien dibuja ve la palabra
// en el celular y dibuja en una pizarra; su equipo grita y el organizador marca (1 punto por dibujo).
// Modo celular: por turnos, alguien del equipo dibuja con el dedo
// en su celular la palabra que le toca, el dibujo aparece en vivo en la pantalla grande y su
// equipo grita hasta adivinar. Quien dibuja marca «¡Adivinaron!» o «Pasar» (o lo marca quien
// organiza). Los trazos viajan por Firebase en el documento salas/{codigo}/dibujos/{uid}.
import { h, montar, vista, selector, esperando, pildoraEquipo, ranking } from './comun.js';
import { itemsDe } from '../bancos.js';
import { PALABRAS_DIBUJO } from '../springfield.js';
import { mezclar, cuentaRegresiva, toast, sonido, vibrar, confeti } from '../util.js';

const PUNTOS_ACIERTO = 10;
// Modo «adivinan todos»: si acierta otro equipo, el equipo de quien dibuja se lleva esto por dibujar bien.
const PUNTOS_DIBUJANTE = 5;

// Modo pizarra (el de la fiesta): se dibuja en una pizarra de verdad y cada dibujo adivinado vale 1.
const PUNTOS_PIZARRA = 1;

// Puntos de un turno a partir de las palabras adivinadas ({ texto, ok, eq }).
export function puntosDelTurno(palabras, equipo, porAcierto = PUNTOS_ACIERTO) {
  const pts = {};
  for (const p of palabras) {
    if (!p.ok) continue;
    const eq = p.eq || equipo;
    pts[eq] = (pts[eq] || 0) + porAcierto;
    if (eq !== equipo) pts[equipo] = (pts[equipo] || 0) + PUNTOS_DIBUJANTE;
  }
  return pts;
}

// ── Lienzo compartido ──
// Coordenadas lógicas de 1000 × 750 (4:3), iguales en el celular y en la tele.
// Cada trazo es un texto: color (1 carácter), grosor (1 carácter) y puntos de 4 caracteres en
// base 36 (2 para x, 2 para y). Así un dibujo entero entra holgado en un documento.
export const ANCHO = 1000;
export const ALTO = 750;
export const COLORES = ['#1d1d1b', '#E4572E', '#2E6FE4', '#2BA36B', '#F2C94C', '#8A4FD8', '#8B5A2B', '#FF6FB5', '#ffffff'];
const GOMA = COLORES.length - 1;
export const GROSORES = [6, 14, 32];
const MAX_TRAZOS = 480;
const MAX_PUNTOS = 250;
const CADA_MS = 300; // cada cuánto manda el dibujo mientras se dibuja

const b36 = (n) => Math.max(0, Math.min(1295, Math.round(n))).toString(36).padStart(2, '0');

export function codificar(color, grosor, puntos) {
  return color.toString(36) + grosor.toString(36) + puntos.map(([x, y]) => b36(x) + b36(y)).join('');
}

export function decodificar(t) {
  const color = parseInt(t[0], 36) || 0;
  const grosor = parseInt(t[1], 36) || 0;
  const puntos = [];
  for (let i = 2; i + 4 <= t.length; i += 4) puntos.push([parseInt(t.slice(i, i + 2), 36), parseInt(t.slice(i + 2, i + 4), 36)]);
  return { color: COLORES[color] || COLORES[0], ancho: GROSORES[grosor] || GROSORES[0], puntos };
}

function trazar(ctx, escala, { color, ancho, puntos }, desde = 0) {
  if (!puntos.length) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = ancho * escala;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (puntos.length === 1) {
    ctx.beginPath();
    ctx.arc(puntos[0][0] * escala, puntos[0][1] * escala, (ancho * escala) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  const i0 = Math.max(0, desde - 1);
  ctx.moveTo(puntos[i0][0] * escala, puntos[i0][1] * escala);
  for (let i = i0 + 1; i < puntos.length; i++) ctx.lineTo(puntos[i][0] * escala, puntos[i][1] * escala);
  ctx.stroke();
}

// Un <canvas> que se ajusta al ancho de su contenedor (con la nitidez de la pantalla).
function lienzo(clase) {
  const canvas = h('canvas', { class: 'lienzo ' + (clase || '') });
  let trazos = [];
  const ajustar = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.width * dpr * (ALTO / ANCHO));
    pintar(trazos);
  };
  const escala = () => canvas.width / ANCHO;
  function pintar(lista) {
    trazos = lista;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const t of lista) trazar(ctx, escala(), typeof t === 'string' ? decodificar(t) : t);
  }
  const alCambiarTamanio = () => ajustar();
  window.addEventListener('resize', alCambiarTamanio);
  return {
    canvas, ajustar, pintar, escala,
    ctx: () => canvas.getContext('2d'),
    soltar: () => window.removeEventListener('resize', alCambiarTamanio),
  };
}

// Lienzo de la tele: escucha el documento de quien dibuja y lo muestra si es de la palabra actual.
function lienzoEnVivo(sala, uid, clase) {
  const l = lienzo(clase);
  let ultimo = null;
  const refrescar = () => {
    const j = sala.juego;
    const d = ultimo;
    const vale = d && d.juego === j?.id && d.ronda === j?.turno && d.n === j?.n;
    l.pintar(vale && Array.isArray(d.trazos) ? d.trazos : []);
  };
  const dejar = sala.escucharDoc('dibujos', uid, (d) => { ultimo = d; refrescar(); });
  return { el: l.canvas, ajustar: () => { l.ajustar(); refrescar(); }, refrescar, soltar: () => { dejar(); l.soltar(); } };
}

// ── El juego ──
export default {
  id: 'dibujo',
  nombre: 'Dibujá en Springfield',
  icono: '✏️',
  resumen: 'Alguien dibuja en su celular, el dibujo sale en vivo en la tele y su equipo adivina todas las que pueda.',
  tipos: ['dibujo'],

  configurar({ bancos, sala }) {
    const aptos = bancos.filter((b) => itemsDe(b, 'dibujo').length >= 5);
    const opciones = [['', `Springfield (vienen con el juego) — ${PALABRAS_DIBUJO.length} palabras`],
      ...aptos.map((b) => [b.id, `${b.titulo} — ${itemsDe(b, 'dibujo').length} palabras para dibujar`])];
    const banco = selector('cfg-banco', 'Palabras', opciones, aptos.find((b) => b.plantilla === 'springfield')?.id || '');
    const donde = selector('cfg-donde', 'Dónde se dibuja', [
      ['pizarra', `En una pizarra: el celular de quien dibuja solo muestra la palabra; su equipo grita y vos marcás (${PUNTOS_PIZARRA} punto por dibujo)`],
      ['celular', 'En el celular: el dibujo sale en vivo en la tele']], 'pizarra');
    const seg = selector('cfg-seg', 'Tiempo por turno', [[60, '1 minuto'], [90, '1 minuto y medio'], [120, '2 minutos']], 90);
    const vueltas = selector('cfg-vueltas', 'Vueltas', [[1, '1 turno por equipo'], [2, '2 turnos por equipo'], [3, '3 turnos por equipo']], 1);
    const modo = selector('cfg-modo', 'Quién adivina', [['equipo', 'Solo el equipo de quien dibuja'], ['todos', 'Todos los equipos: el primero que acierta']], 'todos');
    const conGente = sala.equipos().filter((e) => sala.miembros(e.id).length >= 2);
    const zonaCelular = h('div', { class: 'pila' }, modo.el,
        h('p', { class: 'muted chico' }, `Cada palabra adivinada suma ${PUNTOS_ACIERTO} puntos. Con «Todos los equipos», gana los ${PUNTOS_ACIERTO} el equipo que grita primero la respuesta y el equipo de quien dibuja se lleva ${PUNTOS_DIBUJANTE} por dibujar bien. Pasar no resta, pero la palabra se pierde. Dibuja una persona distinta en cada turno. No se vale escribir letras ni números.`));
    const selDonde = donde.el.querySelector('select');
    const pintarDonde = () => { zonaCelular.hidden = selDonde.value !== 'celular'; };
    selDonde.addEventListener('change', pintarDonde);
    pintarDonde();
    return {
      el: h('div', { class: 'pila' }, banco.el, donde.el, h('div', { class: 'grilla-2' }, seg.el, vueltas.el), zonaCelular,
        conGente.length < 1 && h('p', { class: 'aviso' }, 'Hace falta al menos un equipo con 2 personas.')),
      leer: () => {
        const elegido = aptos.find((b) => b.id === banco.valor());
        const palabras = elegido ? itemsDe(elegido, 'dibujo').map((i) => i.palabra) : PALABRAS_DIBUJO;
        const equipos = sala.equipos().filter((e) => sala.miembros(e.id).length >= 2).map((e) => e.id);
        if (!equipos.length) { toast('Hace falta al menos un equipo con 2 personas', 'error'); return null; }
        const pizarra = donde.valor() === 'pizarra';
        return { palabras: mezclar(palabras), seg: Number(seg.valor()), vueltas: Number(vueltas.valor()), equipos, modo: pizarra ? 'equipo' : modo.valor(), pizarra };
      },
    };
  },

  async iniciar(sala, { palabras, seg, vueltas, equipos, modo = 'equipo', pizarra = false }) {
    const orden = mezclar(equipos);
    // Tope de palabras por turno (adivinadas + pasadas): la lista repartida entre los equipos que juegan.
    const tope = Math.max(1, Math.floor(palabras.length / orden.length));
    const juego = await sala.iniciarJuego({
      tipo: 'dibujo', fase: 'listo', seg, modo, pizarra, tope, pts: pizarra ? PUNTOS_PIZARRA : PUNTOS_ACIERTO, turno: 0, total: orden.length * vueltas, orden,
      equipo: orden[0], actor: null, hasta: 0, n: 0, aciertos: 0, pasadas: 0, ultimas: [], dibujaron: [], ultimaOk: null, ultimaEq: null,
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
      const miembros = sala.miembrosActivos(equipo);
      if (!miembros.length) { toast('Ese equipo no tiene integrantes conectados', 'error'); return; }
      // Dibuja alguien que todavía no dibujó (si ya dibujaron todos, cualquiera).
      const libres = miembros.filter((m) => !j.dibujaron.includes(m.uid));
      const actor = mezclar(libres.length ? libres : miembros)[0];
      const turno = j.turno + 1;
      privado.turnoPalabras = [];
      await sala.actualizarJuego({ fase: 'dibujando', turno, equipo, actor: { uid: actor.uid, nombre: actor.nombre }, n: 0, aciertos: 0, pasadas: 0, ultimas: [], ultimaOk: null, ultimaEq: null, hasta: Date.now() + j.seg * 1000, dibujaron: [...j.dibujaron, actor.uid] });
      await darPalabra(turno, 0, actor.uid);
    }

    async function darPalabra(turno, n, uid) {
      if (privado.pos >= privado.palabras.length) { privado.palabras = mezclar(privado.palabras); privado.pos = 0; }
      const palabra = privado.palabras[privado.pos];
      privado.actual = palabra;
      await sala.repartirSecretos({ [uid]: { juego: sala.juego.id, ronda: turno, n, palabra } });
      await sala.guardarPrivado(privado);
    }

    // Acierto o paso, venga del celular de quien dibuja o de este panel.
    // En el modo «todos», la acción es «acierto:<equipo que adivinó>».
    async function marcar(accion, n) {
      const j = sala.juego;
      if (procesando || j.fase !== 'dibujando' || n !== j.n) return;
      procesando = true;
      try {
        const [tipo, quien] = String(accion).split(':');
        const ok = tipo === 'acierto';
        const eq = ok ? (sala.equipo(quien) ? quien : j.equipo) : null;
        privado.turnoPalabras.push({ texto: privado.actual, ok, ...(eq ? { eq } : {}) });
        privado.pos++;
        const campos = ok ? { aciertos: j.aciertos + 1, ultimaOk: privado.actual, ultimaEq: eq } : { pasadas: j.pasadas + 1 };
        await sala.actualizarJuego({ ...campos, n: j.n + 1 });
        sonido(ok ? 'bien' : 'mal');
        // Llegó al tope de palabras del turno: termina aunque quede tiempo.
        if (j.tope && j.n + 1 >= j.tope) { procesando = false; await terminarTurno(); return; }
        await darPalabra(j.turno, j.n + 1, j.actor.uid);
      } catch (e) { toast(e.message, 'error'); }
      procesando = false;
    }

    let cerrado = -1;   // turno ya cerrado (que el tope y el reloj no lo cierren dos veces)
    async function terminarTurno() {
      const j = sala.juego;
      if (j.fase !== 'dibujando' || cerrado === j.turno) return;
      cerrado = j.turno;
      const siguiente = j.turno < j.total ? j.orden[j.turno % j.orden.length] : null;
      await sala.actualizarJuego({ fase: siguiente ? 'fin_turno' : 'fin', ultimas: privado.turnoPalabras, siguiente }, puntosDelTurno(privado.turnoPalabras, j.equipo, j.pts));
      await sala.repartirSecretos({ [j.actor.uid]: { juego: j.id, ronda: j.turno, n: -1, palabra: '' } });
    }

    // Otra vuelta: un turno más por equipo, aunque el juego ya haya empezado (o terminado).
    async function otraVuelta() {
      const j = sala.juego;
      const total = j.total + j.orden.length;
      if (j.fase === 'fin') await sala.actualizarJuego({ total, fase: 'fin_turno', siguiente: j.orden[j.turno % j.orden.length] });
      else await sala.actualizarJuego({ total });
      toast('Se agregó otra vuelta: un turno más por equipo');
    }
    const botonVuelta = () => h('button', { class: 'btn sec', onclick: otraVuelta }, '➕ Jugar otra vuelta');

    let contador;
    const v = vista({
      destruir: () => fin?.(),
      clave: () => `${sala.juego.fase}:${sala.juego.turno}:${sala.juego.total}:${!!privado}`,
      dibujar() {
        const j = sala.juego;
        fin?.(); fin = null; contador = null;
        if (!privado) { montar(el, esperando('Preparando…')); cargar(); return; }
        const eq = sala.equipo(j.equipo);
        if (j.fase === 'listo' || j.fase === 'fin_turno') {
          montar(el,
            j.fase === 'fin_turno' && h('p', null, `Turno ${j.turno}: `, h('b', null, `${j.aciertos} adivinadas`), ' · ',
              Object.entries(puntosDelTurno(j.ultimas || [], j.equipo, j.pts)).map(([e, p]) => `${sala.equipo(e)?.nombre} +${p}`).join(' · ') || 'sin puntos'),
            h('p', null, `Turno ${j.turno + 1} de ${j.total}: le toca a `, pildoraEquipo(sala.equipo(j.fase === 'fin_turno' ? j.siguiente : j.equipo))),
            h('p', { class: 'muted chico' }, j.pizarra
              ? 'Al empezar, la app elige quién dibuja y le muestra la palabra en su celular. Dibuja en la pizarra, su equipo grita y vos tocás «Adivinaron».'
              : 'Al empezar, la app elige quién dibuja y le muestra la palabra en su celular. El dibujo sale en vivo en la tele.'),
            h('button', { class: 'btn grande', onclick: empezarTurno }, '✏️ Empezar turno'),
            botonVuelta());
          return;
        }
        if (j.fase === 'fin') {
          montar(el, h('p', { class: 'grande' }, '¡Terminó Dibujá en Springfield!'), ranking(sala), botonVuelta());
          return;
        }
        const reloj = h('span', { class: 'reloj grande' });
        contador = h('div', { class: 'pila-s' });
        montar(el,
          h('div', { class: 'fila entre' }, pildoraEquipo(eq), reloj),
          h('p', null, 'Dibuja ', h('b', null, j.actor.nombre)),
          contador,
          j.modo === 'todos' && h('p', { class: 'muted chico' }, 'Adivinan todos: tocá el equipo que gritó primero la respuesta.'),
          h('div', { class: 'fila' },
            j.modo === 'todos'
              ? sala.equipos().map((e) => h('button', { class: 'btn ok', style: { background: e.color }, onclick: () => marcar('acierto:' + e.id, sala.juego.n) }, '✓ ' + e.nombre))
              : h('button', { class: 'btn ok grande', onclick: () => marcar('acierto', sala.juego.n) }, '✓ Adivinaron'),
            h('button', { class: 'btn sec', onclick: () => marcar('paso', sala.juego.n) }, '⏭ Pasar')),
          h('button', { class: 'btn-link', onclick: terminarTurno }, 'Terminar el turno ya'));
        fin = cuentaRegresiva(reloj, j.hasta, { alTerminar: terminarTurno });
      },
      refrescar() {
        const j = sala.juego;
        if (j.fase !== 'dibujando' || !privado) return;
        // Botones del celular de quien dibuja.
        const r = sala.respuestasJuego(j.turno).get(j.actor.uid);
        const clave = r && `${j.turno}:${r.paso}:${r.accion}`;
        if (r && r.paso === j.n && !hechos.has(clave)) { hechos.add(clave); marcar(r.accion, r.paso); }
        if (contador) montar(contador, h('p', { class: 'muted' }, 'Palabra: ', h('b', null, privado.actual || '…')),
          h('p', null, `${j.aciertos} adivinadas · ${j.pasadas} pasadas`, j.tope ? ` · máximo ${j.tope} palabras` : ''));
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
        if (j.fase === 'fin') { montar(el, h('h2', null, '¡Terminó Dibujá en Springfield!'), ranking(sala)); return; }
        if (j.fase !== 'dibujando') {
          montar(el, j.fase === 'fin_turno' && h('div', { class: 'resultado' + (j.equipo === mio ? ' bien' : '') },
            h('div', { class: 'resultado-titulo' }, `${eq?.nombre}: ${j.aciertos} adivinadas`)),
          esperando(mio === (j.fase === 'fin_turno' ? j.siguiente : j.equipo) ? '¡Ahora le toca a tu equipo!' : 'Esperando el próximo turno…'));
          return;
        }
        if (j.actor.uid === sala.uid) {
          const valida = secreto && secreto.juego === j.id && secreto.ronda === j.turno && secreto.n === j.n;
          if (!valida) { montar(el, esperando('Cargando la palabra…')); return; }
          vibrar(60);
          if (j.pizarra) { alLimpiar(palabraParaPizarra(el, sala, j, secreto)); return; }
          alLimpiar(pizarra(el, sala, j, secreto));
          return;
        }
        if (mio === j.equipo || (j.modo === 'todos' && mio)) {
          montar(el, h('div', { class: 'resultado bien' }, h('div', { class: 'resultado-titulo' }, mio === j.equipo ? '¡Adiviná!' : '¡Adiviná antes que nadie!'),
            h('p', null, j.pizarra ? `${j.actor.nombre} está dibujando en la pizarra. ¡Gritá lo que se te ocurra!` : `${j.actor.nombre} está dibujando. Mirá la tele y gritá lo que se te ocurra.`)));
          return;
        }
        montar(el, esperando(`Turno del equipo ${eq?.nombre}`, 'Miren la tele, pero sin soplar 🤫'));
      },
    });
    return v;
  },

  tv(el, sala) {
    let cuenta, vivo, cartel, ultimaOk;
    return vista({
      destruir: () => vivo?.soltar(),
      clave: () => `${sala.juego.fase}:${sala.juego.turno}:${sala.juego.equipo}:${sala.juego.siguiente}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        cuenta = null; cartel = null;
        vivo?.soltar(); vivo = null;
        const eq = sala.equipo(j.equipo);
        if (j.fase === 'fin') {
          sonido('fin'); confeti();
          montar(el, h('div', { class: 'tv-centro' }, h('div', { class: 'tv-icono' }, '✏️'), h('h1', { class: 'tv-titulo' }, '¡Terminó Dibujá en Springfield!'), ranking(sala)));
          return;
        }
        if (j.fase === 'listo' || j.fase === 'fin_turno') {
          const prox = sala.equipo(j.fase === 'fin_turno' ? j.siguiente : j.equipo);
          montar(el, h('div', { class: 'tv-centro' },
            j.fase === 'fin_turno'
              ? [h('div', { class: 'tv-etiqueta' }, j.modo === 'todos' ? 'Palabras adivinadas' : `${eq?.nombre} adivinó`), h('h1', { class: 'tv-titulo enorme', style: { color: eq?.color } }, j.aciertos),
                j.ultimas?.length > 0 && h('ul', { class: 'tv-mimica-lista' }, j.ultimas.map((p) => h('li', { class: p.ok ? 'ok' : 'paso' }, p.texto, j.modo === 'todos' && p.ok && p.eq && h('b', { style: { color: sala.equipo(p.eq)?.color } }, ' · ' + sala.equipo(p.eq)?.nombre))))]
              : [h('div', { class: 'tv-icono' }, '✏️'), h('h1', { class: 'tv-titulo' }, 'Dibujá en Springfield'),
                h('p', { class: 'tv-sub' }, j.pizarra
                  ? `Alguien del equipo dibuja en la pizarra la palabra que le sale en el celular. Su equipo grita. Cada dibujo adivinado vale ${j.pts} punto. ¡Todas las que puedan en ${j.seg} segundos${j.tope ? `, hasta ${j.tope} palabras` : ''}!`
                  : j.modo === 'todos'
                  ? 'Alguien dibuja en su celular y el dibujo sale acá. Adivinan todos los equipos: el primero que grita la respuesta se lleva los puntos.'
                  : 'Alguien del equipo dibuja en su celular y el dibujo sale acá. El resto grita. ¡Todas las que puedan!'),
                h('p', { class: 'tv-sub chico' }, 'No se vale escribir letras ni números.')],
            h('p', { class: 'tv-sub' }, 'Próximo turno: ', pildoraEquipo(prox))));
          if (j.fase === 'fin_turno') sonido('fin');
          return;
        }
        const reloj = h('div', { class: 'tv-reloj' });
        cuenta = h('span', { class: 'tv-dibujo-cuenta', style: { color: eq?.color } });
        cartel = h('div', { class: 'tv-dibujo-cartel', hidden: true });
        ultimaOk = j.ultimaOk;
        if (j.pizarra) {
          montar(el, h('div', { class: 'tv-centro tv-pizarra' },
            h('div', { class: 'tv-etiqueta' }, `Turno de ${eq?.nombre} · dibuja en la pizarra`),
            h('h1', { class: 'tv-titulo enorme', style: { color: eq?.color } }, j.actor.nombre),
            h('div', { class: 'tv-dibujo-datos' },
              h('div', { class: 'pila-s centro' }, cuenta, h('span', { class: 'tv-etiqueta' }, j.tope ? `adivinados (máx. ${j.tope})` : 'adivinados')),
              h('div', { class: 'pila-s centro' }, reloj, h('span', { class: 'tv-etiqueta' }, 'segundos'))),
            h('div', { class: 'tv-pizarra-cartel' }, cartel)));
          alLimpiar(cuentaRegresiva(reloj, j.hasta, { cadaSegundo: (falta) => reloj.classList.toggle('urgente', falta < 10000) }));
          return;
        }
        vivo = lienzoEnVivo(sala, j.actor.uid, 'lienzo-tv');
        montar(el, h('div', { class: 'tv-dibujo' },
          h('div', { class: 'tv-dibujo-cab' },
            h('div', { class: 'pila-s' },
              h('div', { class: 'tv-etiqueta' }, j.modo === 'todos' ? `${eq?.nombre} dibuja · adivinan todos` : `Turno de ${eq?.nombre} · dibuja`),
              h('div', { class: 'tv-dibujo-quien', style: { color: eq?.color } }, j.actor.nombre)),
            h('div', { class: 'tv-dibujo-datos' },
              h('div', { class: 'pila-s centro' }, cuenta, h('span', { class: 'tv-etiqueta' }, 'adivinadas')),
              h('div', { class: 'pila-s centro' }, reloj, h('span', { class: 'tv-etiqueta' }, 'segundos')))),
          h('div', { class: 'tv-dibujo-marco', style: { '--c': eq?.color } }, vivo.el, cartel)));
        vivo.ajustar();
        alLimpiar(cuentaRegresiva(reloj, j.hasta, { cadaSegundo: (falta) => reloj.classList.toggle('urgente', falta < 10000) }));
      },
      refrescar() {
        const j = sala.juego;
        if (cuenta) cuenta.textContent = j.aciertos;
        vivo?.refrescar();
        // Cartel con la palabra que acaban de adivinar.
        if (cartel && j.ultimaOk && j.ultimaOk !== ultimaOk) {
          ultimaOk = j.ultimaOk;
          const quien = j.modo === 'todos' && sala.equipo(j.ultimaEq);
          cartel.textContent = '✓ ' + j.ultimaOk + (quien ? ` · ${quien.nombre}` : '');
          cartel.style.background = quien ? quien.color : '';
          cartel.hidden = false;
          cartel.classList.remove('sale'); void cartel.offsetWidth; cartel.classList.add('sale');
          clearTimeout(cartel.t);
          const c = cartel;
          c.t = setTimeout(() => { c.hidden = true; }, 2200);
        }
      },
    });
  },
};

// Pizarra del celular de quien dibuja. Devuelve la función de limpieza.
function pizarra(el, sala, j, secreto) {
  const l = lienzo('lienzo-cel');
  let trazos = [];
  let actual = null; // { color, grosor, puntos }
  let color = 0;
  let grosor = 1;
  let sucio = false;
  let enviando = false;
  let timer = null;
  let terminado = false;

  const listaParaMandar = () => (actual && actual.puntos.length ? [...trazos, codificar(actual.color, actual.grosor, actual.puntos)] : trazos);

  async function enviar() {
    timer = null;
    if (terminado || enviando || !sucio) return;
    sucio = false;
    enviando = true;
    try { await sala.dibujar({ ronda: j.turno, n: secreto.n, trazos: listaParaMandar() }); }
    catch (e) { console.error('dibujo', e); sucio = true; }
    enviando = false;
    if (sucio && !terminado) programar();
  }
  function programar() {
    sucio = true;
    if (!timer && !enviando) timer = setTimeout(enviar, CADA_MS);
  }

  const punto = (ev) => {
    const r = l.canvas.getBoundingClientRect();
    return [Math.max(0, Math.min(ANCHO, ((ev.clientX - r.left) / r.width) * ANCHO)), Math.max(0, Math.min(ALTO, ((ev.clientY - r.top) / r.height) * ALTO))];
  };
  const decod = (t) => (typeof t === 'string' ? decodificar(t) : t);
  const repintar = () => l.pintar([...trazos, ...(actual ? [{ color: COLORES[actual.color], ancho: GROSORES[actual.grosor], puntos: actual.puntos }] : [])]);

  function cerrarTrazo() {
    if (!actual) return;
    if (actual.puntos.length) trazos.push(codificar(actual.color, actual.grosor, actual.puntos));
    actual = null;
    programar();
  }

  l.canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (trazos.length >= MAX_TRAZOS) { toast('El dibujo está lleno: borrá algo para seguir', 'error'); return; }
    l.canvas.setPointerCapture?.(ev.pointerId);
    actual = { color, grosor, puntos: [punto(ev)] };
    trazar(l.ctx(), l.escala(), decod(codificar(actual.color, actual.grosor, actual.puntos)));
    programar();
  });
  l.canvas.addEventListener('pointermove', (ev) => {
    if (!actual) return;
    ev.preventDefault();
    const eventos = ev.getCoalescedEvents?.() || [ev];
    for (const e of eventos) {
      const p = punto(e);
      const u = actual.puntos[actual.puntos.length - 1];
      if (Math.hypot(p[0] - u[0], p[1] - u[1]) < 4) continue;
      actual.puntos.push(p);
      trazar(l.ctx(), l.escala(), { color: COLORES[actual.color], ancho: GROSORES[actual.grosor], puntos: actual.puntos }, actual.puntos.length - 1);
      // Un trazo muy largo se corta en dos, para que el documento no crezca de más.
      if (actual.puntos.length >= MAX_PUNTOS) { const ult = actual.puntos[actual.puntos.length - 1]; cerrarTrazo(); actual = { color, grosor, puntos: [ult] }; }
    }
    programar();
  });
  for (const tipo of ['pointerup', 'pointercancel', 'pointerleave']) l.canvas.addEventListener(tipo, () => cerrarTrazo());

  const botonesColor = COLORES.map((c, i) => h('button', {
    class: 'pz-color' + (i === color ? ' activo' : '') + (i === GOMA ? ' goma' : ''), style: { '--c': c },
    'aria-label': i === GOMA ? 'Goma' : 'Color ' + (i + 1), title: i === GOMA ? 'Goma' : '',
    onclick: () => { color = i; botonesColor.forEach((b, k) => b.classList.toggle('activo', k === i)); },
  }, i === GOMA ? '🧽' : ''));
  const botonesGrosor = GROSORES.map((g, i) => h('button', {
    class: 'pz-grosor' + (i === grosor ? ' activo' : ''), 'aria-label': ['Fino', 'Medio', 'Grueso'][i],
    onclick: () => { grosor = i; botonesGrosor.forEach((b, k) => b.classList.toggle('activo', k === i)); },
  }, h('span', { style: { width: (6 + i * 7) + 'px', height: (6 + i * 7) + 'px' } })));

  let enviado = false;
  const mandar = async (accion) => {
    if (enviado) return;
    enviado = true;
    el.querySelectorAll('.dibujo-botones button').forEach((b) => { b.disabled = true; });
    try { await sala.responder({ ronda: j.turno, paso: secreto.n, accion }); } catch (e) { toast(e.message, 'error'); enviado = false; }
  };

  const reloj = h('span', { class: 'reloj' });
  montar(el,
    h('div', { class: 'dibujo-cab' },
      h('div', { class: 'pila-s' }, h('span', { class: 'etiqueta' }, 'Dibujá sin letras'), h('div', { class: 'dibujo-palabra' }, secreto.palabra)),
      reloj),
    h('div', { class: 'dibujo-marco' }, l.canvas),
    h('div', { class: 'pz-barra' }, botonesColor),
    h('div', { class: 'pz-barra' }, botonesGrosor,
      h('button', { class: 'btn sec chico', onclick: () => { actual = null; trazos.pop(); repintar(); programar(); } }, '↶ Deshacer'),
      h('button', { class: 'btn sec chico', onclick: () => { actual = null; trazos = []; repintar(); programar(); } }, '🗑 Borrar')),
    h('div', { class: 'mimica-botones dibujo-botones' + (j.modo === 'todos' ? ' todos' : '') },
      ...(j.modo === 'todos'
        ? sala.equipos().map((e) => h('button', { class: 'btn ok', style: { background: e.color }, onclick: () => mandar('acierto:' + e.id) }, '✓ ' + e.nombre))
        : [h('button', { class: 'btn ok grande', onclick: () => mandar('acierto') }, '✓ ¡Adivinaron!')]),
      h('button', { class: 'btn sec grande', onclick: () => mandar('paso') }, '⏭ Pasar')));
  l.ajustar();
  repintar();
  // Lienzo en blanco para esta palabra (borra en la tele lo de la palabra anterior).
  programar();
  const finReloj = cuentaRegresiva(reloj, j.hasta);
  return () => { terminado = true; clearTimeout(timer); finReloj?.(); l.soltar(); };
}

// Modo pizarra: el celular de quien dibuja solo muestra la palabra, bien grande, y un botón para pasar.
function palabraParaPizarra(el, sala, j, secreto) {
  let enviado = false;
  const pasar = h('button', { class: 'btn sec grande', onclick: async () => {
    if (enviado) return;
    enviado = true; pasar.disabled = true;
    try { await sala.responder({ ronda: j.turno, paso: secreto.n, accion: 'paso' }); } catch (e) { toast(e.message, 'error'); enviado = false; pasar.disabled = false; }
  } }, '⏭ Pasar esta palabra');
  const reloj = h('span', { class: 'reloj grande' });
  montar(el, h('div', { class: 'pila centro dibujo-pizarra' },
    h('div', { class: 'fila entre' }, h('span', { class: 'etiqueta' }, 'Dibujá en la pizarra'), reloj),
    h('div', { class: 'dibujo-palabra enorme' }, secreto.palabra),
    h('p', { class: 'muted' }, 'Sin letras ni números. Cuando adivinen, el organizador lo marca y te sale la próxima.'),
    pasar));
  return cuentaRegresiva(reloj, j.hasta);
}
