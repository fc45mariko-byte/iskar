// Génération d'images par modèle (optionnelle).
//
// When enabled, portraits and event illustrations are requested from an
// image-generation endpoint using each character's persistent identity
// descriptor; the first portrait generated for a character becomes its
// reference image for every later request. Without configuration (or if a
// request fails) the procedural SVG is kept. Browser-only.

import { identityRecord, portraitRequest } from '../appearance/identity.js';
import { hashString } from '../appearance/rng.js';

const CONFIG_KEY = 'iskar.imagegen.v1';
const DEFAULTS = {
  enabled: false,
  endpoint: 'https://api.openai.com/v1/images/generations',
  apiKey: '',
  model: 'gpt-image-1',
  size: '1024x1024',
  style: 'Oil painting in a realistic 1920s illustrative style, warm natural light, muted palette',
};

export function loadConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function saveConfig(cfg) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch { /* storage unavailable */ }
}

// --- Cache (IndexedDB, falling back to memory) ------------------------------
const memory = new Map();
let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open('iskar-images', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('images');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  return dbPromise;
}
async function cacheGet(key) {
  if (memory.has(key)) return memory.get(key);
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const r = d.transaction('images').objectStore('images').get(key);
      r.onsuccess = () => { if (r.result) memory.set(key, r.result); resolve(r.result ?? null); };
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function cachePut(key, value) {
  memory.set(key, value);
  const d = await db();
  if (!d) return;
  try { d.transaction('images', 'readwrite').objectStore('images').put(value, key); } catch { /* ignore */ }
}

// --- Requests ------------------------------------------------------------------
let active = 0;
const queue = [];
function limited(fn) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      active++;
      try { resolve(await fn()); } catch (e) { reject(e); } finally { active--; queue.shift()?.(); }
    };
    if (active < 2) run(); else queue.push(run);
  });
}

export async function requestImage(cfg, { prompt, negativePrompt, referenceImage, seed }) {
  const body = { model: cfg.model, prompt: `${cfg.style}. ${prompt}${negativePrompt ? ` Avoid: ${negativePrompt}.` : ''}`, size: cfg.size, n: 1 };
  if (referenceImage) body.reference_image = referenceImage;
  if (seed) body.seed = hashString(String(seed)) % 2147483647;
  const res = await limited(() => fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify(body),
  }));
  if (!res.ok) throw new Error(`Le service d’images a répondu ${res.status}`);
  const json = await res.json();
  const item = json.data?.[0] ?? json;
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item.url) return item.url;
  throw new Error('Réponse du service d’images sans image');
}

export function portraitKey(a) {
  return `portrait:${a.id}:${Math.floor(a.age / 5)}:${hashString(JSON.stringify(a.events))}`;
}

/** Image for a character portrait, or null (callers keep the SVG). */
export async function portraitImage(a) {
  const cfg = loadConfig();
  if (!cfg.enabled) return null;
  const key = portraitKey(a);
  const cached = await cacheGet(key);
  if (cached) return cached;
  const reference = await cacheGet(`reference:${a.id}`);
  const req = portraitRequest(identityRecord(a, reference), 'head-and-shoulders portrait, neutral dark background, period clothing');
  const img = await requestImage(cfg, req);
  await cachePut(key, img);
  if (!reference) await cachePut(`reference:${a.id}`, img);
  return img;
}

/** Image for an event scene featuring known people, or null. */
export async function sceneImage(sceneKey, description, people) {
  const cfg = loadConfig();
  if (!cfg.enabled) return null;
  const key = `scene:${sceneKey}`;
  const cached = await cacheGet(key);
  if (cached) return cached;
  const cast = people.slice(0, 5).map((p, i) => `Person ${i + 1}: ${identityRecord(p).descriptor}`).join(' ');
  const img = await requestImage(cfg, { prompt: `${description}. Wide scene, 1920s. ${cast}`, seed: sceneKey });
  await cachePut(key, img);
  return img;
}

export async function testConnection(cfg) {
  await requestImage(cfg, { prompt: 'A small test image of a wheat field at dusk' });
  return true;
}
