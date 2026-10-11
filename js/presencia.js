// Presencia: que el panel no se duerma, que la tele avise si pasa, y que los celulares avisen
// que siguen conectados. Todo cuesta pocas escrituras (ver LATIDO_MS y PANEL_LATIDO_MS).
import { db, doc, setDoc } from './fb.js';
import { latir, LATIDO_MS } from './sala.js';
import { h } from './util.js';

export const PANEL_LATIDO_MS = 20 * 1000;
const PANEL_CAIDO_MS = 75 * 1000;

// Pide que la pantalla no se apague mientras la pestaña está abierta y la vuelve a pedir
// al volver a la pestaña. Devuelve una función para soltarla.
export function mantenerPantalla() {
  let lock = null;
  const pedir = async () => {
    try { lock = await navigator.wakeLock?.request('screen'); } catch { lock = null; }
  };
  const alVolver = () => { if (document.visibilityState === 'visible' && (!lock || lock.released)) pedir(); };
  document.addEventListener('visibilitychange', alVolver);
  pedir();
  return () => { document.removeEventListener('visibilitychange', alVolver); lock?.release?.().catch(() => {}); };
}

// El panel (quien controla los juegos) deja una marca cada 20 segundos en recursos/latido.
export function latidoPanel(sala, controlo) {
  const marca = () => {
    if (!controlo()) return;
    setDoc(doc(db, 'salas', sala.codigo, 'recursos', 'latido'), { t: Date.now() }).catch(() => {});
  };
  marca();
  const t = setInterval(marca, PANEL_LATIDO_MS);
  sala.subs.push(() => clearInterval(t));
}

// La tele mira esa marca y muestra un cartel si el panel dejó de avisar durante un juego.
export function vigilarPanel(sala) {
  const cartel = h('div', { class: 'banda-conexion banda-panel', role: 'status', hidden: true },
    '⚠ El panel de control no responde. Que Ale mire su celular o compu: puede estar dormido.');
  let ultimo = 0;
  const revisar = () => {
    const activo = !!(sala.juego || sala.data?.pantalla);
    cartel.hidden = !(activo && ultimo && Date.now() - ultimo > PANEL_CAIDO_MS);
  };
  sala.escucharDoc('recursos', 'latido', (d) => { ultimo = d?.t || 0; revisar(); });
  const t = setInterval(revisar, 10000);
  sala.subs.push(() => { clearInterval(t); cartel.remove(); });
  return { cartel, revisar };
}

// Cada celular avisa que sigue ahí (solo con la pantalla prendida) y apenas vuelve a la pestaña.
export function latidoInvitado(sala, uid) {
  let enCurso = false;
  const marca = () => {
    if (enCurso || document.visibilityState === 'hidden') return;
    enCurso = true;
    latir(sala.codigo, uid).catch(() => {}).finally(() => { enCurso = false; });
  };
  const t = setInterval(marca, LATIDO_MS);
  document.addEventListener('visibilitychange', marca);
  sala.subs.push(() => { clearInterval(t); document.removeEventListener('visibilitychange', marca); });
}
