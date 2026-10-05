// Podio final: revela las posiciones de a una, del último al primero, con suspenso y papelitos.
import { h, montar, vista, esperando } from './comun.js';
import { sonido, vibrar, confeti } from '../util.js';

// Posiciones con empates: dos equipos con los mismos puntos comparten el puesto.
function posiciones(sala) {
  const eqs = [...sala.equipos()].sort((a, b) => b.puntos - a.puntos);
  let pos = 0, ant = null;
  return eqs.map((e, i) => {
    if (e.puntos !== ant) { pos = i + 1; ant = e.puntos; }
    return { ...e, pos };
  });
}

const MEDALLA = { 1: '🥇', 2: '🥈', 3: '🥉' };

// Sentencia personal: cuando termina el podio, cada invitado recibe en el celular un fallo de
// Lionel Hutz. Sale siempre el mismo para la misma persona (depende de su uid).
const FALLOS = [
  'Culpable de divertirse demasiado. Pena: bailar el próximo tema.',
  'Inocente por falta de pruebas. Se recomienda no comentar dónde estuvo durante el escape.',
  'Pena: brindar con Ale antes de irse.',
  'Absolución total, a cambio de una porción de torta para el abogado.',
  'Pena: contar su mejor anécdota con Ale en la próxima juntada.',
  'Libertad condicional: puede volver a Springfield el año que viene.',
  'Pena: sacarse una foto con Ale en los próximos diez minutos.',
  'Culpable de haber estado en el mejor cumple del año. No hay apelación.',
  'Se le otorga el título de Empleado del Mes de la Planta Nuclear. Sin aumento.',
  'Pena: cantar el próximo feliz cumpleaños más fuerte que nadie.',
  'Queda obligado a pasarle a Ale todas las fotos de esta noche.',
  'Sobreseimiento: el jurado lo vio comer torta, pero no le importó.',
];
const indice = (uid, n) => [...String(uid)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 11) % n;
const CONDENA_EQUIPO = {
  1: 'Además, por ganar la noche: no lava ni un plato.',
  2: 'Además, por el segundo puesto: elige la próxima canción.',
};

export function sentencia(nombre, equipo, pos, uid) {
  return h('div', { class: 'sentencia' },
    h('div', { class: 'sentencia-cab' }, 'Sentencia · Causa «la torta de Ale»'),
    h('p', null, 'Visto el expediente de ', h('b', null, nombre), ` (${equipo}, ${pos}° puesto), este tribunal resuelve:`),
    h('p', { class: 'sentencia-fallo' }, FALLOS[indice(uid, FALLOS.length)]),
    CONDENA_EQUIPO[pos] && h('p', null, CONDENA_EQUIPO[pos]),
    h('p', { class: 'sentencia-firma' }, 'Lionel Hutz', h('br'), h('small', null, 'Abogado. Springfield, 8 de noviembre.')));
}

export default {
  id: 'podio',
  nombre: 'Podio final',
  icono: '🏆',
  resumen: 'Revela el ranking de equipos de a uno, del último al campeón.',
  tipos: [],
  sinMarcador: true,
  sinCelulares: true,

  configurar({ sala }) {
    return {
      el: h('p', { class: 'muted' }, `Se revelan los ${sala.equipos().length} equipos de a uno, desde el último puesto. Los puntos se congelan al empezar.`),
      leer: () => ({}),
    };
  },

  async iniciar(sala) {
    // Se guarda una foto del ranking: si después alguien suma puntos, el podio no cambia.
    await sala.iniciarJuego({ tipo: 'podio', revelados: 0, tabla: posiciones(sala).map(({ id, nombre, color, puntos, pos }) => ({ id, nombre, color, puntos, pos })) });
  },

  host(el, sala) {
    return vista({
      clave: () => `${sala.juego.revelados}`,
      dibujar() {
        const j = sala.juego;
        const total = j.tabla.length;
        const proximo = j.tabla[total - 1 - j.revelados];
        montar(el,
          h('ol', { class: 'ranking' }, j.tabla.map((e, i) => h('li', { style: { '--c': e.color }, class: i >= total - j.revelados ? '' : 'oculto' },
            h('span', { class: 'rk-pos' }, e.pos + '°'), h('span', { class: 'rk-nombre' }, e.nombre), h('span', { class: 'rk-pts' }, e.puntos + ' pts')))),
          proximo
            ? h('button', { class: 'btn grande', onclick: () => sala.actualizarJuego({ revelados: j.revelados + 1 }) },
              proximo.pos === 1 ? '🏆 Revelar al campeón' : `Revelar el ${proximo.pos}° puesto`)
            : h('p', { class: 'grande' }, '¡Listo! 🎉'));
      },
    });
  },

  alumno(el, sala) {
    return vista({
      clave: () => `${sala.juego.revelados}`,
      dibujar() {
        const j = sala.juego;
        const mio = sala.data.asignaciones?.[sala.uid];
        const total = j.tabla.length;
        const yo = j.tabla.findIndex((e) => e.id === mio);
        if (yo < 0 || yo < total - j.revelados) { montar(el, esperando('Revelando el podio…', 'Mirá la pantalla grande.')); return; }
        const e = j.tabla[yo];
        if (yo === total - j.revelados) {
          vibrar(e.pos === 1 ? [200, 80, 200, 80, 400] : 120);
          if (e.pos === 1) confeti([e.color, '#F2C94C', '#FFFFFF']);
        }
        const nombre = sala.miNombre || sala.jugadores.get(sala.uid)?.nombre || 'Invitado';
        montar(el, h('div', { class: 'resultado mi-equipo', style: { '--c': e.color } },
          h('div', { class: 'etiqueta' }, e.nombre),
          h('div', { class: 'resultado-titulo' }, `${MEDALLA[e.pos] || ''} ${e.pos}° puesto`),
          h('p', null, `${e.puntos} puntos`)),
          j.revelados >= total && sentencia(nombre, e.nombre, e.pos, sala.uid));
      },
    });
  },

  tv(el, sala) {
    return vista({
      clave: () => `${sala.juego.revelados}`,
      dibujar() {
        const j = sala.juego;
        const total = j.tabla.length;
        if (!j.revelados) {
          montar(el, h('div', { class: 'tv-centro' }, h('div', { class: 'tv-icono' }, '🏆'), h('h1', { class: 'tv-titulo enorme' }, 'El podio'),
            h('p', { class: 'tv-sub' }, '¿Quién ganó la noche?')));
          return;
        }
        const nuevo = j.tabla[total - j.revelados];
        const visibles = j.tabla.slice(total - j.revelados);
        montar(el, h('div', { class: 'tv-centro' },
          h('div', { class: 'tv-etiqueta' }, nuevo.pos === 1 ? '¡Campeón de la noche!' : `${nuevo.pos}° puesto`),
          h('h1', { class: 'tv-titulo enorme podio-nuevo', style: { color: nuevo.color } }, `${MEDALLA[nuevo.pos] || ''} ${nuevo.nombre}`),
          h('p', { class: 'tv-sub' }, `${nuevo.puntos} puntos`, j.revelados >= total ? ' · Miren el celular: Hutz dictó una sentencia para cada uno' : ''),
          h('ol', { class: 'ranking podio-lista' }, visibles.map((e) => h('li', { style: { '--c': e.color } },
            h('span', { class: 'rk-pos' }, e.pos + '°'), h('span', { class: 'rk-nombre' }, e.nombre), h('span', { class: 'rk-pts' }, e.puntos + ' pts'))))));
        if (nuevo.pos === 1) { sonido('fin'); confeti(); setTimeout(() => confeti(), 1200); }
        else sonido('bien');
      },
    });
  },
};
