// Preguntas de la Trivia japonesa («Treinta minutos sobre Tokio»). Van en este orden y cada una
// le toca a un equipo (rotan). Sin opciones vale 2; si el equipo pide opciones, vale 1.
// La primera opción es la correcta (en la tele se mezclan). Con «video», al responder la tele pasa
// la escena para chequear la respuesta.
const q = (pregunta, correcta, ...incorrectas) => ({ pregunta, correcta, incorrectas });
const conVideo = (video, it) => ({ ...it, video });

export const PREGUNTAS_JAPONESA = [
  q('¿Cómo se llama el trago que inventa Homero y Moe le roba?', 'La Llamarada Moe', 'El Moe Loco', 'La Duff Ardiente', 'El Fuego de Homero'),
  q('Cuando Homero va al espacio, ¿quién termina siendo el héroe de la misión?', 'Una barra de carbono inanimada', 'Buzz Aldrin', 'Homero', 'Un pájaro bebedor'),
  q('¿Qué le encuentran a Homero en el cerebro, que explica por qué es tan tonto?', 'Un crayón', 'Una dona', 'Una tapita de Duff', 'Un clavo'),
  q('¿Cuál es el número de preso de Bob Patiño?', '24601', '31337', '74200', '18650'),
  q('¿Quién le disparó al Sr. Burns?', 'Maggie', 'Bart', 'Homero', 'Smithers'),
  q('¿Por cuánto dinero le vende Bart su alma a Milhouse?', '5 dólares', '1 dólar', '10 dólares', '50 centavos'),
  q('¿Qué negocio arma Homero con su camioneta cuando nieva?', 'Señor Quitanieves', 'Señor Limpiador', 'Mister Nieve', 'Rey del Invierno'),
  conVideo('video/trivia-magios.mp4', q('¿Qué número tiene Homero como integrante de Los Magios?', '908', '912', '1', '742')),
];

// Ronda final: cada equipo escribe su número en una hoja; el que más se acerca gana 3 puntos.
export const APROX_JAPONESA = {
  pregunta: '¿Por cuánto dinero le vende Lyle Lanley el monorriel a Springfield?',
  respuesta: '3 millones de dólares',
};
