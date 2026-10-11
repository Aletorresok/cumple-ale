// Botonera de frases: botones en el panel que hacen aparecer una frase en la tele (con su sonido)
// cuando "pinta". El panel escribe sala.data.frase = { id, texto, t }; la tele la muestra al cambiar.
// Sonido: audio/frases/<id>.mp3 si existe; si no, un tilín y la voz del navegador.
import { h, montar, toast, leerLocal, guardarLocal, vibrar } from './util.js';
import { reproducir, tocar, decir } from './audio.js';
import { mensajeError } from './fb.js';

export const FRASES = [
  { id: 'caramba', icono: '😮', texto: '¡Ay, caramba!' },
  { id: 'doh', icono: '🤦', texto: '¡D’oh!' },
  { id: 'donas', icono: '🍩', texto: 'Mmm… rosquillas' },
  { id: 'excelente', icono: '🤌', texto: 'Excelente…' },
  { id: 'shorts', icono: '🛹', texto: '¡Cómete mis shorts!' },
  { id: 'jaja', icono: '👉', texto: '¡Ja-ja!' },
  { id: 'okili', icono: '🙋', texto: '¡Okilidokili!' },
  { id: 'gracias', icono: '🏪', texto: '¡Gracias, vuelva pronto!' },
  { id: 'objecion', icono: '⚖️', texto: '¡Objeción, señoría!' },
  { id: 'salud', icono: '🍺', texto: '¡Salud, Moe!' },
  { id: 'feliz', icono: '🎂', texto: '¡Feliz cumple, Ale!' },
  { id: 'baile', icono: '💃', texto: '¡A bailar todos!' },
  { id: 'pizza', icono: '🍕', texto: '¡Llegó la comida!' },
  { id: 'brindis', icono: '🥂', texto: '¡Brindis!' },
];

const CLAVE = 'botoneraPropias';
const ESPERA_MS = 700;

// Panel del organizador.
export function panelBotonera(sala) {
  let propias = leerLocal(CLAVE, []);
  let ultimo = 0;
  const lista = h('div', { class: 'botonera' });
  const campo = h('input', { class: 'campo', maxlength: 60, placeholder: 'Frase nueva, ej.: ¡Que hable Ale!', autocomplete: 'off' });

  const mandar = (f) => {
    const ahora = Date.now();
    if (ahora - ultimo < ESPERA_MS) return;
    ultimo = ahora;
    vibrar(30);
    sala.actualizar({ frase: { id: f.id, texto: f.texto, t: ahora } }).catch((e) => toast(mensajeError(e), 'error'));
  };

  function dibujar() {
    montar(lista, [...FRASES, ...propias].map((f) => h('button', { class: 'btn sec boton-frase', onclick: () => mandar(f) },
      h('span', { class: 'bf-icono' }, f.icono || '💬'), h('span', null, f.texto))));
  }
  dibujar();

  const el = h('section', { class: 'tarjeta pila botonera-panel' },
    h('h2', null, '🔊 Botonera de frases'),
    h('p', { class: 'muted chico' }, 'Tocá una frase cuando pinte: aparece en la tele y suena. Funciona con la pantalla grande abierta y el sonido activado.'),
    lista,
    h('form', { class: 'fila', onsubmit: (ev) => {
      ev.preventDefault();
      const texto = campo.value.trim();
      if (!texto) return;
      propias = [...propias, { id: 'propia-' + Date.now().toString(36), icono: '💬', texto }].slice(-12);
      guardarLocal(CLAVE, propias);
      campo.value = '';
      dibujar();
    } }, campo, h('button', { class: 'btn sec', type: 'submit' }, 'Agregar'),
      propias.length > 0 && h('button', { class: 'btn-link', type: 'button', onclick: () => { propias = []; guardarLocal(CLAVE, propias); dibujar(); } }, 'Quitar las mías')));
  return { el };
}

// Pantalla grande: devuelve la función a llamar en cada cambio de la sala.
export function vigilarFrases() {
  let visto = null; // marca de la última frase; la primera vez no suena (por si se recarga la tele)
  let globo = null;
  let quitar;
  return (sala) => {
    const f = sala.data?.frase;
    const marca = f?.t ?? 0;
    if (visto === null) { visto = marca; return; }
    if (!f || marca === visto) return;
    visto = marca;
    globo?.remove();
    clearTimeout(quitar);
    globo = h('div', { class: 'frase-tv', role: 'status' }, h('span', null, f.texto));
    document.body.append(globo);
    quitar = setTimeout(() => globo?.remove(), 4200);
    reproducir(`audio/frases/${f.id}.mp3`).then((sono) => {
      if (sono) return;
      tocar([[880, 0, .12], [1320, .1, .2]], 0.12);
      decir(f.texto);
    });
  };
}
