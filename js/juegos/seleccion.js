// Selección de equipos (la ceremonia del sombrero, tomada del cumple de Pau): de a uno, cada
// invitado sale en la pantalla grande, los equipos giran con suspenso y se revela adónde va.
// Los equipos quedan parejos: cada invitado va a uno de los que tienen menos gente.
import { h, montar, vista, selector, esperando, pildoraEquipo } from './comun.js';
import { mezclar, sonido, vibrar, confeti, toast, idAzar } from '../util.js';

const SUSPENSO = 3500;   // ms que giran los equipos antes de revelar
const PAUSA_AUTO = 3000; // ms que queda el resultado en pantalla en modo automático

export default {
  id: 'seleccion',
  nombre: 'Selección de equipos',
  icono: '🎩',
  resumen: 'Ceremonia con suspenso: de a uno, cada invitado descubre su equipo en la pantalla grande.',
  tipos: [],
  sinMarcador: true,

  configurar({ sala }) {
    const modo = selector('cfg-rearmar', 'Quiénes', [['todos', 'Todos (se rearman los equipos)'], ['nuevos', 'Solo los que no tienen equipo']], 'todos');
    return {
      el: h('div', { class: 'pila' }, modo.el,
        h('p', { class: 'muted chico' }, `Hay ${sala.listaJugadores().length} invitados conectados. Los que entren durante la ceremonia también pasan. Los equipos quedan parejos.`)),
      leer: () => ({ rearmar: modo.valor() === 'todos' }),
    };
  },

  async iniciar(sala, { rearmar }) {
    const juego = { tipo: 'seleccion', fase: 'lista', paso: 0, actual: null, hasta: 0, auto: false, id: idAzar() };
    // En una sola escritura: si se vaciaran los equipos antes de empezar, el panel los volvería a repartir solo.
    await sala.actualizar(rearmar ? { juego, asignaciones: {} } : { juego });
  },

  host(el, sala) {
    let timer = null;
    let ocupado = false;
    const pendientes = () => sala.listaJugadores().filter((j) => !j.equipo && j.uid !== sala.juego.actual?.uid);

    async function siguiente() {
      if (ocupado) return;
      const quedan = pendientes();
      if (!quedan.length) { await sala.actualizarJuego({ fase: 'fin', actual: null }); return; }
      ocupado = true;
      const elegido = mezclar(quedan)[0];
      const tam = sala.equipos().map((e) => [e.id, sala.miembros(e.id).length]);
      const min = Math.min(...tam.map(([, n]) => n));
      const equipo = mezclar(tam.filter(([, n]) => n === min))[0][0];
      try {
        await sala.actualizarJuego({ fase: 'girando', paso: sala.juego.paso + 1, actual: { uid: elegido.uid, nombre: elegido.nombre, equipo }, hasta: Date.now() + SUSPENSO });
        clearTimeout(timer);
        timer = setTimeout(revelar, SUSPENSO);
      } catch (e) { toast(e.message, 'error'); ocupado = false; }
    }

    async function revelar() {
      const a = sala.juego?.actual;
      if (!a) { ocupado = false; return; }
      try {
        await sala.asignar({ [a.uid]: a.equipo });
        await sala.actualizarJuego({ fase: 'revelado' });
      } finally { ocupado = false; }
      if (sala.juego?.auto) { clearTimeout(timer); timer = setTimeout(siguiente, PAUSA_AUTO); }
    }

    async function repartirResto() {
      clearTimeout(timer);
      const quedan = mezclar(pendientes());
      const tam = Object.fromEntries(sala.equipos().map((e) => [e.id, sala.miembros(e.id).length]));
      const nuevas = {};
      for (const j of quedan) {
        const eid = Object.entries(tam).sort((a, b) => a[1] - b[1])[0][0];
        nuevas[j.uid] = eid; tam[eid]++;
      }
      await sala.asignar(nuevas);
      await sala.actualizarJuego({ fase: 'fin', actual: null, auto: false });
    }

    let zonaCuenta;
    return vista({
      destruir: () => clearTimeout(timer),
      clave: () => `${sala.juego.fase}:${sala.juego.paso}:${sala.juego.auto}`,
      dibujar() {
        const j = sala.juego;
        // Si se recargó la página en medio de un giro, se retoma.
        if (j.fase === 'girando' && !ocupado) { ocupado = true; timer = setTimeout(revelar, Math.max(0, j.hasta - Date.now())); }
        else if (j.fase === 'revelado' && j.auto && !ocupado) { clearTimeout(timer); timer = setTimeout(siguiente, PAUSA_AUTO); }
        zonaCuenta = h('p', { class: 'muted' });
        const auto = h('label', { class: 'check' },
          h('input', { type: 'checkbox', id: 'sel-auto', checked: !!j.auto, onchange: async (e) => {
            await sala.actualizarJuego({ auto: e.target.checked });
            if (e.target.checked && j.fase !== 'girando') siguiente();
            if (!e.target.checked) clearTimeout(timer);
          } }), 'Pasar solo, uno tras otro');
        if (j.fase === 'fin') {
          montar(el, h('p', { class: 'grande' }, '¡Equipos armados!'),
            h('p', { class: 'muted' }, 'Podés renombrar los equipos tocando su nombre, abajo. Si entra alguien más, va solo al equipo más chico.'),
            h('button', { class: 'btn sec', onclick: siguiente }, 'Seguir con los que entraron'));
          return;
        }
        montar(el,
          j.actual && h('div', { class: 'tarjeta suave centro' },
            h('div', { class: 'etiqueta' }, j.fase === 'girando' ? 'Eligiendo equipo para' : 'Quedó en'),
            h('p', { class: 'grande' }, j.actual.nombre),
            j.fase === 'revelado' && pildoraEquipo(sala.equipo(j.actual.equipo))),
          zonaCuenta,
          h('button', { class: 'btn grande', onclick: siguiente, disabled: j.fase === 'girando' }, j.paso ? 'Siguiente invitado' : 'Empezar la ceremonia'),
          auto,
          h('button', { class: 'btn-link', onclick: repartirResto }, 'Repartir a todos los que faltan de una vez'));
      },
      refrescar() {
        if (zonaCuenta) zonaCuenta.textContent = `Faltan ${pendientes().length} de ${sala.listaJugadores().length}.`;
      },
    });
  },

  alumno(el, sala) {
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.paso}:${sala.data.asignaciones?.[sala.uid] || ''}`,
      dibujar() {
        const j = sala.juego;
        const mio = sala.equipoDe(sala.uid);
        const soyYo = j.actual?.uid === sala.uid;
        if (soyYo && j.fase === 'girando') {
          vibrar([60, 60, 60]);
          montar(el, h('div', { class: 'resultado' }, h('div', { class: 'resultado-titulo' }, '¡Te toca!'), h('p', null, 'Mirá la pantalla grande…')));
          return;
        }
        if (mio) {
          if (soyYo) { vibrar([120, 60, 200]); confeti([mio.color, '#FFFFFF', '#F2C94C']); }
          montar(el, h('div', { class: 'resultado mi-equipo', style: { '--c': mio.color } },
            h('div', { class: 'etiqueta' }, 'Tu equipo es'),
            h('div', { class: 'resultado-titulo' }, mio.nombre),
            h('p', null, 'Buscá a los de tu equipo: están en la pantalla grande.')));
          return;
        }
        montar(el, esperando('Todavía no tenés equipo', 'Mirá la pantalla grande: en cualquier momento salís vos.'));
      },
    });
  },

  tv(el, sala) {
    return vista({
      clave: () => `${sala.juego.fase}:${sala.juego.paso}`,
      dibujar(alLimpiar) {
        const j = sala.juego;
        const grupos = h('div', { class: 'tv-grupos chico' }, sala.equipos().map((e) =>
          h('div', { class: 'tv-grupo', style: { '--c': e.color } },
            h('div', { class: 'tv-grupo-cab' }, h('span', null, e.nombre), h('span', { class: 'mono' }, sala.miembros(e.id).length)),
            h('div', { class: 'tv-nombres' }, sala.miembros(e.id).map((m) => h('span', { class: 'tv-nombre' }, m.nombre))))));
        if (j.fase === 'lista' || j.fase === 'fin' || !j.actual) {
          montar(el, h('div', { class: 'tv-centro' },
            h('div', { class: 'tv-icono' }, '🎩'),
            h('h1', { class: 'tv-titulo' }, j.fase === 'fin' ? '¡Equipos listos!' : 'Selección de equipos'),
            h('p', { class: 'tv-sub' }, j.fase === 'fin' ? 'Que empiecen los juegos.' : 'De a uno, cada invitado va a descubrir su equipo.')), grupos);
          if (j.fase === 'fin') { sonido('fin'); confeti(); }
          return;
        }
        const eq = sala.equipo(j.actual.equipo);
        const nombreEq = h('div', { class: 'tv-seleccion-eq' });
        montar(el, h('div', { class: 'tv-centro' },
          h('div', { class: 'tv-etiqueta' }, j.fase === 'girando' ? '¿A qué equipo va…?' : 'Va al equipo'),
          h('h1', { class: 'tv-titulo enorme' }, j.actual.nombre),
          nombreEq), grupos);
        const final = () => {
          nombreEq.textContent = eq?.nombre || '';
          nombreEq.style.setProperty('--c', eq?.color || '#fff');
          nombreEq.classList.add('revelado');
          sonido('fin');
          confeti([eq?.color || '#F2C94C', '#FFFFFF']);
        };
        if (j.fase === 'revelado') { final(); return; }
        const eqs = sala.equipos();
        let k = Math.floor(Math.random() * eqs.length);
        let espera = 90;
        let t;
        const paso = () => {
          if (Date.now() >= j.hasta) return; // el host revela; mientras tanto sigue girando el último
          const e = eqs[k++ % eqs.length];
          nombreEq.textContent = e.nombre;
          nombreEq.style.setProperty('--c', e.color);
          sonido('tic');
          espera = Math.min(500, espera * 1.1);
          t = setTimeout(paso, espera);
        };
        paso();
        alLimpiar(() => clearTimeout(t));
      },
    });
  },
};
