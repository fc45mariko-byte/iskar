// UI check for the game: builds it, then at phone / tablet / desktop widths
// walks the title screen, every game screen and the grain-crisis decision,
// checks layout and script errors, verifies save/continue, and saves screenshots.
//   node test/ui/screens.mjs [outDir]
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const root = resolve(new URL('../..', import.meta.url).pathname);
const outDir = resolve(process.argv[2] ?? join(root, 'test/ui/output'));
execSync('node scripts/build.mjs', { cwd: root, stdio: 'inherit' });
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }

const types = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer(async (req, res) => {
  try {
    const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(root)) throw new Error('outside root');
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/dist/index.html`;

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 960 },
];
const SCREENS = ['carte', 'civilisation', 'region', 'personnage', 'evenements', 'temps', 'analyses', 'explorateur'];
await mkdir(outDir, { recursive: true });
const browser = await playwright.chromium.launch();
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } else console.log('ok  ', msg); };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: vp });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()));
  await page.goto(base);
  await page.waitForSelector('.title-menu');
  check(await overflow(page) <= 0, `${vp.name}: title screen fits`);
  await page.screenshot({ path: join(outDir, `${vp.name}-1-accueil.png`) });

  await page.getByRole('button', { name: 'Jouer ce scénario' }).click();
  await page.waitForSelector('.map-overlay');
  for (const [i, v] of SCREENS.entries()) {
    await page.evaluate((h) => { location.hash = h; }, v);
    await page.waitForSelector(`.tabs-nav a[href="#${v}"][aria-current="page"]`);
    await page.waitForTimeout(v === 'carte' ? 300 : 100);
    const ov = await overflow(page);
    const portraits = await page.locator('.pt, .scene, canvas, .chart, .timeline').count();
    check(ov <= 0 && portraits > 0, `${vp.name}/${v}: overflow ${ov}px, ${portraits} illustrations`);
    await page.screenshot({ path: join(outDir, `${vp.name}-${i + 2}-${v}.png`), fullPage: true });
  }
  // Map modes repaint without errors.
  await page.evaluate(() => { location.hash = 'carte'; });
  for (const mode of ['Ressources', 'Politiques', 'Relations']) await page.getByRole('button', { name: mode, exact: true }).click();
  await page.screenshot({ path: join(outDir, `${vp.name}-carte-relations.png`) });

  // Run time to the grain crisis and decide.
  await page.locator('.topbar [data-action="speed"][data-speed="30"]').click();
  await page.waitForSelector('.pending', { timeout: 15000 });
  await page.locator('.pending').click();
  await page.waitForSelector('.choice');
  check(/Crise du grain à Orane/.test(await page.locator('.decision h1').innerText()), `${vp.name}: grain crisis reaches the council`);
  await page.screenshot({ path: join(outDir, `${vp.name}-6-decision.png`), fullPage: true });
  await page.getByRole('button', { name: /Imposer des restrictions/ }).click();
  await page.waitForSelector('.view-temps');
  check(/Décision : Imposer des restrictions/.test(await page.locator('.log').innerText()), `${vp.name}: decision logged`);
  await page.getByRole('button', { name: 'Sauter une période' }).click();
  await page.getByRole('button', { name: 'Sauter une période' }).click();
  await page.evaluate(() => { location.hash = 'analyses'; });
  await page.waitForSelector('.view-analyses .chart');
  await page.screenshot({ path: join(outDir, `${vp.name}-8-analyses-later.png`), fullPage: true });
  await page.evaluate(() => { location.hash = 'personnage'; });
  await page.getByRole('tab', { name: 'Journal' }).click();
  check(/recopier les arrêtés/.test(await page.locator('.journal').innerText()), `${vp.name}: Mara's journal reflects the decision`);
  await page.evaluate(() => { location.hash = 'explorateur'; });
  await page.getByRole('tab', { name: 'Documents' }).click();
  check(await page.locator('.doc', { hasText: 'Arrêté du conseil d’Orane' }).count() >= 1, `${vp.name}: decree archived`);

  // Save and continue after reload.
  const date = await page.locator('.topbar .date small').innerText();
  await page.goto(base);
  await page.getByRole('button', { name: /Continuer/ }).click();
  await page.waitForSelector('.topbar');
  check(await page.locator('.topbar .date small').innerText() === date, `${vp.name}: continue restores ${date}`);
  check(errors.length === 0, `${vp.name}: no script errors ${errors.join(' | ')}`);
  await context.close();
}
await browser.close();
server.close();
console.log(failures ? `${failures} UI check(s) failed` : 'All UI checks passed', '— screenshots in', outDir);
process.exit(failures ? 1 : 0);
