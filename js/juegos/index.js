import seleccion from './seleccion.js';
import encuesta from './encuesta.js';
import impostor from './impostor.js';
import mimica from './mimica.js';
import escape from './escape.js';
import quiz from './quiz.js';
import apuesta from './apuesta.js';
import nube from './nube.js';
import ruleta from './ruleta.js';
import podio from './podio.js';

// En el orden en que se juegan en la fiesta.
export const JUEGOS = [seleccion, encuesta, impostor, mimica, escape, quiz, apuesta, nube, ruleta, podio];

export const juego = (id) => JUEGOS.find((j) => j.id === id) || null;
