// Banco temático «Springfield» (Los Simpson): trivia, mímica y encuestas.
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


    // ── Los invitados dicen (puntos estimados: con la encuesta en vivo salen los del grupo) ──
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
    { tipo: 'encuesta', pregunta: 'Nombrá algo que dice Homero', respuestas: [
      { texto: "D'oh / Doh / Dou", puntos: 38 }, { texto: 'Mmm… rosquillas / mmm donas / mmm', puntos: 22 },
      { texto: 'Wuju / Woohoo / Yuju', puntos: 16 }, { texto: 'Pequeño demonio / maldito demonio', puntos: 12 },
      { texto: 'Cállate Flanders / Flanders', puntos: 8 }, { texto: 'Marge', puntos: 4 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá algo que tiene Marge', respuestas: [
      { texto: 'el pelo azul / pelo / peinado', puntos: 48 }, { texto: 'collar de perlas / collar / perlas', puntos: 18 },
      { texto: 'vestido verde / vestido', puntos: 14 }, { texto: 'paciencia', puntos: 10 },
      { texto: 'tres hijos / hijos', puntos: 6 }, { texto: 'Homero / marido', puntos: 4 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá algo que hace Bart', respuestas: [
      { texto: 'travesuras / maldades', puntos: 30 }, { texto: 'andar en patineta / patineta / skate', puntos: 24 },
      { texto: 'bromas telefónicas a Moe / bromas / llamar a Moe', puntos: 16 }, { texto: 'escribir en el pizarrón / pizarrón / castigo', puntos: 14 },
      { texto: 'decir ay caramba / ay caramba', puntos: 10 }, { texto: 'usar la gomera / gomera / honda', puntos: 6 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá algo que hay en la casa de los Simpson', respuestas: [
      { texto: 'el sillón / sofá', puntos: 34 }, { texto: 'la tele / televisión', puntos: 26 },
      { texto: 'el cuadro del barco / cuadro / barco', puntos: 12 }, { texto: 'el sótano', puntos: 10 },
      { texto: 'la cocina', puntos: 8 }, { texto: 'el garaje / el auto', puntos: 6 }, { texto: 'la casita del árbol / casa del árbol', puntos: 4 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá un animal de Los Simpson', respuestas: [
      { texto: 'Ayudante de Santa / el perro / galgo', puntos: 44 }, { texto: 'Bola de Nieve / el gato', puntos: 28 },
      { texto: 'el cerdo de Homero / cerdo / chancho / Plopper / Spider-Cerdo', puntos: 16 },
      { texto: 'el elefante de Bart / elefante / Stampy', puntos: 8 }, { texto: 'la tortuga / tortuga', puntos: 4 }] },
  ],
};
