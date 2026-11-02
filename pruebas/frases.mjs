// Prueba del juego «Frases en argentino» con los emuladores de Firebase: cuatro equipos y N
// invitados (12 por defecto). Juega dos frases con las opciones en el celular (una responde todo
// el mundo y se revela sola; en la otra se pide la pista y se revela desde el panel) y dos a los
// gritos, marcadas desde el panel (una la saca un equipo y otra nadie).
//
//   firebase emulators:start --only auth,firestore      (en otra terminal)
//   python3 -m http.server 5173                          (en la carpeta del repo)
//   node pruebas/frases.mjs [cantidad] [carpeta-capturas]
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

  // ── Con opciones en el celular ──
  await elegirJuego(host, 'Frases en argentino', async () => {
    await host.locator('#cfg-modo').selectOption('celular');
    await host.locator('#cfg-cantidad').selectOption('6');
    await host.locator('#cfg-segundos').selectOption('60');
  });
  await tv.locator('.fa-tv').waitFor({ timeout: 15000 });
  await host.locator('.opciones-host li.correcta').waitFor({ timeout: 15000 });
  const correcta = await host.locator('.opciones-host li').evaluateAll((els) => els.findIndex((e) => e.classList.contains('correcta')));
  const argento = (await tv.locator('.fa-tv').textContent()).trim();
  await invitados[0].locator('.fa-argento-cel').waitFor();
  afirmar((await invitados[0].locator('.opcion').count()) === 4, 'el celular muestra 4 opciones');
  await captura(tv, 'f1-tv');
  await captura(invitados[0], 'f1-celular');
  // La mitad acierta, la otra mitad no.
  await Promise.all(invitados.map((p, k) => p.locator('.opcion').nth(k % 2 ? (correcta + 1) % 4 : correcta).click()));
  await tv.locator('.fa-tv-revelada').waitFor({ timeout: 15000 });
  afirmar(await puntos(host) > 0, 'acertar sumó puntos');
  afirmar(await invitados[0].locator('.resultado.bien').count(), 'el que acertó ve ¡Correcto!');
  afirmar(await invitados[1].locator('.resultado.mal').count(), 'el que erró ve Incorrecto');
  await captura(tv, 'f1-revelada');
  paso(`Frase 1 ${argento}: todos respondieron y se reveló sola (${await puntos(host)} puntos)`);
  await medir('Frase 1 (celulares)');

  await host.getByRole('button', { name: 'Siguiente frase →' }).click();
  await host.getByRole('button', { name: '💡 Pista: quién lo dice' }).click();
  await tv.locator('.fa-tv-pista').waitFor({ timeout: 10000 });
  await invitados[2].locator('.fa-pista').waitFor({ timeout: 10000 });
  await captura(tv, 'f2-pista');
  const antes2 = await puntos(host);
  await host.getByRole('button', { name: 'Revelar', exact: true }).click();
  await tv.locator('.fa-tv-revelada').waitFor({ timeout: 10000 });
  afirmar(await puntos(host) === antes2, 'sin respuestas no suma');
  await invitados[0].getByText('Se terminó el tiempo').waitFor();
  paso('Frase 2: pista en la tele y revelada desde el panel sin respuestas');
  await host.getByRole('button', { name: 'Siguiente frase →' }).click();
  await terminarJuego(host);

  // ── A los gritos, marcado desde el panel ──
  await elegirJuego(host, 'Frases en argentino', async () => {
    await host.locator('#cfg-modo').selectOption('voz');
    await host.locator('#cfg-cantidad').selectOption('6');
  });
  await tv.locator('.fa-tv-grito').waitFor({ timeout: 15000 });
  await invitados[0].getByText('¡Griten la frase original!').waitFor();
  afirmar(!(await invitados[0].locator('.opcion').count()), 'a los gritos el celular no muestra opciones');
  await captura(tv, 'v1-tv');
  const antes3 = await puntos(host);
  const eq = (await host.locator('.fa-ganadores .btn').first().textContent()).replace('🗣 ', '');
  await host.locator('.fa-ganadores .btn').first().click();
  await tv.locator('.fa-tv-ganador .tv-eq').waitFor({ timeout: 10000 });
  afirmar(await puntos(host) - antes3 === 100, 'el equipo que la gritó suma 100');
  await captura(tv, 'v1-revelada');
  paso(`A los gritos: ${eq} la sacó (+100)`);
  await host.getByRole('button', { name: 'Siguiente frase →' }).click();
  await host.getByRole('button', { name: 'Nadie: revelar' }).click();
  await tv.getByText('Nadie la sacó').waitFor({ timeout: 10000 });
  afirmar(await puntos(host) - antes3 === 100, 'si nadie la saca no suma');
  paso('A los gritos: nadie la sacó');
  await medir('Frases a los gritos');
  for (const [n, l, e] of etapas) console.log(`  ${n.padEnd(28)} ${String(l).padStart(6)} lecturas ${String(e).padStart(5)} escrituras`);
} catch (e) {
  errores.push('PRUEBA: ' + e.message);
}

await browser.close();
const reales = errores.filter((e) => !/favicon|ERR_TUNNEL|ERR_FAILED|ERR_INTERNET_DISCONNECTED|navigator\.vibrate|fonts\.g/.test(e));
if (reales.length) { console.log('\nErrores:\n' + [...new Set(reales)].join('\n')); process.exit(1); }
console.log('\nTodo bien ✔');
