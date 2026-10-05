# Plan hasta el cumple · 8 de noviembre de 2026

Hoy es 5 de octubre: quedan cinco semanas. La idea es tener la app **terminada el 1 de
noviembre** y usar la última semana solo para ensayar y corregir, así llegamos sobrados.

Cada tarea dice quién la hace: **🤖 Claude** (se hace sola, en una rama con PR que se mergea) o
**🙋 Alexis** (solo vos podés: cuentas, datos de la familia, probar con gente real).

## Resumen

| Semana | Foco | Hito al terminar |
|---|---|---|
| 1 · 5 al 11 oct | Robustez técnica | Aguanta 30 celulares, reconexiones y cortes; hay plan B en papel |
| 2 · 12 al 18 oct | Firebase propio y contenido | La app corre en su propio Firebase con el banco real |
| 3 · 19 al 25 oct | Ensayo chico | Probada con 6 a 10 personas reales en la tele de verdad |
| 4 · 26 oct al 1 nov | Pulido y congelamiento | Versión final congelada el domingo 1 |
| 5 · 2 al 7 nov | Ensayo general | Todo probado en el lugar, checklist lista |
| 8 nov | 🎂 Cumple | — |

## Semana 1 · Robustez técnica (5 al 11 oct)

Lo que más puede arruinar la noche no es un juego feo sino que se caiga la conexión, que alguien
quede afuera o que se corte la tele. Esta semana va todo a eso.

- 🤖 **Indicador de conexión** en el celular, la pantalla grande y el panel: si se corta el wifi,
  aparece «Sin conexión, reconectando…» y desaparece solo al volver. Nadie se queda mirando una
  pantalla congelada sin saber por qué.
- 🤖 **Reconexión probada**: invitados que recargan la página, que bloquean el celular, que
  pierden señal un minuto o que cierran el navegador vuelven a su equipo y al juego en curso.
  Se agrega a la prueba automática (celulares que se desconectan y vuelven en medio de un juego).
- 🤖 **Prueba de carga con 40 celulares** (30 + margen) y medición de cuánto gasta una noche
  entera de la cuota gratis de Firebase (50.000 lecturas y 20.000 escrituras por día). Si da
  justo, se recorta lo que más gasta antes de la fiesta.
- 🤖 **Panel de control a prueba de accidentes**: si se te apaga el celular o se recarga la
  página, retomás la sala desde otro dispositivo sin perder puntos ni el juego en curso (ya
  existe «Controlar desde acá»; se prueba y se pule).
- 🤖 **Plan B en papel**: botón para imprimir tarjetas de respaldo desde el banco (palabras de
  mímica, pares del impostor, encuestas con sus respuestas). Si se cae internet del todo, la
  fiesta sigue con papelitos.
- 🤖 **Página de diagnóstico** (`?diagnostico`): comprueba en segundos que Firebase responde, que
  entran invitados y cuánto tarda. Sirve para verificar el Firebase nuevo y para el día de la
  fiesta, antes de que llegue la gente.
- 🤖 **Propuestas de trivia**: dos o tres bancos de preguntas con temáticas distintas para que
  elijas una (o las combines).
- 🙋 **Activar GitHub Pages** (2 minutos, pasos en el README). Sin esto no hay dirección para
  entrar desde los celulares.
- 🙋 **Elegir la temática de la trivia** entre las propuestas.
- 🙋 **Primera prueba casera**: la compu conectada a la tele + 3 o 4 celulares de la casa.
  Anotá todo lo que moleste, aunque sea chico.

## Semana 2 · Firebase propio y contenido real (12 al 18 oct)

- 🙋 **Crear el proyecto de Firebase `cumple-ale`** (15 minutos, pasos en el README) y pasarme
  los datos de la app web (no son secretos). Así no compartimos cuota con juegos-aula.
- 🤖 Cambiar la configuración, publicar reglas e índices, y correr la prueba completa contra el
  proyecto nuevo con la página de diagnóstico.
- 🙋 **Mandarme el contenido de la familia y los amigos**, aunque sea desordenado (audio, lista,
  lo que sea). Lo que más rinde:
  - Lista de invitados (nombres o apodos) para armar equipos y mensajes.
  - 10 a 15 anécdotas o datos tuyos y de la familia para la trivia y el escape.
  - Palabras de mímica propias (chistes internos, lugares, comidas, frases tuyas).
  - Pares para el impostor con cosas de ustedes.
- 🤖 Armar el **banco real** con todo eso: encuestas, pares, mímica, trivia y un escape propio
  con la historia de la noche y el código final.
- 🤖 **Encuesta previa** (opcional, si te gusta): un enlace que mandás por WhatsApp unos días
  antes; cada invitado responde 8 preguntas cortas y con eso se arma el tablero de «Los
  invitados dicen» con respuestas de verdad de tus invitados.
- 🙋 Decidir si van **¿Cuánto apostás?** y la **nube de deseos** (si no, se ocultan del menú).

## Semana 3 · Ensayo chico (19 al 25 oct)

- 🙋 **Ensayo con 6 a 10 personas reales** (sugerido: sábado 24), en la tele y con el wifi que
  vas a usar. Jugar una ronda de cada juego, en el orden de la noche.
- 🤖 **Guion de la noche**: orden de juegos, tiempos, qué decir al presentar cada uno, cuándo
  dar cada pieza del código. Una hoja para tener a mano.
- 🤖 Corregir todo lo que salga del ensayo.
- 🤖 Pulido de la pantalla grande: legibilidad desde lejos, sonidos, transiciones, cartel de
  bienvenida con tu nombre.

## Semana 4 · Pulido y congelamiento (26 oct al 1 nov)

- 🤖 Últimos ajustes y una ronda de revisión de código buscando errores.
- 🤖 Prueba automática completa de la noche entera, en el orden real, con 40 invitados.
- 🔒 **Domingo 1 de noviembre: se congela la versión.** Desde ahí solo se corrigen errores, nada
  nuevo. Queda marcada en GitHub (`v1.0`) por si hay que volver atrás.

## Semana 5 · Ensayo general (2 al 7 nov)

- 🙋 **Ensayo general en el lugar de la fiesta** (o con el mismo equipo): la compu, el cable a
  la tele, el wifi del lugar, el sonido. Probar también el plan B: hotspot del celular.
- 🙋 Imprimir el guion, el QR grande para la entrada y las tarjetas de respaldo.
- 🤖 Corrección de lo que aparezca y repaso final de la checklist.
- 🙋 Viernes 6 o sábado 7: abrir la sala de la fiesta y dejarla lista (dura 12 horas, así que
  conviene abrirla el mismo día; ver checklist).

## Robustez: qué puede fallar y qué hacemos

| Riesgo | Prevención | Si pasa igual |
|---|---|---|
| Se corta el wifi del lugar | Los invitados juegan con sus datos móviles; la compu de la tele va con cable o con hotspot de un celular cargado | Hotspot del celular para la tele; la app reconecta sola |
| Se cae internet del todo | Tarjetas de respaldo impresas | Mímica, impostor y encuestas en papel; puntos a mano |
| Un invitado recarga o se le apaga el celular | Vuelve solo a su equipo (queda guardado en el celular) | Si cambió de celular, entra con otro nombre y lo movés de equipo desde el panel |
| Se te apaga el celular con el panel | Panel abierto también en otra pestaña o dispositivo | «Controlar desde acá» en el otro dispositivo |
| Se acaba la cuota gratis de Firebase | Firebase propio, medido con la prueba de carga | Pasar el proyecto a plan Blaze con tope de gasto (centavos) |
| La tele se apaga o el navegador se cuelga | Pantalla siempre encendida (ya está), cargador conectado | Recargar `?tv=CÓDIGO`: vuelve al juego en curso |
| Alguien sin celular o sin batería | — | Juega en el celular de alguien de su equipo |
| Llega gente tarde | Se suman solos al equipo más chico | — |

## Checklist del día (8 de noviembre)

**Antes de que llegue la gente (2 horas antes)**

1. Compu enchufada, conectada a la tele, sonido de la tele probado.
2. Wifi del lugar funcionando; hotspot del celular cargado y probado como respaldo.
3. Abrir `?diagnostico` en la compu y en un celular: todo en verde.
4. Entrar al panel, **abrir la sala de la fiesta** (4 equipos) y abrir la pantalla grande en la
   compu. Pantalla completa y «Activar sonido».
5. Escribir el código final del escape en el panel (o «Usar el del escape»).
6. Entrar con un celular de prueba, ver que aparece en la tele, y sacarlo.
7. Panel abierto también en un segundo dispositivo (tablet o celular de alguien de confianza).
8. Tarjetas de respaldo y guion impresos, al lado de la compu.
9. QR grande impreso en la entrada y el wifi del lugar escrito al lado.
10. Celular del panel con brillo alto, sin ahorro de batería, cargado o enchufado.

**Durante la fiesta**

- Recibir con la tele mostrando el QR: la gente entra mientras llega.
- Selección de equipos cuando estén casi todos (los que llegan tarde se suman solos).
- Después de cada juego: 🧩 **Dar pieza** al equipo ganador.
- Escape final y podio para cerrar.

**Si algo falla:** recargar la página que falla; si es la conexión, pasar la compu al hotspot;
si es todo internet, tarjetas de respaldo.

## Lo que solo puede hacer Alexis

1. Activar GitHub Pages (semana 1).
2. Elegir la temática de la trivia (semana 1).
3. Prueba casera con la tele y 3 o 4 celulares (semana 1).
4. Crear el proyecto de Firebase propio y pasarme sus datos (semana 2).
5. Mandar el contenido de la familia y los amigos (semana 2).
6. Decidir ¿Cuánto apostás? y nube de deseos (semana 2).
7. Ensayo chico con gente real (semana 3) y ensayo general en el lugar (semana 5).
8. Imprimir lo impreso y llevar el equipo el día de la fiesta.
