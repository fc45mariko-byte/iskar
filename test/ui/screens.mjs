// UI check for the web app: builds it, serves the repo, opens every view at
// phone / tablet / desktop widths in light and dark, checks layout, script
// errors and portrait coverage, exercises the dossier, and saves screenshots.
//   node test/ui/screens.mjs [outDir] [--dev]   (--dev tests app/ via ES modules)
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const root = resolve(new URL('../..', import.meta.url).pathname);
const args = process.argv.slice(2);
const dev = args.includes('--dev');
const outDir = resolve(args.find((a) => !a.startsWith('--')) ?? join(root, 'test/ui/output'));
if (!dev) execSync('node scripts/build.mjs', { cwd: root, stdio: 'inherit' });
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(root)) throw new Error('outside root');
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/${dev ? 'app' : 'dist'}/index.html`;

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 960 },
];
const views = { atlas: 6, census: 12, registry: 24, households: 3, public: 30, events: 13 };
await mkdir(outDir, { recursive: true });
const browser = await playwright.chromium.launch();
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } else console.log('ok  ', msg); };

for (const scheme of ['light', 'dark']) {
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: vp, colorScheme: scheme });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()));
    await page.goto(base);
    for (const [view, minPlates] of Object.entries(views)) {
      const tag = `${vp.name}/${scheme}/${view}`;
      await page.evaluate((v) => { location.hash = v; }, view);
      await page.waitForFunction((v) => document.querySelector(`.nav a[href="#${v}"][aria-current="page"]`), view);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const plates = await page.locator('.plate, .region-row').count();
      check(overflow <= 0 && plates >= minPlates, `${tag}: overflow ${overflow}px, ${plates} portraits`);
      if (scheme === 'light' || view === 'atlas') await page.screenshot({ path: join(outDir, `${vp.name}-${scheme}-${view}.png`), fullPage: true });
    }
    // Dossier: open someone from the census, age them, record an event, add to registry.
    await page.evaluate(() => { location.hash = 'census'; });
    await page.locator('.plate').nth(3).click();
    await page.waitForSelector('#d-portrait svg');
    await page.locator('#d-age').fill('70');
    await page.locator('#d-age').dispatchEvent('change');
    await page.locator('#ev-type').selectOption('scar');
    await page.getByRole('button', { name: 'Record event' }).click();
    const hist = await page.locator('.history').innerText();
    check(/Visible scar/.test(hist), `${vp.name}/${scheme}: event recorded`);
    await page.getByRole('button', { name: 'Add to registry' }).click();
    check(await page.locator('.chip', { hasText: 'In registry' }).count() === 1, `${vp.name}/${scheme}: added to registry`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `${vp.name}/${scheme}/dossier: no horizontal scroll`);
    await page.screenshot({ path: join(outDir, `${vp.name}-${scheme}-dossier.png`), fullPage: true });
    await page.getByRole('link', { name: 'Back to registry' }).click();
    await page.waitForSelector('#f-q');
    check(await page.locator('.plate').count() === 25, `${vp.name}/${scheme}: registry shows the new resident`);
    check(errors.length === 0, `${vp.name}/${scheme}: no script errors ${errors.join(' | ')}`);
    await page.close();
  }
}
await browser.close();
server.close();
console.log(failures ? `${failures} UI check(s) failed` : 'All UI checks passed', '— screenshots in', outDir);
process.exit(failures ? 1 : 0);
