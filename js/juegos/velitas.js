// Momento torta: con las luces apagadas, cada celular se vuelve una velita encendida y la tele
// muestra el «Feliz cumple». Cuando quien organiza toca «Soplar», se apagan todas a la vez
// (con una pizca de azar, como velas de verdad) y llueven papelitos.
import { h, montar, vista } from './comun.js';
import { sonido, vibrar, confeti } from '../util.js';

const LETRA = ['Que los cumplas feliz,', 'que los cumplas feliz,', 'que los cumplas, {n},', 'que los cumplas feliz.'];

function vela(apagada, demora = 0) {
  return h('div', { class: 'vela' + (apagada ? ' apagada' : ''), style: { '--demora': demora + 'ms' } },
    h('div', { class: 'vela-llama' }), h('div', { class: 'vela-humo' }), h('div', { class: 'vela-cuerpo' }));
}

// Cada celular se apaga con su propia demora, siempre la misma para ese invitado.
const demoraDe = (uid) => [...String(uid)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7) % 900;

export default {
  id: 'velitas',
  nombre: 'Momento torta',
  icono: '🎂',
  resumen: 'Los celulares se vuelven velitas para cantar el feliz cumpleaños, y se apagan al soplar.',
  tipos: [],
  sinMarcador: true,

  configurar() {
    const nombre = h('input', { class: 'campo', id: 'cfg-cumple', value: 'Ale', maxlength: 20 });
    return {
      el: h('div', { class: 'pila' },
        h('label', { class: 'pila-s' }, h('span', { class: 'etq' }, '¿Quién cumple?'), nombre),
        h('p', { class: 'muted chico' }, 'Apagá las luces y pedí que todos levanten el celular. Cuando suene el último «que los cumplas feliz», tocá «Soplar».')),
      leer: () => ({ nombre: nombre.value.trim() || 'Ale' }),
    };
  },

  async iniciar(sala, { nombre }) {
    await sala.iniciarJuego({ tipo: 'velitas', nombre, fase: 'prendidas', soplos: 0 });
  },

  host(el, sala) {
    return vista({
      clave: () => `${sala.juego.fase}`,
      dibujar() {
        const j = sala.juego;
        const prendidas = j.fase === 'prendidas';
        montar(el,
          h('p', { class: 'grande' }, prendidas ? `🕯️ ${sala.jugadores.size} velitas prendidas` : '💨 ¡Sopladas!'),
          h('p', { class: 'muted' }, prendidas ? 'Luces apagadas, celulares en alto, y a cantar.' : 'Si querés repetir (para la foto), volvé a prenderlas.'),
          prendidas
            ? h('button', { class: 'btn grande', onclick: () => sala.actualizarJuego({ fase: 'sopladas', soplos: j.soplos + 1 }) }, '💨 ¡Soplar!')
            : h('button', { class: 'btn sec', onclick: () => sala.actualizarJuego({ fase: 'prendidas' }) }, '🕯️ Prenderlas de nuevo'));
      },
    });
  },

  alumno(el, sala) {
    return vista({
      clave: () => `${sala.juego.fase}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        const prendidas = j.fase === 'prendidas';
        const demora = demoraDe(sala.uid);
        const capa = h('div', { class: 'velita-pantalla' + (prendidas ? '' : ' sopladas') },
          vela(!prendidas, demora),
          h('p', { class: 'velita-texto' }, prendidas ? '¡Levantá el celular!' : `¡Feliz cumple, ${j.nombre}!`));
        montar(el, capa);
        if (!prendidas) {
          const t = setTimeout(() => { vibrar([60, 40, 120]); confeti(); }, demora + 400);
          alLimpiar(() => clearTimeout(t));
        }
      },
    });
  },

  tv(el, sala) {
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.soplos}`,
      dibujar() {
        const j = sala.juego;
        const prendidas = j.fase === 'prendidas';
        const cuantas = Math.max(1, Math.min(sala.jugadores.size, 40));
        montar(el, h('div', { class: 'tv-centro tv-velitas' + (prendidas ? '' : ' sopladas') },
          h('div', { class: 'tv-etiqueta' }, prendidas ? `🕯️ ${sala.jugadores.size} velitas prendidas` : 'Pidió tres deseos'),
          h('h1', { class: 'tv-titulo enorme' }, `¡Feliz cumple, ${j.nombre}!`),
          h('div', { class: 'tv-velas', style: { '--cols': cuantas <= 16 ? cuantas : Math.ceil(cuantas / 2) } }, Array.from({ length: cuantas }, (_, i) => vela(!prendidas, (i * 137) % 900))),
          prendidas
            ? h('div', { class: 'tv-letra' }, LETRA.map((l) => h('div', null, l.replace('{n}', j.nombre))))
            : h('p', { class: 'tv-sub' }, '🎉 ¡Que vengan las porciones!')));
        if (!prendidas) { sonido('fin'); setTimeout(() => confeti(), 600); setTimeout(() => confeti(), 1800); }
      },
    });
  },
};
