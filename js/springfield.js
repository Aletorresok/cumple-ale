// Banco temático «Springfield» (Los Simpson): trivia, mímica, pares para el impostor y encuestas.
// Usa los nombres del doblaje latino. Se agrega desde «Mis bancos» y se edita como cualquier otro.
const q = (pregunta, correcta, ...incorrectas) => ({ tipo: 'pregunta', pregunta, correcta, incorrectas });

export const BANCO_SPRINGFIELD = {
  id: 'springfield',
  titulo: 'Springfield · Los Simpson',
  materia: 'Temática Simpson para todos los juegos',
  items: [
    // ── Trivia ──
    q('¿Qué cerveza toma Homero?', 'Duff', 'Buzz', 'Krusty', 'Fudd'),
    q('¿Dónde trabaja Homero?', 'En la planta nuclear', 'En el Kwik-E-Mart', 'En la taberna de Moe', 'En la escuela'),
    q('¿Cómo se llama el dueño de la planta nuclear?', 'Montgomery Burns', 'Waylon Smithers', 'Joe Quimby', 'Kent Brockman'),
    q('¿Cómo se llama el vecino de los Simpson?', 'Ned Flanders', 'Lenny', 'Carl', 'Kirk Van Houten'),
    q('¿Cómo se llama el perro de los Simpson?', 'Ayudante de Santa', 'Bola de Nieve', 'Pulgoso', 'Duque'),
    q('¿Qué instrumento toca Lisa?', 'El saxofón', 'La trompeta', 'El violín', 'El piano'),
    q('¿Cómo se llama el payaso favorito de Bart?', 'Krusty', 'Bob Patiño', 'Gabbo', 'Tomy'),
    q('¿Cómo se llama el mejor amigo de Bart?', 'Milhouse', 'Nelson', 'Ralph', 'Martin'),
    q('¿Quién atiende el Kwik-E-Mart?', 'Apu', 'Moe', 'Barney', 'Cletus'),
    q('¿Cuántos hijos tienen Homero y Marge?', '3', '2', '4', '5'),
    q('¿De qué color es el pelo de Marge?', 'Azul', 'Violeta', 'Verde', 'Rojo'),
    q('¿Cómo se llama el abogado de los Simpson?', 'Lionel Hutz', 'Troy McClure', 'Kent Brockman', 'el Dr. Hibbert'),
    q('¿Cómo se apellida el jefe de policía?', 'Wiggum', 'Quimby', 'Skinner', 'Hibbert'),
    q('¿Cómo se llama el director de la escuela?', 'Seymour Skinner', 'Edna Krabappel', 'Willie', 'Chalmers'),
    q('¿Cómo se llama la hija más chica de los Simpson?', 'Maggie', 'Lisa', 'Patty', 'Selma'),
    q('¿Qué dice Nelson cuando se burla de alguien?', '¡Ja-ja!', '¡Ay, caramba!', '¡Excelente!', '¡Okilidokili!'),

    // ── Mímica ──
    ...['Homero ahorcando a Bart', 'Homero comiendo donas', 'Marge armándose el peinado', 'Bart en patineta',
      'Lisa tocando el saxofón', 'Maggie con el chupete', 'El Sr. Burns diciendo «Excelente»', 'Ned Flanders saludando',
      'Apu atendiendo el Kwik-E-Mart', 'Moe sirviendo cerveza', 'Krusty el payaso', 'El jefe Wiggum comiendo',
      'Nelson burlándose', 'Homero durmiendo en la planta', 'Barney eructando', 'El abuelo contando una historia',
      'Ralph comiendo crayones', 'Bob Patiño pisando rastrillos', 'La familia corriendo al sillón', 'Homero cayendo por el barranco']
      .map((palabra) => ({ tipo: 'mimica', palabra })),

    // ── El impostor ──
    { tipo: 'par', a: 'Homero', b: 'Barney' },
    { tipo: 'par', a: 'Sr. Burns', b: 'Smithers' },
    { tipo: 'par', a: 'Ned Flanders', b: 'el Reverendo Alegría' },
    { tipo: 'par', a: 'Krusty', b: 'Bob Patiño' },
    { tipo: 'par', a: 'la taberna de Moe', b: 'el Kwik-E-Mart' },
    { tipo: 'par', a: 'cerveza Duff', b: 'Buzz Cola' },
    { tipo: 'par', a: 'Marge', b: 'Patty' },
    { tipo: 'par', a: 'Lisa', b: 'Martin' },
    { tipo: 'par', a: 'Milhouse', b: 'Ralph' },
    { tipo: 'par', a: 'Apu', b: 'Moe' },

    // ── Los invitados dicen (puntos estimados, para cambiar por los de la encuesta previa) ──
    { tipo: 'encuesta', pregunta: 'Nombrá un personaje de Los Simpson', respuestas: [
      { texto: 'Homero', puntos: 30 }, { texto: 'Bart', puntos: 24 }, { texto: 'Marge', puntos: 15 },
      { texto: 'Lisa', puntos: 12 }, { texto: 'Sr. Burns / Burns', puntos: 9 }, { texto: 'Maggie', puntos: 6 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá algo que come o toma Homero', respuestas: [
      { texto: 'donas / rosquillas', puntos: 35 }, { texto: 'cerveza / Duff', puntos: 28 }, { texto: 'chuletas / costillas', puntos: 12 },
      { texto: 'pizza', puntos: 10 }, { texto: 'pollo', puntos: 8 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá un lugar de Springfield', respuestas: [
      { texto: 'la taberna de Moe / bar de Moe / Moe', puntos: 30 }, { texto: 'la planta nuclear / planta', puntos: 25 },
      { texto: 'Kwik-E-Mart / el almacén de Apu', puntos: 18 }, { texto: 'la escuela / escuela primaria', puntos: 14 },
      { texto: 'la casa de los Simpson / Avenida Siempreviva', puntos: 13 }] },
  ],
};
