// Prueba de «Dibujá en Springfield» con los emuladores de Firebase: cuatro equipos y N invitados
// (12 por defecto). Quien dibuja traza en su celular y se comprueba que el dibujo aparece en la
// tele, que deshacer y borrar llegan, que adivinar cambia la palabra y limpia el lienzo, que el
// panel puede marcar a mano y que los puntos se suman. Al final muestra lecturas y escrituras.
//
//   firebase emulators:start --only auth,firestore      (en otra terminal)
//   python3 -m http.server 5173                          (en la carpeta del repo)
//   node pruebas/dibujo.mjs [cantidad] [carpeta-capturas]
//   node pruebas/fiesta.mjs [cantidad] [carpeta-capturas]
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const BASE = process.env.BASE || 'http://localhost:5173/';
const N = Number(process.argv[2] || 12);
const CAPTURAS = process.argv[3] || '';
const errores = [];
// El proyecto de Firebase de la app (el emulador acepta cualquiera en modo de un solo proyecto).
const PROYECTO = (readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/projectId: '([^']+)'/) || [])[1] || 'juegos-aula';

// Si la red no deja bajar Firebase de gstatic, se sirve desde el paquete «firebase» de npm.
const sdk = (() => { try { return createRequire(import.meta.url).resolve('firebase/package.json').replace(/package\.json$/, ''); } catch { return null; } })();

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
const browser = await chromium.launch({ proxy, executablePath: process.env.CHROMIUM || undefined });

const fuentes = new Map();
async function pagina(nombre, url, viewport = { width: 390, height: 800 }) {
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => localStorage.setItem('emulador', '1'));
  // Voz de mentira: guarda lo que se «dice» en window.__dichos para poder comprobarlo.
  await ctx.addInitScript(() => {
    const dichos = (window.__dichos = []);
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ name: 'Voz de prueba', lang: 'es-AR' }],
      speak: (u) => dichos.push({ texto: u.text, tono: u.pitch, vel: u.rate }),
      cancel() {}, addEventListener() {},
    } });
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  });
  if (sdk && process.env.SDK_LOCAL) {
    await ctx.route('https://www.gstatic.com/firebasejs/**', (r) => {
      const archivo = sdk + new URL(r.request().url()).pathname.split('/').pop();
      if (!existsSync(archivo)) return r.abort();
      return r.fulfill({ body: readFileSync(archivo), contentType: 'text/javascript' });
    });
    // Las fuentes de Google se cortan para ir más rápido, salvo con FUENTES=1 (para capturas).
    // Con FUENTES=1 se bajan una sola vez y se reparten a todas las páginas desde memoria.
    if (!process.env.FUENTES) await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    else await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (r) => {
      const url = r.request().url();
      if (!fuentes.has(url)) fuentes.set(url, r.fetch().then(async (res) => ({ status: res.status(), headers: res.headers(), body: await res.body() })));
      try { await r.fulfill(await fuentes.get(url)); } catch { fuentes.delete(url); await r.abort(); }
    });
  }
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !(nombre === 'tv' && /404/.test(m.text()))) errores.push(`${nombre}: ${m.text()}`); });
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


// Primer celular que muestra `selector`.
async function celularCon(invitados, selector) {
  for (let i = 0; i < 60; i++) {
    for (const p of invitados) if (await p.locator(selector).count()) return p;
    await esperar(300);
  }
  throw new Error('Ningún celular muestra ' + selector);
}
const puntos = async (host) => (await host.locator('.equipo-pts').allTextContents()).reduce((a, x) => a + Number(x), 0);
// Cuántos píxeles no blancos tiene el lienzo de la tele.
const tinta = (p) => p.locator('canvas.lienzo-tv').evaluate((c) => {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) n++;
  return n;
});
async function esperarTinta(p, cond, texto) {
  for (let i = 0; i < 40; i++) { if (cond(await tinta(p))) return; await esperar(250); }
  throw new Error('Falló: ' + texto + ` (tinta ${await tinta(p)})`);
}
// Dibuja con el «dedo» (mouse) sobre el lienzo del celular: una lista de puntos en fracciones.
async function trazo(p, puntos) {
  const r = await p.locator('canvas.lienzo-cel').boundingBox();
  const a = (f) => [r.x + f[0] * r.width, r.y + f[1] * r.height];
  await p.mouse.move(...a(puntos[0]));
  await p.mouse.down();
  for (const f of puntos.slice(1)) await p.mouse.move(...a(f), { steps: 8 });
  await p.mouse.up();
}

try {
  const host = await pagina('host', '?docente', { width: 1100, height: 900 });
  await host.waitForFunction(() => window.pruebas);
  await host.evaluate((sub) => window.pruebas.entrarComoOrganizador(sub), 'org-' + Date.now());
  await host.getByText('Mis bancos').waitFor({ timeout: 20000 });
  await host.locator('#cant-equipos').selectOption('4');
  await host.getByRole('button', { name: 'Abrir una sala' }).click();
  const codigo = (await host.locator('.sala-codigo').textContent()).trim();
  const tv = await pagina('tv', `?tv=${codigo}`, { width: 1600, height: 900 });
  const invitados = await Promise.all(Array.from({ length: N }, async (_, k) => {
    const p = await pagina(`inv${k + 1}`, `?sala=${codigo}`);
    await p.locator('#nombre').fill(`Invitado ${k + 1}`);
    await p.getByRole('button', { name: 'Entrar' }).click();
    await p.getByText('¡Mirá la tele!').waitFor({ timeout: 30000 });
    return p;
  }));
  await host.waitForFunction((n) => document.querySelector('.entrada')?.textContent.includes(`${n} invitados conectados`), N, { timeout: 30000 });
  await elegirJuego(host, 'Selección de equipos');
  await host.getByRole('button', { name: /Repartir a todos/ }).click();
  await host.getByText('¡Equipos armados!').waitFor();
  for (const p of invitados) await p.locator('.resultado.mi-equipo').waitFor({ timeout: 15000 });
  await terminarJuego(host);
  paso(`Sala ${codigo}: ${N} invitados en 4 equipos (sin agregar ningún banco)`);
  await medir('Entrada y equipos');

  // ── Modo pizarra (por defecto): el celular solo muestra la palabra y el organizador marca ──
  const antesPz = await puntos(host);
  await elegirJuego(host, 'Dibujá en Springfield', async () => {
    afirmar(await host.locator('#cfg-donde').inputValue() === 'pizarra', 'por defecto se dibuja en la pizarra');
    afirmar(await host.locator('#cfg-seg').inputValue() === '90', 'por defecto, turnos de 1 minuto y medio');
    afirmar(await host.locator('#cfg-vueltas').inputValue() === '1', 'por defecto, una vuelta (un turno por equipo)');
  });
  await host.getByRole('button', { name: '✏️ Empezar turno' }).click();
  const dibujaPz = await celularCon(invitados, '.dibujo-pizarra');
  afirmar(!(await dibujaPz.locator('canvas').count()), 'en modo pizarra el celular no tiene lienzo');
  const pz1 = await dibujaPz.locator('.dibujo-palabra').textContent();
  await tv.getByText('dibuja en la pizarra').waitFor({ timeout: 10000 });
  afirmar(!(await tv.getByText(pz1).count()), 'la tele no muestra la palabra');
  await captura(dibujaPz, '0a-celular-pizarra');
  await host.getByRole('button', { name: '✓ Adivinaron' }).click();
  await dibujaPz.locator('.dibujo-palabra', { hasNotText: pz1 }).waitFor({ timeout: 10000 });
  await tv.locator('.tv-dibujo-cartel', { hasText: pz1 }).waitFor({ timeout: 5000 });
  await captura(tv, '0b-tv-pizarra');
  const pz2 = await dibujaPz.locator('.dibujo-palabra').textContent();
  await dibujaPz.getByRole('button', { name: /Pasar/ }).click();
  await dibujaPz.locator('.dibujo-palabra', { hasNotText: pz2 }).waitFor({ timeout: 10000 });
  await host.getByRole('button', { name: '✓ Adivinaron' }).click();
  await host.getByText('2 adivinadas · 1 pasadas').waitFor({ timeout: 10000 });
  await host.getByRole('button', { name: 'Terminar el turno ya' }).click();
  await tv.locator('.tv-mimica-lista li').nth(2).waitFor({ timeout: 10000 });
  afirmar(await puntos(host) - antesPz === 2, `pizarra: cada dibujo adivinado vale 1 (sumó ${await puntos(host) - antesPz})`);
  paso(`Pizarra: adivinaron «${pz1}», pasaron «${pz2}», +2 puntos`);
  await host.getByText('Turno 2 de 4').waitFor({ timeout: 10000 });
  await host.getByRole('button', { name: '➕ Jugar otra vuelta' }).click();
  await host.getByText('Turno 2 de 8').waitFor({ timeout: 10000 });
  paso('Con el juego empezado, «Jugar otra vuelta» suma un turno más por equipo (4 → 8)');
  // El organizador elige quién dibuja: tocando su nombre, la palabra le aparece a esa persona.
  const elegible = host.locator('.btn.sec', { hasText: /Invitado \d+/ });
  afirmar(await elegible.count() >= 1, 'el panel muestra a los integrantes del equipo para elegir quién dibuja');
  const elegido = (await elegible.last().textContent()).replace('✓ ', '').trim();
  await elegible.last().click();
  const celElegido = invitados[Number(elegido.split(' ')[1]) - 1];
  await celElegido.locator('.dibujo-palabra').waitFor({ timeout: 10000 });
  paso(`El organizador eligió a ${elegido} y la palabra le apareció en su celular`);
  // Tope: las palabras repartidas entre los equipos (30 / 4 = 7). Al llegar, el turno termina solo.
  await host.getByText('máximo 7 palabras').waitFor({ timeout: 10000 });
  for (let i = 0; i < 7; i++) {
    await host.getByText(`${i} adivinadas`).waitFor({ timeout: 10000 });
    await esperar(700);
    await host.getByRole('button', { name: '✓ Adivinaron' }).click();
  }
  await tv.locator('.tv-mimica-lista li').nth(6).waitFor({ timeout: 10000 });
  afirmar(!(await host.getByRole('button', { name: '✓ Adivinaron' }).count()), 'al llegar al tope el turno terminó solo');
  paso('Tope: con 4 equipos, cada turno llega hasta 7 palabras y termina solo');
  await terminarJuego(host);

  const antes = await puntos(host);
  await elegirJuego(host, 'Dibujá en Springfield', async () => {
    await host.locator('#cfg-banco').waitFor();
    const op = await host.locator('#cfg-banco option').allTextContents();
    afirmar(op[0].includes('vienen con el juego'), `las palabras de Springfield vienen con el juego (${op})`);
    await host.locator('#cfg-donde').selectOption('celular');
    await host.locator('#cfg-modo').selectOption('equipo');
    await host.locator('#cfg-vueltas').selectOption('1');
  });
  await tv.getByText('Dibujá en Springfield').first().waitFor({ timeout: 10000 });
  await captura(tv, '1-tv-presentacion');

  // ── Turno 1: dibujar, deshacer, borrar, adivinar y pasar desde el celular ──
  await host.getByRole('button', { name: '✏️ Empezar turno' }).click();
  const dibuja = await celularCon(invitados, 'canvas.lienzo-cel');
  const p1 = await dibuja.locator('.dibujo-palabra').textContent();
  await tv.locator('canvas.lienzo-tv').waitFor({ timeout: 10000 });
  afirmar(await tinta(tv) === 0, 'la tele arranca con el lienzo en blanco');
  // La palabra la ve solo quien dibuja (ni la tele ni el resto de los celulares).
  afirmar(!(await tv.getByText(p1).count()), 'la tele no muestra la palabra');
  for (const p of invitados) if (p !== dibuja) afirmar(!(await p.getByText(p1).count()), 'otro celular no ve la palabra');
  // Una dona: círculo grande y círculo chico.
  const circulo = (cx, cy, r) => Array.from({ length: 25 }, (_, i) => [cx + r * Math.cos(i / 24 * 2 * Math.PI), cy + r * 1.33 * Math.sin(i / 24 * 2 * Math.PI)]);
  await trazo(dibuja, circulo(0.5, 0.5, 0.3));
  await dibuja.locator('.pz-color').nth(7).click(); // rosa
  await dibuja.locator('.pz-grosor').nth(2).click();
  await trazo(dibuja, circulo(0.5, 0.5, 0.2));
  await dibuja.locator('.pz-color').nth(1).click();
  await dibuja.locator('.pz-grosor').nth(0).click();
  for (let i = 0; i < 6; i++) await trazo(dibuja, [[0.3 + i * 0.07, 0.3], [0.33 + i * 0.07, 0.36]]);
  await esperarTinta(tv, (n) => n > 5000, 'el dibujo aparece en la tele');
  const conTodo = await tinta(tv);
  await captura(tv, '2-tv-dibujando');
  await captura(dibuja, '3-celular-dibujando');
  paso(`Dibujo en vivo en la tele (${conTodo} píxeles pintados)`);
  // Deshacer quita el último trazo, en la tele también.
  for (let i = 0; i < 7; i++) await dibuja.getByRole('button', { name: '↶ Deshacer' }).click();
  await esperarTinta(tv, (n) => n > 0 && n < conTodo * 0.7, 'deshacer llega a la tele');
  await dibuja.getByRole('button', { name: '🗑 Borrar' }).click();
  await esperarTinta(tv, (n) => n === 0, 'borrar deja la tele en blanco');
  paso('Deshacer y borrar llegan a la tele');

  await trazo(dibuja, circulo(0.5, 0.5, 0.25));
  await esperarTinta(tv, (n) => n > 1000, 'vuelve a dibujar');
  await dibuja.getByRole('button', { name: '✓ ¡Adivinaron!' }).click();
  await dibuja.locator('.dibujo-palabra', { hasNotText: p1 }).waitFor({ timeout: 10000 });
  await tv.locator('.tv-dibujo-cartel', { hasText: p1 }).waitFor({ timeout: 5000 });
  await captura(tv, '4-tv-adivinaron');
  await esperarTinta(tv, (n) => n === 0, 'la palabra nueva arranca en blanco en la tele');
  const p2 = await dibuja.locator('.dibujo-palabra').textContent();
  await dibuja.getByRole('button', { name: '⏭ Pasar' }).click();
  await dibuja.locator('.dibujo-palabra', { hasNotText: p2 }).waitFor({ timeout: 10000 });
  // Quien organiza también puede marcar desde el panel.
  await host.getByRole('button', { name: '✓ Adivinaron' }).click();
  await host.getByText('2 adivinadas · 1 pasadas').waitFor({ timeout: 10000 });
  paso(`Adivinaron «${p1}», pasaron «${p2}» y el panel marcó otra`);
  await medir('Turno 1 dibujando');
  await host.getByRole('button', { name: 'Terminar el turno ya' }).click();
  await tv.locator('.tv-mimica-lista li').nth(2).waitFor({ timeout: 10000 });
  await captura(tv, '5-tv-fin-turno');
  afirmar(await puntos(host) - antes === 20, 'el turno sumó 20 puntos');
  afirmar(!(await dibuja.locator('canvas.lienzo-cel').count()), 'el celular deja de mostrar la pizarra');

  // ── Turno 2: dibuja otra persona de otro equipo ──
  await host.getByRole('button', { name: '✏️ Empezar turno' }).click();
  const otro = await celularCon(invitados, 'canvas.lienzo-cel');
  afirmar(otro !== dibuja, 'dibuja otra persona');
  await tv.locator('canvas.lienzo-tv').waitFor({ timeout: 10000 });
  afirmar(await tinta(tv) === 0, 'la tele arranca en blanco en el turno nuevo');
  await trazo(otro, [[0.1, 0.1], [0.9, 0.9]]);
  await esperarTinta(tv, (n) => n > 500, 'el segundo turno también se ve');
  const adivinan = await celularCon(invitados.filter((p) => p !== otro), '.resultado.bien');
  await captura(adivinan, '6-celular-adivina');
  await host.getByRole('button', { name: 'Terminar el turno ya' }).click();
  for (let t = 3; t <= 4; t++) {
    await host.getByRole('button', { name: '✏️ Empezar turno' }).click();
    await celularCon(invitados, 'canvas.lienzo-cel');
    await host.getByRole('button', { name: 'Terminar el turno ya' }).click();
  }
  await tv.getByText('¡Terminó Dibujá en Springfield!').waitFor({ timeout: 10000 });
  paso('Cuatro turnos (uno por equipo) y ranking final');
  await medir('Resto de los turnos');
  await terminarJuego(host);

  // ── Modo «adivinan todos»: el primero que acierta se lleva 10 y el que dibuja, 5 ──
  const antesTodos = await puntos(host);
  await elegirJuego(host, 'Dibujá en Springfield', async () => {
    await host.locator('#cfg-donde').selectOption('celular');
    await host.locator('#cfg-modo').selectOption('todos');
    await host.locator('#cfg-vueltas').selectOption('1');
  });
  await host.getByRole('button', { name: '✏️ Empezar turno' }).click();
  const dibujaT = await celularCon(invitados, 'canvas.lienzo-cel');
  const suEquipo = (await dibujaT.locator('.invitado-barra .pildora').textContent()).split('·')[0].trim();
  await tv.getByText(/adivinan todos/i).waitFor({ timeout: 10000 });
  // Todos los demás celulares (de cualquier equipo) invitan a adivinar.
  for (const p of invitados) if (p !== dibujaT) await p.locator('.resultado.bien').waitFor({ timeout: 10000 });
  const botonesEq = await dibujaT.locator('.dibujo-botones button.ok').allTextContents();
  afirmar(botonesEq.length === 4, `quien dibuja tiene un botón por equipo (${botonesEq})`);
  const otroEq = botonesEq.map((t) => t.replace('✓', '').trim()).find((t) => t !== suEquipo);
  const pT = await dibujaT.locator('.dibujo-palabra').textContent();
  await trazo(dibujaT, [[0.2, 0.2], [0.8, 0.8]]);
  await dibujaT.getByRole('button', { name: '✓ ' + otroEq }).click();
  await tv.locator('.tv-dibujo-cartel', { hasText: otroEq }).waitFor({ timeout: 5000 });
  await captura(tv, '7-tv-todos-adivino-otro');
  await captura(dibujaT, '8-celular-todos');
  await dibujaT.locator('.dibujo-palabra', { hasNotText: pT }).waitFor({ timeout: 10000 });
  await host.getByRole('button', { name: '✓ ' + suEquipo }).click();
  await host.getByText('2 adivinadas · 0 pasadas').waitFor({ timeout: 10000 });
  await host.getByRole('button', { name: 'Terminar el turno ya' }).click();
  await tv.locator('.tv-mimica-lista li', { hasText: otroEq }).waitFor({ timeout: 10000 });
  await captura(tv, '9-tv-todos-fin-turno');
  const pts = Object.fromEntries((await host.locator('.equipo').evaluateAll((els) => els.map((e) => [e.querySelector('.equipo-nombre, b, h3')?.textContent?.trim(), Number(e.querySelector('.equipo-pts')?.textContent)]))));
  afirmar(await puntos(host) - antesTodos === 25, `adivinan todos: 10 + 10 + 5 por dibujar (sumó ${await puntos(host) - antesTodos}; ${JSON.stringify(pts)})`);
  paso(`Adivinan todos: ${otroEq} +10, ${suEquipo} +15 (10 propia + 5 por dibujar)`);
  await medir('Modo adivinan todos');
  for (const [n, l, e] of etapas) console.log(`  ${n.padEnd(28)} ${String(l).padStart(6)} lecturas ${String(e).padStart(5)} escrituras`);
} catch (e) {
  errores.push('PRUEBA: ' + e.message);
}

await browser.close();
const reales = errores.filter((e) => !/favicon|ERR_TUNNEL|ERR_FAILED|ERR_INTERNET_DISCONNECTED|navigator\.vibrate|fonts\.g/.test(e));
if (reales.length) { console.log('\nErrores:\n' + [...new Set(reales)].join('\n')); process.exit(1); }
console.log('\nTodo bien ✔');
