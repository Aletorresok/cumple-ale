// Narrador de la fiesta con voz grave y lenta «tipo Homero»: comenta cuando empieza y termina cada
// juego, lee los titulares del noticiero y dice lo que quien organiza escriba en el panel.
// No es la voz real del actor: es la voz de síntesis del navegador de la tele, bajada de tono y de
// velocidad. Se afina desde la tele (botón «🎙 Voz»), porque las voces dependen de ese navegador.
import { h, montar, leerLocal, guardarLocal, toast } from './util.js';
import { voz, PRESETS, vocesEs, decir } from './audio.js';
import { mensajeError } from './fb.js';

const LINEAS = {
  seleccion: {
    inicio: ['¡Mmm… los equipos! Ojalá me toque el de las donas.', 'Vamos a ver quién va con quién. Yo me pido la Taberna de Moe.'],
    fin: ['Equipos listos. Que gane el mejor… o sea, yo.'],
  },
  encuesta: {
    inicio: ['Los invitados dicen. A ver qué respondió la gente… yo diría que donas.', 'Adivinen lo que más respondieron. No es tan difícil.'],
  },
  mimica: {
    inicio: ['Mímica. Hablar es de cobardes.', 'Ahora actúen sin decir una palabra. Qué difícil para mí.'],
  },
  quiz: {
    inicio: ['Trivia. Que nadie mire el celular del de al lado.', 'Preguntas, preguntas… yo prefiero las donas.'],
  },
  escape: {
    inicio: ['Llegó una carta documento de Lionel Hutz. Eso nunca es bueno.', 'A escapar. Yo ya me quiero ir por la comida.'],
  },
  velitas: {
    inicio: ['Se apagan las luces. Todos arriba con el celular.', 'Es la hora de la torta. Mi momento favorito.'],
    fin: ['¡Feliz cumpleaños, Ale! Y guardame una porción.'],
  },
  podio: {
    inicio: ['Y ahora, el podio. Redoble de tambores.'],
    fin: ['Eso fue todo. ¡Felicitaciones a los campeones y gracias por venir!'],
  },
};
const AL_AZAR = (l) => l[Math.floor(Math.random() * l.length)];

// Panel del organizador: prende el narrador y le hace decir lo que escribas.
export function panelNarrador(sala) {
  const campo = h('input', { class: 'campo', maxlength: 120, placeholder: 'Que diga: «Las pizzas salen en cinco minutos»', autocomplete: 'off' });
  const boton = h('button', { class: 'btn sec', onclick: () => sala.actualizar({ narrador: !sala.data?.narrador }).catch((e) => toast(mensajeError(e), 'error')) });
  const el = h('section', { class: 'tarjeta pila' },
    h('h2', null, '🎙 Narrador'),
    h('p', { class: 'muted chico' }, 'Con la voz grave y lenta tipo Homero, comenta cada juego, lee el noticiero y dice lo que escribas. La voz se afina en la tele, con el botón «🎙 Voz» (aparece al mover el mouse).'),
    h('div', { class: 'fila' }, boton),
    h('form', { class: 'fila', onsubmit: (ev) => {
      ev.preventDefault();
      const texto = campo.value.trim();
      if (!texto) return;
      campo.value = '';
      sala.aTv({ decir: { texto, t: Date.now() } }).catch((e) => toast(mensajeError(e), 'error'));
    } }, campo, h('button', { class: 'btn', type: 'submit' }, '🗣 Decir')));
  const refrescar = () => { boton.textContent = sala.data?.narrador ? '🎙 Narrador prendido (tocá para apagar)' : '🎙 Prender el narrador'; boton.className = sala.data?.narrador ? 'btn' : 'btn sec'; };
  refrescar();
  return { el, refrescar };
}

// Pantalla grande: devuelve la función a llamar en cada cambio de la sala.
export function vigilarNarrador() {
  Object.assign(voz, PRESETS.homero, leerLocal('vozTv', {}));
  let juegoVisto; // undefined hasta la primera actualización: al recargar la tele no narra lo que ya pasó
  let tipoAntes = null;
  let decirVisto = null;
  return (sala) => {
    voz.activa = !!sala.data?.narrador;
    if (sala.tv) { // lo que escribe el organizador llega por recursos/tv
      const d = sala.tv.decir;
      if (decirVisto === null) decirVisto = d?.t ?? 0;
      else if (d && d.t !== decirVisto) { decirVisto = d.t; decir(d.texto); }
    }
    const id = sala.juego?.id || null;
    if (juegoVisto === undefined) { juegoVisto = id; tipoAntes = sala.juego?.tipo || null; return; }
    if (id === juegoVisto) return;
    const cambio = { desde: tipoAntes, hacia: sala.juego?.tipo || null };
    juegoVisto = id; tipoAntes = cambio.hacia;
    if (!voz.activa) return;
    if (cambio.desde && !cambio.hacia) { const fin = LINEAS[cambio.desde]?.fin; if (fin) decir(AL_AZAR(fin)); }
    else if (cambio.hacia) { const ini = LINEAS[cambio.hacia]?.inicio; if (ini) decir(AL_AZAR(ini)); }
  };
}

// Botón «🎙 Voz» de la tele: voz, tono y velocidad, con presets y una prueba.
export function afinadorVoz() {
  const guardar = () => guardarLocal('vozTv', { nombre: voz.nombre, tono: voz.tono, vel: voz.vel });
  const caja = h('div', { class: 'afinador', hidden: true });
  const boton = h('button', { class: 'tv-boton', onclick: () => { caja.hidden = !caja.hidden; if (!caja.hidden) dibujar(); } }, '🎙 Voz');

  function dibujar() {
    const voces = vocesEs();
    const tono = h('input', { type: 'range', min: 0, max: 2, step: 0.05, value: voz.tono, oninput: (e) => { voz.tono = Number(e.target.value); guardar(); } });
    const vel = h('input', { type: 'range', min: 0.5, max: 1.5, step: 0.05, value: voz.vel, oninput: (e) => { voz.vel = Number(e.target.value); guardar(); } });
    const preset = (nombre) => () => { Object.assign(voz, PRESETS[nombre]); guardar(); dibujar(); };
    montar(caja,
      h('label', null, 'Voz', voces.length
        ? h('select', { onchange: (e) => { voz.nombre = e.target.value; guardar(); } }, voces.map((v) => h('option', { value: v.name, selected: v.name === voz.nombre }, `${v.name} (${v.lang})`)))
        : h('span', { class: 'muted' }, 'Este navegador no tiene voces en español')),
      h('label', null, 'Tono (grave ↔ agudo)', tono),
      h('label', null, 'Velocidad (lento ↔ rápido)', vel),
      h('div', { class: 'fila' },
        h('button', { class: 'tv-boton', onclick: preset('homero') }, 'Tipo Homero'),
        h('button', { class: 'tv-boton', onclick: preset('normal') }, 'Normal'),
        h('button', { class: 'tv-boton', onclick: () => decir('Mmm… donas. ¡Feliz cumpleaños, Ale!') }, '▶ Probar')));
  }
  try { speechSynthesis.addEventListener('voiceschanged', () => { if (!caja.hidden) dibujar(); }); } catch { /* sin voz */ }
  return { boton, caja };
}
