// Selección de equipos (la ceremonia del sombrero, tomada del cumple de Pau): de a uno, cada
// invitado sale en la pantalla grande, los equipos giran con suspenso y se revela adónde va.
// El anfitrión elige a qué equipo va cada uno (para que nadie quede con desconocidos) o deja que
// decida la suerte, que lo manda a uno de los equipos con menos gente.
import { h, montar, vista, selector, esperando, pildoraEquipo, logoEquipo } from './comun.js';
import { LOGOS } from '../config.js';
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

    // Quién pasa ahora: sale uno al azar, pero el anfitrión puede cambiarlo por otro de la lista.
    let candidato = null;
    const elegirCandidato = (uid) => {
      const quedan = pendientes();
      candidato = quedan.find((j) => j.uid === uid)?.uid || mezclar(quedan)[0]?.uid || null;
    };
    const vigente = () => pendientes().find((j) => j.uid === candidato) || null;

    // equipoForzado: el que elige el anfitrión. Sin él, la suerte lo manda a uno de los más chicos.
    async function siguiente(equipoForzado) {
      if (ocupado) return;
      const quedan = pendientes();
      if (!quedan.length) { await sala.actualizarJuego({ fase: 'fin', actual: null }); return; }
      ocupado = true;
      const elegido = vigente() || mezclar(quedan)[0];
      const tam = sala.equipos().map((e) => [e.id, sala.miembros(e.id).length]);
      const min = Math.min(...tam.map(([, n]) => n));
      const equipo = typeof equipoForzado === 'string' ? equipoForzado : mezclar(tam.filter(([, n]) => n === min))[0][0];
      candidato = null;
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

    let zonaCuenta, zonaTurno;
    const pantalla = vista({
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
        zonaTurno = h('div', { class: 'pila' });
        montar(el,
          j.actual && h('div', { class: 'tarjeta suave centro' },
            h('div', { class: 'etiqueta' }, j.fase === 'girando' ? 'Eligiendo equipo para' : 'Quedó en'),
            h('p', { class: 'grande' }, j.actual.nombre),
            j.fase === 'revelado' && pildoraEquipo(sala.equipo(j.actual.equipo))),
          zonaCuenta,
          zonaTurno,
          auto,
          h('button', { class: 'btn-link', onclick: repartirResto }, 'Repartir a todos los que faltan de una vez'));
        pintarTurno();
      },
      refrescar() {
        if (zonaCuenta) zonaCuenta.textContent = `Faltan ${pendientes().length} de ${sala.listaJugadores().length}.`;
        pintarTurno();
      },
    });

    // El turno: quién pasa (al azar, o el que elijas de la lista) y a qué equipo lo mandás.
    function pintarTurno() {
      if (!zonaTurno || sala.juego.fase === 'fin') return;
      const quedan = pendientes();
      const girando = sala.juego.fase === 'girando';
      if (!vigente() && quedan.length) elegirCandidato();
      const c = vigente();
      const firma = `${girando}:${c?.uid}:${quedan.map((q) => q.uid).join(',')}:${sala.equipos().map((e) => e.id + sala.miembros(e.id).length).join(',')}`;
      if (zonaTurno.dataset.firma === firma) return;
      zonaTurno.dataset.firma = firma;
      if (!c) {
        montar(zonaTurno, h('button', { class: 'btn grande', onclick: () => siguiente(), disabled: girando }, 'Terminar la ceremonia'));
        return;
      }
      const lista = h('select', { class: 'campo', id: 'sel-quien', onchange: (e) => { elegirCandidato(e.target.value); pintarTurno(); } },
        quedan.map((q) => h('option', { value: q.uid, selected: q.uid === c.uid }, q.nombre)));
      montar(zonaTurno,
        h('div', { class: 'tarjeta pila' },
          h('div', { class: 'etiqueta' }, 'Pasa ahora'),
          h('div', { class: 'fila nowrap' }, lista,
            h('button', { class: 'btn sec chico', onclick: () => { elegirCandidato(quedan.length > 1 ? mezclar(quedan.filter((q) => q.uid !== c.uid))[0].uid : c.uid); pintarTurno(); } }, '🎲 Otro')),
          h('div', { class: 'etiqueta' }, `Mandá a ${c.nombre} a…`),
          h('div', { class: 'fila' }, sala.equipos().map((e) => h('button', {
            class: 'pildora-boton', style: { '--c': e.color }, disabled: girando, onclick: () => siguiente(e.id),
          }, `${e.nombre} (${sala.miembros(e.id).length})`))),
          h('button', { class: 'btn grande', onclick: () => siguiente(), disabled: girando }, '🎩 Que decida la suerte')));
    }
    return pantalla;
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
            logoEquipo(mio, 'logo-eq enorme'),
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
            h('div', { class: 'tv-grupo-cab' }, h('span', { class: 'fila nowrap' }, logoEquipo(e), e.nombre), h('span', { class: 'mono' }, sala.miembros(e.id).length)),
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
        const logoEq = h('img', { class: 'tv-seleccion-logo', alt: '', hidden: true });
        const ponerLogo = (e) => { const src = e && LOGOS[e.id]; logoEq.hidden = !src; if (src) logoEq.src = src; };
        montar(el, h('div', { class: 'tv-centro' },
          h('div', { class: 'tv-etiqueta' }, j.fase === 'girando' ? '¿A qué equipo va…?' : 'Va al equipo'),
          h('h1', { class: 'tv-titulo enorme' }, j.actual.nombre),
          logoEq, nombreEq), grupos);
        const final = () => {
          ponerLogo(eq);
          logoEq.classList.add('revelado');
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
          ponerLogo(e);
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
