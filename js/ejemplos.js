// Banco de ejemplo para probar todos los juegos. Se copia a «Mis bancos» y después se edita
// con cosas de la familia y los amigos.
export const BANCO_FIESTA = {
  id: 'fiesta-ejemplo',
  titulo: 'Cumple Ale · ejemplo',
  materia: 'Para probar',
  items: [
    // ── Los invitados dicen ──
    { tipo: 'encuesta', pregunta: 'Nombrá algo que no puede faltar en un cumpleaños', respuestas: [
      { texto: 'torta / la torta', puntos: 30 }, { texto: 'música / musica', puntos: 22 }, { texto: 'amigos / amigas', puntos: 15 },
      { texto: 'globos', puntos: 12 }, { texto: 'velitas / velas', puntos: 10 }, { texto: 'regalos', puntos: 8 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá algo que se lleva a la playa', respuestas: [
      { texto: 'protector / protector solar / bronceador', puntos: 30 }, { texto: 'toalla / lona', puntos: 25 }, { texto: 'sombrilla', puntos: 15 },
      { texto: 'mate', puntos: 12 }, { texto: 'malla', puntos: 10 }, { texto: 'heladerita / conservadora', puntos: 8 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá una excusa para llegar tarde', respuestas: [
      { texto: 'tráfico / transito / trafico', puntos: 32 }, { texto: 'me quedé dormido / me dormí / dormido', puntos: 25 }, { texto: 'el colectivo / bondi', puntos: 15 },
      { texto: 'no encontraba las llaves / llaves', puntos: 10 }, { texto: 'lluvia', puntos: 8 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá algo que se hace en un asado', respuestas: [
      { texto: 'comer', puntos: 28 }, { texto: 'aplaudir al asador / aplauso', puntos: 22 }, { texto: 'tomar / brindar', puntos: 18 },
      { texto: 'charlar', puntos: 12 }, { texto: 'picar / picada', puntos: 10 }, { texto: 'prender el fuego / fuego', puntos: 8 }] },
    { tipo: 'encuesta', pregunta: 'Nombrá una canción que siempre suena en las fiestas', respuestas: [
      { texto: 'cumbia', puntos: 25 }, { texto: 'despacito', puntos: 20 }, { texto: 'la bamba', puntos: 15 },
      { texto: 'macarena', puntos: 12 }, { texto: 'el cuarteto / cuarteto', puntos: 10 }] },

    // ── El impostor ──
    { tipo: 'par', a: 'playa', b: 'pileta' },
    { tipo: 'par', a: 'asado', b: 'choripán' },
    { tipo: 'par', a: 'mate', b: 'tereré' },
    { tipo: 'par', a: 'Navidad', b: 'Año Nuevo' },
    { tipo: 'par', a: 'perro', b: 'lobo' },
    { tipo: 'par', a: 'guitarra', b: 'violín' },
    { tipo: 'par', a: 'avión', b: 'helicóptero' },
    { tipo: 'par', a: 'torta', b: 'flan' },
    { tipo: 'par', a: 'Harry Potter', b: 'El señor de los anillos' },
    { tipo: 'par', a: 'cine', b: 'teatro' },
    { tipo: 'par', a: 'bicicleta', b: 'monopatín' },
    { tipo: 'par', a: 'casamiento', b: 'cumpleaños' },

    // ── Mímica ──
    ...['Titanic', 'Lavar los platos', 'Hacer un asado', 'Shakira', 'Spiderman', 'Manejar en la ruta', 'Sacarse una selfie',
      'Cebar mate', 'El Rey León', 'Bailar cumbia', 'Ir al dentista', 'Atarse los cordones', 'Harry Potter', 'Messi',
      'Pescar', 'Tocar la batería', 'Un pingüino', 'Cocinar fideos', 'Volar en avión', 'Jugar al tenis', 'Peinarse',
      'Una gallina', 'Abrir un regalo', 'Soplar las velitas', 'Esquiar', 'Un robot', 'Ordeñar una vaca', 'Planchar',
      'Buscar wifi', 'Tirarse a la pileta', 'Superman', 'La Sirenita', 'Hacer yoga', 'Un mago', 'Pasear al perro',
      'Darth Vader', 'Comer espaguetis', 'Escalar una montaña', 'Un DJ', 'Despertarse tarde'].map((palabra) => ({ tipo: 'mimica', palabra })),

    // ── ¿Cuánto apostás? ──
    { tipo: 'afirmacion', texto: 'Los pulpos tienen tres corazones.', verdadera: true, explicacion: 'Dos bombean sangre a las branquias y uno al resto del cuerpo.' },
    { tipo: 'afirmacion', texto: 'La Gran Muralla China se ve desde la Luna a simple vista.', verdadera: false, explicacion: 'Es un mito: es muy angosta para verse desde tan lejos.' },
    { tipo: 'afirmacion', texto: 'Las bananas son bayas, pero las frutillas no.', verdadera: true, explicacion: 'Botánicamente, la banana es una baya y la frutilla no.' },
    { tipo: 'afirmacion', texto: 'El dulce de leche lo inventaron en Argentina.', verdadera: false, explicacion: 'Se hace en muchos países desde hace siglos; el origen está en discusión.' },

    // ── Trivia ──
    { tipo: 'pregunta', pregunta: '¿En qué año salió la película Titanic?', correcta: '1997', incorrectas: ['1994', '2001', '1999'] },
    { tipo: 'pregunta', pregunta: '¿Cuántas velitas tiene una torta de 40?', correcta: 'Las que entren', incorrectas: ['40', '4', '14'] },
    { tipo: 'pregunta', pregunta: '¿Qué país ganó el Mundial 2022?', correcta: 'Argentina', incorrectas: ['Francia', 'Brasil', 'Croacia'] },

    // ── Sala de escape ──
    {
      tipo: 'escape',
      titulo: '¿Quién se llevó la torta?',
      intro: 'Faltan minutos para soplar las velitas y la torta desapareció. Quien se la llevó dejó la heladera cerrada con candados y pistas por toda la fiesta. Abran todos los candados antes de que se derrita el dulce de leche.',
      final: '¡La encontraron! Estaba en la heladera de la vecina. Ahora sí: ¡que vengan las velitas!',
      minutos: 15,
      candados: [
        { titulo: 'La edad misteriosa', desafio: 'Sumen los números de esta lista: 7 + 8 + 11. Ese es el código.', tipo: 'numero', respuesta: '26',
          pistas: ['Son tres números para sumar.', '7 + 8 = 15. Le falta sumar 11.'] },
        { titulo: 'El ingrediente', desafio: 'Soy dulce, marrón y en Argentina me ponen en todo. Sin mí, la torta no es torta.', tipo: 'palabra', respuesta: 'dulce de leche / dulcedeleche',
          pistas: ['Se come a cucharadas del pote.', 'Empieza con «dulce de…».'] },
        { titulo: 'El camino a la heladera', desafio: 'Desde la puerta: subí la escalera, doblá a la derecha, bajá, doblá a la izquierda.', tipo: 'direccion', respuesta: 'arriba,derecha,abajo,izquierda',
          pistas: ['Son cuatro flechas.', 'La primera es ↑ y la segunda →.'] },
        { titulo: 'Los globos', desafio: 'Los globos de la fiesta están en este orden: el del cielo, el del pasto, el del sol.', tipo: 'color', respuesta: 'azul,verde,amarillo',
          pistas: ['Son tres colores.', 'El cielo es azul.'] },
      ],
    },
  ],
};
