// Prueba de «¿Te acordás de la escena?» con los emuladores de Firebase: cuatro equipos y N invitados
// (8 por defecto). Juega dos escenas: en la primera los celulares escriben nombres (con errores de
// tipeo, repetidos y alguno inventado) y quien organiza acepta uno a mano; en la segunda se corta
// el tiempo antes. Revisa los puntos por puesto y lo que muestran la tele y los celulares.
//
//   firebase emulators:start --only auth,firestore      (en otra terminal)
//   python3 -m http.server 5173                          (en la carpeta del repo)
//   SDK_LOCAL=1 node pruebas/escenas.mjs [cantidad] [carpeta-capturas]
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const BASE = process.env.BASE || 'http://localhost:5173/';
const N = Number(process.argv[2] || 8);
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
  paso(`Sala ${codigo}: ${N} invitados en 4 equipos`);
  await medir('Entrada y equipos');

  // Equipo de cada celular, para saber qué escribe cada uno.
  const equipoDe = async (p) => (await p.locator('.etiqueta').first().textContent()).trim();

  await elegirJuego(host, '¿Te acordás de la escena?', async () => {
    await host.locator('.escena-opcion').first().waitFor();
    afirmar(await host.locator('.escena-opcion input:checked').count() === 2, 'vienen marcadas 2 escenas (Cleto y las mascotas)');
    // Solo Cleto y los Borbotones.
    const marcas = host.locator('.escena-opcion input');
    for (let i = 0; i < await marcas.count(); i++) {
      const t = await host.locator('.escena-opcion').nth(i).textContent();
      if (/Cleto|Borbotones/.test(t)) await marcas.nth(i).check(); else await marcas.nth(i).uncheck();
    }
    await host.locator('#cfg-seg').selectOption('60');
    afirmar(await host.locator('#cfg-puntos').inputValue() === 'acierto', 'por defecto, 1 punto por cada cosa que se acuerden');
    await host.locator('#cfg-puntos').selectOption('puesto');
  });
  await tv.getByText('Los hijos de Cleto').waitFor({ timeout: 15000 });
  await captura(tv, 'e1-presentar');
  await invitados[0].getByText('¡Miren la tele!').waitFor();
  await host.getByRole('button', { name: /A escribir/ }).click();
  for (const p of invitados) await p.locator('#escena-respuesta').waitFor({ timeout: 10000 });

  // Lo que escribe cada equipo (repartido entre sus celulares).
  const porEquipo = {};
  for (const p of invitados) (porEquipo[await equipoDe(p)] ||= []).push(p);
  const nombres = Object.keys(porEquipo);
  afirmar(nombres.length === 4, 'hay cuatro equipos con gente');
  const listas = [
    ['tifany', 'Cody', 'dilan', 'Brittney', 'kiubert', 'Zoey', 'Max', 'Noa', 'Phil', 'Mario'],   // 9 bien + 1 inventado
    ['Heather', 'Cody', 'Cody', 'Hunter', 'Kira', 'Wesley'],                                       // 5 (una repetida)
    ['Tiffany', 'Taylor', 'Pepe'],                                                                  // 2 + Pepe (se acepta a mano no: queda afuera)
    [],                                                                                             // no escribe nada
  ];
  const esperado = [9, 5, 2, 0];
  for (const [k, eq] of nombres.entries()) {
    const cels = porEquipo[eq];
    for (const [i, t] of listas[k].entries()) {
      const p = cels[i % cels.length];
      await p.locator('#escena-respuesta').fill(t);
      await p.locator('#escena-respuesta').press('Enter');
    }
  }
  await captura(porEquipo[nombres[0]][0], 'e1-celular');
  await esperar(1500);
  await tv.locator('.tv-eq', { hasText: nombres[0] }).getByText('✍️ 10').waitFor({ timeout: 10000 });
  await captura(tv, 'e1-escribiendo');
  // Un celular recarga la página: su lista sigue ahí.
  const recargado = porEquipo[nombres[1]][0];
  const antesRecarga = await recargado.locator('.chip-palabra').count();
  await recargar(recargado);
  await recargado.locator('#escena-respuesta').waitFor({ timeout: 15000 });
  afirmar(await recargado.locator('.chip-palabra').count() === antesRecarga, 'la lista sobrevive a recargar la página');
  paso('Escribieron los cuatro equipos; la tele cuenta lo escrito y una recarga no pierde nada');
  await medir('Escena 1: escribir');

  await host.getByRole('button', { name: 'Cortar el tiempo ya' }).click();
  await host.getByRole('button', { name: '📺 Revelar en la tele' }).waitFor();
  await tv.getByText('Contando…').waitFor();
  const cuenta = async (eq) => Number((await host.locator('.escena-equipo', { hasText: eq }).locator('b').first().textContent()).split(' ')[0]);
  for (const [k, eq] of nombres.entries()) afirmar(await cuenta(eq) === esperado[k], `${eq} reconoce ${esperado[k]} (${await cuenta(eq)})`);
  afirmar(await host.locator('.escena-equipo', { hasText: nombres[0] }).getByText('Mario').count() === 1, 'lo inventado queda sin reconocer');
  // A mano: el equipo 3 dijo «Pepe» queriendo decir Dermot (se acepta) y al equipo 1 se le saca Phil.
  await host.locator('.escena-equipo', { hasText: nombres[2] }).getByRole('button', { name: 'Dermot', exact: true }).click();
  await host.locator('.escena-equipo', { hasText: nombres[0] }).getByRole('button', { name: '✓ Phil' }).click();
  await esperar(400);
  afirmar(await cuenta(nombres[2]) === 3 && await cuenta(nombres[0]) === 8, 'los cambios a mano cuentan');
  await captura(host, 'e1-revisar');
  await host.getByRole('button', { name: '📺 Revelar en la tele' }).click();
  await tv.locator('.tv-escena-items li').first().waitFor();
  afirmar(await tv.locator('.tv-escena-items li').count() === 27, 'la tele muestra los 27 hijos');
  await esperar(7500);
  await captura(tv, 'e1-revelada');
  const pts = await host.locator('.equipo-pts').allTextContents();
  const total = pts.reduce((a, x) => a + Number(x), 0);
  afirmar(total === 100 + 60 + 40, `puntos por puesto 100+60+40+0 (${pts})`);
  const cel = porEquipo[nombres[0]][0];
  await cel.getByText('8 de 27').waitFor();
  await captura(cel, 'e1-celular-resultado');
  paso(`Escena 1 revelada: ${nombres.map((e, k) => `${e} ${[8, 5, 3, 0][k]}`).join(', ')} → ${pts.join(' / ')}`);
  await medir('Escena 1: revisar y revelar');

  // ── Escena 2: los Borbotones; dos equipos empatan ──
  await host.getByRole('button', { name: 'Siguiente escena →' }).click();
  await tv.locator('.tv-titulo', { hasText: 'Los Borbotones' }).waitFor();
  await host.getByRole('button', { name: /A escribir/ }).click();
  const b = [['homer', 'Apu', 'skiner'], ['Barney', 'Apu', 'Homero'], ['el jefe gorgory'], []];
  for (const [k, eq] of nombres.entries()) {
    const p = porEquipo[eq][0];
    await p.locator('#escena-respuesta').waitFor();
    for (const t of b[k]) { await p.locator('#escena-respuesta').fill(t); await p.locator('#escena-respuesta').press('Enter'); }
  }
  await esperar(1500);
  await host.getByRole('button', { name: 'Cortar el tiempo ya' }).click();
  await host.getByRole('button', { name: '📺 Revelar en la tele' }).click();
  await tv.locator('.tv-escena-items li').first().waitFor();
  await esperar(500);
  const pts2 = (await host.locator('.equipo-pts').allTextContents()).reduce((a, x) => a + Number(x), 0);
  afirmar(pts2 - total === 100 + 100 + 40, `empate: los dos primeros se llevan 100 (${pts2 - total})`);
  paso('Escena 2: empate en el primer puesto, los dos suman 100 y el siguiente 40');
  await host.getByRole('button', { name: 'Ver resultados' }).click();
  await tv.getByText('¡Terminaron las escenas!').waitFor();
  await medir('Escena 2');
  for (const [n, l, e] of etapas) console.log(`  ${n.padEnd(28)} ${String(l).padStart(6)} lecturas ${String(e).padStart(5)} escrituras`);

  // ── Escena con video: se carga desde el panel, pasa una vez en la tele y después la pregunta ──
  await terminarJuego(host);
  const antesV = (await host.locator('.equipo-pts').allTextContents()).reduce((a, x) => a + Number(x), 0);
  await elegirJuego(host, '¿Te acordás de la escena?', async () => {
    await host.getByText('🎬 Cargar una escena con video').click();
    await host.locator('#esc-titulo').fill('Homero en la feria');
    await host.locator('#esc-video').fill('pruebas/escena-prueba.mp4');
    await host.locator('#esc-pregunta').fill('¿Qué colores había en la pantalla?');
    await host.locator('#esc-respuestas').fill('rojo / colorado\nverde\nazul');
    await host.getByRole('button', { name: 'Guardar escena' }).click();
    await host.locator('.escena-opcion', { hasText: 'Homero en la feria' }).waitFor();
    const marcas = host.locator('.escena-opcion input');
    for (let i = 0; i < await marcas.count(); i++) {
      const t = await host.locator('.escena-opcion').nth(i).textContent();
      if (/Homero en la feria/.test(t)) await marcas.nth(i).check(); else await marcas.nth(i).uncheck();
    }
  });
  await tv.getByText('la escena pasa una sola vez').waitFor({ timeout: 10000 });
  afirmar(!(await tv.getByText('¿Qué colores había').count()), 'la pregunta no aparece antes del video');
  await host.getByRole('button', { name: /Pasar el video en la tele/ }).click();
  await tv.locator('video.tv-video').waitFor({ timeout: 10000 });
  await invitados[0].getByText('¡Miren la tele!').waitFor();
  await tv.waitForFunction(() => { const v = document.querySelector('video.tv-video'); return v && v.currentTime > 0.3; }, null, { timeout: 10000 });
  await captura(tv, 'e5-video');
  paso('Escena con video: la tele pasa el video y los celulares dicen que miren la tele');
  await host.getByRole('button', { name: /Terminó el video/ }).click();
  await tv.getByText('¿Qué colores había en la pantalla?').waitFor({ timeout: 10000 });
  await host.getByRole('button', { name: /A escribir/ }).click();
  const unoV = invitados[0];
  await unoV.locator('#escena-respuesta').waitFor({ timeout: 10000 });
  for (const t of ['Colorado', 'azul', 'violeta']) { await unoV.locator('#escena-respuesta').fill(t); await unoV.locator('#escena-respuesta').press('Enter'); }
  await esperar(1500);
  await host.getByRole('button', { name: 'Cortar el tiempo ya' }).click();
  await host.getByRole('button', { name: '📺 Revelar en la tele' }).click();
  await tv.locator('.tv-escena-items li').first().waitFor();
  await esperar(500);
  const ptsV = (await host.locator('.equipo-pts').allTextContents()).reduce((a, x) => a + Number(x), 0);
  afirmar(ptsV - antesV === 2, `1 punto por cada cosa recordada (sumó ${ptsV - antesV})`);
  paso('Escena con video: el equipo se acordó de 2 de 3 y sumó 2 puntos');
  await host.getByRole('button', { name: 'Ver resultados' }).click();
  await terminarJuego(host);

  // ── Cerrar la sala: los celulares ven que se cerró y la sala desaparece del panel ──
  await host.getByRole('button', { name: 'Cerrar sala', exact: true }).last().click();
  await host.getByRole('dialog').getByRole('button', { name: 'Cerrar sala' }).click();
  await invitados[0].getByText('La sala se cerró').waitFor({ timeout: 20000 });
  await host.getByText('Mis bancos').waitFor({ timeout: 20000 });
  await esperar(1500);
  afirmar(!(await host.getByText(codigo).count()), 'la sala ya no aparece en el panel');
  paso('Cerrar sala: los celulares ven «La sala se cerró» y la sala desaparece del panel');
} catch (e) {
  errores.push('PRUEBA: ' + e.message);
}

await browser.close();
const reales = errores.filter((e) => !/favicon|ERR_TUNNEL|ERR_FAILED|ERR_INTERNET_DISCONNECTED|navigator\.vibrate|fonts\.g/.test(e));
if (reales.length) { console.log('\nErrores:\n' + [...new Set(reales)].join('\n')); process.exit(1); }
console.log('\nTodo bien ✔');
