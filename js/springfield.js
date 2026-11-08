// Banco temático «Springfield» (Los Simpson): trivia, mímica y encuestas.
// Usa los nombres del doblaje latino. Se agrega desde «Mis bancos» y se edita como cualquier otro.
const q = (pregunta, correcta, ...incorrectas) => ({ tipo: 'pregunta', pregunta, correcta, incorrectas });

// Para «Dibujá en Springfield»: cosas que se reconocen en un dibujo de un minuto.
// Vienen con el juego (no hace falta agregar el banco) y se pueden cambiar desde «Mis bancos».
export const PALABRAS_DIBUJO = [
  'Una dona con chispitas', 'Una lata de Duff', 'La planta nuclear', 'El pelo de Marge', 'Plopper, el cerdo araña',
  'El sillón de los Simpson', 'La patineta de Bart', 'El saxofón de Lisa', 'El chupete de Maggie', 'Blinky, el pez de tres ojos',
  'El Kwik-E-Mart', 'La taberna de Moe', 'El auto de Homero', 'El micro escolar de Otto', 'El monorriel',
  'La casa del árbol', 'Bola de Nieve, el gato', 'Ayudante de Santa, el perro', 'Krusty el payaso', 'El bigote de Flanders',
  'Los anteojos de Milhouse', 'La gomera de Bart', 'Una barra de plutonio', 'Itchy y Scratchy', 'El Hombre Abeja',
  'La estatua de Jebediah Springfield', 'El Sr. Burns diciendo «Excelente»', 'El Sr. Quitanieves', 'Una chuleta de cerdo',
  'El pizarrón de los castigos de Bart', 'Homero astronauta', 'El collar de perlas de Marge', 'Bob Patiño pisando un rastrillo',
  'Homero en la hamaca', 'La dentadura del abuelo', 'Duffman', 'La sirena del patrullero de Wiggum', 'El ojo morado de Moe',
  'Lisa vegetariana comiendo una ensalada', 'La familia en el sillón mirando la tele',
];

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
      'Ralph comiendo crayones', 'Bob Patiño pisando rastrillos', 'La familia corriendo al sillón', 'Homero cayendo por el barranco',
      // Episodios famosos
      'Homero viaja al espacio como astronauta', 'Homero come los ajíes picantes de la feria y alucina',
      'Homero engorda a propósito para trabajar desde casa', 'Lisa se hace vegetariana',
      'Bart le corta la cabeza a la estatua de Jebediah Springfield', 'Homero va a la universidad',
      'Los Simpson viajan a Japón', 'Bart se hace famoso con la frase «Yo no fui»',
      'Homero recupera el pelo con un tónico milagroso', 'Lisa toca el saxofón con Encías Sangrantes Murphy',
      'Marge se hace policía', 'Homero se convierte en boxeador', 'Bart se gana un elefante',
      'Homero forma un cuarteto vocal y se hace famoso', 'El Sr. Burns tapa el sol', 'Los Simpson viajan a Brasil']
      .map((palabra) => ({ tipo: 'mimica', palabra })),

    // ── Para dibujar ──
    ...PALABRAS_DIBUJO.map((palabra) => ({ tipo: 'dibujo', palabra })),


    // ── Los invitados dicen ──
    // Puntos REALES del Google Form (18 invitados, hasta 3 respuestas cada uno, del 2 al 6 de noviembre de 2026):
    // cada respuesta vale tantos puntos como personas la dieron. Las que dijo una sola persona quedan afuera.
    // El primer texto antes de la barra es el que se ve en la tele; el resto son variantes que también valen.
    { tipo: 'encuesta', pregunta: 'Nombrá un personaje de Los Simpson que no sea de la familia', respuestas: [
      { texto: 'Moe', puntos: 8 }, { texto: 'Apu', puntos: 7 }, { texto: 'Ned Flanders / Flanders', puntos: 6 },
      { texto: 'Barney / Barnie', puntos: 4 }, { texto: 'Sr. Burns / Burns / Montgomery Burns / señor Berns', puntos: 3 },
      { texto: 'Smithers / Smiders', puntos: 2 }, { texto: 'Lenny', puntos: 2 }, { texto: 'el hombre topo / Hans Topo / topo', puntos: 2 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá algo que come o toma Homero', respuestas: [
      { texto: 'cerveza / Duff / cerveza Duff', puntos: 16 }, { texto: 'rosquillas / donas / donuts / dona', puntos: 13 },
      { texto: 'hamburguesa / hamburguesas', puntos: 3 }, { texto: 'chuletas de cerdo / chuleta / chuletas', puntos: 2 },
      { texto: 'maní', puntos: 2 }, { texto: 'la Venus de Milo de gelatina / Venus de jalea / Venus de Milo', puntos: 2 },
      { texto: 'pastel / pie / tarta', puntos: 2 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá un lugar de Springfield', respuestas: [
      { texto: 'la escuela primaria / escuela / Escuela Primaria de Springfield / colegio', puntos: 11 },
      { texto: 'la planta nuclear / planta / planta de energía / planta atómica', puntos: 10 },
      { texto: 'la taberna de Moe / bar de Moe / Moe / bar / taberna', puntos: 9 },
      { texto: 'el Kwik-E-Mart / minisúper / minimercado / almacén de Apu', puntos: 4 },
      { texto: 'Krusty Burger / hamburguesas Krusty', puntos: 3 }, { texto: 'la iglesia / iglesia', puntos: 2 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá algo que hay en la casa de los Simpson', respuestas: [
      { texto: 'la tele / TV / televisor / televisión', puntos: 14 }, { texto: 'el sillón / sofá / sillon', puntos: 14 },
      { texto: 'el cuadro del barco / cuadro / barco / velero', puntos: 4 }, { texto: 'Ayudante de Santa / el perro / perro', puntos: 3 },
      { texto: 'la casa del árbol / casita del árbol', puntos: 2 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá un trabajo que tuvo Homero', respuestas: [
      { texto: 'inspector de seguridad en la planta nuclear / inspector de seguridad / planta nuclear / planta / técnico nuclear / sector 7G', puntos: 12 },
      { texto: 'quitanieves / Don Barredora / barrendero / barredor de nieve / limpia nieves', puntos: 9 },
      { texto: 'en el bowling / bolos / boliche / acomodador de bolos', puntos: 5 }, { texto: 'astronauta', puntos: 5 },
      { texto: 'heladero', puntos: 2 }, { texto: 'payaso / Krusty el payaso', puntos: 2 },
      { texto: 'cantante / Los Borbotones / Be Sharps', puntos: 2 }, { texto: 'boxeador', puntos: 2 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá un invitado famoso de Los Simpson', respuestas: [
      { texto: 'Lady Gaga / Gaga', puntos: 5 }, { texto: 'U2 / Bono', puntos: 4 }, { texto: 'Ronaldo / Ronaldo Nazario', puntos: 4 },
      { texto: 'Michael Jackson', puntos: 4 }, { texto: 'Mick Jagger / Rolling Stones', puntos: 3 },
      { texto: 'Leonard Nimoy / Señor Spock / Spock', puntos: 3 }, { texto: 'Stephen King', puntos: 2 },
      { texto: 'Los Beatles / Paul McCartney / McCartney', puntos: 2 }] },
  ],
};
