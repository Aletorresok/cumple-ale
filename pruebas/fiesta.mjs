// Prueba de punta a punta con los emuladores de Firebase: abre la sala, la pantalla grande y
// N invitados (30 por defecto), y juega la selección de equipos, la mímica y el podio.
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

try {
  // ── Organizador ──
  const host = await pagina('host', '?docente', { width: 1100, height: 900 });
  await host.waitForFunction(() => window.pruebas);
  await host.evaluate((sub) => window.pruebas.entrarComoOrganizador(sub), 'org-' + Date.now());
  await host.getByText('Mis bancos').waitFor({ timeout: 20000 }); // la página se recarga sola al entrar
  await host.getByRole('button', { name: /banco de ejemplo/ }).click();
  await host.getByText('Cumple Ale · ejemplo').waitFor();
  await host.getByRole('button', { name: '🍩 Agregar el banco Springfield' }).click();
  await host.getByText('Springfield · Los Simpson').waitFor();
  await host.getByRole('button', { name: '⚡ Trivia · Springfield', exact: true }).click();
  await host.getByText('16 preguntas').waitFor();
  await host.locator('#cant-equipos').selectOption('4');
  await host.getByRole('button', { name: 'Abrir una sala' }).click();
  const codigo = (await host.locator('.sala-codigo').textContent()).trim();
  paso(`Sala ${codigo} abierta`);
  await host.locator('.escaleta-actual').getByText('Llegada').waitFor();
  await captura(host, '0b-escaleta-panel');

  // ── Deshacer puntos: un +50 de más se vuelve atrás con un toque ──
  const ptsPrimero = () => host.locator('.equipo .equipo-pts').first().textContent();
  const ptsAntes = Number(await ptsPrimero());
  await host.locator('.equipo').first().getByRole('button', { name: '+50' }).click();
  await host.locator('.deshacer').getByText(/\+50/).waitFor();
  await host.waitForFunction((n) => Number(document.querySelector('.equipo .equipo-pts').textContent) === n, ptsAntes + 50);
  await host.locator('.deshacer').click();
  await host.waitForFunction((n) => Number(document.querySelector('.equipo .equipo-pts').textContent) === n, ptsAntes);
  afirmar(!(await host.locator('.deshacer').count()), 'después de deshacer no queda nada para deshacer');
  paso('Deshacer puntos: el +50 de más volvió atrás');

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
      await p.getByText('¡Mirá la tele!').waitFor({ timeout: 30000 });
      return p;
    }));
    invitados.push(...lote);
  }
  await host.waitForFunction((n) => document.querySelector('.entrada')?.textContent.includes(`${n} invitados conectados`), N, { timeout: 30000 });
  paso(`${N} invitados conectados`);
  // Los celulares bajan solo lo que usan: ni el panel ni los bancos de ejemplo.
  const bajados = await invitados[0].evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
  afirmar(!bajados.some((u) => /\/js\/(docente|ejemplos|trivias|expedientes|respaldo|diagnostico)\.js/.test(u)), 'el celular no baja el panel');
  await medir('Entrada de los invitados');
  await captura(tv, '1-espera');

  // ── Selección de equipos ──
  await elegirJuego(host, 'Selección de equipos');
  // El anfitrión elige a quién y a qué equipo lo manda.
  const quien = await host.locator('#sel-quien option').nth(1).textContent();
  await host.locator('#sel-quien').selectOption({ label: quien });
  const destino = (await host.locator('.tarjeta .pildora-boton').nth(2).textContent()).replace(/ \(\d+\)$/, '');
  await host.locator('.tarjeta .pildora-boton').nth(2).click();
  await esperar(1200);
  await captura(tv, '2-seleccion-girando');
  await host.locator('.tarjeta.suave .pildora').waitFor({ timeout: 10000 });
  afirmar((await host.locator('.tarjeta.suave .grande').textContent()) === quien, `pasa el elegido a mano (${quien})`);
  afirmar((await host.locator('.tarjeta.suave .pildora').textContent()).includes(destino), `va al equipo elegido a mano (${destino})`);
  await tv.getByText(destino, { exact: false }).first().waitFor();
  paso(`Selección a mano: ${quien} → ${destino}`);
  await captura(tv, '3-seleccion-revelado');
  // Y uno que decide la suerte.
  await host.getByRole('button', { name: /Que decida la suerte/ }).click();
  await host.getByText('Eligiendo equipo para').waitFor();
  await host.getByText('Quedó en').waitFor({ timeout: 10000 });
  afirmar((await host.locator('.tarjeta.suave .grande').textContent()) !== quien, 'la suerte eligió a otro invitado');
  await host.getByRole('button', { name: /Repartir a todos/ }).click();
  await host.getByText('¡Equipos armados!').waitFor();
  for (const p of invitados) await p.locator('.resultado.mi-equipo').waitFor({ timeout: 15000 });
  const tamanios = await host.locator('.equipo .miembros').evaluateAll((els) => els.map((e) => e.querySelectorAll('.chip').length));
  afirmar(Math.max(...tamanios) - Math.min(...tamanios) <= 1, `equipos parejos (${tamanios})`);
  paso(`Equipos armados y parejos: ${tamanios.join(', ')}`);
  await captura(invitados[0], '4-seleccion-celular');
  await terminarJuego(host);
  await medir('Selección de equipos');

  // ── Los invitados dicen ──
  await elegirJuego(host, 'Los invitados dicen');
  // La tele muestra primero solo los equipos; la pregunta aparece cuando el panel la muestra.
  await tv.locator('.duelo.en-tv').waitFor({ timeout: 15000 });
  afirmar(!(await tv.locator('.tv-pregunta').count()), 'la pregunta arranca oculta en la tele');
  await host.getByRole('button', { name: '📺 Mostrar la pregunta en la tele' }).click();
  await tv.locator('.tablero').waitFor({ timeout: 15000 });
  await captura(tv, '10-invitados-dicen');
  await esperar(1500);
  await captura(invitados[0], '10f-invitados-dicen-celular');
  paso('Los invitados dicen: arrancó con el tablero');
  await terminarJuego(host);
  await medir('Los invitados dicen (arranque)');

  // ── Trivia ──
  await elegirJuego(host, 'Trivia por equipos', async () => {
    await host.locator('#cfg-banco').selectOption({ label: 'Trivia · Springfield — 31 preguntas' });
    await host.locator('#cfg-cantidad').selectOption('5');
    await host.locator('#cfg-modo').selectOption('castigo');
  });
  let salioContrato = false;
  let penados = 0;
  // Con castigo vota solo el capitán; los demás ven «¡Miren la tele!» y pueden tocar «voto yo».
  const vozYo = (p) => p.getByRole('button', { name: /voto yo/ });
  const pregLista = (p, timeout) => p.locator('.opcion').or(vozYo(p)).first().waitFor({ timeout });
  const votar = async (p, k) => { if (await vozYo(p).count()) await vozYo(p).click(); await p.locator('.opcion').nth(k).click(); };
  for (let n = 0; n < 5; n++) {
    await pregLista(invitados[0], 15000);
    const pregunta = await tv.locator('.tv-pregunta').textContent();
    const esContrato = pregunta.includes('contrato');
    if (esContrato) { salioContrato = true; await captura(tv, '10c-trivia-contrato'); await captura(invitados[0], '10d-trivia-celular'); }
    if (n === 0) {
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
        await pregLista(p, 20000);
        const eq = await p.locator('.invitado-barra .pildora').textContent();
        afirmar(eq === equiposAntes[i], `después de recargar sigue en su equipo (${equiposAntes[i]} → ${eq})`);
      }
      paso('Reconexión: tres celulares recargaron y siguen con su equipo y la pregunta');
      // Wifi conectado pero sin internet: el navegador cree que hay red y Firebase no responde.
      // Ese celular responde igual; ve el aviso, y la respuesta llega cuando vuelve internet.
      const sinInternet = invitados[6];
      const servidor = /127\.0\.0\.1:8080|localhost:8080/;
      const bloquear = (r) => r.abort('internetdisconnected');
      await sinInternet.context().route(servidor, bloquear);
      await Promise.all(invitados.map((p) => votar(p, 0)));
      await sinInternet.locator('.banda-conexion:not([hidden])').waitFor({ timeout: 20000 });
      await sinInternet.context().unroute(servidor, bloquear);
      await sinInternet.locator('.banda-conexion').waitFor({ state: 'hidden', timeout: 60000 });
      paso('Reconexión: un celular con wifi pero sin internet vio el aviso y su respuesta llegó al volver');
    } else if (n === 1) {
      // Presencia: un celular que dejó de avisar (se quedó sin batería) no frena la pregunta.
      const ausente = invitados[N - 1];
      const raiz = `http://127.0.0.1:8080/v1/projects/${PROYECTO}/databases/(default)/documents/salas/${codigo}/jugadores`;
      const cab = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
      // pageSize: sin él, la API devuelve una sola página y el invitado puede no estar en ella.
      const lista = await (await fetch(raiz + "?pageSize=300", { headers: cab })).json();
      const doc = lista.documents.find((d) => d.fields.nombre.stringValue === `Invitado ${N}`);
      afirmar(doc, 'se encontró al invitado que va a quedar ausente');
      const viejo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const resp = await fetch(`${doc.name.replace(/^projects/, 'http://127.0.0.1:8080/v1/projects')}?updateMask.fieldPaths=visto`, { method: 'PATCH', headers: cab, body: JSON.stringify({ fields: { visto: { timestampValue: viejo } } }) });
      afirmar(resp.ok, `el emulador aceptó marcar al ausente (${resp.status})`);
      await esperar(1500);
      await Promise.all(invitados.filter((p) => p !== ausente).map((p) => votar(p, n % 2)));
      paso(`Presencia: ${N - 1} respondieron y la pregunta se reveló sin esperar al celular ausente`);
    } else {
      await Promise.all(invitados.map((p) => pregLista(p, 15000)));
      const capitanes = [];
      for (const p of invitados) if (await p.locator('.opcion').count()) capitanes.push(p);
      afirmar(capitanes.length === 4, `solo los 4 capitanes ven las opciones (${capitanes.length})`);
      if (n === 2) await captura(invitados.find((p) => !capitanes.includes(p)), '10d2-trivia-sin-celular');
      await Promise.all(capitanes.map((p) => p.locator('.opcion').nth(n % 2).click()));
      await host.getByRole('button', { name: /Siguiente pregunta|Ver resultados/ }).waitFor({ timeout: 8000 });
      if (n === 2) paso('Trivia: votan solo los 4 capitanes y la pregunta se revela sin esperar el reloj');
    }
    await host.getByRole('button', { name: /Siguiente pregunta|Ver resultados/ }).waitFor({ timeout: 20000 });
    await tv.locator('.tv-opcion.correcta').waitFor();
    penados += await tv.locator('.tv-prenda').count();
    if (n === 0) await invitados[0].locator('.resultado').waitFor();
    if (n === 0) await captura(tv, '10a-trivia');
    if (esContrato) await captura(tv, '10e-trivia-contrato-revelada');
    await host.getByRole('button', { name: /Siguiente pregunta|Ver resultados/ }).click();
  }
  afirmar(penados > 0, `en el modo con castigo algún equipo pagó prenda (${penados})`);
  afirmar(salioContrato, 'la pregunta del contrato sale siempre, aunque se sorteen 5');
  paso(`Trivia con castigo: cinco preguntas, ${penados} prendas repartidas, con la del contrato`);
  await terminarJuego(host);
  await medir('Trivia (cinco preguntas)');

  // ── Pausa: noticiero de Springfield con un aviso ──
  const irAlPaso = async (titulo) => {
    await host.locator('.escaleta summary').click();
    await host.locator('.escaleta-lista').getByRole('button', { name: titulo }).click();
    await host.locator('.escaleta-actual').getByText(titulo.replace(/^\S+ /, '')).waitFor();
  };
  await irAlPaso('📺 Pausa · Noticiero de Springfield');
  await host.getByRole('button', { name: '📺 Poner el noticiero' }).click();
  await tv.locator('.tv-noticiero').waitFor({ timeout: 15000 });
  await host.locator('#aviso-tv').fill('Las pizzas salen en 5 minutos');
  await host.getByRole('button', { name: 'Mandar aviso' }).click();
  await tv.getByText('Las pizzas salen en 5 minutos').waitFor({ timeout: 20000 });
  await esperar(800);
  await captura(tv, '10k-noticiero-aviso');
  await tv.locator('.nt-cinta', { hasText: /La causa de la torta|Último momento|Testigo clave/ }).waitFor({ timeout: 40000 });
  await esperar(800);
  await captura(tv, '10l-noticiero');
  await captura(host, '10m-escaleta-pausa');
  await host.getByRole('button', { name: 'Volver al QR en la tele' }).click();
  await tv.locator('.tv-entrar').waitFor({ timeout: 15000 });
  paso('Noticiero: la tele pasó el aviso y los titulares de la noche, y volvió al QR');

  // ── Intro de la noche y botonera de frases ──
  await irAlPaso('🎬 Intro de la noche');
  await host.getByRole('button', { name: '🎬 Poner la intro' }).click();
  await tv.locator('.tv-intro').waitFor({ timeout: 15000 });
  await tv.locator('.in-final').waitFor({ state: 'visible', timeout: 15000 });
  await esperar(1500);
  await captura(tv, '10n-intro');
  await host.getByRole('button', { name: '↻ Repetir la intro' }).waitFor();
  await tv.locator('.in-pizarron').waitFor({ timeout: 15000 });
  await tv.locator('.in-renglon', { hasText: 'No voy a faltar' }).first().waitFor({ timeout: 10000 });
  await captura(tv, '10n2-intro-pizarron');
  // Si arranca un juego en medio de la intro y después termina, la tele no repite la intro: vuelve al QR.
  await elegirJuego(host, 'Completá la frase');
  await tv.locator('.tv-frase').waitFor({ timeout: 15000 });
  await terminarJuego(host);
  await tv.locator('.tv-entrar').waitFor({ timeout: 15000 });
  afirmar(!(await tv.locator('.tv-intro').count()), 'al terminar un juego la intro no vuelve a empezar');
  paso('Intro de la noche en la tele (pizarrón) y no se repite al volver de un juego');

  // ── Podio ──
  await elegirJuego(host, 'Podio final');
  for (let i = 0; i < 4; i++) await host.getByRole('button', { name: /Revelar/ }).click().then(() => esperar(400));
  await tv.getByText('¡Campeón de la noche!').waitFor();
  await esperar(1500);
  await captura(tv, '12-podio');
  for (const p of invitados) await p.locator('.sentencia').waitFor({ timeout: 15000 });
  await captura(invitados[0], '13-podio-celular');
  paso('Podio: revelado hasta el campeón, y cada invitado recibió su sentencia');
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
  paso('Plan B: se imprime el banco con mímica, encuestas, trivia, escape y hoja de puntos');

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
