# Cumple Ale · juegos

Juegos para el cumpleaños de Ale (8 de noviembre de 2026), pensados para 20 a 30 personas a la
vez. Una pantalla grande (tele o proyector) muestra el juego, cada invitado juega desde su
celular sin cuenta ni instalación, y quien organiza maneja todo desde su propio celular.

Sale de dos apps anteriores: **juegos-aula** (Recreo), de donde viene la base de salas,
pantalla grande, celulares, equipos y varios juegos, y el **cumple de Pau** (PauPotter), de
donde vienen la ceremonia de selección, la mímica y el cierre con podio.

## Juegos

| Juego | Qué usa del banco | Cómo se juega |
|---|---|---|
| 🎩 **Selección de equipos** | Nada | De a uno, cada invitado sale en la pantalla grande, los equipos giran con suspenso y se revela adónde va. Los equipos quedan parejos. Puede pasar solo, uno tras otro. |
| 📊 **Los invitados dicen** | Encuestas (o nada) | Al estilo de 100 argentinos dicen. Las encuestas salen del banco o de lo que responden los invitados en el momento. Tres errores y otro equipo puede robar el pozo. |
| 🕵️ **El impostor** | Pares de palabras | Todos tienen la misma palabra menos uno, que no sabe que es el impostor. Pistas en voz alta y votación desde el celular. |
| 🎭 **Mímica por equipos** | Palabras de mímica | Alguien del equipo ve la palabra en su celular y la actúa; marca «¡Adivinaron!» o «Pasar». Cada acierto suma 10. |
| 🔐 **Sala de escape** | Escapes | Candados (números, palabras, flechas o colores) por equipos, en carrera o todos juntos. |
| 🏆 **Podio final** | Nada | Revela el ranking del último al campeón, con papelitos. |

**🧩 Piezas del código final.** Conectan todo con la sala de escape. En el panel de la sala
escribís el código del último candado del escape (o tocás «Usar el del escape…»). Después de
cada juego, tocás **🧩 Dar pieza** en el equipo que ganó: le llega un número del código en su
posición, que ven en el celular. En el escape final, en modo cooperativo, los equipos tienen que
juntar sus piezas para abrir el último candado. El escape de ejemplo ya viene preparado así.

**⚡ Trivia: tres temáticas propuestas.** En «Mis bancos» hay un botón para agregar cada una
(15 preguntas cada una): *Bien argentina* (historia, geografía, fútbol, música), *Cine, tele y
música* y *Cultura general*. Se pueden editar o combinar, y sumar preguntas sobre Ale.

También quedan disponibles, a revisar: ⚡ Trivia por equipos, 🎲 ¿Cuánto apostás?, ☁️ Nube de
deseos y 🎯 ¿A quién le toca? (sorteo).

**🖨 Plan B en papel.** En «Mis bancos», el botón 🖨 de cada banco imprime todo para jugar sin
internet: tarjetas de mímica para recortar, pares del impostor por ronda, encuestas con sus
respuestas, preguntas con la correcta marcada, el escape con sus respuestas y una hoja de puntos.

**🩺 Diagnóstico.** `…/cumple-ale/?diagnostico` revisa en segundos que el dispositivo llega a
Firebase y cuánto tarda; con `?diagnostico=ABCD` revisa también la sala (horas que le quedan,
invitados, código final). Está enlazado desde el panel de la sala.

## Cómo se usa

1. Entrá a la app y tocá **Organizo yo →**. Entrás con tu cuenta de Google.
2. Tocá **🎉 Agregar el banco de ejemplo** y editalo con cosas de la familia y los amigos.
3. **Abrí una sala** (4 equipos va bien para 30 personas) y tocá **Abrir pantalla grande** en la
   computadora conectada a la tele.
4. Los invitados escanean el QR o entran con el código de 4 letras.
5. Empezá por la **Selección de equipos** y seguí con los juegos desde tu celular. Los puntos se
   acumulan entre juegos hasta el podio.

## Puesta en marcha

La app es una página estática con Firebase (plan gratuito) para las salas en tiempo real.
**Por ahora usa el proyecto de Firebase de juegos-aula**, que ya está configurado y tiene las
mismas reglas, así que funciona sin hacer nada más que publicar la página.

### Publicar con GitHub Pages

En GitHub: *Settings → Pages → Build and deployment → Source: Deploy from a branch*, rama
`main`, carpeta `/ (root)`, **Save**. A los minutos queda en
`https://aletorresok.github.io/cumple-ale/`.

### (Recomendado antes del cumple) Firebase propio

Para no mezclar con juegos-aula ni compartir su cuota:

1. Creá un proyecto en la [consola de Firebase](https://console.firebase.google.com) (por ejemplo
   `cumple-ale`) y agregale una app web. Copiá sus datos en [`js/config.js`](js/config.js).
2. *Firestore Database → Crear base de datos*. Después, en *Reglas*, pegá el contenido de
   [`firestore.rules`](firestore.rules) y tocá **Publicar**.
3. *Authentication → Método de acceso*: activá **Anónimo** y **Google**.
4. *Authentication → Configuración → Dominios autorizados*: agregá `aletorresok.github.io`.

## Probar en la computadora

Con los emuladores de Firebase (hace falta Java):

```
npm i -D firebase-tools playwright firebase
npx firebase emulators:start --only auth,firestore --project juegos-aula
python3 -m http.server 5173
node pruebas/fiesta.mjs 30 capturas      # 30 invitados simulados juegan una noche entera
```

La prueba también corta la red de algunos celulares, recarga otros, y al final muestra cuántas
lecturas y escrituras de Firebase gastó cada juego.

En `http://localhost:5173/`, con `localStorage.emulador = '1'` la app usa los emuladores.

## Estructura del código

```
index.html                 página única
css/estilos.css            estilos (la pantalla grande es siempre oscura)
js/app.js                  decide qué mostrar: ?tv=, ?docente, ?sala=
js/config.js               configuración de Firebase y colores de equipos
js/fb.js                   conexión con Firebase
js/sala.js                 estado compartido de una sala
js/bancos.js               bancos de contenido y su editor
js/ejemplos.js             banco de ejemplo de la fiesta
js/escapes.js              candados y editor de escapes
js/docente.js              panel de quien organiza
js/alumno.js               vista del invitado (celular)
js/tv.js                   pantalla grande
js/juegos/*.js             un archivo por juego (configurar, iniciar, host, alumno, tv)
firestore.rules            reglas de seguridad de la base de datos
pruebas/fiesta.mjs         prueba de punta a punta con invitados simulados
```

Para agregar un juego: crear `js/juegos/mijuego.js` con la misma forma que los demás y sumarlo
a `js/juegos/index.js`.
