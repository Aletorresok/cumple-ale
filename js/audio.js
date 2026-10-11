// Sonidos de la tele: archivos propios si existen (audio/tema.mp3, audio/frases/<id>.mp3) y, si no,
// un sonido generado o la voz del navegador. Los archivos oficiales de la serie no vienen en el repo:
// si querés usar los tuyos, copialos en esas carpetas (ver audio/LEEME.md).
let ctx;
const contexto = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

// Reproduce un archivo; resuelve true si sonó y false si no existe o el navegador lo bloqueó.
export function reproducir(ruta) {
  return new Promise((resolver) => {
    try {
      const a = new Audio(ruta);
      a.addEventListener('error', () => resolver(false), { once: true });
      a.addEventListener('playing', () => resolver(true), { once: true });
      a.play().catch(() => resolver(false));
    } catch { resolver(false); }
  });
}

// Toca una lista de notas [frecuencia, inicio, duración] (segundos) con timbre de metales.
export function tocar(notas, volumen = 0.16) {
  try {
    const c = contexto();
    if (c.state === 'suspended') c.resume();
    const t0 = c.currentTime + 0.05;
    for (const [f, inicio, dur] of notas) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, t0 + inicio);
      g.gain.exponentialRampToValueAtTime(volumen, t0 + inicio + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + inicio + dur);
      o.start(t0 + inicio); o.stop(t0 + inicio + dur + 0.05);
    }
  } catch { /* sin audio */ }
}

// Fanfarria de apertura propia (no es la melodía de la serie): arpegio ascendente y acorde final.
const DO = 523.25, MI = 659.25, SOL = 783.99, DO2 = 1046.5, MI2 = 1318.5;
export const FANFARRIA = [
  [DO, 0, .22], [MI, .24, .22], [SOL, .48, .22], [DO2, .72, .5],
  [SOL, 1.35, .2], [DO2, 1.58, .2], [MI2, 1.82, .9],
  [DO, 2.8, 1.4], [MI, 2.8, 1.4], [SOL, 2.8, 1.4], [DO2, 2.8, 1.4],
];

// Dice una frase con la voz del navegador (español). Resuelve false si no hay voz disponible.
export function decir(texto) {
  try {
    const s = window.speechSynthesis;
    if (!s) return false;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-AR';
    u.rate = 1.05;
    u.pitch = 1.1;
    s.cancel();
    s.speak(u);
    return true;
  } catch { return false; }
}
