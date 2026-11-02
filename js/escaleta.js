// La noche, paso a paso: el guion de la fiesta dentro del panel. Muestra qué viene, qué
// configurar y qué decir, para que cualquiera pueda llevar la fiesta (Ale también juega).
// El paso actual se guarda en la sala (campo «escaleta»), así lo ve igual el otro dispositivo.
import { h, montar, toast } from './util.js';
import { juego as buscarJuego } from './juegos/index.js';
import { mensajeError } from './fb.js';

export const ESCALETA = [
  { icono: '🚪', titulo: 'Llegada', nota: 'La tele muestra el QR. Cada uno entra con su nombre mientras saluda.', decir: 'Escaneen el QR de la tele y pongan su nombre.' },
  { icono: '🎬', titulo: 'Intro de la noche', pantalla: 'intro', nota: 'La tele pasa la apertura con fanfarria. Subí el volumen y tocá «Poner la intro».', decir: '¡Mírenla! Empieza la fiesta.' },
  { icono: '🎩', titulo: 'Selección de equipos', juego: 'seleccion', nota: '4 equipos. Tocá «Empezar la ceremonia».', decir: 'El sombrero decide los equipos. Miren la tele.' },
  { icono: '📊', titulo: 'Los invitados dicen', juego: 'encuesta', nota: '4 rondas en llaves (dos cruces, perdedores entre sí y final doble), unos 20 minutos. Elegí las 4 preguntas al configurar. Con globos: dos inflados en una mesita frente a la tele por cada cara a cara (llevá 12 a 15). Marcás vos lo que dicen en voz alta.', decir: 'Dos equipos por ronda. Cara a cara: el primero que explota el globo responde en voz alta. El que gana elige si juega o pasa. Tres errores y el otro equipo roba.' },
  { icono: '✏️', titulo: 'Dibujá en Springfield', juego: 'dibujo', nota: '1 minuto y medio por turno, 2 vueltas (15 a 18 minutos).', decir: 'Uno dibuja en el celular y el dibujo sale en la tele. Su equipo grita hasta adivinar. Nada de letras.' },
  { icono: '📺', titulo: 'Pausa · Noticiero de Springfield', pantalla: 'noticiero', nota: 'Comida. La tele pasa el noticiero con lo que va de la noche. Podés mandar avisos.', decir: 'A comer. En la tele pasa el noticiero de Springfield con cómo va la noche.' },
  { icono: '⚡', titulo: 'Trivia · Springfield', juego: 'quiz', nota: 'Modo «Con castigo»: 8 preguntas, 20 segundos. La del contrato sale siempre.', decir: 'Hablen en el equipo y voten: gana la opción más votada. El equipo que se equivoca paga una prenda.' },
  { icono: '🧉', titulo: 'Frases en argentino', juego: 'frases', nota: '10 frases, 30 segundos. Modo celular o a los gritos. Con 💡 das la pista de quién la dice.', decir: 'La tele muestra una frase de Los Simpson dicha en argentino. Adivinen cuál es la original.' },
  { icono: '📼', titulo: '¿Te acordás de la escena?', juego: 'escenas', nota: '3 escenas, 1 minuto y medio cada una. Antes de revelar, revisá en el panel lo que escribieron.', decir: 'Miren la escena en la tele y escriban en el celular todo lo que se acuerden. Suma lo de todo el equipo.' },
  { icono: '🎂', titulo: 'Momento torta', juego: 'velitas', nota: 'Apagá las luces. Todos levantan el celular: son las velitas.', decir: '¡Arriba los celulares! Cuando Ale sople, se apagan todas.' },
  { icono: '🏆', titulo: 'Podio y sentencias', juego: 'podio', nota: 'Del último al campeón. Al final cada uno ve su sentencia en el celular.', decir: 'Revelamos el podio. Después miren el celular: Hutz dictó una sentencia para cada uno.' },
];

export function panelEscaleta(sala, { abrirJuego }) {
  const aviso = h('input', { class: 'campo', id: 'aviso-tv', maxlength: 90, placeholder: 'Ej.: Las pizzas salen en 5 minutos', autocomplete: 'off' });
  const cuerpo = h('div', { class: 'pila' });
  const el = h('section', { class: 'tarjeta pila escaleta' }, cuerpo);
  let clave = '';

  const ir = (n) => sala.actualizar({ escaleta: Math.max(0, Math.min(ESCALETA.length - 1, n)), pantalla: null }).catch((e) => toast(mensajeError(e), 'error'));
  const pantalla = (valor) => sala.actualizar({ pantalla: valor }).catch((e) => toast(mensajeError(e), 'error'));

  function refrescar() {
    if (!sala.data) return;
    const n = sala.data.escaleta || 0;
    const enJuego = !!sala.juego;
    const noticiero = sala.data.pantalla === 'noticiero';
    const enIntro = sala.data.pantalla === 'intro';
    const k = `${n}:${enJuego}:${noticiero}:${enIntro}:${sala.data.introT || 0}:${sala.data.avisoTv || ''}`;
    if (k === clave) return;
    clave = k;
    const p = ESCALETA[n];
    const def = p.juego && buscarJuego(p.juego);
    if (document.activeElement !== aviso) aviso.value = sala.data.avisoTv || '';
    montar(cuerpo,
      h('div', { class: 'fila entre' },
        h('h2', null, '🗓 La noche, paso a paso'),
        h('span', { class: 'muted chico mono' }, `${n + 1} de ${ESCALETA.length}`)),
      h('div', { class: 'escaleta-actual' },
        h('div', { class: 'escaleta-icono' }, p.icono),
        h('div', { class: 'pila-s' },
          h('b', { class: 'grande' }, p.titulo),
          h('span', null, p.nota),
          p.decir && h('span', { class: 'muted chico' }, '🎤 «', p.decir, '»'),
          p.pieza && h('span', { class: 'pieza-recordatorio chico' }, '🧩 Al terminar, dale la pieza al equipo ganador.'))),
      h('div', { class: 'fila' },
        def && !enJuego && h('button', { class: 'btn', onclick: () => abrirJuego(def) }, `▶ Abrir ${def.nombre}`),
        p.pantalla === 'noticiero' && !enJuego && h('button', { class: noticiero ? 'btn sec' : 'btn', onclick: () => pantalla(noticiero ? null : 'noticiero') },
          noticiero ? 'Volver al QR en la tele' : '📺 Poner el noticiero'),
        p.pantalla === 'intro' && !enJuego && h('button', { class: enIntro ? 'btn sec' : 'btn', onclick: () => sala.actualizar({ pantalla: 'intro', introT: Date.now() }).catch((e) => toast(mensajeError(e), 'error')) },
          enIntro ? '↻ Repetir la intro' : '🎬 Poner la intro'),
        p.pantalla === 'intro' && enIntro && h('button', { class: 'btn sec', onclick: () => pantalla(null) }, 'Volver al QR en la tele'),
        h('button', { class: 'btn sec', disabled: n === 0, onclick: () => ir(n - 1) }, '←'),
        h('button', { class: 'btn sec', disabled: n === ESCALETA.length - 1, onclick: () => ir(n + 1) }, 'Siguiente paso →')),
      (noticiero || p.pantalla === 'noticiero') && h('form', { class: 'fila', onsubmit: (ev) => {
        ev.preventDefault();
        sala.actualizar({ avisoTv: aviso.value.trim() }).then(() => toast(aviso.value.trim() ? 'Aviso en la tele' : 'Aviso borrado', 'ok'));
      } }, aviso, h('button', { class: 'btn sec', type: 'submit' }, 'Mandar aviso')),
      h('details', null,
        h('summary', { class: 'muted chico' }, 'Ver toda la noche'),
        h('ol', { class: 'escaleta-lista' }, ESCALETA.map((x, i) => h('li', { class: i < n ? 'hecho' : i === n ? 'actual' : '' },
          h('button', { class: 'btn-link', onclick: () => ir(i) }, `${x.icono} ${x.titulo}`))))));
  }
  return { el, refrescar };
}
