// Noticiero de Springfield: pantalla para las pausas. Pasa titulares armados con lo que va de la
// noche (quién lidera, las piezas de la causa, invitados al azar) y los avisos de quien organiza.
// Abajo corre la tabla de puntos y queda un QR chico para los que llegan tarde.
import { h, montar, urlApp } from './util.js';
import { qr } from './qr.js';

const CADA_MS = 8000;

const CHISMES = [
  'El Sr. Burns niega todo vínculo con la desaparición de la torta: «Excelente… digo, qué escándalo».',
  'Lionel Hutz ofrece sus servicios a los presentes. Acepta porciones de torta como forma de pago.',
  'Moe aclara que la torta no está en la taberna: «Revisen el freezer del Kwik-E-Mart».',
  'Se recuerda a los presentes que un contrato es un acuerdo que no se puede romper, que no se puede romper.',
  'El jefe Wiggum confirma que la investigación avanza: «Tenemos pistas, y también donas».',
  'Apu informa que los Squishees están a mitad de precio solo por esta noche.',
  'El director Skinner pide silencio para la próxima prueba. Nadie le hace caso.',
  'Flanders felicita a Ale: «¡Que los cumplas feliz, vecinirijillo!».',
];

// Arma los titulares con el estado actual de la sala.
export function titulares(sala) {
  const t = [];
  const eqs = [...sala.equipos()].sort((a, b) => b.puntos - a.puntos);
  const jugadores = sala.listaJugadores();
  const aviso = sala.data?.avisoTv?.trim();
  if (eqs.length && eqs[0].puntos > 0) {
    const empatados = eqs.filter((e) => e.puntos === eqs[0].puntos);
    t.push(empatados.length > 1
      ? { cinta: 'Último momento', texto: `Empate en la cima: ${empatados.map((e) => e.nombre).join(' y ')}, con ${eqs[0].puntos} puntos cada uno.` }
      : { cinta: 'Último momento', texto: `${eqs[0].nombre} lidera la noche con ${eqs[0].puntos} puntos.`, color: eqs[0].color });
    const ult = eqs[eqs.length - 1];
    if (ult.puntos < eqs[0].puntos) t.push({ cinta: 'Deportes', texto: `${ult.nombre} promete remontar: «Todavía queda mucha noche», declaró su vocero.`, color: ult.color });
  }
  const largo = sala.data?.piezas?.largo;
  if (largo) {
    const posiciones = new Set(eqs.flatMap((e) => Object.keys(sala.piezasDe(e.id))));
    const con = eqs.filter((e) => Object.keys(sala.piezasDe(e.id)).length);
    t.push({ cinta: 'La causa de la torta', texto: posiciones.size
      ? `Ya aparecieron ${posiciones.size} de ${largo} piezas del código. Las tienen ${con.map((e) => e.nombre).join(', ')}. Hutz pide que las cuiden.`
      : `Todavía no apareció ninguna pieza del código. Hutz está nervioso.` });
  }
  if (jugadores.length) {
    const testigo = jugadores[Math.floor(Math.random() * jugadores.length)];
    const eq = sala.equipo(testigo.equipo);
    t.push({ cinta: 'Testigo clave', texto: `${testigo.nombre}${eq ? ` (${eq.nombre})` : ''} asegura haber visto la torta. La fiscalía lo toma con pinzas.`, color: eq?.color });
    t.push({ cinta: 'Springfield en números', texto: `${jugadores.length} invitados en la fiesta, repartidos en ${eqs.length} equipos.` });
  }
  t.push({ cinta: 'Chimentos', texto: CHISMES[Math.floor(Math.random() * CHISMES.length)] });
  // El aviso de quien organiza sale uno de cada dos titulares.
  if (aviso) return t.flatMap((x) => [{ cinta: 'Aviso de la organización', texto: aviso, aviso: true }, x]);
  return t;
}

export function noticiero(el, sala) {
  // Si ya está en pantalla, solo se actualizan los datos: el titular sigue rotando solo.
  let n = el.querySelector('.tv-noticiero');
  if (!n) {
    const enlace = urlApp('?sala=' + sala.codigo);
    const cinta = h('div', { class: 'nt-cinta' });
    const texto = h('div', { class: 'nt-titular' });
    const banda = h('div', { class: 'nt-banda' });
    n = h('div', { class: 'tv-noticiero' },
      h('div', { class: 'nt-cabecera' },
        h('span', { class: 'nt-vivo' }, '● EN VIVO'),
        h('span', { class: 'nt-canal' }, 'Noticiero de Springfield'),
        h('span', { class: 'nt-con' }, 'con Kent Brockman')),
      h('div', { class: 'nt-cuerpo' }, h('div', { class: 'nt-nota' }, cinta, texto)),
      h('div', { class: 'nt-pie' },
        h('div', { class: 'nt-qr' }, qr(enlace, 'qr'), h('span', null, '¿Llegaste tarde?', h('br'), h('b', { class: 'mono' }, sala.codigo))),
        banda));
    montar(el, n);
    let i = 0;
    const pasar = () => {
      if (!n.isConnected) { clearInterval(reloj); return; }
      const lista = titulares(sala);
      const x = lista[i++ % lista.length];
      cinta.textContent = x.cinta;
      cinta.style.setProperty('--c', x.color || (x.aviso ? 'var(--mark)' : '#E03A3A'));
      cinta.classList.toggle('aviso', !!x.aviso);
      texto.textContent = x.texto;
      texto.classList.remove('entra'); void texto.offsetWidth; texto.classList.add('entra');
    };
    const reloj = setInterval(pasar, CADA_MS);
    n._banda = banda;
    pasar();
  }
  // Tabla de puntos que corre abajo, como en la tele.
  const eqs = [...sala.equipos()].sort((a, b) => b.puntos - a.puntos);
  const items = eqs.map((e) => h('span', { class: 'nt-eq', style: { '--c': e.color } }, e.nombre, ' ', h('b', { class: 'mono' }, e.puntos)));
  montar(n._banda, h('div', { class: 'nt-corre' }, items, items.map((x) => x.cloneNode(true))));
}
