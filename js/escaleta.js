// La noche, paso a paso: el guion de la fiesta dentro del panel. Muestra qué viene, qué
// configurar y qué decir, para que cualquiera pueda llevar la fiesta (Ale también juega).
// El paso actual se guarda en la sala (campo «escaleta»), así lo ve igual el otro dispositivo.
import { h, montar, toast } from './util.js';
import { juego as buscarJuego } from './juegos/index.js';
import { mensajeError } from './fb.js';

export const ESCALETA = [
  { icono: '🚪', titulo: 'Llegada', nota: 'La tele muestra el QR. Cada uno entra con su nombre mientras saluda.', decir: 'Escaneen el QR de la tele y pongan su nombre.' },
  { icono: '🎬', titulo: 'Intro de la noche', pantalla: 'intro', nota: 'La tele pasa la apertura con fanfarria. Subí el volumen y tocá «Poner la intro».', decir: '¡Mírenla! Empieza la fiesta.' },
  { icono: '🎩', titulo: 'Selección de equipos', juego: 'seleccion', nota: '4 equipos. Para cada invitado tocá el equipo al que lo mandás, o «Que decida la suerte».', decir: 'El sombrero decide los equipos. Miren la tele.' },
  { icono: '📊', titulo: 'Los invitados dicen', juego: 'encuesta', nota: '4 rondas rotando (cada equipo juega 2); los puntos van a la tabla general. 5 respuestas por pregunta, 1 punto cada una. Al revelar se ve cuántas personas la dijeron. Con globos: dos inflados en una mesita frente a la tele por cada cara a cara (llevá 12 a 15). Tocás «Acertó» o «✗ Respuesta incorrecta». Tres errores seguidos terminan la ronda. Si nadie sabe las que faltan, «cerrar la ronda». Si empatan, desempate por aproximación (+1 al más cercano).', decir: 'Pasa uno de cada equipo y explotan el globo. El primero responde: si dice la más votada, sigue su equipo; si no, prueba el rival y sigue el que dijo la más votada. Cada respuesta vale un punto. El equipo sigue hasta completar el tablero o errar; si erra, tiene la chance el rival, y si el rival también erra, el primero tiene una última chance.' },
  { icono: '✏️', titulo: 'Dibujá en Springfield', juego: 'dibujo', nota: 'Modo «todos adivinan», 1 minuto por turno, 2 vueltas (unos 10 minutos).', decir: 'Uno dibuja en el celular y el dibujo sale en la tele. Adivinan todos a los gritos: el primer equipo que la dice suma 10 y el que dibuja, 5. Nada de letras.' },
  { icono: '📺', titulo: 'Pausa · Noticiero de Springfield', pantalla: 'noticiero', nota: 'Comida. La tele pasa el noticiero con lo que va de la noche. Podés mandar avisos.', decir: 'A comer. En la tele pasa el noticiero de Springfield con cómo va la noche.' },
  { icono: '⚡', titulo: 'Trivia · Springfield', juego: 'quiz', nota: 'Modo «Con castigo»: 8 preguntas, 15 segundos. Vota solo el capitán (rota en cada pregunta). La del contrato sale siempre. Prendas de 20 segundos como mucho.', decir: 'Miren la tele y discutan en voz alta. Vota solo el capitán: le sale la corona en el celular. El equipo que se equivoca paga una prenda.' },
  { icono: '📼', titulo: '¿Te acordás de la escena?', juego: 'escenas', nota: '2 escenas (Cleto y las mascotas), 1 minuto cada una. Revisá rápido en el panel y revelá: la gente espera.', decir: 'Miren la escena en la tele y escriban en el celular todo lo que se acuerden. Suma lo de todo el equipo.' },
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
