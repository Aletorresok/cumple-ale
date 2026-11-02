# Estado del proyecto

Última actualización: 05/10/2026 (tarde). Cumpleaños: 08/11/2026.

## Hecho

- Base copiada de juegos-aula: salas con código y QR, pantalla grande, celulares, equipos,
  puntos y bancos de contenido. Se sacaron las clases, los bancos de materias y los juegos
  escolares (rosco, aventura, termómetro, ordenar).
- Juegos nuevos: selección de equipos con suspenso, mímica por equipos y podio final.
- Banco de ejemplo con encuestas, 40 palabras de mímica y un escape
  («¿Quién se llevó la torta?»).
- Piezas del código final: después de cada juego se le da al equipo ganador una pieza del
  código del último candado del escape; en el escape final cooperativo juntan las piezas.
- Probado con los emuladores y 30 invitados simulados: selección, mímica, los
  invitados dicen, escape y podio.
- Aviso «Sin conexión · reconectando…» en celulares, pantalla grande y panel. Aparece si se
  corta la red o si el wifi no tiene internet (una escritura que no llega en 4 segundos), y se
  va solo al volver. Probado con 40 invitados: celulares sin red, sin internet y recargados
  vuelven solos a su equipo y al juego.
- Medición de cuota: una pasada corta por todos los juegos con 40 invitados gasta unas 2.600
  lecturas y 200 escrituras. Una noche completa debería quedar entre 15.000 y 25.000 lecturas,
  dentro de la cuota gratis (50.000 por día) si el Firebase es propio.

- Página de diagnóstico (`?diagnostico=ABCD`) para revisar conexión y sala antes de empezar.
- Plan B en papel: el botón 🖨 de cada banco imprime todo para jugar sin internet.

- Temática Springfield para toda la noche: equipos, colores, tipografía, bienvenida y banco Simpson.
- Trivia «Springfield» (cultura Simpson) con la pregunta del contrato, que sale siempre. Modo «Con castigo»: cada integrante vota, la opción más votada es la del equipo (empata el capitán) y el que se equivoca paga una prenda. Fuera del menú: apuesta, nube de deseos y ruleta (30/10).
- Escapes de Lionel Hutz: modo «Cada equipo su escape», cuatro expedientes de 6 candados (uno
  por equipo, con letras de una clave, información repartida y una tarjeta física) y La
  sentencia cooperativa con las piezas. Probado con 30 invitados.

- La noche entera (08/10, Alexis eligió las 4 propuestas): «La noche, paso a paso» en el panel,
  Noticiero de Springfield para las pausas, Momento torta con los celulares como velitas sobre
  una dona rosa, y una sentencia personal de Hutz para cada invitado al final del podio.

- Intro de la noche (11/10): la tele pasa la apertura con fanfarria generada (o `audio/tema.mp3` si
  Alexis lo agrega) y una botonera de frases en el panel que las muestra y dice en la tele. Los
  audios oficiales no vienen en el repo.

- Narrador tipo Homero (11/10): voz de síntesis del navegador, grave y lenta, que comenta cada
  juego, lee el noticiero y dice lo que escribe el organizador. Se afina desde la tele («🎙 Voz»).
  No es la voz real del actor.

## Decisiones de Alexis

- Sí: selección de equipos, Los invitados dicen, mímica por equipos, podio.
- No: el impostor (11/10): con tanta gente se pierde el sentido.
- Trivia: sí, pero con otra temática. Hay tres propuestas para elegir en «Mis bancos»: Bien
  argentina, Cine tele y música, y Cultura general.
- A revisar: ¿Cuánto apostás?. Veremos: nube de deseos.
- No: «¿Quién es más probable que…?».
- Interés: sala de escape conectada con los otros juegos.
- Temática Simpson para toda la noche (05/10).
- Invitación por carta documento (PDF a mandar): llevarla al escape, firmada por Lionel Hutz.

## Pendiente

- Probarlo en una tele y celulares reales.
- Pasar a un Firebase propio (ver README).
- Cargar el banco real con cosas de la familia y los amigos.
- Elegir la temática de la trivia entre las tres propuestas.
