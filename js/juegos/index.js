import seleccion from './seleccion.js';
import encuesta from './encuesta.js';
import mimica from './mimica.js';
import dibujo from './dibujo.js';
import escape from './escape.js';
import quiz from './quiz.js';
import frases from './frases.js';
import escenas from './escenas.js';
import velitas from './velitas.js';
import podio from './podio.js';

// En el orden en que se juegan en la fiesta (mímica y escape quedan al final, fuera del lineup).
export const JUEGOS = [seleccion, encuesta, dibujo, quiz, frases, escenas, velitas, podio, mimica, escape];

export const juego = (id) => JUEGOS.find((j) => j.id === id) || null;
