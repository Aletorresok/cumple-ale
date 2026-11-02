// Prueba del juego «Los invitados dicen» con los emuladores de Firebase: cuatro equipos y N invitados
// (12 por defecto). Juega tres rondas: una con el pulsador y las respuestas desde los celulares
// (cara a cara, jugar, tres cruces y robo), una marcada a mano desde el panel y la última, que vale doble.
//
//   firebase emulators:start --only auth,firestore      (en otra terminal)
//   python3 -m http.server 5173                          (en la carpeta del repo)
//   node pruebas/invitados-dicen.mjs [cantidad] [carpeta-capturas]
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
// Primer celular que muestra `selector` (espera hasta que aparezca alguno).
async function celularCon(invitados, selector, { excepto = [] } = {}) {
  for (let i = 0; i < 60; i++) {
    for (const p of invitados) if (!excepto.includes(p) && await p.locator(selector).count()) return p;
    await esperar(300);
  }
  throw new Error('Ningún celular muestra ' + selector);
}
const puntos = async (host) => (await host.locator('.equipo-pts').allTextContents()).reduce((a, x) => a + Number(x), 0);

try {
  const host = await pagina('host', '?docente', { width: 1100, height: 900 });
  await host.waitForFunction(() => window.pruebas);
  await host.evaluate((sub) => window.pruebas.entrarComoOrganizador(sub), 'org-' + Date.now());
  await host.getByText('Mis bancos').waitFor({ timeout: 20000 });
  await host.getByRole('button', { name: '🍩 Agregar el banco Springfield' }).click();
  await host.getByText('Springfield · Los Simpson').waitFor();
  await host.locator('#cant-equipos').selectOption('4');
  await host.getByRole('button', { name: 'Abrir una sala' }).click();
  const codigo = (await host.locator('.sala-codigo').textContent()).trim();
  const tv = await pagina('tv', `?tv=${codigo}`, { width: 1600, height: 900 });
  const invitados = await Promise.all(Array.from({ length: N }, async (_, k) => {
    const p = await pagina(`inv${k + 1}`, `?sala=${codigo}`);
    await p.locator('#nombre').fill(`Invitado ${k + 1}`);
    await p.getByRole('button', { name: 'Entrar' }).click();
    await p.getByText('¡Ya estás adentro!').waitFor({ timeout: 30000 });
    return p;
  }));
  await host.waitForFunction((n) => document.querySelector('.entrada')?.textContent.includes(`${n} invitados conectados`), N, { timeout: 30000 });
  await elegirJuego(host, 'Selección de equipos');
  await host.getByRole('button', { name: /Repartir a todos/ }).click();
  await host.getByText('¡Equipos armados!').waitFor();
  for (const p of invitados) await p.locator('.resultado.mi-equipo').waitFor({ timeout: 15000 });
  await terminarJuego(host);
  paso(`Sala ${codigo}: ${N} invitados en 4 equipos`);
  await medir('Entrada y equipos');

  await elegirJuego(host, 'Los invitados dicen', async () => {
    const banco = (await host.locator('#cfg-banco option').allTextContents()).find((t) => t.includes('Springfield'));
    if (banco) await host.locator('#cfg-banco').selectOption({ label: banco });
    await host.locator('#cfg-rondas').selectOption('3');
    await host.locator('#cfg-seg').selectOption('0');
  });

  // ── Ronda 1: todo desde los celulares ──
  await tv.locator('.duelo.en-tv').waitFor({ timeout: 15000 });
  const respuestas = await host.locator('.tablero-host li > span').evaluateAll((els) => els.map((e) => e.firstChild.textContent));
  await esperar(800);
  const reps = [];
  for (const p of invitados) if (await p.locator('.pulsador').count()) reps.push(p);
  afirmar(reps.length === 2, `pasan al frente dos invitados (${reps.length})`);
  await captura(tv, 'r1-cara-a-cara');
  await captura(reps[0], 'r1-pulsador');
  await reps[1].locator('.pulsador').click();
  await reps[1].locator('#encuesta-juego').waitFor();
  await host.getByText('Responde').first().waitFor();
  await reps[1].locator('#encuesta-juego').fill('zzzz nada');
  await reps[1].getByRole('button', { name: 'Responder' }).click();
  await reps[0].locator('#encuesta-juego').waitFor({ timeout: 10000 });
  await reps[0].locator('#encuesta-juego').fill(respuestas[1]);
  await reps[0].getByRole('button', { name: 'Responder' }).click();
  await reps[0].getByRole('button', { name: '¡Jugamos!' }).waitFor({ timeout: 10000 });
  await captura(tv, 'r1-elegir');
  paso(`Cara a cara: el primero erró, el segundo dijo «${respuestas[1]}» y ganó`);
  await reps[0].getByRole('button', { name: '¡Jugamos!' }).click();
  for (let k = 0; k < 3; k++) {
    await esperar(600);
    const quien = await celularCon(invitados, '#encuesta-juego:not([disabled])');
    if (k === 0) await captura(quien, 'r1-te-toca');
    await quien.locator('#encuesta-juego').fill('respuesta mala ' + k);
    await quien.getByRole('button', { name: 'Responder' }).click();
  }
  await tv.getByText('¡Roba!').waitFor({ timeout: 10000 });
  await captura(tv, 'r1-robo');
  const ladron = await celularCon(invitados, '#encuesta-juego:not([disabled])');
  await ladron.locator('#encuesta-juego').fill(respuestas[0]);
  await ladron.getByRole('button', { name: 'Responder' }).click();
  await host.getByText(/se lleva \d+ puntos/).waitFor({ timeout: 10000 });
  const r1 = await host.locator('p.grande').first().textContent();
  afirmar(await puntos(host) > 0, 'el robo sumó puntos');
  await captura(tv, 'r1-fin');
  paso(`Tres cruces y robo con «${respuestas[0]}»: ${r1}`);
  await medir('Ronda 1 (celulares)');

  // ── Ronda 2: todo marcado a mano desde el panel ──
  await host.getByText('Próximo cara a cara').waitFor();
  await host.getByRole('button', { name: 'Siguiente ronda →' }).click();
  await host.getByRole('button', { name: /^Pulsó / }).first().click();
  await host.getByRole('button', { name: 'Acertó' }).first().click();
  await host.getByRole('button', { name: /^Juega / }).click();
  const antes2 = await puntos(host);
  while (await host.getByRole('button', { name: 'Acertó' }).count()) {
    await host.getByRole('button', { name: 'Acertó' }).first().click();
    await esperar(700);
    if (await host.getByText(/se lleva \d+ puntos/).count()) break;
  }
  await host.getByText(/se lleva \d+ puntos/).waitFor({ timeout: 10000 });
  afirmar(await puntos(host) > antes2, 'el tablero completo sumó');
  paso('Ronda 2 (panel): ' + await host.locator('p.grande').first().textContent());

  // ── Ronda 3: vale doble; nadie acierta en el cara a cara, pasan otros dos ──
  await host.getByRole('button', { name: 'Siguiente ronda →' }).click();
  await tv.locator('.doble').waitFor({ timeout: 10000 });
  await host.getByRole('button', { name: /^Pulsó / }).first().click();
  await host.getByRole('button', { name: '✗ No está en el tablero' }).click();
  await esperar(700);
  await host.getByRole('button', { name: '✗ No está en el tablero' }).click();
  await host.getByText('(intento 2)').waitFor({ timeout: 10000 });
  await host.getByRole('button', { name: /^Saltear: gana / }).first().click();
  await host.getByRole('button', { name: /^Pasan: juega / }).click();
  const antes3 = await puntos(host);
  const filas = await host.getByRole('button', { name: 'Acertó' }).count();
  for (let k = 0; k < filas; k++) { await host.getByRole('button', { name: 'Acertó' }).first().click(); await esperar(700); }
  await host.getByText('(doble)').waitFor({ timeout: 10000 });
  const pozo = Number((await host.locator('p.grande').first().textContent()).match(/(\d+) puntos/)[1]);
  afirmar(await puntos(host) - antes3 === pozo, 'la ronda doble sumó lo que dice');
  await captura(tv, 'r3-fin-doble');
  paso('Ronda 3 (doble, segundo cara a cara): ' + await host.locator('p.grande').first().textContent());
  await host.getByRole('button', { name: 'Ver resultados' }).click();
  await tv.getByText('¡Terminó el juego!').waitFor();
  await medir('Rondas 2 y 3 (panel)');
  for (const [n, l, e] of etapas) console.log(`  ${n.padEnd(28)} ${String(l).padStart(6)} lecturas ${String(e).padStart(5)} escrituras`);
} catch (e) {
  errores.push('PRUEBA: ' + e.message);
}

await browser.close();
const reales = errores.filter((e) => !/favicon|ERR_TUNNEL|ERR_FAILED|ERR_INTERNET_DISCONNECTED|navigator\.vibrate|fonts\.g/.test(e));
if (reales.length) { console.log('\nErrores:\n' + [...new Set(reales)].join('\n')); process.exit(1); }
console.log('\nTodo bien ✔');
