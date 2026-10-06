#!/usr/bin/env node
/**
 * Prueba de humo de Relevo de Luz con Playwright (viewport 390×844).
 *
 * Verifica: lobby y tarjetas de Juegos, que cada subjuego abra y gaste UNA tirada por partida,
 * que "Volver" regrese al lobby, que el juego principal arranque con ?autoplay y que no haya errores de página.
 * También reproduce el bug conocido de la Pesca (botón "Cambiar" que duplica escuchas).
 *
 * Uso:
 *   npm run build && npx vite preview --port 4173 --strictPort    # en otra terminal
 *   npm i --no-save playwright && npx playwright install chromium   # una sola vez (Playwright no está en package.json)
 *   node docs/herramientas/prueba-subjuegos.mjs [http://127.0.0.1:4173/relevo/]
 *
 * Si Playwright está instalado en otro lado: PLAYWRIGHT_MODULE=/ruta/a/playwright/index.mjs node docs/herramientas/prueba-subjuegos.mjs
 */
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const URL = process.argv[2] ?? 'http://127.0.0.1:4173/relevo/';

const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

async function freshPage() {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  // Sin red externa: SDK de Telegram, fuentes y Monetag (sin zona se usa el anuncio de prueba).
  await page.route(/telegram\.org|fonts\.(googleapis|gstatic)\.com|libtl\.com/, (r) => r.abort());
  await page.goto(URL);
  await page.waitForTimeout(700);
  return page;
}
const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('relevo.save.v1') ?? '{}'));

// 1) Lobby y tarjetas
let page = await freshPage();
const tabs = await page.$$eval('[data-tab]', (els) => els.map((e) => e.getAttribute('data-tab')));
check('Pestañas del lobby', ['home', 'games', 'missions', 'chars', 'worlds'].every((t) => tabs.includes(t)), tabs.join(','));
await page.click('[data-tab="games"]');
const cards = await page.$$eval('.game-card', (els) => els.map((e) => e.className.replace('game-card ', '')));
check('Tarjetas de subjuegos', cards.length >= 2, cards.join(','));

// 2) Torre: una tirada gasta 1, se acredita 1 ronda, Volver vuelve al lobby
await page.click('.game-card.tower .gc-play');
await page.waitForTimeout(300);
await page.click('[data-s-play]');
await page.waitForTimeout(200);
check('Torre abre y juega', (await page.evaluate(() => window.__relevo.tower.mode)) === 'play');
await page.evaluate(() => window.__relevo.tower.endRound());
await page.evaluate(() => window.__relevo.tower.endRound()); // segundo llamado: no debe acreditar de nuevo
let s = await save(page);
check('Torre: 1 tirada usada y 1 ronda acreditada', s.tower.used === 1 && s.tower.rounds === 1, JSON.stringify(s.tower));
await page.click('[data-s-back]');
await page.waitForTimeout(300);
check('Torre: Volver regresa al lobby', !(await page.evaluate(() => window.__relevo.subOpen)));

// 3) Pesca: una tirada sin tocar "Cambiar"
await page.click('.game-card.fish .gc-play');
await page.waitForTimeout(300);
await page.click('[data-f-play]');
await page.waitForTimeout(200);
await page.evaluate(() => (window.__relevo.fishing.left = 0));
await page.waitForFunction(() => window.__relevo.fishing.mode === 'result');
s = await save(page);
check('Pesca: 1 tirada usada y 1 ronda acreditada', s.fish.used === 1 && s.fish.rounds === 1, JSON.stringify({ used: s.fish.used, rounds: s.fish.rounds }));
check('Sin errores de página (lobby y subjuegos)', page.errors.length === 0, page.errors.join(' | '));

// 4) Bug conocido: en la intro de la Pesca, "Cambiar" y después PESCAR gasta 2 tiradas.
page = await freshPage();
await page.click('[data-tab="games"]');
await page.click('.game-card.fish .gc-play');
await page.waitForTimeout(300);
if (await page.$('[data-f-target]')) {
  await page.click('[data-f-target]');
  await page.waitForTimeout(100);
  await page.click('[data-f-play]');
  await page.waitForTimeout(200);
  const used = (await save(page)).fish.used;
  check('Pesca: "Cambiar" + PESCAR gasta 1 tirada (falla mientras el bug siga)', used === 1, `tiradas usadas: ${used}`);
}

// 5) Juego principal con bot
page = await freshPage();
await page.goto(URL + '?autoplay');
await page.waitForTimeout(600);
await page.click('[data-play]');
await page.waitForTimeout(12000);
const main = await page.evaluate(() => ({ phase: window.__relevo.phase, chain: window.__relevo.chain }));
check('Juego principal con ?autoplay avanza', main.chain > 0, JSON.stringify(main));
check('Sin errores de página (juego principal)', page.errors.length === 0, page.errors.join(' | '));

await browser.close();
for (const r of results) console.log(`${r.ok ? 'OK   ' : 'FALLA'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
