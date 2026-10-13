// Bundles app/ into a single self-contained HTML file (no build dependencies).
//   node scripts/build.mjs
// Output: dist/index.html (full document) and dist/iskar-registry.html
// (body-level markup for hosts that supply their own document skeleton).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const entry = resolve(root, 'app/main.js');
const modules = new Map(); // abs path -> { code, deps }
const order = [];

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*'([^']+)';/g;

async function load(file) {
  if (modules.has(file)) return;
  modules.set(file, null);
  const src = await readFile(file, 'utf8');
  const deps = [];
  let code = src.replace(IMPORT_RE, (_, names, spec) => {
    const dep = resolve(dirname(file), spec);
    deps.push(dep);
    const binds = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': ')).join(', ');
    return `const { ${binds} } = __m[${JSON.stringify(relative(root, dep))}];`;
  });
  const exported = [];
  code = code.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  code = code.replace(/^export\s*\{([^}]*)\};?/gm, (_, names) => {
    for (const n of names.split(',').map((x) => x.trim()).filter(Boolean)) exported.push(n);
    return '';
  });
  code = code.replace(/^import\s*\*\s*as\s+(\w+)\s+from\s*'([^']+)';/gm, (_, ns, spec) => {
    const dep = resolve(dirname(file), spec);
    deps.push(dep);
    return `const ${ns} = __m[${JSON.stringify(relative(root, dep))}];`;
  });
  if (/^export\s/m.test(code)) throw new Error(`Unsupported export form in ${file}`);
  for (const d of deps) await load(d);
  modules.set(file, { code, exported });
  order.push(file);
}

await load(entry);
const bundle = order.map((file) => {
  const { code, exported } = modules.get(file);
  return `__m[${JSON.stringify(relative(root, file))}] = (() => {\n${code}\nreturn { ${exported.join(', ')} };\n})();`;
}).join('\n');
const script = `<script>\n(() => {\n'use strict';\nconst __m = {};\n${bundle}\n})();\n</script>`;

const html = await readFile(resolve(root, 'app/index.html'), 'utf8');
const full = html.replace(/<script type="module" src="\.\/main\.js"><\/script>/, () => script);
if (full === html) throw new Error('entry script tag not found');
await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(resolve(root, 'dist/index.html'), full);

// Body-level variant: title, font links and styles from <head>, then <body> contents.
const head = full.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>\s*/g, '');
const body = full.match(/<body>([\s\S]*)<\/body>/)[1];
await writeFile(resolve(root, 'dist/iskar-registry.html'), `${head.trim()}\n${body.trim()}\n`);
console.log(`Built ${order.length} modules → dist/index.html (${(full.length / 1024).toFixed(0)} KB)`);
