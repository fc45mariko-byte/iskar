// UI check: serves the repo, opens the demo at phone / tablet / desktop widths,
// verifies layout and portrait coverage, and writes full-page screenshots.
//   node test/ui/screens.mjs [outDir]
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const root = resolve(new URL('../..', import.meta.url).pathname);
const outDir = resolve(process.argv[2] ?? join(root, 'test/ui/output'));
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(root)) throw new Error('outside root');
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const viewports = [
  { name: 'phone', width: 360, height: 780 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];
await mkdir(outDir, { recursive: true });
const browser = await playwright.chromium.launch();
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } else console.log('ok  ', msg); };

for (const scheme of ['light', 'dark']) {
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: vp, colorScheme: scheme });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`http://localhost:${port}/demo/index.html`);
    await page.waitForSelector('#pop-grid .card');
    const tag = `${vp.name}/${scheme}`;
    check(errors.length === 0, `${tag}: no script errors ${errors.join(' | ')}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `${tag}: no horizontal scroll (overflow ${overflow}px)`);
    const counts = await page.evaluate(() => ({
      pop: document.querySelectorAll('#pop-grid .card svg').length,
      roles: document.querySelectorAll('#roles .card svg').length,
      household: document.querySelectorAll('#household .card svg').length,
      scene: document.querySelectorAll('#scene svg svg').length,
    }));
    check(counts.pop === 12 && counts.roles === 30 && counts.household >= 3 && counts.scene === 11, `${tag}: portraits rendered ${JSON.stringify(counts)}`);
    const tones = await page.evaluate(() => [...document.querySelectorAll('#pop-grid .card')].length);
    check(tones === 12, `${tag}: preview cards present`);
    // Interact: pick a dossier subject and apply events.
    await page.locator('#pop-grid .card').nth(11).click();
    await page.getByRole('button', { name: 'Add scar' }).click();
    await page.getByRole('button', { name: '+10 years' }).click();
    const history = await page.locator('#dos-attrs').innerText();
    check(/scar at/.test(history), `${tag}: event recorded in dossier`);
    const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow2 <= 0, `${tag}: no horizontal scroll after interaction`);
    await page.screenshot({ path: join(outDir, `${vp.name}-${scheme}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
server.close();
console.log(failures ? `${failures} UI check(s) failed` : 'All UI checks passed', '— screenshots in', outDir);
process.exit(failures ? 1 : 0);
