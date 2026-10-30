import seleccion from './seleccion.js';
import encuesta from './encuesta.js';
import mimica from './mimica.js';
import escape from './escape.js';
import quiz from './quiz.js';
import velitas from './velitas.js';
import podio from './podio.js';

// En el orden en que se juegan en la fiesta.
export const JUEGOS = [seleccion, encuesta, mimica, escape, quiz, velitas, podio];

export const juego = (id) => JUEGOS.find((j) => j.id === id) || null;
