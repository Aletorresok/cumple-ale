// Preguntas de la Trivia japonesa («Treinta minutos sobre Tokio»). Van en este orden y cada una
// le toca a un equipo (rotan). Sin opciones vale 2; si el equipo pide opciones, vale 1.
// La primera opción es la correcta (en la tele se mezclan). Con «video», al responder la tele pasa
// la escena para chequear la respuesta.
const q = (pregunta, correcta, ...incorrectas) => ({ pregunta, correcta, incorrectas });
const conVideo = (video, it) => ({ ...it, video });

export const PREGUNTAS_JAPONESA = [
  conVideo('video/trivia-magios.mp4', q('¿Cuál es el número de Homero como integrante de Los Magios?', '908', '712', '1.024', '666')),
  q('¿Cuál es el número de preso de Bob Patiño?', '24601', '31337', '74200', '18650'),
  conVideo('video/trivia-llamarada.mp4', q('Además del fuego, ¿cuál es el ingrediente secreto de la Llamarada Moe?', 'Jarabe para la tos infantil de Krusty', 'Tequila', 'Licor de dona', 'Duff con pimienta')),
  q('¿Qué nombre nuevo se pone Homero, sacado de un secador de pelo?', 'Max Power', 'Homer Thompson', 'Mr. X', 'Señor Poder'),
  q('¿Qué coeficiente intelectual tiene Homero con el crayón en el cerebro?', '55', '105', '75', '30'),
  q('¿Cómo se llama el osito de peluche del Sr. Burns?', 'Bobo', 'Rosebud', 'Winston', 'Teddy'),
  q('¿Cuál es el teléfono del Señor Quitanieves?', 'KL5-3226', 'KL5-1234', '555-PLOW', '742-1989'),
  q('¿Cuál es el nombre real de Krusty el payaso?', 'Herschel Krustofski', 'Hyman Krustofski', 'Krusty Kowalski', 'Herschel Klein'),
];

// Ronda final: cada equipo escribe su número en una hoja; el que más se acerca gana 3 puntos.
export const APROX_JAPONESA = {
  pregunta: '¿Por cuánto dinero le vende Lyle Lanley el monorriel a Springfield?',
  respuesta: '3 millones de dólares',
};
