// Cartes peintes (canvas). Browser-only rendering; the terrain model itself is
// pure and deterministic so the same seed always yields the same continent.

import { hashString, Rng } from '../appearance/rng.js';
import { CIVILIZATIONS, CIV_IDS } from '../world/civilizations.js';
import { hexToRgb } from '../appearance/traits.js';

// ---------------------------------------------------------------------------
// Noise

function makeNoise(seed) {
  const s = hashString(String(seed));
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, oct = 5) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += value(x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  };
}

// ---------------------------------------------------------------------------
// World model

export const WORLD_W = 800;
export const WORLD_H = 560;
const SEA_LEVEL = 0.2;

export function buildWorld(seed = 'iskar') {
  const W = WORLD_W, H = WORLD_H;
  const n1 = makeNoise(`${seed}:land`);
  const n2 = makeNoise(`${seed}:owner`);
  const n3 = makeNoise(`${seed}:relief`);
  const civs = CIV_IDS.map((id) => CIVILIZATIONS[id].map);
  const elev = new Float32Array(W * H);
  const owner = new Int8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      // Domain warp: organic coasts and borders.
      const wx = nx + (n2(nx * 2.6, ny * 2.6, 4) - 0.5) * 0.16;
      const wy = ny + (n2(nx * 2.6 + 9, ny * 2.6 + 4, 4) - 0.5) * 0.16;
      let base = 0, best = 0, bestD = Infinity;
      for (let i = 0; i < civs.length; i++) {
        const c = civs[i];
        const d = Math.hypot((wx - c.x) * 1.25, wy - c.y) / c.r;
        base += Math.exp(-d * d * 0.85);
        const db = Math.hypot((wx - c.x) * 1.25, wy - c.y) / c.r + (n2(nx * 9 + i, ny * 9, 3) - 0.5) * 0.18;
        if (db < bestD) { bestD = db; best = i; }
      }
      const edge = Math.min(nx, 1 - nx, ny, 1 - ny);
      let e = Math.min(1.15, base) * 0.62 - 0.1 + (n1(wx * 3.4, wy * 3.4) - 0.5) * 0.85 + (n1(nx * 12, ny * 12, 3) - 0.5) * 0.22;
      if (edge < 0.07) e -= (0.07 - edge) * 5;
      const ridge = 1 - Math.abs(n3(nx * 5, ny * 5, 4) * 2 - 1);
      const i = y * W + x;
      elev[i] = e > SEA_LEVEL ? e + ridge ** 3 * 0.35 : e;
      owner[i] = e > SEA_LEVEL ? best : -1;
    }
  }
  // Remove tiny islands far from any civ (keeps the coast readable).
  return { W, H, elev, owner, seed };
}

/** Pixel position of each civilization's capital (snapped onto its own land). */
export function capitals(data) {
  const out = {};
  CIV_IDS.forEach((id, idx) => {
    const m = CIVILIZATIONS[id].map;
    let best = null, bestD = Infinity;
    for (let y = 0; y < data.H; y += 4) for (let x = 0; x < data.W; x += 4) {
      if (data.owner[y * data.W + x] !== idx) continue;
      const d = Math.hypot(x - m.x * data.W, y - m.y * data.H);
      if (d < bestD) { bestD = d; best = [x, y]; }
    }
    out[id] = best ?? [m.x * data.W, m.y * data.H];
  });
  return out;
}

// ---------------------------------------------------------------------------
// Painting

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function heat(t) {
  // 0 red → 0.5 amber → 1 green
  return t < 0.5 ? mix([176, 62, 50], [214, 160, 64], t * 2) : mix([214, 160, 64], [86, 150, 92], (t - 0.5) * 2);
}

/**
 * Paint the world map. mode: 'carte' | 'ressources' | 'politiques' | 'relations'.
 * `values` supplies per-civ numbers for the data modes.
 */
export function paintWorld(canvas, data, { mode = 'carte', borders = true, values = {}, player = 'orane' } = {}) {
  const { W, H, elev, owner } = data;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const px = img.data;
  const tex = makeNoise(`${data.seed}:tex`);
  const civRgb = CIV_IDS.map((id) => hexToRgb(CIVILIZATIONS[id].color));
  const civTint = CIV_IDS.map((id, i) => {
    if (mode === 'politiques') return heat((values[id] ?? 50) / 100);
    if (mode === 'relations') return id === player ? [212, 168, 92] : heat(((values[id] ?? 0) + 100) / 200);
    return civRgb[i];
  });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const e = elev[i];
      const o = owner[i];
      const t = tex(x / 7, y / 7, 3) - 0.5;
      let c;
      if (o < 0) {
        const depth = Math.min(1, Math.max(0, (SEA_LEVEL - e) / 0.5));
        c = mix([52, 92, 108], [14, 30, 42], depth ** 0.7);
        if (SEA_LEVEL - e < 0.025) c = mix(c, [120, 150, 150], 0.35);
        c = c.map((v) => v + t * 10);
      } else {
        const xl = Math.max(0, x - 1), yu = Math.max(0, y - 1);
        const shade = Math.max(-1, Math.min(1, (elev[yu * W + xl] - e) * 30));
        let base;
        if (mode === 'ressources') base = mix([128, 140, 88], [150, 128, 96], Math.min(1, (e - SEA_LEVEL) * 1.5));
        else base = mix(civTint[o], [188, 170, 134], mode === 'carte' ? 0.36 : 0.12);
        c = base.map((v) => v * (1 + shade * 0.42 - Math.max(0, e - 0.75) * 0.25) + t * 26);
        if (e - SEA_LEVEL < 0.012) c = mix(c, [226, 210, 170], 0.5);
        if (borders) {
          const r = x + 1 < W ? owner[i + 1] : o;
          const d = y + 1 < H ? owner[i + W] : o;
          if ((r >= 0 && r !== o) || (d >= 0 && d !== o)) c = [58, 40, 26];
        }
      }
      px[i * 4] = c[0];
      px[i * 4 + 1] = c[1];
      px[i * 4 + 2] = c[2];
      px[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Coastline ink.
  ctx.globalCompositeOperation = 'multiply';
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  vg.addColorStop(0, 'rgba(255,255,255,0)');
  vg.addColorStop(1, 'rgba(40,30,20,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------------------
// Region (province) maps

export const REGION_W = 800;
export const REGION_H = 560;

/** Deterministic layout of a province: locality positions, river, roads. */
export function layoutRegion(civId, province) {
  const r = new Rng(`${civId}:${province.id}:layout`);
  const W = REGION_W, H = REGION_H;
  const river = [];
  let x = W * r.range(0.35, 0.6);
  for (let y = -20; y <= H + 20; y += 20) {
    river.push([x, y]);
    x += r.normal(0, 14) + Math.sin(y / 70) * 10;
    x = Math.max(W * 0.2, Math.min(W * 0.8, x));
  }
  const riverX = (y) => {
    const k = Math.max(0, Math.min(river.length - 2, Math.floor((y + 20) / 20)));
    const t = (y + 20 - k * 20) / 20;
    return river[k][0] + (river[k + 1][0] - river[k][0]) * t;
  };
  const places = province.localities.map(([name, pop, kind], i) => {
    let px, py;
    if (i === 0) { py = H * r.range(0.32, 0.48); px = riverX(py) + r.range(-30, 30); }
    else {
      const ang = r.range(0, Math.PI * 2);
      const dist = r.range(150, 240);
      px = Math.max(70, Math.min(W - 90, W * 0.5 + Math.cos(ang) * dist * 1.3));
      py = Math.max(70, Math.min(H - 60, H * 0.48 + Math.sin(ang) * dist * 0.9));
    }
    return { name, pop, kind, x: px, y: py, size: Math.max(3, Math.log10(pop) * 3.4 - 6) };
  });
  const roads = places.slice(1).map((p) => [places[0], p]);
  return { W, H, river, places, roads, coast: province.localities.some((l) => l[2] === 'port') };
}

export function paintRegion(canvas, civId, province, layout, layers = {}) {
  const { W, H } = layout;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const n = makeNoise(`${civId}:${province.id}:terrain`);
  const img = ctx.createImageData(W, H);
  const px = img.data;
  const climate = { sahel: [[176, 150, 98], [150, 120, 76]], kaelen: [[64, 92, 52], [44, 70, 40]], veyra: [[104, 112, 80], [88, 88, 70]] }[civId] ?? [[112, 128, 72], [84, 104, 58]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const e = n(x / 160, y / 160, 5);
    const f = n(x / 40 + 100, y / 40, 3);
    let c = mix(climate[0], climate[1], Math.min(1, e * 1.4));
    c = c.map((v) => v * (0.88 + f * 0.25));
    if (layout.coast && x < 90 + n(0, y / 60) * 60) c = mix([30, 64, 80], [52, 92, 104], n(x / 30, y / 30, 2));
    px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const r = new Rng(`${civId}:${province.id}:paint`);
  // Fields: patchwork around settlements.
  for (const p of layout.places) {
    const count = 14 + Math.round(p.size * 4);
    for (let k = 0; k < count; k++) {
      const a = r.range(0, Math.PI * 2), d = r.range(p.size * 6, p.size * 6 + 90);
      const fx = p.x + Math.cos(a) * d, fy = p.y + Math.sin(a) * d * 0.8;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(r.range(-0.6, 0.6));
      ctx.fillStyle = r.pick(['rgba(196,176,96,0.55)', 'rgba(150,160,78,0.5)', 'rgba(172,140,84,0.45)', 'rgba(120,150,70,0.45)']);
      ctx.fillRect(-r.range(10, 22), -r.range(7, 14), r.range(20, 44), r.range(14, 28));
      ctx.restore();
    }
  }
  // Forests.
  for (let k = 0; k < 2400; k++) {
    const fx = r.range(0, W), fy = r.range(0, H);
    if (n(fx / 90 + 50, fy / 90, 3) < 0.55) continue;
    if (layout.places.some((p) => Math.hypot(p.x - fx, p.y - fy) < 50 + p.size * 6)) continue;
    ctx.fillStyle = `rgba(${28 + r.int(0, 20)},${54 + r.int(0, 24)},${30 + r.int(0, 14)},0.85)`;
    ctx.beginPath();
    ctx.arc(fx, fy, r.range(2.5, 5), 0, Math.PI * 2);
    ctx.fill();
  }
  // River.
  if (layers.rivieres !== false) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, col] of [[14, 'rgba(40,70,80,0.5)'], [9, '#4f8796'], [3, 'rgba(170,210,215,0.6)']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      layout.river.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  }
  // Roads.
  if (layers.routes !== false) {
    ctx.strokeStyle = 'rgba(214,190,140,0.9)';
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    for (const [a, b] of layout.roads) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2 + 30, (a.y + b.y) / 2 - 20, b.x, b.y);
      ctx.stroke();
    }
  }
  // Settlements: clusters of roofs.
  for (const p of layout.places) {
    const isVillage = p.pop < 20000;
    if (isVillage && layers.villages === false) continue;
    if (!isVillage && layers.villes === false) continue;
    const houses = Math.round(8 + p.size * 9);
    for (let k = 0; k < houses; k++) {
      const a = r.range(0, Math.PI * 2), d = Math.sqrt(r.next()) * p.size * 6;
      const hx = p.x + Math.cos(a) * d, hy = p.y + Math.sin(a) * d * 0.8;
      ctx.fillStyle = r.pick(['#9c4a32', '#b0573a', '#8a3f2c', '#c06a45']);
      ctx.fillRect(hx - 3, hy - 2.5, 6, 5);
      ctx.fillStyle = 'rgba(240,226,200,0.85)';
      ctx.fillRect(hx - 3, hy + 2.5, 6, 2);
    }
    if (!isVillage) {
      ctx.fillStyle = '#d8c7a4';
      ctx.fillRect(p.x - 4, p.y - 14, 8, 14);
      ctx.fillStyle = '#7d4a32';
      ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - 14); ctx.lineTo(p.x, p.y - 24); ctx.lineTo(p.x + 6, p.y - 14); ctx.fill();
    }
  }
  // Border of the province.
  if (layers.frontieres !== false) {
    ctx.strokeStyle = 'rgba(232,196,120,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.setLineDash([]);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,8,4,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------
// Title-screen landscape

export function paintLandscape(canvas, seed = 'iskar') {
  const W = 1280, H = 720;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const n = makeNoise(`${seed}:landscape`);
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, '#2c3346');
  sky.addColorStop(0.45, '#8a6a5c');
  sky.addColorStop(0.75, '#e0a66a');
  sky.addColorStop(1, '#f3cf8c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * 0.62, H * 0.5, 10, W * 0.62, H * 0.5, 380);
  sun.addColorStop(0, 'rgba(255,236,190,0.95)');
  sun.addColorStop(0.2, 'rgba(255,214,150,0.5)');
  sun.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  // Clouds.
  for (let k = 0; k < 5; k++) {
    const y = 80 + k * 38;
    ctx.fillStyle = `rgba(${210 + k * 4},${160 + k * 6},${140 + k * 4},${0.05 + k * 0.01})`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y + (n(x / 220, k) - 0.5) * 40);
    ctx.lineTo(W, y + 18); ctx.lineTo(0, y + 18); ctx.fill();
  }
  // Mountain ranges, far to near, with aerial perspective.
  const ranges = [
    { base: 0.5, amp: 0.3, col: [130, 108, 120], f: 260 },
    { base: 0.56, amp: 0.26, col: [92, 78, 92], f: 200 },
    { base: 0.62, amp: 0.2, col: [58, 52, 62], f: 150 },
  ];
  ranges.forEach((rg, k) => {
    ctx.fillStyle = `rgb(${rg.col.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) {
      const ridge = 1 - Math.abs(n(x / rg.f + k * 10, k * 3.1, 5) * 2 - 1);
      const left = 1.25 - 0.5 / (1 + Math.exp(-(x / W - 0.4) * 12));
      ctx.lineTo(x, H * (rg.base - ridge * rg.amp * left));
    }
    ctx.lineTo(W, H);
    ctx.fill();
    const haze = ctx.createLinearGradient(0, H * 0.25, 0, H * 0.7);
    haze.addColorStop(0, 'rgba(240,190,140,0)');
    haze.addColorStop(1, `rgba(240,180,130,${0.22 - k * 0.06})`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);
  });
  // Lake with reflections.
  const lakeTop = H * 0.68;
  const lake = ctx.createLinearGradient(0, lakeTop, 0, H);
  lake.addColorStop(0, '#d79a62');
  lake.addColorStop(0.3, '#6c5a5c');
  lake.addColorStop(1, '#1d2230');
  ctx.fillStyle = lake;
  ctx.fillRect(0, lakeTop, W, H - lakeTop);
  for (let k = 0; k < 140; k++) {
    const y = lakeTop + Math.pow(k / 140, 1.6) * (H - lakeTop);
    ctx.fillStyle = `rgba(255,220,170,${0.25 * (1 - k / 140)})`;
    const cx = W * 0.62 + (n(k, 3) - 0.5) * 120;
    ctx.fillRect(cx - 120 * (1 - k / 160), y, 240 * (1 - k / 160) * n(k, 7), 1.4);
  }
  // Hill with a walled city and castle (right).
  ctx.fillStyle = '#2a2428';
  ctx.beginPath();
  ctx.moveTo(W * 0.55, lakeTop + 4);
  ctx.quadraticCurveTo(W * 0.7, H * 0.5, W * 0.95, H * 0.55);
  ctx.lineTo(W, H * 0.56); ctx.lineTo(W, lakeTop + 4); ctx.fill();
  const towers = [[0.7, 0.44, 22, 70], [0.735, 0.37, 26, 110], [0.775, 0.45, 20, 60], [0.81, 0.47, 44, 46], [0.66, 0.5, 60, 30], [0.86, 0.5, 70, 28], [0.75, 0.5, 90, 22]];
  for (const [tx, ty, tw, th] of towers) {
    ctx.fillStyle = '#231e22';
    ctx.fillRect(W * tx, H * ty, tw, th + 120);
    ctx.beginPath(); ctx.moveTo(W * tx - 4, H * ty); ctx.lineTo(W * tx + tw / 2, H * ty - tw * 1.3); ctx.lineTo(W * tx + tw + 4, H * ty); ctx.fill();
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = `rgba(255,190,110,${0.5 + k * 0.1})`;
      ctx.fillRect(W * tx + tw / 2 - 1.5, H * ty + 14 + k * 18, 3, 6);
    }
  }
  // Foreground framing (left cliffs, darker).
  ctx.fillStyle = '#16141a';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let y = H; y >= H * 0.12; y -= 8) ctx.lineTo(80 + (n(y / 90, 9) - 0.5) * 140 + (H - y) * 0.06, y);
  ctx.lineTo(0, H * 0.12);
  ctx.fill();
  const vg = ctx.createRadialGradient(W * 0.6, H * 0.5, H * 0.2, W * 0.5, H * 0.5, W * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(8,8,12,0.75)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

/** A few secondary city positions inside each civilization's territory. */
export function cityPositions(data) {
  const caps = capitals(data);
  const out = {};
  CIV_IDS.forEach((id, idx) => {
    const [cx, cy] = caps[id];
    const found = [];
    for (const ang of [0.6, 2.4, 4.2, 5.4, 1.5, 3.3]) {
      for (const dist of [70, 90, 55, 110]) {
        const x = Math.round(cx + Math.cos(ang) * dist), y = Math.round(cy + Math.sin(ang) * dist * 0.8);
        if (x < 10 || y < 10 || x >= data.W - 10 || y >= data.H - 10) continue;
        if (data.owner[y * data.W + x] === idx && found.every(([fx, fy]) => Math.hypot(fx - x, fy - y) > 50)) { found.push([x, y]); break; }
      }
      if (found.length >= 3) break;
    }
    out[id] = found;
  });
  return out;
}

/** A point on the shared border of two civilizations, nearest the midpoint between their capitals. */
export function borderPoint(data, a, b, caps = capitals(data)) {
  const ia = CIV_IDS.indexOf(a), ib = CIV_IDS.indexOf(b);
  const mx = (caps[a][0] + caps[b][0]) / 2, my = (caps[a][1] + caps[b][1]) / 2;
  let best = [mx, my], bestD = Infinity;
  for (let y = 1; y < data.H - 1; y += 2) for (let x = 1; x < data.W - 1; x += 2) {
    const o = data.owner[y * data.W + x];
    if (o !== ia) continue;
    const r = data.owner[y * data.W + x + 2], d = data.owner[(y + 2) * data.W + x];
    if (r !== ib && d !== ib) continue;
    const dist = Math.hypot(x - mx, y - my);
    if (dist < bestD) { bestD = dist; best = [x, y]; }
  }
  return best;
}
