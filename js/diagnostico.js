// Diagnóstico (?diagnostico, o ?diagnostico=ABCD para revisar también una sala): comprueba en
// segundos que este dispositivo llega a Firebase, cuánto tarda y si la sala está lista.
// Sirve para verificar un Firebase nuevo y el día de la fiesta, antes de que llegue la gente.
import { asegurarSesion, usuario, esDocente, mensajeError, db, doc, getDoc, getDocs, collection } from './fb.js';
import { firebaseConfig } from './config.js';
import { h, montar, urlApp } from './util.js';

const LENTO_MS = 800;

export function iniciarDiagnostico(raiz, codigoUrl) {
  const codigo = (codigoUrl || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const lista = h('ul', { class: 'lista diag' });
  const resumen = h('p', { class: 'diag-resumen', role: 'status' }, 'Revisando…');
  const otraVez = h('button', { class: 'btn', onclick: () => correr() }, 'Probar de nuevo');
  montar(raiz, h('main', { class: 'centrado' }, h('div', { class: 'tarjeta ingreso pila' },
    h('div', { class: 'marca' }, 'Cumple Ale 🩺'),
    h('h1', null, 'Diagnóstico'),
    h('p', { class: 'muted' }, codigo ? `Revisa este dispositivo y la sala ${codigo}.` : 'Revisa que este dispositivo pueda jugar.'),
    lista, resumen, otraVez,
    h('a', { class: 'btn-link', href: urlApp('') }, '← Volver'))));

  async function correr() {
    otraVez.disabled = true;
    lista.replaceChildren();
    resumen.textContent = 'Revisando…';
    let fallas = 0;
    let avisos = 0;
    const fila = (estado, texto, detalle = '') => {
      if (estado === 'mal') fallas++;
      if (estado === 'aviso') avisos++;
      const icono = { bien: '✅', aviso: '⚠️', mal: '❌' }[estado];
      lista.append(h('li', { class: 'diag-fila ' + estado }, h('span', null, icono), h('span', { class: 'pila-s' }, h('b', null, texto), detalle && h('span', { class: 'muted chico' }, detalle))));
    };

    fila(navigator.onLine ? 'bien' : 'mal', navigator.onLine ? 'Hay red' : 'Sin red', navigator.onLine ? '' : 'Conectate al wifi o activá los datos.');
    const propio = firebaseConfig.projectId !== 'juegos-aula';
    fila(propio ? 'bien' : 'aviso', `Firebase: ${firebaseConfig.projectId}`, propio ? 'Proyecto propio de la fiesta.' : 'Prestado de juegos-aula. Antes del cumple conviene pasar a uno propio.');

    let u = null;
    try {
      const t0 = performance.now();
      u = await conTiempo(asegurarSesion(), 15000);
      fila('bien', 'Sesión iniciada', `${Math.round(performance.now() - t0)} ms`);
    } catch (e) {
      fila('mal', 'No se pudo iniciar sesión', mensajeError(e));
    }

    if (u) {
      try {
        const tiempos = [];
        for (let i = 0; i < 3; i++) {
          const t0 = performance.now();
          await conTiempo(getDoc(doc(db, 'salas', 'ZZZZ')), 10000);
          tiempos.push(performance.now() - t0);
        }
        const ms = Math.round(tiempos.sort((a, b) => a - b)[1]);
        fila(ms < LENTO_MS ? 'bien' : 'aviso', `Firebase responde en ${ms} ms`, ms < LENTO_MS ? 'Rápido.' : 'Anda lento: probá con otra red o acercate al router.');
      } catch (e) {
        fila('mal', 'Firebase no responde', mensajeError(e));
      }
    }

    if (u && codigo) {
      try {
        const s = await conTiempo(getDoc(doc(db, 'salas', codigo)), 10000);
        if (!s.exists()) fila('mal', `La sala ${codigo} no existe`, 'Abrila desde el panel.');
        else {
          const d = s.data();
          const horas = (d.expira.toMillis() - Date.now()) / 3600e3;
          if (horas <= 0) fila('mal', `La sala ${codigo} venció`, 'Abrí una nueva desde el panel.');
          else fila(horas < 4 ? 'aviso' : 'bien', `Sala ${codigo} abierta`, `Le quedan ${horas.toFixed(1)} horas${horas < 4 ? ': puede vencer antes de que termine la fiesta' : ''}.`);
          const jug = await getDocs(collection(db, 'salas', codigo, 'jugadores'));
          fila('bien', `${jug.size} ${jug.size === 1 ? 'invitado conectado' : 'invitados conectados'}`, `${d.equipos?.length || 0} equipos.`);
          if (d.piezas?.largo) fila('bien', 'Código final cargado', `${d.piezas.largo} piezas para repartir.`);
          else fila('aviso', 'Falta el código final del escape', 'Cargalo en el panel de la sala para poder dar piezas.');
        }
      } catch (e) {
        fila('mal', `No se pudo leer la sala ${codigo}`, mensajeError(e));
      }
    }

    const quien = await usuario();
    if (esDocente(quien)) fila('bien', `Organizador: ${quien.displayName || quien.email}`, 'Este dispositivo puede manejar el panel.');
    if ('wakeLock' in navigator) fila('bien', 'Pantalla siempre encendida disponible');
    else fila('aviso', 'Este navegador no puede mantener la pantalla encendida', 'Para la tele, desactivá el apagado automático de pantalla.');

    resumen.textContent = fallas ? `❌ Hay ${fallas} ${fallas === 1 ? 'problema' : 'problemas'}.` : avisos ? '⚠️ Funciona, con avisos.' : '✅ Todo listo para jugar.';
    resumen.className = 'diag-resumen ' + (fallas ? 'mal' : avisos ? 'aviso' : 'bien');
    otraVez.disabled = false;
  }

  correr();
}

function conTiempo(promesa, ms) {
  return Promise.race([promesa, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('Tardó demasiado: no hay conexión con el servidor.'), { code: 'unavailable' })), ms))]);
}
