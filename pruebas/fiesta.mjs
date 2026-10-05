// Prueba de punta a punta con los emuladores de Firebase: abre la sala, la pantalla grande y
// N invitados (30 por defecto), y juega la selección de equipos, el impostor, la mímica y el podio.
// En el medio corta la conexión de algunos celulares y recarga otros, y al final muestra cuántas
// lecturas y escrituras de Firebase gastó la noche (para compararlo con la cuota gratis).
//
//   firebase emulators:start --only auth,firestore      (en otra terminal)
//   python3 -m http.server 5173                          (en la carpeta del repo)
//   node pruebas/fiesta.mjs [cantidad] [carpeta-capturas]
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const BASE = process.env.BASE || 'http://localhost:5173/';
const N = Number(process.argv[2] || 30);
const CAPTURAS = process.argv[3] || '';
const errores = [];

// Si la red no deja bajar Firebase de gstatic, se sirve desde el paquete «firebase» de npm.
const sdk = (() => { try { return createRequire(import.meta.url).resolve('firebase/package.json').replace(/package\.json$/, ''); } catch { return null; } })();

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const browser = await chromium.launch({ proxy, executablePath: process.env.CHROMIUM || undefined });

async function pagina(nombre, url, viewport = { width: 390, height: 800 }) {
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => localStorage.setItem('emulador', '1'));
  if (sdk && process.env.SDK_LOCAL) {
    await ctx.route('https://www.gstatic.com/firebasejs/**', (r) => {
      const archivo = sdk + new URL(r.request().url()).pathname.split('/').pop();
      if (!existsSync(archivo)) return r.abort();
      return r.fulfill({ body: readFileSync(archivo), contentType: 'text/javascript' });
    });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  }
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errores.push(`${nombre}: ${m.text()}`); });
  p.on('pageerror', (e) => errores.push(`${nombre}: ${e.message}`));
  await p.goto(BASE + url);
  todas.push(p);
  return p;
}

// Lecturas y escrituras de Firebase de todas las páginas (las recargadas suman lo de antes).
const todas = [];
const usoPrevio = { lecturas: 0, escrituras: 0 };
async function usoDe(p) { return p.evaluate(() => ({ ...(window.usoFirestore || { lecturas: 0, escrituras: 0 }) })).catch(() => ({ lecturas: 0, escrituras: 0 })); }
async function usoTotal() {
  const t = { ...usoPrevio };
  for (const u of await Promise.all(todas.map(usoDe))) { t.lecturas += u.lecturas; t.escrituras += u.escrituras; }
  return t;
}
let usoAntes = { lecturas: 0, escrituras: 0 };
const etapas = [];
async function medir(nombre) {
  const t = await usoTotal();
  etapas.push([nombre, t.lecturas - usoAntes.lecturas, t.escrituras - usoAntes.escrituras]);
  usoAntes = t;
}
async function recargar(p) {
  const u = await usoDe(p);
  usoPrevio.lecturas += u.lecturas; usoPrevio.escrituras += u.escrituras;
  await p.reload();
}

const captura = async (p, nombre) => { if (CAPTURAS) await p.screenshot({ path: `${CAPTURAS}/${nombre}.png` }); };
const paso = (t) => console.log(`· ${t}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function afirmar(cond, texto) { if (!cond) throw new Error('Falló: ' + texto); }

async function elegirJuego(host, nombre, preparar) {
  await host.locator('.juego-tarjeta', { hasText: nombre }).click();
  await preparar?.();
  await host.getByRole('button', { name: 'Empezar', exact: true }).click();
}

async function terminarJuego(host) {
  await host.getByRole('button', { name: 'Terminar juego' }).click();
  await host.locator('.modal').getByRole('button', { name: 'Terminar' }).click();
  await host.locator('.juego-tarjeta').first().waitFor();
}

try {
  // ── Organizador ──
  const host = await pagina('host', '?docente', { width: 1100, height: 900 });
  await host.waitForFunction(() => window.pruebas);
  await host.evaluate((sub) => window.pruebas.entrarComoOrganizador(sub), 'org-' + Date.now());
  await host.getByText('Mis bancos').waitFor({ timeout: 20000 }); // la página se recarga sola al entrar
  await host.getByRole('button', { name: /banco de ejemplo/ }).click();
  await host.getByText('Cumple Ale · ejemplo').waitFor();
  await host.getByRole('button', { name: '⚡ Trivia · Bien argentina' }).click();
  await host.getByText('16 preguntas').waitFor();
  await host.locator('#cant-equipos').selectOption('4');
  await host.getByRole('button', { name: 'Abrir una sala' }).click();
  const codigo = (await host.locator('.sala-codigo').textContent()).trim();
  paso(`Sala ${codigo} abierta`);

  const tv = await pagina('tv', `?tv=${codigo}`, { width: 1600, height: 900 });

  // ── Diagnóstico de la sala (lo que se mira antes de que llegue la gente) ──
  const diag = await pagina('diag', `?diagnostico=${codigo}`);
  await diag.getByText(/Todo listo|Funciona, con avisos|problema/).waitFor({ timeout: 30000 });
  const resumenDiag = await diag.locator('.diag-resumen').textContent();
  afirmar(!resumenDiag.includes('❌'), `el diagnóstico no encuentra problemas (${resumenDiag}: ${(await diag.locator('.diag-fila.mal').allTextContents()).join(' | ')})`);
  afirmar(await diag.getByText(`Sala ${codigo} abierta`).count(), 'el diagnóstico ve la sala abierta');
  await captura(diag, '0-diagnostico');
  paso(`Diagnóstico: ${resumenDiag}`);
  await diag.close();

  // ── Invitados ──
  const invitados = [];
  for (let i = 0; i < N; i += 10) {
    const lote = await Promise.all(Array.from({ length: Math.min(10, N - i) }, async (_, k) => {
      const n = i + k + 1;
      const p = await pagina(`inv${n}`, `?sala=${codigo}`);
      await p.locator('#nombre').fill(`Invitado ${n}`);
      await p.getByRole('button', { name: 'Entrar' }).click();
      await p.getByText('¡Ya estás adentro!').waitFor({ timeout: 30000 });
      return p;
    }));
    invitados.push(...lote);
  }
  await host.waitForFunction((n) => document.querySelector('.entrada')?.textContent.includes(`${n} invitados conectados`), N, { timeout: 30000 });
  paso(`${N} invitados conectados`);
  await medir('Entrada de los invitados');
  await captura(tv, '1-espera');

  // ── Selección de equipos ──
  await elegirJuego(host, 'Selección de equipos');
  await host.getByRole('button', { name: 'Empezar la ceremonia' }).click();
  await esperar(1200);
  await captura(tv, '2-seleccion-girando');
  await host.getByRole('button', { name: 'Siguiente invitado' }).waitFor({ timeout: 10000 });
  await host.locator('.tarjeta.suave .pildora').waitFor();
  await captura(tv, '3-seleccion-revelado');
  await host.getByRole('button', { name: /Repartir a todos/ }).click();
  await host.getByText('¡Equipos armados!').waitFor();
  for (const p of invitados) await p.locator('.resultado.mi-equipo').waitFor({ timeout: 15000 });
  const tamanios = await host.locator('.equipo .miembros').evaluateAll((els) => els.map((e) => e.querySelectorAll('.chip').length));
  afirmar(Math.max(...tamanios) - Math.min(...tamanios) <= 1, `equipos parejos (${tamanios})`);
  paso(`Equipos armados y parejos: ${tamanios.join(', ')}`);
  await captura(invitados[0], '4-seleccion-celular');
  await terminarJuego(host);
  await medir('Selección de equipos');

  // ── Impostor ──
  await elegirJuego(host, 'El impostor');
  await host.getByRole('button', { name: 'Abrir votación' }).waitFor({ timeout: 20000 });
  for (const p of invitados) await p.locator('.palabra', { hasNotText: '…' }).waitFor({ timeout: 15000 });
  const palabras = await Promise.all(invitados.map((p) => p.locator('.palabra').textContent()));
  const distintas = [...new Set(palabras)];
  afirmar(distintas.length === 2, `dos palabras repartidas (${distintas})`);
  paso(`Impostor: palabras repartidas (${distintas.map((d) => `${d} ×${palabras.filter((x) => x === d).length}`).join(', ')})`);
  await captura(tv, '5-impostor-pistas');
  await captura(invitados[0], '5a-impostor-celular');

  // ── Reconexión: se corta la red de tres celulares y otros tres recargan la página ──
  const cortados = invitados.slice(0, 3);
  await Promise.all(cortados.map((p) => p.context().setOffline(true)));
  await Promise.all(cortados.map((p) => p.locator('.banda-conexion:not([hidden])').waitFor({ timeout: 20000 })));
  await captura(cortados[0], '5b-sin-conexion');
  await esperar(3000);
  await Promise.all(cortados.map((p) => p.context().setOffline(false)));
  await Promise.all(cortados.map((p) => p.locator('.banda-conexion').waitFor({ state: 'hidden', timeout: 30000 })));
  paso('Reconexión: tres celulares sin red vieron el aviso y volvieron solos');
  const recargados = invitados.slice(3, 6);
  const equiposAntes = await Promise.all(recargados.map((p) => p.locator('.invitado-barra .pildora').textContent()));
  await Promise.all(recargados.map(recargar));
  for (const [i, p] of recargados.entries()) {
    await p.locator('.palabra', { hasText: palabras[3 + i] }).waitFor({ timeout: 20000 });
    const eq = await p.locator('.invitado-barra .pildora').textContent();
    afirmar(eq === equiposAntes[i], `después de recargar sigue en su equipo (${equiposAntes[i]} → ${eq})`);
  }
  paso('Reconexión: tres celulares recargaron y siguen con su equipo y su palabra');
  await host.getByRole('button', { name: 'Abrir votación' }).click();
  // Wifi conectado pero sin internet: el navegador cree que hay red y Firebase no responde.
  // Ese celular vota igual; ve el aviso, y el voto llega cuando vuelve internet.
  const sinInternet = invitados[6];
  const servidor = /127\.0\.0\.1:8080|localhost:8080/;
  const bloquear = (r) => r.abort('internetdisconnected');
  await sinInternet.context().route(servidor, bloquear);
  await Promise.all(invitados.map((p) => p.locator('.btn-voto').first().click()));
  await sinInternet.locator('.banda-conexion:not([hidden])').waitFor({ timeout: 20000 });
  await sinInternet.context().unroute(servidor, bloquear);
  await sinInternet.locator('.banda-conexion').waitFor({ state: 'hidden', timeout: 60000 });
  paso('Reconexión: un celular con wifi pero sin internet vio el aviso y su voto llegó al volver');
  await host.waitForFunction((n) => document.body.textContent.includes(`${n} de ${n}`), N, { timeout: 20000 });
  await host.getByRole('button', { name: 'Cerrar votación y revelar' }).click();
  await tv.getByText(/El impostor era|Los impostores eran/).waitFor();
  await captura(tv, '6-impostor-resultado');
  paso('Impostor: votaron todos y se reveló');
  await terminarJuego(host);
  await medir('Impostor (con reconexiones)');

  // ── Mímica ──
  const antes = await host.locator('.equipo-pts').allTextContents();
  await elegirJuego(host, 'Mímica por equipos');
  await host.getByRole('button', { name: '🎭 Empezar turno' }).click();
  const actor = await (async () => {
    for (let i = 0; i < 40; i++) {
      for (const p of invitados) if (await p.getByRole('button', { name: '✓ ¡Adivinaron!' }).count()) return p;
      await esperar(500);
    }
    throw new Error('Nadie recibió la palabra de mímica');
  })();
  const p1 = await actor.locator('.palabra').textContent();
  await captura(tv, '7-mimica-turno');
  await captura(actor, '8-mimica-actor');
  await actor.getByRole('button', { name: '✓ ¡Adivinaron!' }).click();
  await actor.locator('.palabra', { hasNotText: p1 }).waitFor({ timeout: 10000 });
  const p2 = await actor.locator('.palabra').textContent();
  await actor.getByRole('button', { name: '⏭ Pasar' }).click();
  await actor.locator('.palabra', { hasNotText: p2 }).waitFor({ timeout: 10000 });
  await actor.getByRole('button', { name: '✓ ¡Adivinaron!' }).click();
  await host.getByText('2 adivinadas · 1 pasadas').waitFor({ timeout: 10000 });
  await host.getByRole('button', { name: 'Terminar el turno ya' }).click();
  await tv.locator('.tv-mimica-lista li').nth(2).waitFor();
  await captura(tv, '9-mimica-fin-turno');
  const despues = await host.locator('.equipo-pts').allTextContents();
  const suma = despues.reduce((a, x) => a + Number(x), 0) - antes.reduce((a, x) => a + Number(x), 0);
  afirmar(suma === 20, `la mímica sumó 20 puntos (sumó ${suma})`);
  paso(`Mímica: 2 adivinadas y 1 pasada (${p1}, ${p2}), +20 puntos`);
  await terminarJuego(host);
  await medir('Mímica (un turno)');

  // ── Los invitados dicen ──
  await elegirJuego(host, 'Los invitados dicen');
  await tv.locator('.tablero').waitFor({ timeout: 15000 });
  await captura(tv, '10-invitados-dicen');
  await esperar(1500);
  await captura(invitados[0], '10f-invitados-dicen-celular');
  paso('Los invitados dicen: arrancó con el tablero');
  await terminarJuego(host);
  await medir('Los invitados dicen (arranque)');

  // ── Trivia ──
  await elegirJuego(host, 'Trivia por equipos', async () => {
    await host.locator('#cfg-banco').selectOption({ label: 'Trivia · Bien argentina — 16 preguntas' });
    await host.locator('#cfg-cantidad').selectOption('5');
  });
  let salioContrato = false;
  for (let n = 0; n < 5; n++) {
    await invitados[0].locator('.opcion').first().waitFor({ timeout: 15000 });
    const pregunta = await tv.locator('.tv-pregunta').textContent();
    const esContrato = pregunta.includes('contrato');
    if (esContrato) { salioContrato = true; await captura(tv, '10c-trivia-contrato'); await captura(invitados[0], '10d-trivia-celular'); }
    await Promise.all(invitados.map((p) => p.locator('.opcion').nth(n % 2).click()));
    await host.getByRole('button', { name: /Siguiente pregunta|Ver resultados/ }).waitFor({ timeout: 20000 });
    await tv.locator('.tv-opcion.correcta').waitFor();
    if (n === 0) await captura(tv, '10a-trivia');
    if (esContrato) await captura(tv, '10e-trivia-contrato-revelada');
    await host.getByRole('button', { name: /Siguiente pregunta|Ver resultados/ }).click();
  }
  afirmar(salioContrato, 'la pregunta del contrato sale siempre, aunque se sorteen 5');
  paso('Trivia: cinco preguntas respondidas por todos, con la del contrato');
  await terminarJuego(host);
  await medir('Trivia (cinco preguntas)');

  // ── Piezas del código final ──
  await host.getByRole('button', { name: /Usar el del escape «¿Quién se llevó la torta\?»/ }).click();
  await host.waitForFunction(() => document.querySelector('#codigo-final')?.value === '0811');
  const darPieza = host.getByRole('button', { name: '🧩 Dar pieza' });
  for (const i of [0, 0, 1, 1]) {
    await darPieza.nth(i).click();
    await esperar(700);
  }
  const textos = (await host.locator('.tarjeta .mono').allTextContents()).filter((t) => /^\S( \S){3}$/.test(t));
  const juntas = Array.from({ length: 4 }, (_, i) => textos.map((t) => t.split(' ')[i]).find((x) => x && x !== '_'));
  afirmar(juntas.join('') === '0811', `entre los dos equipos tienen el código completo (${textos.join(' | ')})`);
  const chips = await Promise.all(invitados.map((p) => p.locator('.piezas-chip').count()));
  const conPiezas = chips.filter(Boolean).length;
  afirmar(conPiezas === tamanios[0] + tamanios[1], `ven las piezas los ${tamanios[0] + tamanios[1]} de los dos equipos (las ven ${conPiezas})`);
  paso(`Piezas: dos equipos juntan 0811 entre los dos (${textos.join(' | ')}); las ven ${conPiezas} celulares`);
  await captura(invitados[chips.findIndex(Boolean)], '10b-piezas-celular');

  // ── Sala de escape cooperativa: el candado final se abre con las piezas ──
  await elegirJuego(host, 'Sala de escape', () => host.locator('#cfg-modo-escape').selectOption('coop'));
  await host.getByRole('button', { name: /▶ Empezar/ }).click();
  // Quien organiza abre los candados de cada equipo hasta que aparece el final (que no lo abre).
  const final = () => invitados[0].getByText('Candado final · todo el grupo').count();
  for (let k = 0; k < 4 && !(await final()); k++) {
    await host.getByRole('button', { name: 'Abrir candado' }).first().click();
    await esperar(800);
  }
  await invitados[0].getByText('Candado final · todo el grupo').waitFor({ timeout: 15000 });
  const conPieza = [];
  for (const p of invitados) if (await p.locator('.piezas-grande').count()) conPieza.push(p);
  afirmar(conPieza.length === conPiezas, `el candado final muestra las piezas a ${conPiezas} invitados (a ${conPieza.length})`);
  await captura(conPieza[0], '11-escape-final-celular');
  await conPieza[0].locator('#escape-codigo').fill('0811');
  await conPieza[0].getByRole('button', { name: '🔑 Probar código' }).click();
  await tv.getByText(/La encontraron/).first().waitFor({ timeout: 20000 });
  await captura(tv, '11b-escape-final');
  paso('Sala de escape: el grupo abrió el candado final con las piezas');
  await terminarJuego(host).catch(() => {});
  await medir('Piezas y escape');

  // ── Podio ──
  await elegirJuego(host, 'Podio final');
  for (let i = 0; i < 4; i++) await host.getByRole('button', { name: /Revelar/ }).click().then(() => esperar(400));
  await tv.getByText('¡Campeón de la noche!').waitFor();
  await esperar(1500);
  await captura(tv, '12-podio');
  await captura(invitados[0], '13-podio-celular');
  paso('Podio: revelado hasta el campeón');
  await medir('Podio');

  // ── Plan B en papel ──
  const usoHost = await usoDe(host);
  usoPrevio.lecturas += usoHost.lecturas; usoPrevio.escrituras += usoHost.escrituras;
  await host.goto(BASE + '?docente');
  await host.getByRole('listitem').filter({ hasText: 'Cumple Ale · ejemplo' }).getByRole('button', { name: 'Imprimir plan B' }).click();
  await host.emulateMedia({ media: 'print' });
  const impreso = host.locator('#impresion');
  await impreso.waitFor();
  for (const t of ['Hoja de puntos', 'Titanic', 'pileta', 'Nombrá algo que se lleva a la playa', 'Respuesta: 0811']) {
    afirmar(await impreso.getByText(t, { exact: false }).count(), `el plan B en papel incluye «${t}»`);
  }
  await captura(host, '14-plan-b');
  await host.emulateMedia({ media: 'screen' });
  paso('Plan B: se imprime el banco con mímica, impostor, encuestas, trivia, escape y hoja de puntos');

  console.log('\nUso de Firebase (aprox.):');
  for (const [n, l, e] of etapas) console.log(`  ${n.padEnd(32)} ${String(l).padStart(6)} lecturas ${String(e).padStart(5)} escrituras`);
  const t = await usoTotal();
  console.log(`  ${'Total'.padEnd(32)} ${String(t.lecturas).padStart(6)} lecturas ${String(t.escrituras).padStart(5)} escrituras`);
  console.log('  Cuota gratis por día: 50000 lecturas, 20000 escrituras.');
} catch (e) {
  errores.push('PRUEBA: ' + e.message);
}

await browser.close();
const reales = errores.filter((e) => !/favicon|ERR_TUNNEL|ERR_FAILED|ERR_INTERNET_DISCONNECTED|navigator\.vibrate|fonts\.g/.test(e));
if (reales.length) { console.log('\nErrores:\n' + [...new Set(reales)].join('\n')); process.exit(1); }
console.log('\nTodo bien ✔');
