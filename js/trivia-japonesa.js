// Preguntas de la Trivia japonesa («Treinta minutos sobre Tokio»). Van en este orden y cada una
// le toca a un equipo (rotan). Sin opciones vale 2; si el equipo pide opciones, vale 1.
// La primera opción es la correcta (en la tele se mezclan). Con «video», al responder la tele pasa
// la escena para chequear la respuesta.
const q = (pregunta, correcta, ...incorrectas) => ({ pregunta, correcta, incorrectas });
const conVideo = (video, it) => ({ ...it, video });

export const PREGUNTAS_JAPONESA = [
  conVideo('video/trivia-magios.mp4', q('¿Cuál es el número de Homero como integrante de Los Magios?', '908', '712', '1.024', '666')),
  conVideo('video/trivia-llamarada.mp4', q('Además del fuego, ¿cuál es el ingrediente secreto de la Llamarada Moe?', 'Jarabe para la tos infantil de Krusty', 'Tequila', 'Licor de dona', 'Duff con pimienta')),
  conVideo('video/trivia-crayones.mp4', q('¿Cuántos crayones se metió Homero por la nariz?', '16', '8', '12', '24')),
  conVideo('video/trivia-moe-revista.mp4', q('¿Qué se quedó haciendo Moe la noche que le dispararon al Sr. Burns?', 'Leía una revista del supermercado', 'Leía el diario', 'Hacía un crucigrama', 'Leía una historieta')),
  conVideo('video/trivia-codigo-area.mp4', q('¿Cuál es el código de área de la Nueva Springfield?', '939', '636', '742', '555')),
  conVideo('video/trivia-hugo.mp4', q('¿Qué come Hugo, el gemelo malvado de Bart?', 'Cabezas de pescado', 'Cucarachas', 'Comida de perro', 'Pan duro')),
  conVideo('video/trivia-juan-topo.mp4', q('¿Cuántos años tiene Juan Topo, el hombre topo?', '31', '82', '64', '95')),
  conVideo('video/trivia-abejas.mp4', q('¿Cuánto le iban a pagar a Homero por las abejas que consiguió vendiendo azúcar?', '2.000 dólares', '500 dólares', '1.000 dólares', '5.000 dólares')),
];

// Ronda final de aproximación (cada equipo escribe su número en una hoja; el que más se acerca gana 3).
// Alexis la sacó: en null, la trivia termina con la última pregunta. Para volver a usarla:
// { pregunta: '¿Por cuánto dinero le vende Lyle Lanley el monorriel a Springfield?', respuesta: '3 millones de dólares' }
export const APROX_JAPONESA = null;
