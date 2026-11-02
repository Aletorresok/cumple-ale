// Banco del juego «Frases en argentino»: frases famosas de Los Simpson reescritas en
// rioplatense. La tele muestra la versión argentina y los equipos tienen que adivinar la
// original (la del doblaje latino, que es la que todos conocemos).
//
// Cada frase: argento (lo que sale en la tele), original (la respuesta), quien (pista) y,
// si hace falta, nota (de dónde sale, se muestra al revelar).
const f = (argento, original, quien, nota = '') => ({ argento, original, quien, nota });

export const FRASES = [
  f('Mmm… bolas de fraile.', 'Mmm… rosquillas.', 'Homero'),
  f('¡Uh, la pucha, loco!', '¡Ay, caramba!', 'Bart'),
  f('¡Morfate mis calzones, chabón!', '¡Cómete mis calzones!', 'Bart'),
  f('Sin cable y sin birra, Homero está de la nuca.', 'Sin TV y sin cerveza, Homero pierde la cabeza.', 'Homero', 'La parodia de «El resplandor»'),
  f('Joya… nunca taxi.', 'Excelente…', 'El Sr. Burns', 'Juntando la punta de los dedos'),
  f('Ni ahí fui yo. Nadie me vio. No tienen ni una prueba, gato.', 'Yo no fui. Nadie me vio. No pueden probar nada.', 'Bart'),
  f('¿Qué hacés, vecinito? ¿Todo joyita, joyita?', '¡Hola, holita, vecinito!', 'Ned Flanders'),
  f('Buenas, soy Troy McClure. Capaz me junaron en pelis como «Che, ¿quién me afanó el riñón?».', 'Hola, soy Troy McClure. Tal vez me recuerden de películas como…', 'Troy McClure'),
  f('¡Súper Family Game Chalmers!', '¡Súper Nintendo Chalmers!', 'Ralph'),
  f('Bodegón de Moe, habla Moe, ¿quién jode?', 'Taberna de Moe, habla Moe.', 'Moe', 'Cuando Bart le hace bromas por teléfono'),
  f('¡Vamo’ arribaaa!', '¡Woo-hoo!', 'Homero'),
  f('¡Por el fernet! El que te mete en todos los quilombos y el que te saca.', 'Por el alcohol: la causa y la solución de todos los problemas de la vida.', 'Homero'),
  f('Smithers, mandale los dogos.', 'Smithers, suelta a los perros.', 'El Sr. Burns'),
  f('Gracias, papu. ¡Volvé cuando pinte!', 'Gracias, vuelva prontos.', 'Apu'),
  f('Si el laburo no te cabe, no hacés paro: caés todos los días y lo hacés como el traste. Bien argentino.', 'Si no te gusta tu trabajo, no haces huelga: vas todos los días y lo haces con desgano. Ese es el estilo americano.', 'Homero'),
  f('La peor temporada de la historia. Lejos. Ni se gasten.', '¡El peor episodio de la historia!', 'El sujeto de las historietas'),
  f('¡Vení para acá, pendejo de…!', '¡Por qué tú, pequeño…!', 'Homero', 'Mientras ahorca a Bart'),
  f('Yo andaba con un morrón colgado del cinto, que en esa época era lo más.', 'Me até una cebolla al cinturón, que era la moda en esa época.', 'El abuelo Simpson'),
  f('Mi vieja dice que soy re facha.', 'Mi mamá dice que soy guapo.', 'Milhouse'),
  f('Lisa, los vampiros son puro chamuyo, como los duendes, los gremlins y los cordobeses.', 'Lisa, los vampiros son seres inventados, como los duendes, los gremlins y los esquimales.', 'Homero'),
  f('¡Jajá! ¡Tomá, pa’ que tengas!', '¡Ja-ja!', 'Nelson'),
  f('¡Nena, en esta casa la termodinámica se respeta, ¿me entendiste?!', '¡Lisa, en esta casa obedecemos las leyes de la termodinámica!', 'Homero'),
  f('Choripanes al vapor, Superintendente.', 'Hamburguesas al vapor.', 'El director Skinner', 'El almuerzo con Chalmers'),
  f('Le pusiste onda y te salió como el traste. Moraleja: ni te gastes.', 'Lo intentaste y fallaste miserablemente. La lección es: nunca lo intentes.', 'Homero'),
  f('Yo, por mi parte, ya me hago amigo de los nuevos capos: las cucarachas.', 'Yo, por mi parte, doy la bienvenida a nuestros nuevos amos insectos.', 'Kent Brockman'),
];
