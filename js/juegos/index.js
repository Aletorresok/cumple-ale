import seleccion from './seleccion.js';
import encuesta from './encuesta.js';
import dibujo from './dibujo.js';
import quiz from './quiz.js';
import escenas from './escenas.js';
import frase from './frase.js';
import podio from './podio.js';

// En el orden en que se juegan en la fiesta.
export const JUEGOS = [seleccion, encuesta, dibujo, quiz, escenas, frase, podio];

export const juego = (id) => JUEGOS.find((j) => j.id === id) || null;
