// La noche, paso a paso: el guion de la fiesta dentro del panel. Muestra qué viene, qué
// configurar y qué decir, para que cualquiera pueda llevar la fiesta (Ale también juega).
// El paso actual se guarda en la sala (campo «escaleta»), así lo ve igual el otro dispositivo.
import { h, montar, toast } from './util.js';
import { juego as buscarJuego } from './juegos/index.js';
import { mensajeError } from './fb.js';

export const ESCALETA = [
  { icono: '🚪', titulo: 'Llegada', nota: 'La tele muestra el QR. Cada uno entra con su nombre mientras saluda.', decir: 'Escaneen el QR de la tele y pongan su nombre.' },
  { icono: '🎩', titulo: 'Selección de equipos', juego: 'seleccion', nota: '4 equipos. Tocá «Empezar la ceremonia».', decir: 'El sombrero decide los equipos. Miren la tele.' },
  { icono: '📊', titulo: 'Los invitados dicen', juego: 'encuesta', nota: '5 rondas del banco.', pieza: true, decir: 'Hay que adivinar lo que más respondió la gente. Tres errores y otro equipo roba.' },
  { icono: '🕵️', titulo: 'El impostor', juego: 'impostor', nota: '2 o 3 rondas, impostores automáticos.', pieza: true, decir: 'Todos tienen la misma palabra menos uno. Pistas en voz alta y después se vota.' },
  { icono: '🎭', titulo: 'Mímica por equipos', juego: 'mimica', nota: '1 minuto por turno, 2 vueltas.', pieza: true, decir: 'Uno ve la palabra en el celular y la actúa sin hablar.' },
  { icono: '📺', titulo: 'Pausa · Noticiero de Springfield', pantalla: 'noticiero', nota: 'Comida. La tele pasa el noticiero con lo que va de la noche. Podés mandar avisos.', decir: 'Cada equipo que ganó tiene una pieza de un código. Guárdenla para el final.' },
  { icono: '⚡', titulo: 'Trivia · Bien argentina', juego: 'quiz', nota: '10 preguntas, 20 segundos. La del contrato sale siempre.', pieza: true, decir: 'Pregunta en la tele, todos responden desde el celular.' },
  { icono: '⚖️', titulo: 'Escapes de Lionel Hutz', juego: 'escape', nota: 'Modo «Cada equipo su escape». Las tarjetas físicas ya escondidas.', decir: 'Lionel Hutz les mandó una carta documento: cada equipo tiene su expediente.' },
  { icono: '🔐', titulo: 'La sentencia', juego: 'escape', nota: 'Modo cooperativo, escape «La sentencia».', decir: 'Abran los candados entre todos. El último se abre con las piezas: júntense.' },
  { icono: '🎂', titulo: 'Momento torta', juego: 'velitas', nota: 'Apagá las luces. Todos levantan el celular: son las velitas.', decir: '¡Arriba los celulares! Cuando Ale sople, se apagan todas.' },
  { icono: '🏆', titulo: 'Podio y sentencias', juego: 'podio', nota: 'Del último al campeón. Al final cada uno ve su sentencia en el celular.', decir: 'Revelamos el podio. Después miren el celular: Hutz dictó una sentencia para cada uno.' },
];

export function panelEscaleta(sala, { abrirJuego }) {
  const aviso = h('input', { class: 'campo', id: 'aviso-tv', maxlength: 90, placeholder: 'Ej.: Las pizzas salen en 5 minutos', autocomplete: 'off' });
  const cuerpo = h('div', { class: 'pila' });
  const el = h('section', { class: 'tarjeta pila escaleta' }, cuerpo);
  let clave = '';

  const ir = (n) => sala.actualizar({ escaleta: Math.max(0, Math.min(ESCALETA.length - 1, n)) }).catch((e) => toast(mensajeError(e), 'error'));
  const pantalla = (valor) => sala.actualizar({ pantalla: valor }).catch((e) => toast(mensajeError(e), 'error'));

  function refrescar() {
    if (!sala.data) return;
    const n = sala.data.escaleta || 0;
    const enJuego = !!sala.juego;
    const noticiero = sala.data.pantalla === 'noticiero';
    const k = `${n}:${enJuego}:${noticiero}:${sala.data.avisoTv || ''}`;
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
        h('button', { class: 'btn sec', disabled: n === 0, onclick: () => ir(n - 1) }, '←'),
        h('button', { class: 'btn sec', disabled: n === ESCALETA.length - 1, onclick: () => ir(n + 1) }, 'Siguiente paso →')),
      (noticiero || p.pantalla) && h('form', { class: 'fila', onsubmit: (ev) => {
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
