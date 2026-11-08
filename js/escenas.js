// Escenas clásicas de Los Simpson para «¿Te acordás de la escena?». Cada escena tiene una lista de
// cosas para recordar; cada equipo escribe todas las que se acuerde desde los celulares.
//
// Los nombres van como en el doblaje latino. En «alias» van otras formas de escribir lo mismo
// (la app ya tolera tildes, mayúsculas y un error de tipeo). Quien organiza puede aceptar o
// sacar respuestas a mano antes de revelar, así que no hace falta prever todo.
//
// «fija: true» = viene marcada para jugar. Las demás quedan de repuesto en el panel.
export const ESCENAS = [
  {
    id: 'abuelo-onda',
    titulo: 'Yo sí estaba en onda',
    video: 'video/escena-onda.mp4',
    consigna: '¿Cuántas veces se dice la palabra «onda» en la escena?',
    fija: true,
    items: [['8', 'ocho', '8 veces', 'ocho veces']],
  },
  {
    id: 'olimpicos',
    titulo: 'Springfield, sede olímpica',
    video: 'video/escena-olimpicos.mp4',
    consigna: '¿Qué ciudades proponen como sede de los Juegos Olímpicos antes de Springfield? (Valen los países)',
    fija: true,
    minimo: 6,   // si nombran 6, la respuesta es correcta
    items: [
      ['París', 'Paris', 'Francia'], ['Moscú', 'Moscu', 'Rusia'], ['Mongolia'], ['Buenos Aires', 'Argentina'],
      ['Ohio'], ['Budapest', 'Hungría', 'Hungria'], ['Dallas', 'Texas'], ['Londres', 'Inglaterra', 'Reino Unido'], ['Uganda'],
    ],
  },
  {
    id: 'burns-enfermedades',
    titulo: 'Las enfermedades del Sr. Burns',
    video: 'video/escena-burns.mp4',
    consigna: '¿Qué enfermedades tiene el Sr. Burns? (Si nombran 5, la respuesta es correcta)',
    fija: true,
    minimo: 5,   // si nombran 5 de las 6, la respuesta es correcta
    items: [
      ['Pulmonía', 'Pulmonia', 'Neumonía', 'Neumonia'], ['Diabetes juvenil', 'Diabetes'], ['Embarazo psicológico', 'Embarazo psicologico', 'Embarazo'],
      ['Gripe', 'Influenza'], ['Bronquitis'], ['Cáncer pancreático', 'Cancer pancreatico', 'Cáncer de páncreas', 'Cancer'],
    ],
  },
  {
    id: 'cleto',
    titulo: 'Los hijos de Cleto',
    video: 'video/escena-cleto.mp4',
    consigna: 'Cleto llama a todos sus hijos, uno por uno. ¿Qué nombres se acuerdan? (Si nombran 5, la respuesta es correcta)',
    fija: true,
    minimo: 5,   // con 5 nombres, la respuesta es correcta
    items: [
      ['Tiffany', 'Tifany', 'Tiffani'], ['Heather', 'Heder', 'Hether'], ['Cody', 'Kody', 'Codi'],
      ['Dylan', 'Dilan'], ['Dermot', 'Dermott'], ['Jacob', 'Jakob', 'Yacob'], ['Jordan', 'Jordán'], ['Taylor', 'Tailor', 'Teylor'],
      ['Brittany', 'Britany', 'Britney', 'Brittney'], ['Wesley', 'Wesly', 'Uesley'], ['Rumer', 'Rumor', 'Rummer'],
      ['Scout', 'Skaut', 'Scaut'], ['Cassidy', 'Casidy', 'Cassidi'], ['Zoe', 'Zoey', 'Zoé'], ['Chloe', 'Cloe', 'Cloé', 'Kloe'],
      ['Max'], ['Hunter', 'Jonter', 'Hanter'], ['Kendall', 'Kendal'], ['Caitlin', 'Katlin', 'Kaitlin', 'Kaitlyn', 'Catlin'],
      ['Noah', 'Noa', 'Noé'], ['Sasha', 'Sacha'], ['Morgan'], ['Kyra', 'Kira', 'Kaira'], ['Ian', 'Ían'],
      ['Lauren', 'Loren'], ['Q-bert', 'Qbert', 'Kiubert', 'Cubert', 'Q bert'], ['Phil', 'Fil'],
    ],
  },
  {
    id: 'octillizos',
    titulo: 'Los octillizos de Apu',
    consigna: 'Apu y Manjula tuvieron ocho bebés de una. ¿Cómo se llaman?',
    items: [
      ['Poonam', 'Punam', 'Poonan'], ['Sashi', 'Sasi', 'Shashi'], ['Pria', 'Priya', 'Prya'], ['Uma'],
      ['Anoop', 'Anup', 'Anoup'], ['Sandeep', 'Sandip', 'Sandi'], ['Nabendu', 'Nabendú', 'Navendu'], ['Gheet', 'Geet', 'Gita', 'Guit'],
    ],
  },
  {
    id: 'borbotones',
    titulo: 'Los Borbotones',
    consigna: 'El cuarteto de Homero que ganó un Grammy. ¿Quiénes estuvieron en la banda?',
    items: [
      ['Homero', 'Homero Simpson'], ['Apu', 'Apu Nahasapeemapetilon'], ['Skinner', 'Director Skinner', 'Seymour Skinner'],
      ['Barney', 'Barney Gumble'], ['Jefe Gorgory', 'Gorgory', 'Clancy Gorgory', 'el jefe'],
    ],
  },
  {
    id: 'burns',
    titulo: '¿Quién le disparó al Sr. Burns?',
    consigna: 'Burns tapó el sol y medio Springfield tenía motivos. ¿Quiénes eran los sospechosos?',
    items: [
      ['Smithers', 'Waylon Smithers'], ['Homero'], ['Moe'], ['Barney'], ['Willie', 'Jardinero Willie'],
      ['Skinner', 'Director Skinner'], ['Bart'], ['Lisa'], ['Tito Puente', 'Tito'], ['Maggie (¡fue ella!)', 'Maggie'],
    ],
  },
  {
    id: 'mascotas',
    titulo: 'Las mascotas de los Simpson',
    consigna: 'Perros, gatos y bichos que pasaron por la casa de Siempreviva. ¿Cuántos se acuerdan?',
    items: [
      ['Ayudante de Santa', 'Ayudante de Santa Claus', 'Santa\'s Little Helper', 'Ayudante'], ['Bola de Nieve', 'Bola de Nieve II', 'Snowball'],
      ['Pinchy', 'la langosta', 'Pinchi'], ['Mojo', 'el mono'], ['Plopper', 'Cerdo Araña', 'Spider Cerdo', 'Spider Pig'],
      ['Stampy', 'el elefante', 'Estampy'], ['Princesa', 'el poni', 'el pony'], ['Laddie', 'Ladi', 'Lady'],
      ['Bart Junior', 'la rana', 'el sapo'], ['Strangles', 'la serpiente', 'la víbora'],
    ],
  },
  {
    id: 'monorriel',
    titulo: 'El monorriel',
    consigna: 'Lyle Lanley ya les había vendido monorrieles a otros pueblos. ¿A cuáles?',
    items: [['Brockway', 'Brokway', 'Brockwey'], ['Ogdenville', 'Ogdenvil', 'Ogden'], ['North Haverbrook', 'Haverbrook', 'Norte Haverbrook']],
  },
  {
    id: 'selma',
    titulo: 'Los maridos de Selma',
    consigna: 'Selma se casó varias veces. ¿Con quiénes?',
    items: [
      ['Bob Patiño', 'Actor Secundario Bob', 'Sideshow Bob', 'Bob'], ['Troy McClure', 'Troy', 'McClure'], ['Lionel Hutz', 'Hutz'],
      ['Disco Stu'], ['Abe Simpson', 'Abuelo', 'Abe', 'Abraham'],
    ],
  },
  {
    id: 'alias-homero',
    titulo: 'Los otros nombres de Homero',
    consigna: 'Homero se hizo llamar de muchas formas. ¿Cuáles se acuerdan?',
    items: [
      ['Max Power'], ['El Señor Quitanieves', 'Señor Quitanieves', 'Sr. Quitanieves', 'Mr. Plow', 'Quitanieves'],
      ['Hombre Pay', 'Pie Man', 'el hombre pastel'], ['Homero Thompson', 'Thompson'],
      ['Sr. X', 'Señor X', 'Mr. X'],
    ],
  },
  {
    id: 'bouvier',
    titulo: 'La familia Bouvier',
    consigna: 'La familia de Marge, la de los Bouvier. ¿Quiénes son?',
    items: [
      ['Marge'], ['Patty', 'Paty'], ['Selma'], ['Jacqueline', 'Jaqueline', 'Jackie', 'la mamá de Marge'],
      ['Clancy', 'Clancy Bouvier', 'el papá de Marge'], ['Ling', 'Ling Bouvier'],
    ],
  },
  {
    id: 'abusones',
    titulo: 'Los abusones de la escuela',
    consigna: 'Los que le roban la merienda a Martin. ¿Quiénes son?',
    items: [['Nelson', 'Nelson Muntz'], ['Jimbo', 'Jimbo Jones'], ['Kearney', 'Kerney', 'Kearny'], ['Dolph', 'Dolf', 'Dolfo']],
  },
];
