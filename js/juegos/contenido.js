// ============================================================
// Contenido libre precargado.
// Cada "set" tiene la misma forma que tendrá un juego creado por un profesor
// (tabla juegos: tipo, titulo, categoria, nivel, datos, publico), así la
// biblioteca libre podrá mezclar estos sets con los de los profesores.
// ============================================================

// Juegos disponibles y qué datos usan
export const JUEGOS = {
  sopa:     { nombre: 'Sopa de letras', ico: '🔎', usa: 'palabras', color: '#14A3B8',
              desc: 'Busca las palabras ocultas y demuestra tu agilidad mental.' },
  quiz:     { nombre: 'Quiz', ico: '💡', usa: 'preguntas', color: '#8E5BE8',
              desc: 'Demuestra cuánto sabes y elige la mejor respuesta.' },
  ahorcado: { nombre: 'Ahorcado', ico: '🦘', usa: 'palabras', color: '#F28C0F',
              desc: 'Adivina la palabra antes de que el cangurito se canse de colgar.' },
  memoria:  { nombre: 'Memorama', ico: '🃏', usa: 'parejas', color: '#4CAF2E',
              desc: 'Encuentra los pares y ejercita tu memoria.' },
  rompecabezas: { nombre: 'Rompecabezas', ico: '🧩', usa: 'imagenes', color: '#EC4C93',
              desc: 'Arma la imagen pieza por pieza. ¡También con una foto de la familia!' },
  frase:    { nombre: 'Ordena la frase', ico: '🔤', usa: 'frases', color: '#2F80ED',
              desc: 'Forma la frase correcta y demuestra tu talento.' },
  trivia:   { nombre: 'Trivia Bíblica', ico: '📖', usa: 'trivia', color: '#7B4FD6',
              desc: 'Pon a prueba tu conocimiento de la Biblia.' },
  ordena:   { nombre: 'Ordena la palabra', ico: '🔀', usa: 'palabras', color: '#27AE60',
              desc: 'Las letras están revueltas: ordénalas con ayuda de la pista.' }
};

const p = (palabra, pista) => ({ palabra, pista });

export const SETS = [
  { id: 'animales', titulo: 'Animales', ico: '🐾', categoria: 'Ciencia', nivel: 'Primaria', autor: 'QuizApp',
    palabras: [
      p('PERRO', 'El mejor amigo del ser humano'), p('JIRAFA', 'Tiene el cuello más largo'),
      p('ELEFANTE', 'Tiene trompa y orejas grandes'), p('CÓNDOR', 'Ave andina de alas enormes'),
      p('VICUÑA', 'Aparece en el escudo del Perú'), p('DELFÍN', 'Mamífero marino muy juguetón'),
      p('TORTUGA', 'Lleva su casa en la espalda'), p('LLAMA', 'Camélido de los Andes'),
      p('PINGÜINO', 'Ave que no vuela y nada muy bien'), p('COCODRILO', 'Reptil de mandíbula poderosa'),
      p('MARIPOSA', 'Antes fue oruga'), p('CANGURO', 'Salta y lleva a su cría en una bolsa'),
      p('BALLENA', 'El animal más grande del planeta'), p('LORO', 'Ave que puede imitar palabras'),
      p('CUY', 'Roedor andino')
    ] },
  { id: 'frutas', titulo: 'Frutas del Perú', ico: '🥭', categoria: 'Alimentación', nivel: 'Primaria', autor: 'QuizApp',
    palabras: [
      p('MANGO', 'Amarillo, dulce y jugoso'), p('LÚCUMA', 'Sabor clásico de helado peruano'),
      p('CHIRIMOYA', 'Verde por fuera, blanca por dentro'), p('PLÁTANO', 'Se pela y es amarillo'),
      p('FRESA', 'Roja con semillitas por fuera'), p('MANZANA', 'Roja o verde, crujiente'),
      p('NARANJA', 'Fruta y color a la vez'), p('SANDÍA', 'Verde por fuera, roja por dentro'),
      p('PIÑA', 'Tiene corona'), p('UVA', 'Crece en racimos'), p('GRANADILLA', 'Se rompe la cáscara y tiene semillas'),
      p('AGUAYMANTO', 'Pequeña, naranja, con capuchón'), p('PAPAYA', 'Naranja por dentro con semillas negras'),
      p('DURAZNO', 'Piel suave como terciopelo'), p('MARACUYÁ', 'Ácida, ideal para refresco')
    ] },
  { id: 'verbos', titulo: 'Verbos de acción', ico: '🏃', categoria: 'Comunicación', nivel: 'Primaria', autor: 'QuizApp',
    palabras: [
      p('CANTAR', 'Lo haces con tu voz y una melodía'), p('CORRER', 'Ir muy rápido con las piernas'),
      p('SALTAR', 'Despegar los pies del suelo'), p('ESCRIBIR', 'Usar lápiz y papel'),
      p('LEER', 'Lo haces con un libro'), p('DIBUJAR', 'Hacer un retrato'), p('NADAR', 'Moverse en el agua'),
      p('BAILAR', 'Moverse con la música'), p('COMER', 'Lo haces en el almuerzo'), p('DORMIR', 'Lo haces de noche'),
      p('JUGAR', 'Lo haces en el recreo'), p('PENSAR', 'Usar la cabeza'), p('APRENDER', 'Lo que haces en la escuela'),
      p('REÍR', 'Lo haces con un chiste'), p('VIAJAR', 'Ir a otro lugar')
    ] },
  { id: 'cuerpo', titulo: 'Cuerpo humano', ico: '🫀', categoria: 'Ciencia', nivel: 'Primaria / Secundaria', autor: 'QuizApp',
    palabras: [
      p('CORAZÓN', 'Bombea la sangre'), p('PULMÓN', 'Respiramos con él'), p('CEREBRO', 'Controla todo el cuerpo'),
      p('HÍGADO', 'Órgano que limpia la sangre'), p('RIÑÓN', 'Filtra y forma la orina'), p('ESTÓMAGO', 'Allí empieza la digestión'),
      p('HUESO', 'Forma el esqueleto'), p('MÚSCULO', 'Nos permite movernos'), p('SANGRE', 'Líquido rojo'),
      p('PIEL', 'El órgano más grande'), p('COLUMNA', 'Sostiene la espalda'), p('RODILLA', 'Articulación de la pierna'),
      p('CODO', 'Articulación del brazo'), p('TOBILLO', 'Une el pie con la pierna')
    ] },
  { id: 'paises', titulo: 'Países', ico: '🌎', categoria: 'Geografía', nivel: 'Primaria / Secundaria', autor: 'QuizApp',
    palabras: [
      p('PERÚ', 'Su capital es Lima'), p('CHILE', 'Su capital es Santiago'), p('BRASIL', 'Su capital es Brasilia'),
      p('ARGENTINA', 'Su capital es Buenos Aires'), p('COLOMBIA', 'Su capital es Bogotá'), p('ECUADOR', 'Su capital es Quito'),
      p('BOLIVIA', 'Su capital es Sucre'), p('MÉXICO', 'Su capital es Ciudad de México'), p('URUGUAY', 'Su capital es Montevideo'),
      p('PARAGUAY', 'Su capital es Asunción'), p('VENEZUELA', 'Su capital es Caracas'), p('CANADÁ', 'Su capital es Ottawa'),
      p('ESPAÑA', 'Su capital es Madrid'), p('JAPÓN', 'Su capital es Tokio'), p('ITALIA', 'Su capital es Roma')
    ] },
  { id: 'ciencia', titulo: 'Palabras de ciencia', ico: '🔬', categoria: 'Ciencia', nivel: 'Secundaria', autor: 'QuizApp',
    palabras: [
      p('ÁTOMO', 'La partícula de la materia'), p('CÉLULA', 'Unidad básica de la vida'), p('ENERGÍA', 'Capacidad de hacer trabajo'),
      p('GRAVEDAD', 'Nos mantiene en el suelo'), p('PLANETA', 'La Tierra es uno'), p('GALAXIA', 'La Vía Láctea es una'),
      p('FOTOSÍNTESIS', 'Así fabrican su alimento las plantas'), p('MOLÉCULA', 'Unión de átomos'), p('VOLCÁN', 'Expulsa lava'),
      p('IMÁN', 'Atrae el hierro'), p('OXÍGENO', 'Gas que respiramos'), p('BACTERIA', 'Ser vivo de una sola célula'),
      p('ECOSISTEMA', 'Seres vivos y su ambiente'), p('ELECTRICIDAD', 'Enciende los focos')
    ] },
  { id: 'peru', titulo: 'Perú: lugares y cultura', ico: '🇵🇪', categoria: 'Personal social', nivel: 'Primaria / Secundaria', autor: 'QuizApp',
    palabras: [
      p('MACHU PICCHU', 'Ciudadela inca en Cusco'), p('TITICACA', 'Lago navegable más alto del mundo'),
      p('AREQUIPA', 'La Ciudad Blanca'), p('AMAZONAS', 'El río más caudaloso'), p('CEVICHE', 'Plato bandera con pescado y limón'),
      p('MARINERA', 'Baile nacional con pañuelo'), p('CAJÓN', 'Instrumento de percusión peruano'), p('NAZCA', 'Famosas por sus líneas'),
      p('CHAVÍN', 'Cultura del Lanzón'), p('PARACAS', 'Cultura de los mantos'), p('CUSCO', 'Capital del Tahuantinsuyo'),
      p('INTI RAYMI', 'Fiesta del Sol')
    ] }
];

// Dibujos (emoji) para jugar con imágenes en los temas que los tienen
const DIBUJOS = {
  PERRO: '🐶', JIRAFA: '🦒', ELEFANTE: '🐘', 'CÓNDOR': '🦅', 'DELFÍN': '🐬', TORTUGA: '🐢', LLAMA: '🦙', 'PINGÜINO': '🐧',
  COCODRILO: '🐊', MARIPOSA: '🦋', CANGURO: '🦘', BALLENA: '🐋', LORO: '🦜', CUY: '🐹',
  MANGO: '🥭', 'PLÁTANO': '🍌', FRESA: '🍓', MANZANA: '🍎', NARANJA: '🍊', 'SANDÍA': '🍉', 'PIÑA': '🍍', UVA: '🍇', DURAZNO: '🍑',
  CANTAR: '🎤', CORRER: '🏃', SALTAR: '🤸', ESCRIBIR: '✍️', LEER: '📖', DIBUJAR: '🎨', NADAR: '🏊', BAILAR: '💃', COMER: '🍽️',
  DORMIR: '😴', JUGAR: '⚽', PENSAR: '🤔', APRENDER: '🎓', 'REÍR': '😂', VIAJAR: '✈️',
  'CORAZÓN': '🫀', 'PULMÓN': '🫁', CEREBRO: '🧠', HUESO: '🦴', 'MÚSCULO': '💪', SANGRE: '🩸',
  'VOLCÁN': '🌋', PLANETA: '🪐', GALAXIA: '🌌', 'IMÁN': '🧲', 'ÁTOMO': '⚛️', ELECTRICIDAD: '⚡', BACTERIA: '🦠', 'CÉLULA': '🔬',
  'CAJÓN': '🥁', CEVICHE: '🐟', 'MACHU PICCHU': '🏔️', TITICACA: '🛶', AMAZONAS: '🌳', MARINERA: '💃'
};
SETS.forEach(st => st.palabras.forEach(pal => { if (DIBUJOS[pal.palabra]) pal.imagen = DIBUJOS[pal.palabra]; }));

// ¿El tema tiene suficientes palabras con imagen para jugar con dibujos?
export const conImagenes = (set) => (set.palabras || []).filter(x => x.imagen).length >= 4;

// Parejas para Memoria
export const SETS_MEMORIA = [
  { id: 'm-iguales', titulo: 'Parejas iguales (para los más chiquitos)', ico: '🍎', categoria: 'Inicial', autor: 'QuizApp',
    parejas: ['🍎', '🍌', '🍇', '🐶', '🐱', '🐸', '🚗', '⚽', '🌈', '⭐'].map(e => [e, e]) },
  { id: 'm-frutas-dibujos', titulo: 'Frutas: dibujo y nombre', ico: '🍓', categoria: 'Inicial / Primaria', autor: 'QuizApp',
    parejas: [['🥭', 'Mango'], ['🍌', 'Plátano'], ['🍓', 'Fresa'], ['🍎', 'Manzana'], ['🍊', 'Naranja'], ['🍉', 'Sandía'], ['🍍', 'Piña'], ['🍇', 'Uva'], ['🍑', 'Durazno'], ['🍋', 'Limón']] },
  { id: 'm-animales', titulo: 'Animales y sus nombres', ico: '🐾', categoria: 'Inicial / Primaria', autor: 'QuizApp',
    parejas: [['🐶', 'Perro'], ['🐱', 'Gato'], ['🦒', 'Jirafa'], ['🐘', 'Elefante'], ['🐢', 'Tortuga'], ['🐧', 'Pingüino'], ['🦋', 'Mariposa'], ['🐬', 'Delfín'], ['🦜', 'Loro'], ['🦘', 'Canguro']] },
  { id: 'm-colores', titulo: 'Colores en inglés', ico: '🎨', categoria: 'Inglés', autor: 'QuizApp',
    parejas: [['Red', 'Rojo'], ['Blue', 'Azul'], ['Green', 'Verde'], ['Yellow', 'Amarillo'], ['Black', 'Negro'], ['White', 'Blanco'], ['Orange', 'Naranja'], ['Purple', 'Morado'], ['Pink', 'Rosado'], ['Brown', 'Marrón']] },
  { id: 'm-capitales', titulo: 'Países y capitales', ico: '🌎', categoria: 'Geografía', autor: 'QuizApp',
    parejas: [['Perú', 'Lima'], ['Chile', 'Santiago'], ['Colombia', 'Bogotá'], ['Ecuador', 'Quito'], ['Argentina', 'Buenos Aires'], ['Bolivia', 'Sucre'], ['Brasil', 'Brasilia'], ['Uruguay', 'Montevideo'], ['Paraguay', 'Asunción'], ['Venezuela', 'Caracas']] },
  { id: 'm-tablas', titulo: 'Tablas de multiplicar', ico: '✖️', categoria: 'Matemática', autor: 'QuizApp',
    parejas: [['6 × 7', '42'], ['8 × 8', '64'], ['9 × 6', '54'], ['7 × 7', '49'], ['8 × 4', '32'], ['9 × 9', '81'], ['6 × 8', '48'], ['7 × 9', '63'], ['5 × 9', '45'], ['12 × 3', '36']] },
  { id: 'm-regiones', titulo: 'Regiones del Perú y su capital', ico: '🗺️', categoria: 'Personal social', autor: 'QuizApp',
    parejas: [['Cusco', 'Cusco'], ['Loreto', 'Iquitos'], ['La Libertad', 'Trujillo'], ['Lambayeque', 'Chiclayo'], ['Junín', 'Huancayo'], ['Ucayali', 'Pucallpa'], ['San Martín', 'Moyobamba'], ['Madre de Dios', 'Puerto Maldonado'], ['Puno', 'Puno'], ['Piura', 'Piura']]
      .map(([a, b]) => [a, b === a ? `Ciudad de ${b}` : b]) }
];

// Preguntas para Quiz relámpago (la correcta es la primera; se barajan al jugar)
const q = (enunciado, ...opciones) => ({ enunciado, opciones });
export const SETS_QUIZ = [
  { id: 'q-general', titulo: 'Cultura general', ico: '🌟', categoria: 'Varios', autor: 'QuizApp', preguntas: [
    q('¿Cuántos días tiene un año bisiesto?', '366', '365', '364', '360'),
    q('¿Cuál es el océano que baña las costas del Perú?', 'Pacífico', 'Atlántico', 'Índico', 'Ártico'),
    q('¿Qué planeta es conocido como el planeta rojo?', 'Marte', 'Venus', 'Júpiter', 'Saturno'),
    q('¿Cuántos lados tiene un hexágono?', '6', '5', '7', '8'),
    q('¿Qué gas necesitan las plantas para la fotosíntesis?', 'Dióxido de carbono', 'Oxígeno', 'Nitrógeno', 'Helio'),
    q('¿Quién escribió "Los ríos profundos"?', 'José María Arguedas', 'Mario Vargas Llosa', 'César Vallejo', 'Ricardo Palma'),
    q('¿Cuál es el animal terrestre más rápido?', 'Guepardo', 'León', 'Caballo', 'Avestruz'),
    q('¿En qué continente está Egipto?', 'África', 'Asia', 'Europa', 'Oceanía'),
    q('¿Cuántos minutos tiene una hora?', '60', '100', '30', '90'),
    q('¿Cuál es el río más largo de Sudamérica?', 'Amazonas', 'Paraná', 'Orinoco', 'Magdalena'),
    q('¿Qué instrumento mide la temperatura?', 'Termómetro', 'Barómetro', 'Brújula', 'Balanza'),
    q('¿Cuál es la capital de Japón?', 'Tokio', 'Pekín', 'Seúl', 'Bangkok')
  ] },
  { id: 'q-mate', titulo: 'Cálculo mental', ico: '🧮', categoria: 'Matemática', autor: 'QuizApp', preguntas: [
    q('7 × 8 =', '56', '54', '64', '48'), q('144 ÷ 12 =', '12', '14', '11', '13'), q('25 + 38 =', '63', '53', '61', '73'),
    q('La mitad de 90 es', '45', '40', '35', '50'), q('9 × 9 =', '81', '72', '99', '89'), q('100 − 37 =', '63', '73', '67', '57'),
    q('El 10 % de 250 es', '25', '2,5', '50', '10'), q('3² + 4² =', '25', '49', '12', '14'),
    q('¿Cuántos centímetros hay en 2 metros?', '200', '20', '2000', '120'), q('15 × 4 =', '60', '45', '50', '75'),
    q('El doble de 37 es', '74', '64', '77', '67'), q('1/2 + 1/4 =', '3/4', '2/6', '1/6', '2/4')
  ] },
  { id: 'q-peru', titulo: 'Conoce el Perú', ico: '🇵🇪', categoria: 'Personal social', autor: 'QuizApp', preguntas: [
    q('¿En qué año se proclamó la independencia del Perú?', '1821', '1824', '1810', '1879'),
    q('¿Qué animal aparece en el escudo nacional?', 'Vicuña', 'Llama', 'Alpaca', 'Cóndor'),
    q('¿Cuál es la capital del Perú?', 'Lima', 'Cusco', 'Arequipa', 'Trujillo'),
    q('¿Qué cultura hizo las famosas líneas en el desierto?', 'Nazca', 'Moche', 'Chavín', 'Paracas'),
    q('¿Cuál es el baile nacional del Perú?', 'Marinera', 'Huayno', 'Festejo', 'Tondero'),
    q('¿En qué región está Machu Picchu?', 'Cusco', 'Puno', 'Apurímac', 'Junín'),
    q('¿Qué lago comparten Perú y Bolivia?', 'Titicaca', 'Junín', 'Parinacochas', 'Sandoval'),
    q('¿Cuántas regiones naturales tradicionales tiene el Perú?', '3', '2', '4', '8'),
    q('¿Quién es conocido como el "Amauta"?', 'José Carlos Mariátegui', 'Miguel Grau', 'Túpac Amaru II', 'Jorge Basadre'),
    q('¿Qué plato se prepara con pescado y limón?', 'Ceviche', 'Ají de gallina', 'Lomo saltado', 'Pachamanca')
  ] }
];

// Ordena la frase: se toca cada palabra en orden
const f = (frase, pista) => ({ frase, pista });
export const SETS_FRASES = [
  { id: 'f-oraciones', titulo: 'Oraciones sencillas', ico: '🏡', categoria: 'Primaria', autor: 'QuizApp', frases: [
    f('La casa es grande', 'Una oración corta'), f('Mi perro corre en el parque', 'Una mascota feliz'),
    f('Los niños juegan en el patio', 'La hora del recreo'), f('Mamá cocina un rico ají de gallina', 'El almuerzo de hoy'),
    f('El sol sale por el este', 'Así empieza el día'), f('Me gusta leer cuentos antes de dormir', 'Una buena costumbre'),
    f('Mañana iremos a la playa', 'Un paseo en verano'), f('La familia almuerza junta el domingo', 'El día favorito') ] },
  { id: 'f-refranes', titulo: 'Refranes', ico: '🦉', categoria: 'Para toda la familia', autor: 'QuizApp', frases: [
    f('Más vale tarde que nunca', 'Sobre llegar tarde'), f('No hay mal que por bien no venga', 'Lo bueno de lo malo'),
    f('Al que madruga Dios lo ayuda', 'Levantarse temprano'), f('Camarón que se duerme se lo lleva la corriente', 'Hay que estar atento'),
    f('Perro que ladra no muerde', 'Mucho ruido'), f('Dime con quién andas y te diré quién eres', 'Las amistades'),
    f('En casa de herrero cuchillo de palo', 'Lo que falta en casa'), f('Ojos que no ven corazón que no siente', 'Lo que no se sabe') ] },
  { id: 'f-biblia', titulo: 'Versículos de la Biblia', ico: '✝️', categoria: 'Biblia', autor: 'QuizApp', frases: [
    f('Jehová es mi pastor nada me faltará', 'Salmo 23:1'), f('Dios es amor', '1 Juan 4:8'),
    f('Todo lo puedo en Cristo que me fortalece', 'Filipenses 4:13'), f('Amarás a tu prójimo como a ti mismo', 'Mateo 22:39'),
    f('Yo soy el camino la verdad y la vida', 'Juan 14:6'), f('Lámpara es a mis pies tu palabra', 'Salmo 119:105'),
    f('En el principio creó Dios los cielos y la tierra', 'Génesis 1:1'), f('Bienaventurados los de limpio corazón', 'Mateo 5:8') ] }
];

// Trivia Bíblica (la correcta es la primera)
export const SETS_TRIVIA = [
  { id: 'b-at', titulo: 'Antiguo Testamento', ico: '📜', categoria: 'Biblia', autor: 'QuizApp', preguntas: [
    q('¿Quién construyó el arca?', 'Noé', 'Moisés', 'Abraham', 'David'),
    q('¿Quién venció al gigante Goliat?', 'David', 'Saúl', 'Sansón', 'Josué'),
    q('¿Quién fue tragado por un gran pez?', 'Jonás', 'Elías', 'Daniel', 'Pedro'),
    q('¿Quién recibió los Diez Mandamientos?', 'Moisés', 'Aarón', 'Josué', 'Abraham'),
    q('¿En qué foso fue echado Daniel?', 'El de los leones', 'El de las serpientes', 'El de los osos', 'El de los lobos'),
    q('¿Cuál es el primer libro de la Biblia?', 'Génesis', 'Éxodo', 'Salmos', 'Mateo'),
    q('¿Cómo se llamaba la esposa de Abraham?', 'Sara', 'Rebeca', 'Raquel', 'Lea'),
    q('¿Cuántos hijos varones tuvo Jacob?', '12', '10', '7', '3'),
    q('¿Quién tenía una gran fuerza en su cabello?', 'Sansón', 'Gedeón', 'Saúl', 'Jonatán'),
    q('¿Qué mar se abrió para que pasara el pueblo de Israel?', 'El Mar Rojo', 'El Mar Muerto', 'El Mar de Galilea', 'El Mediterráneo'),
    q('¿Quién fue vendido por sus hermanos?', 'José', 'Benjamín', 'Isaac', 'Esaú'),
    q('¿Qué rey es famoso por su sabiduría?', 'Salomón', 'David', 'Saúl', 'Ezequías') ] },
  { id: 'b-nt', titulo: 'Nuevo Testamento', ico: '🕊️', categoria: 'Biblia', autor: 'QuizApp', preguntas: [
    q('¿En qué ciudad nació Jesús?', 'Belén', 'Nazaret', 'Jerusalén', 'Jericó'),
    q('¿Cuántos apóstoles eligió Jesús?', '12', '10', '7', '70'),
    q('¿Quién bautizó a Jesús?', 'Juan el Bautista', 'Pedro', 'Pablo', 'Santiago'),
    q('¿Qué apóstol negó a Jesús tres veces?', 'Pedro', 'Juan', 'Tomás', 'Judas'),
    q('¿Cuál es el primer libro del Nuevo Testamento?', 'Mateo', 'Marcos', 'Hechos', 'Romanos'),
    q('Según el evangelio de Juan, ¿cuál fue el primer milagro de Jesús?', 'Convertir el agua en vino', 'Caminar sobre el agua', 'Multiplicar los panes', 'Sanar a un ciego'),
    q('¿Con cuántos panes alimentó Jesús a los cinco mil?', '5', '7', '12', '3'),
    q('¿Quién escribió la carta a los Romanos?', 'Pablo', 'Pedro', 'Lucas', 'Marcos'),
    q('¿Cómo se llamaba la madre de Jesús?', 'María', 'Marta', 'Isabel', 'Ana'),
    q('¿Qué apóstol dudó de la resurrección hasta ver a Jesús?', 'Tomás', 'Andrés', 'Felipe', 'Mateo'),
    q('¿En qué pueblo creció Jesús?', 'Nazaret', 'Belén', 'Capernaúm', 'Betania'),
    q('¿Quién subió a un árbol para ver pasar a Jesús?', 'Zaqueo', 'Nicodemo', 'Lázaro', 'Bartimeo'),
    q('¿Cuál es el último libro de la Biblia?', 'Apocalipsis', 'Judas', 'Hechos', 'Malaquías') ] }
];

// Rompecabezas: imágenes dibujadas aquí mismo (o una foto propia)
export const SETS_PUZZLE = [
  { id: 'p-campo', titulo: 'El cangurito en el campo', ico: '🦘', categoria: 'Dibujo', autor: 'QuizApp' },
  { id: 'p-andes', titulo: 'Montañas y llamas', ico: '🏔️', categoria: 'Dibujo', autor: 'QuizApp' },
  { id: 'p-mar', titulo: 'Un día en la playa', ico: '🏖️', categoria: 'Dibujo', autor: 'QuizApp' },
  { id: 'foto', titulo: 'Una foto de la familia', ico: '📷', categoria: 'Tu propia foto', autor: 'Tú' }
];

// Sets compatibles con un juego
export function setsPara(juego) {
  const usa = JUEGOS[juego]?.usa;
  if (usa === 'palabras') return SETS;
  if (usa === 'parejas') return SETS_MEMORIA;
  if (usa === 'preguntas') return SETS_QUIZ;
  if (usa === 'trivia') return SETS_TRIVIA;
  if (usa === 'frases') return SETS_FRASES;
  if (usa === 'imagenes') return SETS_PUZZLE;
  return [];
}
export function buscarSet(juego, id) { return setsPara(juego).find(s => s.id === id) || null; }
