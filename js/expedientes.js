// Escapes de Lionel Hutz: cuatro expedientes (uno por equipo, para el modo «Cada equipo su
// escape») y la sentencia final cooperativa, que se abre con las piezas del código de la noche.
//
// Cómo está armado cada expediente (6 candados):
// - Cada candado abierto da una letra (recompensa). El candado 6 se abre con la palabra que
//   forman las 5 letras, así que no se puede saltear nada.
// - Dos candados tienen información dividida: cada integrante ve solo una parte en su celular.
// - Un candado tiene una pista física (tarjeta con QR para esconder en la fiesta). Si no se
//   imprimen, la segunda pista de ese candado trae el dato para no trabarse.
const MARCO = {
  titulo: 'La causa de la torta',
  intro: 'CARTA DOCUMENTO. Springfield, 8 de noviembre. Lionel Hutz, abogado (y repartidor de pizza los fines de semana), intima a los presentes a resolver los expedientes de la causa «Springfield contra quien se llevó la torta de Ale», en el plazo de 20 minutos y bajo apercibimiento de quedarse sin torta. Cada equipo recibe un expediente distinto. El primero en cerrarlo gana. Queda usted debidamente notificado.',
  final: 'Expedientes cerrados. Lionel Hutz ya tiene todas las pruebas: solo falta que el juez dicte la sentencia.',
};

const letra = (n, l) => `Consta en el expediente: la letra ${n} de la clave es «${l}».`;

const expediente = (titulo, intro, final, clave, candados) => ({
  tipo: 'escape', titulo, intro, final, minutos: 20, marco: MARCO,
  candados: [
    ...candados.map((c, i) => ({ ...c, recompensa: letra(i + 1, clave[i]) })),
    {
      titulo: 'El cierre del expediente', tipo: 'palabra', respuesta: clave.toLowerCase(),
      desafio: 'Para cerrar el expediente, el juez pide la clave: las letras que fueron apareciendo al abrir cada candado, en orden.',
      pistas: [`Son ${clave.length} letras, una por candado.`, `Empieza con «${clave[0]}».`],
    },
  ],
});

export const BANCO_HUTZ = {
  id: 'hutz',
  titulo: 'Springfield · Escapes de Lionel Hutz',
  materia: 'Cuatro expedientes (uno por equipo) y la sentencia final',
  items: [
    expediente('Expediente 1 · La planta nuclear',
      'El Sr. Burns jura que no sabe nada de la torta, pero alguien vio una caja sospechosa en el sector 7G. Hutz necesita pruebas: revisen la planta antes de que Burns suelte a los perros.',
      'Expediente cerrado: la caja del sector 7G tenía solo donas. Burns es inocente… esta vez.',
      'DONAS', [
        { titulo: 'El tablero del sector 7G', tipo: 'numero', respuesta: '77',
          desafio: 'Homero trabaja en el sector 7G. Cambien la G por su número en el abecedario (A = 1, B = 2…, sin la Ñ) y escriban el código: el 7 y después ese número.',
          pistas: ['A = 1, B = 2, C = 3…', 'La G es la séptima letra.'] },
        { titulo: 'La sala de descanso', tipo: 'numero', respuesta: '96',
          desafio: 'Faltan donas en la sala de descanso. Cada uno de ustedes tiene un dato distinto en el celular: júntenlos.',
          partes: ['Lenny comió el doble de donas que Carl.', 'Carl comió 3 donas.', 'Homero comió tantas como Lenny y Carl juntos.', 'El código es cuántas comió Homero y después cuántas comió Lenny.'],
          pistas: ['Lenny comió 6.', 'Homero comió 9: el código es 9 y 6.'] },
        { titulo: 'El camino al reactor', tipo: 'direccion', respuesta: 'arriba,derecha,abajo,derecha,arriba',
          desafio: 'Desde la puerta del sector 7G: suban por el pasillo hacia el norte, doblen al este, bajen la escalera hacia el sur, sigan al este y suban al norte hasta el reactor.',
          pistas: ['Norte es ↑, este es →, sur es ↓.', 'Son cinco flechas: ↑ → ↓ → ↑.'] },
        { titulo: 'Las barras de uranio', tipo: 'color', respuesta: 'amarillo,rojo,verde,azul',
          desafio: 'Las barras de uranio están en un orden que solo conocen entre todos. Junten sus datos.',
          partes: ['Hay cuatro barras: roja, verde, amarilla y azul.', 'La amarilla va primera.', 'La azul va última.', 'La verde va justo después de la roja.'],
          pistas: ['Si la amarilla es la primera y la azul la última, quedan la roja y la verde en el medio.', 'Amarillo, rojo, verde, azul.'] },
        { titulo: 'La oficina del Sr. Burns', tipo: 'palabra', respuesta: 'excelente',
          desafio: 'Detrás de un cuadro de la oficina de Burns hay una nota en clave. Búsquenla en la fiesta (tarjeta con QR). Cada letra está corrida un lugar hacia adelante en el abecedario (la A es B, la B es C…).',
          fisica: 'Nota del Sr. Burns: FYDFMFOUF',
          pistas: ['Para descifrar, corran cada letra un lugar hacia atrás: F es E.', 'La nota dice FYDFMFOUF. Es la palabra favorita de Burns.'] },
      ]),

    expediente('Expediente 2 · La taberna de Moe',
      'Moe dice que la torta nunca pasó por la taberna, pero hay migas en la barra. Hutz pidió una orden de allanamiento (la escribió en una servilleta). Revisen todo antes de que Moe cierre.',
      'Expediente cerrado: las migas eran de los maníes de Barney. Moe es inocente y les invita un Flameado.',
      'TRAGO', [
        { titulo: 'El teléfono de la barra', tipo: 'numero', respuesta: '19',
          desafio: 'Bart llama a la taberna y pregunta por «Armando Esteban Quito». El código es la cantidad de letras del nombre completo, sin contar los espacios.',
          pistas: ['Contá cada palabra por separado y sumá.', 'Armando (7) + Esteban (7) + Quito (5).'] },
        { titulo: 'La libreta de fiado', tipo: 'numero', respuesta: '26',
          desafio: 'Moe anota en una libreta lo que le deben. Cada uno de ustedes ve un renglón distinto: júntenlos.',
          partes: ['Lenny le debe $12 a Moe.', 'Barney debe el triple que Lenny.', 'Homero debe $10 menos que Barney.', 'El código es lo que debe Homero.'],
          pistas: ['Barney debe $36.', 'Homero debe 36 − 10.'] },
        { titulo: 'La rocola', tipo: 'color', respuesta: 'amarillo,azul,verde,rojo',
          desafio: 'La rocola se desbloquea con cuatro colores, en este orden: la piel de los Simpson, el pelo de Marge, el vestido de Marge y el collar de Marge.',
          pistas: ['La piel de los Simpson es amarilla y el pelo de Marge, azul.', 'El vestido de Marge es verde y el collar, rojo.'] },
        { titulo: 'El escondite de Moe', tipo: 'direccion', respuesta: 'derecha,abajo,abajo,izquierda',
          desafio: 'Moe guarda algo debajo de la barra. Para llegar desde la puerta hay que seguir un camino que conocen entre todos.',
          partes: ['Desde la puerta, primero se va hacia la derecha.', 'Después de la derecha, se baja dos veces.', 'Al final se va hacia la izquierda.', 'Son cuatro flechas en total.'],
          pistas: ['La primera es → y las dos siguientes son ↓.', '→ ↓ ↓ ←'] },
        { titulo: 'La pizarra del menú', tipo: 'palabra', respuesta: 'flameado / flameado de moe / flameadodemoe',
          desafio: 'La pizarra del menú de Moe está escondida en la fiesta (tarjeta con QR). Lean la primera letra de cada renglón, de arriba hacia abajo: es el trago secreto de la casa.',
          fisica: 'Menú de la taberna: Fritas · Limonada · Aceitunas · Maní · Empanadas · Agua · Duff · Ostras',
          pistas: ['Es el trago que inventó Homero y que Moe le robó.', 'El menú dice: Fritas, Limonada, Aceitunas, Maní, Empanadas, Agua, Duff, Ostras.'] },
      ]),

    expediente('Expediente 3 · El Kwik-E-Mart',
      'Apu vio a alguien salir del Kwik-E-Mart con una caja con forma de torta. Las cámaras de seguridad están encendidas (casi siempre). Revisen el local antes del cambio de turno.',
      'Expediente cerrado: la caja era de Squishees para el cumpleaños. «¡Gracias, vuelva pronto!»',
      'TURNO', [
        { titulo: 'El turno de Apu', tipo: 'numero', respuesta: '12',
          desafio: 'Apu trabajó 96 horas seguidas. Calculen cuántos días completos son y multipliquen ese número por el precio de un Squishee: $3.',
          pistas: ['Un día tiene 24 horas.', '96 horas son 4 días: 4 × 3.'] },
        { titulo: 'El producto robado', tipo: 'palabra', respuesta: 'squishee',
          desafio: 'Falta un producto de la heladera. Cada uno de ustedes tiene un dato: júntenlos para saber cuál es.',
          partes: ['Las letras del producto, mezcladas, son: E · H · I · Q · S · S · U · E.', 'Es una bebida helada que vende Apu.', 'Empieza con S y termina con dos E.'],
          pistas: ['Tiene 8 letras y es de muchos colores.', 'Es el Squishee.'] },
        { titulo: 'La caja registradora', tipo: 'numero', respuesta: '53',
          desafio: 'En la caja había 4 billetes de $20, 2 de $10 y 6 de $1. Snake se llevó la mitad de la plata. ¿Cuánto quedó?',
          pistas: ['En total había $106.', 'La mitad de 106.'] },
        { titulo: 'Las cámaras de seguridad', tipo: 'color', respuesta: 'violeta,azul,verde,naranja',
          desafio: 'La cámara grabó al sospechoso. Junten lo que ve cada uno para armar el código de colores.',
          partes: ['El código es el color de la gorra, la remera, el pantalón y las zapatillas, en ese orden.', 'La gorra era violeta.', 'La remera era del color del pelo de Marge.', 'El pantalón era verde y las zapatillas, naranjas.'],
          pistas: ['El pelo de Marge es azul.', 'Violeta, azul, verde, naranja.'] },
        { titulo: 'El depósito', tipo: 'direccion', respuesta: 'arriba,arriba,izquierda,abajo',
          desafio: 'El plano del depósito está escondido en la fiesta (tarjeta con QR). Sigan el camino que marca, flecha por flecha.',
          fisica: 'Plano del depósito: desde la heladera de Squishee, dos pasos hacia arriba, uno a la izquierda y uno hacia abajo.',
          pistas: ['Son cuatro flechas y las dos primeras son iguales.', 'El plano dice: dos hacia arriba, una a la izquierda y una hacia abajo.'] },
      ]),

    expediente('Expediente 4 · La escuela primaria',
      'El director Skinner asegura que la torta fue confiscada «por motivos pedagógicos». Hutz sospecha de la sala de profesores. Revisen la escuela antes de que suene la campana.',
      'Expediente cerrado: Skinner la tenía guardada para el cumpleaños de su mamá. La devuelve, con una nota a los padres.',
      'TAREA', [
        { titulo: 'El pizarrón de Bart', tipo: 'numero', respuesta: '50',
          desafio: 'Bart escribió 100 veces la misma frase en el pizarrón. Cada frase le lleva 30 segundos. ¿Cuántos minutos tardó?',
          pistas: ['Dos frases tardan un minuto.', '100 frases ÷ 2 por minuto.'] },
        { titulo: 'Los casilleros', tipo: 'palabra', respuesta: 'lisa',
          desafio: 'La torta estuvo un rato en un casillero. Junten los datos de cada uno para saber de quién era.',
          partes: ['Bart, Lisa y Milhouse tienen los casilleros 1, 2 y 3.', 'Lisa no tiene el casillero 1.', 'Milhouse tiene un casillero con número par.', 'El código es el nombre de quien tiene el casillero 3.'],
          pistas: ['El único número par es el 2: ese es el de Milhouse.', 'Si Lisa no tiene el 1, tiene el 3.'] },
        { titulo: 'El autobús de Otto', tipo: 'numero', respuesta: '13',
          desafio: 'El autobús sale con 12 chicos. En la primera parada bajan 5 y suben 3. En la segunda bajan 4 y suben 7. ¿Cuántos chicos llegan a la escuela?',
          pistas: ['Después de la primera parada quedan 10.', '10 − 4 + 7.'] },
        { titulo: 'El recreo', tipo: 'direccion', respuesta: 'arriba,derecha,derecha,izquierda',
          desafio: 'Nelson los persigue en el recreo. El camino para escapar lo saben entre todos.',
          partes: ['La primera flecha es la contraria a «abajo».', 'La segunda y la tercera van hacia donde sale el sol (el este).', 'La última va hacia donde se pone el sol (el oeste).', 'Son cuatro flechas.'],
          pistas: ['El este es → y el oeste es ←.', '↑ → → ←'] },
        { titulo: 'La nota de Skinner', tipo: 'palabra', respuesta: 'skinner',
          desafio: 'Skinner escondió una nota con números en la fiesta (tarjeta con QR). Cada número es una letra: A = 1, B = 2…, sin la Ñ.',
          fisica: 'Nota pegada debajo del escritorio: 19 · 11 · 9 · 14 · 14 · 5 · 18',
          pistas: ['19 es la S.', 'La nota dice 19 · 11 · 9 · 14 · 14 · 5 · 18: es un apellido.'] },
      ]),

    {
      tipo: 'escape',
      titulo: 'La sentencia',
      intro: 'Los cuatro expedientes están cerrados y el juez Snyder está listo para dictar sentencia. Lionel Hutz necesita que todo Springfield trabaje junto: cada equipo tiene una parte del caso y el último candado se abre con las piezas del código que ganaron en la noche.',
      final: '¡SENTENCIA! El juez declara a la torta de Ale «libre de culpa y cargo» y ordena comerla de inmediato. Lionel Hutz cobra sus honorarios en porciones. ¡Que vengan las velitas!',
      minutos: 15,
      candados: [
        { titulo: 'La pregunta del juez', tipo: 'palabra', respuesta: 'romper',
          desafio: 'El juez Snyder pregunta: «¿Qué es un contrato?». Hutz responde: «El diccionario lo define como un acuerdo que no se puede ____, que no se puede ____». Completen la palabra.',
          pistas: ['Es lo que no se puede hacer con un acuerdo.', 'Empieza con R.'] },
        { titulo: 'Las cuatro claves', tipo: 'numero', respuesta: '4',
          desafio: 'Cada equipo cerró su expediente con una clave de cinco letras. Pregúntenles a los otros equipos la suya: ¿cuántas letras A hay en total entre las cuatro claves?',
          pistas: ['Las claves eran DONAS, TRAGO, TURNO y TAREA.', 'DONAS tiene 1, TRAGO 1, TURNO 0 y TAREA 2.'] },
        { titulo: 'El semáforo del juzgado', tipo: 'color', respuesta: 'rojo,amarillo,verde',
          desafio: 'Para entrar al juzgado hay que respetar el semáforo: los colores de «pare», «precaución» y «avance», en ese orden.',
          pistas: ['Son tres colores.', 'Rojo, amarillo, verde.'] },
        { titulo: 'La dirección de los Simpson', tipo: 'direccion', respuesta: 'arriba,derecha,abajo',
          desafio: 'El juez manda a notificar a los Simpson en Avenida Siempreviva 742. Cada número es una flecha: 7 = ↑, 4 = →, 2 = ↓.',
          pistas: ['Son tres flechas, una por número.', '↑ → ↓'] },
        { titulo: 'La sentencia', tipo: 'numero', respuesta: '0811',
          desafio: 'El último candado se abre con el código que fueron ganando en los juegos de la noche. Junten las piezas de todos los equipos.',
          pistas: ['Es una fecha muy importante para esta fiesta.', 'Día y mes del cumple de Ale, con dos números cada uno.'] },
      ],
    },
  ],
};
