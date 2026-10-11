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

// Voz del narrador: la tele la afina (tono, velocidad y voz) y se guarda en ese navegador.
// `activa` la prende o apaga quien organiza desde el panel (sala.data.narrador).
export const voz = { activa: false, nombre: '', tono: 0.5, vel: 0.85 };
export const PRESETS = { homero: { tono: 0.5, vel: 0.85 }, normal: { tono: 1, vel: 1 } };

// Voces en español que tiene este navegador (las argentinas y latinas primero).
export function vocesEs() {
  try {
    const peso = (v) => (/-AR/i.test(v.lang) ? 0 : /-(MX|US|419|CO|CL)/i.test(v.lang) ? 1 : 2);
    return speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang)).sort((a, b) => peso(a) - peso(b));
  } catch { return []; }
}

// Dice un texto con la voz afinada. Devuelve false si el navegador no puede hablar.
export function decir(texto) {
  try {
    const s = window.speechSynthesis;
    if (!s) return false;
    const u = new SpeechSynthesisUtterance(texto);
    const v = vocesEs();
    u.voice = v.find((x) => x.name === voz.nombre) || v[0] || null;
    u.lang = u.voice?.lang || 'es-AR';
    u.pitch = voz.tono;
    u.rate = voz.vel;
    s.cancel();
    s.speak(u);
    return true;
  } catch { return false; }
}
