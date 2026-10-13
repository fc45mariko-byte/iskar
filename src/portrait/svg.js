// Procedural SVG portraits rendered from the structured appearance record.
//
// Deterministic: the same record (same age, same events) always produces the
// same picture, so a character stays recognisable across screens and scenes.
// Lighting comes from the upper left. Every shadow, highlight, lip and line
// colour is derived from the person's own skin colour, so form and features
// read clearly across the whole light-to-dark range.

import { Rng, clamp, hashString } from '../appearance/rng.js';
import { EYE_COLORS, HAIR_COLORS, mixHex, shadeHex, relativeLuminance } from '../appearance/traits.js';
import { visibleAppearance } from '../appearance/lifecycle.js';

const f = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Geometry helpers

function smoothClosed(pts, tension = 1) {
  const n = pts.length;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

function resample(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const k = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let j = 0; j < k; j++) out.push([x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k]);
  }
  return out;
}

function arc(cx, cy, rx, ry, a0, a1, n = 14) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

function pointInPoly([x, y], pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bounds(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

// ---------------------------------------------------------------------------
// Colour

/** Feature colours derived from the individual's own skin colour. */
export function featurePalette(skin) {
  const lum = relativeLuminance(skin);
  // Lips shift continuously from rose-brown on lighter skin to mauve-brown on
  // deeper skin, so they stay distinct at every tone.
  const k = clamp((lum - 0.03) / 0.5);
  const lip = mixHex(shadeHex(skin, 0.7 + 0.3 * k), mixHex('#8e4f5c', '#b25a55', k), 0.55);
  return {
    shadow: shadeHex(skin, 0.62),
    deep: shadeHex(skin, 0.42),
    line: mixHex(shadeHex(skin, 0.3), '#0d0907', 0.6),
    lip,
    lipUpper: shadeHex(lip, 0.82),
    // Deeper skin gets a stronger, cooler sheen, as it does under real light.
    highlight: lum < 0.08 ? mixHex(shadeHex(skin, 1.7), '#c9b3a8', 0.25) : shadeHex(skin, 1.22),
    lit: shadeHex(skin, lum < 0.08 ? 1.3 : 1.1),
    shade: shadeHex(skin, 0.74),
    blush: mixHex(skin, lum > 0.3 ? '#d4625c' : '#9c3c3c', 0.5),
    blushOpacity: lum > 0.3 ? 0.2 : 0.14,
  };
}

// ---------------------------------------------------------------------------
// Face geometry

function geometry(a, v) {
  const child = a.age < 14;
  const cx = 100;
  const cy = 112;
  const shapeMods = {
    oval: [0, 0.9, 0.74, 0],
    round: [2, 1, 0.88, -4],
    square: [1, 0.95, 0.95, -1],
    heart: [1, 1, 0.64, 0],
    long: [-3, 0.9, 0.78, 6],
    diamond: [-1, 0.86, 0.68, 2],
  }[a.face.shape];
  const W = 33 + a.face.cheekbones * 4 + a.face.width * 7 + shapeMods[0] + (child ? 2 : 0);
  const H = 46 + a.face.length * 8 + shapeMods[3] - (child ? 4 : 0);
  const temple = W * shapeMods[1];
  const jawW = W * (shapeMods[2] + (a.face.jaw - 0.5) * 0.25);
  const outline = [
    [cx, cy - H],
    [cx + temple * 0.75, cy - H * 0.82],
    [cx + temple, cy - H * 0.4],
    [cx + W, cy + 2],
    [cx + jawW, cy + H * 0.62],
    [cx + jawW * 0.55, cy + H * 0.9],
    [cx + jawW * 0.22, cy + H * 0.995],
    [cx - jawW * 0.22, cy + H * 0.995],
    [cx - jawW * 0.55, cy + H * 0.9],
    [cx - jawW, cy + H * 0.62],
    [cx - W, cy + 2],
    [cx - temple, cy - H * 0.4],
    [cx - temple * 0.75, cy - H * 0.82],
  ];
  const hairlineY = cy - H * 0.58 + v.recession * 16;
  const ey = cy - 7 + a.face.featureHeight * 5;
  const ny = cy + 13 + a.face.noseLength * 8;
  const my = Math.min(ny + 11 + a.face.length * 3, cy + H * 0.72);
  return { cx, cy, W, H, outline, hairlineY, child, ey, ny, my, jawW };
}

// ---------------------------------------------------------------------------
// Rendering context: unique ids + shared defs per portrait

class Ctx {
  constructor(uid) {
    this.uid = uid;
    this.n = 0;
    this.defs = [];
    this.blurs = {};
  }
  id(prefix = 'i') {
    return `${this.uid}${prefix}${(this.n++).toString(36)}`;
  }
  linear(stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) {
    const id = this.id('g');
    this.defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsSvg(stops)}</linearGradient>`);
    return `url(#${id})`;
  }
  radial(stops, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) {
    const id = this.id('r');
    this.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stopsSvg(stops)}</radialGradient>`);
    return `url(#${id})`;
  }
  clip(d) {
    const id = this.id('c');
    this.defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
    return `url(#${id})`;
  }
  blur(sd) {
    if (!this.blurs[sd]) {
      const id = this.id('b');
      this.defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`);
      this.blurs[sd] = `url(#${id})`;
    }
    return this.blurs[sd];
  }
}

function stopsSvg(stops) {
  return stops.map(([o, c, op = 1]) => `<stop offset="${o}" stop-color="${c}"${op < 1 ? ` stop-opacity="${op}"` : ''}/>`).join('');
}

// ---------------------------------------------------------------------------
// Hair

const CURL = { straight: 0, wavy: 0, curly: 5.2, coily: 3.4, 'tightly-coiled': 2.4 };

function hairPalette(color) {
  const lum = relativeLuminance(color);
  return {
    base: color,
    dark: shadeHex(color, 0.55),
    deep: shadeHex(color, 0.35),
    // Very dark hair gets a cool sheen; lighter hair a warm one.
    sheen: lum < 0.02 ? mixHex(shadeHex(color, 3.2), '#8c8a96', 0.35) : shadeHex(color, 1.75),
    light: shadeHex(color, lum < 0.02 ? 2.2 : 1.35),
  };
}

/** A mass of hair filling an outline, rendered by texture. */
function hairMass(ctx, pts, texture, color, rng, { opacity = 1, detail = 1 } = {}) {
  const pal = hairPalette(color);
  const d = smoothClosed(pts);
  const b = bounds(pts);
  const fill = ctx.linear([[0, pal.light], [0.45, pal.base], [1, pal.dark]], { x1: 0, y1: 0, x2: 0.35, y2: 1 });
  if (opacity < 1) return `<path d="${d}" fill="${fill}" opacity="${opacity}"/>`;
  const clip = ctx.clip(d);
  const r = CURL[texture];
  let s = '';

  if (r) {
    // Soft, irregular silhouette: curls and coils break the outline.
    const edge = resample(pts, r * (texture === 'tightly-coiled' ? 0.9 : 1.15));
    s += '<g>';
    for (const [x, y] of edge) {
      const rr = r * rng.range(0.8, 1.2);
      s += `<circle cx="${f(x + rng.range(-1.2, 1.2))}" cy="${f(y + rng.range(-1.2, 1.2))}" r="${f(rr)}" fill="${y < (b.y0 + b.y1) / 2 ? pal.base : pal.dark}"/>`;
    }
    if (texture !== 'curly') {
      for (const [x, y] of resample(pts, r * 1.6)) s += `<circle cx="${f(x + rng.range(-2, 2))}" cy="${f(y + rng.range(-2, 2))}" r="${f(r * 0.9)}" fill="${pal.base}" opacity="0.45"/>`;
    }
    s += `</g><path d="${d}" fill="${fill}"/>`;
    // Interior texture: open spirals, lit on the upper-left.
    const area = (b.x1 - b.x0) * (b.y1 - b.y0);
    const count = Math.round((area / (r * r * 3.2)) * detail);
    s += `<g clip-path="${clip}" fill="none" stroke-linecap="round">`;
    for (let i = 0; i < count; i++) {
      const x = rng.range(b.x0, b.x1), y = rng.range(b.y0, b.y1);
      if (!pointInPoly([x, y], pts)) continue;
      const rr = r * rng.range(0.55, 0.95);
      const lit = (y - b.y0) / (b.y1 - b.y0) < 0.45 && x < (b.x0 + b.x1) / 2 + 10;
      const a0 = rng.range(0, Math.PI * 2);
      const p0 = [x + rr * Math.cos(a0), y + rr * Math.sin(a0)];
      const sweep = rng.range(1.4, 2.8);
      const p1 = [x + rr * Math.cos(a0 + sweep), y + rr * Math.sin(a0 + sweep)];
      s += `<path d="M${f(p0[0])},${f(p0[1])} A${f(rr)},${f(rr)} 0 0 1 ${f(p1[0])},${f(p1[1])}" stroke="${lit && rng.chance(0.55) ? pal.sheen : pal.deep}" stroke-width="${texture === 'curly' ? 0.9 : 0.65}" opacity="${lit ? 0.7 : 0.55}"/>`;
    }
    s += '</g>';
  } else {
    s += `<path d="${d}" fill="${fill}"/>`;
    // Strands flow from the crown out to the edge of the mass.
    const crown = [b.x0 + (b.x1 - b.x0) * 0.45, b.y0 + 2];
    const amp = texture === 'wavy' ? 3.2 : 0.6;
    s += `<g clip-path="${clip}" fill="none" stroke-linecap="round">`;
    const ends = resample(pts, Math.max(2.2, 3.4 / detail));
    ends.forEach(([ex, ey], i) => {
      if (ey < crown[1] + 4) return;
      const mx = (crown[0] + ex) / 2, my = (crown[1] + ey) / 2;
      const nx = -(ey - crown[1]), ny = ex - crown[0];
      const len = Math.hypot(nx, ny) || 1;
      const bend = (texture === 'wavy' ? Math.sin(i * 1.7) * amp : amp) * 2;
      const c1 = [mx + (nx / len) * bend, my + (ny / len) * bend - 6];
      const dark = i % 3 !== 0;
      s += `<path d="M${f(crown[0] + rng.range(-3, 3))},${f(crown[1])} Q${f(c1[0])},${f(c1[1])} ${f(ex)},${f(ey + 2)}" stroke="${dark ? pal.dark : pal.light}" stroke-width="${f(rng.range(0.5, 1.2))}" opacity="${dark ? 0.5 : 0.4}"/>`;
    });
    s += '</g>';
  }
  // Sheen: a soft band of reflected light across the crown.
  const sx = b.x0 + (b.x1 - b.x0) * 0.38, sy = b.y0 + Math.min(18, (b.y1 - b.y0) * 0.22);
  s += `<g clip-path="${clip}"><ellipse cx="${f(sx)}" cy="${f(sy)}" rx="${f((b.x1 - b.x0) * 0.32)}" ry="${r ? 7 : 5}" fill="${pal.sheen}" opacity="${r ? 0.22 : 0.32}" filter="${ctx.blur(3)}" transform="rotate(-12 ${f(sx)} ${f(sy)})"/></g>`;
  return s;
}

function hairSvg(ctx, a, v, g, color, rng, detail) {
  const { cx, cy, W, H, hairlineY } = g;
  const tex = a.hair.texture;
  const style = v.hairStyle;
  const curl = CURL[tex];
  const vol = { straight: 4, wavy: 6, curly: 9, coily: 11, 'tightly-coiled': 12 }[tex];
  const back = [];
  const front = [];
  const pal = hairPalette(color);

  const cap = (extra, sideDrop = 8) => {
    const outer = arc(cx, cy - 6, W + extra, H + extra - 2, Math.PI * 1.04, Math.PI * 1.96, 16);
    const hairline = [
      [cx + W - 2, cy - 6],
      [cx + W * 0.72, hairlineY + 7],
      [cx + W * 0.3, hairlineY + 1],
      [cx, hairlineY - 1],
      [cx - W * 0.3, hairlineY + 1],
      [cx - W * 0.72, hairlineY + 7],
      [cx - W + 2, cy - 6],
    ];
    return [[cx - W - extra * 0.5, cy + sideDrop], ...outer, [cx + W + extra * 0.5, cy + sideDrop], ...hairline];
  };
  const mass = (pts, opts) => hairMass(ctx, pts, tex, color, rng, { detail, ...opts });

  if (style === 'headwrap') {
    const hue = (a.clothingHue + 140) % 360;
    const c1 = `hsl(${hue} 48% 44%)`, c2 = `hsl(${hue} 50% 30%)`, c3 = `hsl(${hue} 45% 58%)`;
    const fill = ctx.linear([[0, c3], [0.5, c1], [1, c2]], { x1: 0, y1: 0, x2: 1, y2: 1 });
    const pts = [[cx - W - 5, cy - 8], ...arc(cx, cy - 18, W + 11, H + 6, Math.PI * 1.05, Math.PI * 1.95, 14), [cx + W + 5, cy - 8], [cx + W * 0.45, cy - H * 0.52], [cx, cy - H * 0.6], [cx - W * 0.45, cy - H * 0.52]];
    const top = arc(cx + 6, cy - H - 9, 28, 17, Math.PI, Math.PI * 2, 12);
    front.push(`<path d="${smoothClosed([...top, [cx + 28, cy - H + 6], [cx - 18, cy - H + 4]])}" fill="${fill}"/>`);
    front.push(`<path d="${smoothClosed(pts)}" fill="${fill}"/>`);
    front.push(`<g stroke="${c2}" stroke-width="1.3" fill="none" opacity="0.7" stroke-linecap="round"><path d="M${f(cx - W)},${f(cy - 28)} Q${cx},${f(cy - H - 12)} ${f(cx + W + 2)},${f(cy - 46)}"/><path d="M${f(cx - W + 6)},${f(cy - 16)} Q${cx - 4},${f(cy - H)} ${f(cx + W - 2)},${f(cy - 30)}"/><path d="M${cx - 12},${f(cy - H - 18)} q14,8 30,4"/></g>`);
    front.push(`<g stroke="${c3}" stroke-width="1" fill="none" opacity="0.6"><path d="M${f(cx - W + 2)},${f(cy - 34)} Q${cx - 6},${f(cy - H - 6)} ${f(cx + W - 8)},${f(cy - 50)}"/></g>`);
    return { back: '', front: front.join(''), shadowLine: cy - H * 0.55 };
  }
  if (style === 'shaved') {
    front.push(mass(cap(1, -4), { opacity: 0.32 }));
    return { back: '', front: front.join(''), shadowLine: null };
  }
  if (style === 'afro') {
    const r = W + 18 + vol;
    back.push(mass(arc(cx, cy - 20, r, r * 0.92, Math.PI * 0.84, Math.PI * 2.16, 28)));
    front.push(mass(cap(3, 4)));
    return { back: back.join(''), front: front.join(''), shadowLine: hairlineY };
  }
  const longLen = { shoulder: cy + 46, long: 224, braids: 214, locs: 210, twists: cy + 40 }[style];
  if (style === 'shoulder' || style === 'long') {
    const pts = [...arc(cx, cy - 8, W + vol + 4, H + vol, Math.PI, Math.PI * 2, 16), [cx + W + vol + 9, longLen - 10], [cx + W * 0.7, longLen], [cx - W * 0.7, longLen], [cx - W - vol - 9, longLen - 10]];
    back.push(mass(pts));
    back.push(`<ellipse cx="${cx}" cy="${cy + 20}" rx="${f(W * 0.95)}" ry="${f(H * 0.9)}" fill="${pal.deep}" opacity="0.55" filter="${ctx.blur(4)}"/>`);
  }
  if (style === 'braids' || style === 'locs' || style === 'twists') {
    const strands = style === 'braids' ? 8 : style === 'locs' ? 11 : 13;
    const sw = style === 'braids' ? 6.2 : style === 'locs' ? 5.6 : 4.6;
    let g2 = '<g stroke-linecap="round" fill="none">';
    const draw = (dd, w) => {
      g2 += `<path d="${dd}" stroke="${pal.dark}" stroke-width="${f(w + 1)}"/>`;
      g2 += `<path d="${dd}" stroke="${pal.base}" stroke-width="${f(w)}"/>`;
      if (style === 'locs') g2 += `<path d="${dd}" stroke="${pal.light}" stroke-width="${f(w * 0.25)}" opacity="0.5" transform="translate(-1 0)"/>`;
      else g2 += `<path d="${dd}" stroke="${pal.deep}" stroke-width="${f(w * 0.8)}" stroke-dasharray="1.6 2.6" opacity="0.8"/><path d="${dd}" stroke="${pal.sheen}" stroke-width="${f(w * 0.35)}" stroke-dasharray="1 3.2" opacity="0.55" transform="translate(-0.8 -0.6)"/>`;
    };
    for (let i = 0; i < 5; i++) {
      const x0 = cx - W * 0.5 + i * W * 0.25;
      draw(`M${f(x0)},${f(cy - 30)} Q${f(x0 + rng.range(-6, 6))},${f(cy + 30)} ${f(x0 + rng.range(-4, 4))},${f(longLen - 6)}`, sw);
    }
    for (let i = 0; i < strands; i++) {
      const t = i / (strands - 1);
      const x0 = cx - W - 4 + t * (2 * W + 8);
      const side = x0 < cx ? -1 : 1;
      if (Math.abs(x0 - cx) < W * 0.55) continue;
      const xEnd = x0 + side * rng.range(4, 12);
      const yEnd = longLen - rng.range(0, 14);
      draw(`M${f(x0)},${f(cy - 20)} Q${f(x0 + side * 8)},${f((cy + yEnd) / 2)} ${f(xEnd)},${f(yEnd)}`, sw);
    }
    back.push(g2 + '</g>');
    front.push(mass(cap(style === 'locs' ? 6 : 3, 2)));
    if (style === 'braids') {
      let rows = '<g fill="none" stroke-linecap="round">';
      for (let i = -3; i <= 3; i++) {
        const dd = `M${f(cx + i * 6)},${f(hairlineY + 1)} Q${f(cx + i * 9)},${f(cy - H - 4)} ${f(cx + i * 12)},${f(cy - H - 2)}`;
        rows += `<path d="${dd}" stroke="${pal.deep}" stroke-width="1.1" opacity="0.85"/><path d="${dd}" stroke="${pal.sheen}" stroke-width="0.5" opacity="0.5" transform="translate(2.4 0)"/>`;
      }
      front.push(rows + '</g>');
    }
    return { back: back.join(''), front: front.join(''), shadowLine: hairlineY };
  }
  const capExtra = { 'close-crop': 2 + curl * 0.3, short: vol, shoulder: vol, long: vol, bun: Math.min(vol, 6), topknot: Math.min(vol, 5) }[style] ?? vol;
  if (style === 'bun') back.push(mass(arc(cx, cy - H - 10, 18, 15, 0, Math.PI * 2, 16).slice(0, -1)));
  front.push(mass(cap(capExtra, style === 'close-crop' ? -2 : 8)));
  if (style === 'shoulder' || style === 'long') {
    for (const side of [-1, 1]) {
      const pts = [[cx + side * (W - 6), cy - 18], [cx + side * (W + vol + 6), cy - 14], [cx + side * (W + vol + 4), longLen - 14], [cx + side * (W - 2), longLen - 20], [cx + side * (W + 1), cy + 10]];
      front.push(mass(pts));
    }
  }
  if (style === 'topknot') front.push(mass(arc(cx, cy - H - 8, 11, 9, 0, Math.PI * 2, 14).slice(0, -1)));
  return { back: back.join(''), front: front.join(''), shadowLine: style === 'close-crop' ? null : hairlineY };
}

// ---------------------------------------------------------------------------
// Face

function faceModelling(ctx, a, g, P, faceClip) {
  const { cx, cy, W, H, ey, ny, my } = g;
  const deepSet = a.eyes.lid === 'deep-set' ? 0.18 : 0;
  const blur = ctx.blur(3.2);
  const soft = ctx.blur(1.6);
  const dx = 13 + a.eyes.spacing * 6;
  let s = `<g clip-path="${faceClip}">`;
  // Form shadow on the far (right) side and under the jaw.
  s += `<ellipse cx="${f(cx + W * 1.02)}" cy="${f(cy + 6)}" rx="${f(W * 0.5)}" ry="${f(H * 1.1)}" fill="${P.shade}" opacity="0.7" filter="${blur}"/>`;
  s += `<ellipse cx="${cx}" cy="${f(cy + H * 1.05)}" rx="${f(W * 0.9)}" ry="${f(H * 0.28)}" fill="${P.shade}" opacity="0.55" filter="${blur}"/>`;
  s += `<ellipse cx="${f(cx - W * 1.05)}" cy="${f(cy + 2)}" rx="${f(W * 0.22)}" ry="${f(H * 0.9)}" fill="${P.shade}" opacity="0.35" filter="${blur}"/>`;
  // Eye sockets.
  for (const side of [-1, 1]) {
    s += `<ellipse cx="${f(cx + side * dx)}" cy="${f(ey - 3)}" rx="${f(11 + a.eyes.size * 3)}" ry="${f(7 + deepSet * 10)}" fill="${P.shade}" opacity="${f(0.32 + deepSet + (side > 0 ? 0.1 : 0))}" filter="${soft}"/>`;
  }
  // Nose: shadow side, bridge highlight, tip.
  const nw = 6 + a.face.noseWidth * 7;
  s += `<path d="M${f(cx + 3)},${f(ey + 1)} Q${f(cx + 6 + a.face.noseBridge * 2)},${f((ey + ny) / 2)} ${f(cx + nw * 0.9)},${f(ny + 1)} L${f(cx + 2)},${f(ny + 2)}Z" fill="${P.shade}" opacity="0.7" filter="${soft}"/>`;
  s += `<path d="M${f(cx - 1.5)},${f(ey + 2)} Q${f(cx - 2.5)},${f((ey + ny) / 2)} ${f(cx - 1)},${f(ny - 1)}" stroke="${P.highlight}" stroke-width="${f(1.6 + a.face.noseBridge * 1.6)}" fill="none" opacity="0.55" stroke-linecap="round" filter="${soft}"/>`;
  s += `<ellipse cx="${f(cx - 1)}" cy="${f(ny + 0.5)}" rx="3" ry="2.2" fill="${P.highlight}" opacity="0.55" filter="${soft}"/>`;
  // Cheekbones: lit side highlight, contour beneath, a little colour.
  s += `<ellipse cx="${f(cx - W * 0.55)}" cy="${f(ey + 13)}" rx="${f(9 + a.face.cheekbones * 4)}" ry="6" fill="${P.highlight}" opacity="${f(0.22 + a.face.cheekbones * 0.18)}" filter="${blur}"/>`;
  s += `<ellipse cx="${f(cx + W * 0.55)}" cy="${f(ey + 13)}" rx="${f(8 + a.face.cheekbones * 3)}" ry="5" fill="${P.highlight}" opacity="0.12" filter="${blur}"/>`;
  for (const side of [-1, 1]) {
    const kx = cx + side * (W - 7);
    s += `<ellipse cx="${f(kx)}" cy="${f(ey + 24)}" rx="6" ry="12" fill="${P.shade}" opacity="${f(0.15 + a.face.cheekbones * 0.3)}" filter="${blur}" transform="rotate(${side * -14} ${f(kx)} ${f(ey + 24)})"/>`;
    s += `<ellipse cx="${f(cx + side * W * 0.52)}" cy="${f(ny + 4)}" rx="9" ry="6" fill="${P.blush}" opacity="${P.blushOpacity}" filter="${blur}"/>`;
  }
  // Forehead and chin light.
  s += `<ellipse cx="${cx - 8}" cy="${f(cy - H * 0.55)}" rx="${f(W * 0.5)}" ry="${f(H * 0.2)}" fill="${P.highlight}" opacity="0.32" filter="${blur}"/>`;
  s += `<ellipse cx="${cx - 2}" cy="${f(my + (cy + H - my) * 0.55)}" rx="7" ry="4" fill="${P.highlight}" opacity="0.3" filter="${soft}"/>`;
  // Under-lip and philtrum shadows.
  s += `<ellipse cx="${cx + 1}" cy="${f(my + 8 + a.face.lipFullness * 3)}" rx="7" ry="2.4" fill="${P.shade}" opacity="0.55" filter="${soft}"/>`;
  s += `<path d="M${cx - 2},${f(ny + 5)} L${cx - 2.6},${f(my - 3)} M${cx + 2},${f(ny + 5)} L${cx + 2.6},${f(my - 3)}" stroke="${P.shade}" stroke-width="1.2" opacity="0.4" filter="${soft}"/>`;
  return s + '</g>';
}

function eyesSvg(ctx, a, v, g, P, rng) {
  const { cx, ey } = g;
  const dx = 13 + a.eyes.spacing * 6;
  const ew = 9 + a.eyes.size * 4;
  const eh = (a.eyes.lid === 'monolid' ? 3.2 : 3.8) + a.eyes.size * 2.2;
  const tilt = a.eyes.tilt * 6;
  const irisBase = EYE_COLORS[a.eyes.color];
  const iris = ctx.radial([[0, mixHex(irisBase, '#e8c27a', 0.28)], [0.55, irisBase], [0.88, shadeHex(irisBase, 0.55)], [1, '#14100e']]);
  const sclera = ctx.linear([[0, mixHex('#efe9e1', P.shade, 0.35)], [0.45, '#f1ece5'], [1, '#e6dfd6']]);
  const lash = P.line;
  let s = '';
  for (const side of [-1, 1]) {
    const x = cx + side * dx;
    const rot = `rotate(${f(-side * tilt)} ${f(x)} ${f(ey)})`;
    const injured = v.eyeInjury && ((v.eyeInjury.side === 'left') === (side === -1));
    s += `<g transform="${rot}">`;
    if (injured && v.eyeInjury.patch) {
      s += `<ellipse cx="${f(x)}" cy="${f(ey)}" rx="${f(ew + 2.5)}" ry="${f(eh + 4.5)}" fill="#1d1a18"/><ellipse cx="${f(x - 3)}" cy="${f(ey - 3)}" rx="4" ry="2" fill="#4a4440" opacity="0.6"/>`;
      s += `<line x1="${f(x - ew - 2)}" y1="${f(ey - 2)}" x2="${f(cx - side * 52)}" y2="${f(ey - 26)}" stroke="#1d1a18" stroke-width="1.6"/><line x1="${f(x + ew + 2)}" y1="${f(ey - 2)}" x2="${f(cx + side * 52)}" y2="${f(ey - 10)}" stroke="#1d1a18" stroke-width="1.6"/>`;
      s += '</g>';
      continue;
    }
    const top = ey - eh * 2;
    const eyePath = `M${f(x - ew)},${f(ey)} Q${f(x - ew * 0.2)},${f(top)} ${f(x + ew)},${f(ey - 0.5)} Q${f(x + ew * 0.1)},${f(ey + eh * 1.45)} ${f(x - ew)},${f(ey)}Z`;
    const clip = ctx.clip(eyePath);
    s += `<path d="${eyePath}" fill="${sclera}"/>`;
    const ir = eh * 1.2;
    const iy = ey - eh * 0.28;
    s += `<g clip-path="${clip}">`;
    s += `<circle cx="${f(x)}" cy="${f(iy)}" r="${f(ir)}" fill="${iris}"/>`;
    s += `<circle cx="${f(x)}" cy="${f(iy)}" r="${f(ir * 0.42)}" fill="#0b0908"/>`;
    s += `<path d="M${f(x - ew)},${f(ey)} Q${f(x - ew * 0.2)},${f(top)} ${f(x + ew)},${f(ey - 0.5)} L${f(x + ew)},${f(top)} L${f(x - ew)},${f(top)}Z" fill="${P.shade}" opacity="0.45" transform="translate(0 ${f(eh * 0.55)})" filter="${ctx.blur(0.8)}"/>`;
    s += `<circle cx="${f(x + ir * 0.35)}" cy="${f(iy - ir * 0.38)}" r="${f(ir * 0.22)}" fill="#fff" opacity="0.92"/><circle cx="${f(x - ir * 0.3)}" cy="${f(iy + ir * 0.32)}" r="${f(ir * 0.1)}" fill="#fff" opacity="0.5"/>`;
    s += '</g>';
    if (injured) s += `<path d="M${f(x - 3)},${f(ey - eh * 2.4)} L${f(x + 4)},${f(ey + eh * 2)}" stroke="${mixHex(P.highlight, '#c99a9a', 0.5)}" stroke-width="1.5" stroke-linecap="round"/>`;
    // Upper lid fold and crease by lid type.
    const lid = a.eyes.lid;
    const lidH = lid === 'monolid' ? eh * 1.25 : lid === 'hooded' ? eh * 1.05 : eh * 0.75;
    s += `<path d="M${f(x - ew - 1)},${f(ey + 0.3)} Q${f(x - ew * 0.2)},${f(top - 0.5)} ${f(x + ew + 1)},${f(ey - 0.3)} Q${f(x)},${f(top - lidH)} ${f(x - ew - 1)},${f(ey + 0.3)}Z" fill="${P.lit}" opacity="0.5"/>`;
    if (lid === 'double') s += `<path d="M${f(x - ew * 0.75)},${f(ey - eh * 1.15)} Q${f(x)},${f(top - eh * 0.9)} ${f(x + ew * 0.95)},${f(ey - eh * 0.95)}" fill="none" stroke="${P.shadow}" stroke-width="1" stroke-linecap="round"/>`;
    if (lid === 'hooded') s += `<path d="M${f(x - ew - 1.5)},${f(ey - eh * 0.7)} Q${f(x)},${f(top - eh * 0.75)} ${f(x + ew + 2)},${f(ey - eh * 0.1)}" fill="none" stroke="${P.shadow}" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>`;
    if (lid === 'deep-set') s += `<path d="M${f(x - ew * 0.9)},${f(ey - eh * 1.5)} Q${f(x)},${f(top - eh * 1.2)} ${f(x + ew)},${f(ey - eh * 1.2)}" fill="none" stroke="${P.deep}" stroke-width="1.1" opacity="0.7"/>`;
    // Lash line, with a small flick at the outer corner.
    const outer = x + side * ew;
    s += `<path d="M${f(x - ew)},${f(ey)} Q${f(x - ew * 0.2)},${f(top)} ${f(x + ew)},${f(ey - 0.5)}" fill="none" stroke="${lash}" stroke-width="${lid === 'monolid' ? 1.9 : 1.6}" stroke-linecap="round"/>`;
    s += `<path d="M${f(outer - side * 3)},${f(ey - eh * 0.9)} q${side * 2.4},-0.4 ${side * 4},-1.6" fill="none" stroke="${lash}" stroke-width="1.1" stroke-linecap="round"/>`;
    s += `<path d="M${f(x - ew * 0.8)},${f(ey + eh * 0.55)} Q${f(x)},${f(ey + eh * 1.5)} ${f(x + ew * 0.85)},${f(ey + eh * 0.45)}" fill="none" stroke="${P.shadow}" stroke-width="0.7" opacity="0.75"/>`;
    s += `<path d="M${f(x - ew * 0.6)},${f(ey + eh * 1.3)} Q${f(x)},${f(ey + eh * 2.1)} ${f(x + ew * 0.6)},${f(ey + eh * 1.2)}" fill="none" stroke="${P.shade}" stroke-width="1.2" opacity="0.35"/>`;
    s += '</g>';
  }
  // Brows drawn as individual hairs over a soft base.
  const browBase = mixHex(HAIR_COLORS[a.hair.color], '#bdb8b0', v.grey * 0.6);
  const brow = shadeHex(browBase, relativeLuminance(browBase) > 0.25 ? 0.7 : 0.95);
  const thick = 1.2 + a.face.browThickness * 2.8;
  for (const side of [-1, 1]) {
    const x = cx + side * dx;
    const by = ey - eh * 2 - 5;
    const arch = 2 + a.face.browArch * 4;
    const p0 = [x - side * (ew + 1), by + 2], p1 = [x + side, by - arch], p2 = [x + side * (ew + 3), by + 2.5];
    const at = (t) => [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
    s += `<path d="M${f(p0[0])},${f(p0[1])} Q${f(p1[0])},${f(p1[1])} ${f(p2[0])},${f(p2[1])}" fill="none" stroke="${brow}" stroke-width="${f(thick)}" stroke-linecap="round" opacity="0.55"/>`;
    s += `<g stroke="${brow}" stroke-width="0.55" stroke-linecap="round">`;
    const hairs = Math.round(10 + a.face.browThickness * 14);
    for (let i = 0; i < hairs; i++) {
      const t = i / hairs;
      const [hx, hy] = at(t);
      const len = thick * rng.range(1.1, 1.8) * (t > 0.85 ? 0.6 : 1);
      const off = rng.range(-thick / 2, thick / 2);
      const rise = t < 0.3 ? 0.9 : 0.35;
      s += `<line x1="${f(hx)}" y1="${f(hy + off)}" x2="${f(hx + side * len * (1 - rise * 0.5))}" y2="${f(hy + off - len * rise)}"/>`;
    }
    s += '</g>';
  }
  return s;
}

function noseMouthSvg(ctx, a, g, P) {
  const { cx, ny, my } = g;
  const nw = 6 + a.face.noseWidth * 7;
  let s = '';
  s += `<path d="M${f(cx - nw)},${f(ny - 2)} Q${f(cx - nw - 2.5)},${f(ny + 4)} ${f(cx - nw * 0.45)},${f(ny + 4.2)}" fill="none" stroke="${P.shadow}" stroke-width="1.3" stroke-linecap="round"/>`;
  s += `<path d="M${f(cx + nw)},${f(ny - 2)} Q${f(cx + nw + 2.5)},${f(ny + 4)} ${f(cx + nw * 0.45)},${f(ny + 4.2)}" fill="none" stroke="${P.deep}" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>`;
  s += `<path d="M${f(cx - nw * 0.45)},${f(ny + 4.2)} Q${cx},${f(ny + 6.6)} ${f(cx + nw * 0.45)},${f(ny + 4.2)}" fill="none" stroke="${P.shadow}" stroke-width="0.9" opacity="0.7"/>`;
  for (const side of [-1, 1]) {
    const nx = cx + side * nw * 0.42;
    s += `<ellipse cx="${f(nx)}" cy="${f(ny + 3)}" rx="${f(1.5 + a.face.noseWidth * 1.1)}" ry="1.3" fill="${P.deep}" transform="rotate(${side * 12} ${f(nx)} ${f(ny + 3)})"/>`;
  }

  const mw = 9 + a.face.lipFullness * 4 + a.face.jaw * 2 + a.face.mouthWidth * 4;
  const up = 2 + a.face.lipFullness * 3.2;
  const lo = 2.6 + a.face.lipFullness * 4;
  const upperFill = ctx.linear([[0, shadeHex(P.lipUpper, 1.05)], [1, shadeHex(P.lipUpper, 0.85)]]);
  const lowerFill = ctx.linear([[0, shadeHex(P.lip, 0.8)], [0.45, P.lip], [1, shadeHex(P.lip, 0.92)]]);
  s += `<path d="M${f(cx - mw)},${f(my)} Q${f(cx - mw * 0.55)},${f(my - up * 1.05)} ${f(cx - 2.2)},${f(my - up * 0.95)} Q${cx},${f(my - up * 0.55)} ${f(cx + 2.2)},${f(my - up * 0.95)} Q${f(cx + mw * 0.55)},${f(my - up * 1.05)} ${f(cx + mw)},${f(my)}Z" fill="${upperFill}"/>`;
  s += `<path d="M${f(cx - mw)},${f(my)} Q${f(cx - mw * 0.5)},${f(my + lo * 1.5)} ${cx},${f(my + lo * 1.55)} Q${f(cx + mw * 0.5)},${f(my + lo * 1.5)} ${f(cx + mw)},${f(my)}Z" fill="${lowerFill}"/>`;
  s += `<path d="M${f(cx - mw - 0.6)},${f(my + 0.2)} Q${f(cx - mw * 0.4)},${f(my + 1.2)} ${cx},${f(my + 0.6)} Q${f(cx + mw * 0.4)},${f(my + 1.2)} ${f(cx + mw + 0.6)},${f(my + 0.2)}" fill="none" stroke="${P.deep}" stroke-width="1.05" stroke-linecap="round"/>`;
  s += `<ellipse cx="${cx - 2}" cy="${f(my + lo * 0.75)}" rx="${f(mw * 0.32)}" ry="${f(lo * 0.28)}" fill="#fff" opacity="0.2" filter="${ctx.blur(1)}"/>`;
  s += `<path d="M${f(cx - mw * 0.5)},${f(my - up * 1.2)} Q${cx},${f(my - up * 1.5)} ${f(cx + mw * 0.3)},${f(my - up * 1.25)}" fill="none" stroke="${P.highlight}" stroke-width="0.8" opacity="0.4"/>`;
  for (const side of [-1, 1]) s += `<circle cx="${f(cx + side * (mw + 0.8))}" cy="${f(my + 0.2)}" r="1" fill="${P.deep}" opacity="0.5"/>`;
  if (a.marks.dimples) {
    for (const side of [-1, 1]) s += `<path d="M${f(cx + side * (mw + 4))},${f(my - 3)} q${side},3 0,5" fill="none" stroke="${P.shadow}" stroke-width="0.9" opacity="0.6"/>`;
  }
  return s;
}

function marksSvg(ctx, a, v, g, P, rng) {
  const { cx, cy, W } = g;
  let s = '';
  if (a.marks.vitiligo) {
    const vr = new Rng(a.marks.vitiligo.seed);
    const light = mixHex(a.skin.hex, '#f2e4d8', 0.75);
    for (let i = 0; i < a.marks.vitiligo.patches; i++) {
      const px = cx + vr.range(-W * 0.7, W * 0.7), py = cy + vr.range(-30, 40);
      const pts = Array.from({ length: 8 }, (_, k) => {
        const ang = (k / 8) * Math.PI * 2, rr = vr.range(3, 8);
        return [px + rr * Math.cos(ang), py + rr * Math.sin(ang)];
      });
      s += `<path d="${smoothClosed(pts)}" fill="${light}" opacity="0.9" filter="${ctx.blur(0.5)}"/>`;
    }
  }
  if (a.marks.freckles) {
    const n = Math.round(14 + a.marks.freckles * 36);
    const fc = shadeHex(a.skin.hex, 0.66);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const x = cx + side * rng.range(2, W * 0.75), y = g.ey + rng.range(8, 24) + Math.abs(x - cx) * 0.08;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rng.range(0.45, 1.05))}" fill="${fc}" opacity="${f(rng.range(0.45, 0.8))}"/>`;
    }
  }
  for (const m of a.marks.moles) s += `<circle cx="${f(cx - W + m.x * 2 * W)}" cy="${f(cy - 40 + m.y * 90)}" r="0.95" fill="${P.deep}"/>`;
  if (a.marks.birthmark) s += `<ellipse cx="${f(cx - W + a.marks.birthmark.x * 2 * W)}" cy="${f(cy - 40 + a.marks.birthmark.y * 90)}" rx="4" ry="2.6" fill="${mixHex(a.skin.hex, '#7a3b2e', 0.3)}" opacity="0.6" filter="${ctx.blur(0.6)}"/>`;
  if (v.wrinkles > 0.05) {
    s += `<g fill="none" stroke="${P.shadow}" stroke-width="0.8" opacity="${f(v.wrinkles * 0.7)}" stroke-linecap="round">`;
    s += `<path d="M${cx - 16},${f(cy - 32)} q16,-3 32,0"/>`;
    if (v.wrinkles > 0.4) s += `<path d="M${cx - 12},${f(cy - 37)} q12,-2 24,0"/><path d="M${cx - 3},${f(g.ey - 11)} v-4 M${cx + 3},${f(g.ey - 11)} v-4"/>`;
    s += `<path d="M${cx - 12},${f(g.ny + 2)} q-6,8 -4,${f(g.my - g.ny + 4)}"/><path d="M${cx + 12},${f(g.ny + 2)} q6,8 4,${f(g.my - g.ny + 4)}"/>`;
    for (const side of [-1, 1]) s += `<path d="M${cx + side * 31},${f(g.ey - 2)} l${side * 5},-2 M${cx + side * 31},${f(g.ey + 1)} l${side * 5},1"/>`;
    if (v.wrinkles > 0.6) s += `<path d="M${cx - 20},${f(g.ey + 9)} q6,3 12,1 M${cx + 8},${f(g.ey + 10)} q6,2 12,-1"/>`;
    s += '</g>';
  }
  for (const sc of v.scars) {
    const side = sc.side === 'left' ? -1 : 1;
    const [sx, sy] = sc.location === 'brow' ? [cx + side * 20, g.ey - 20] : sc.location === 'chin' ? [cx + side * 6, g.my + 12] : [cx + side * 24, g.ey + 12];
    s += `<path d="M${f(sx - 5)},${f(sy - 6)} L${f(sx + 5)},${f(sy + 7)}" stroke="${mixHex(P.highlight, '#d8b0a6', 0.45)}" stroke-width="2" stroke-linecap="round"/>`;
    s += `<path d="M${f(sx - 5)},${f(sy - 6)} L${f(sx + 5)},${f(sy + 7)}" stroke="${P.shadow}" stroke-width="0.5" stroke-dasharray="1.5 2"/>`;
  }
  for (const t of v.tattoos) {
    const tcol = mixHex(P.deep, '#1b2a4a', 0.5);
    const [tx, ty] = t.location === 'forehead' ? [cx, cy - 34] : t.location === 'chin' ? [cx, g.my + 12] : [cx - 25, g.ey + 14];
    s += `<g stroke="${tcol}" stroke-width="1.1" fill="none" opacity="0.85"><path d="M${f(tx - 6)},${f(ty)} l6,-5 l6,5 l-6,5z"/><path d="M${f(tx)},${f(ty - 9)} v-3 M${f(tx)},${f(ty + 9)} v3"/></g>`;
  }
  return s;
}

function facialHairSvg(ctx, style, g, color, tex, rng) {
  if (style === 'none') return '';
  const { cx, cy, H, W, my, jawW } = g;
  const pal = hairPalette(color);
  if (style === 'stubble') {
    let s = `<path d="M${f(cx - W * 0.86)},${f(cy + 8)} Q${f(cx - jawW)},${f(cy + H * 0.9)} ${cx},${f(cy + H)} Q${f(cx + jawW)},${f(cy + H * 0.9)} ${f(cx + W * 0.86)},${f(cy + 8)} Q${cx},${f(my + 2)} ${f(cx - W * 0.86)},${f(cy + 8)}Z" fill="${pal.dark}" opacity="0.12" filter="${ctx.blur(2.5)}"/><g fill="${pal.dark}" opacity="0.24">`;
    for (let i = 0; i < 320; i++) {
      const ang = rng.range(0.05, Math.PI - 0.05);
      const rr = rng.range(0.5, 1);
      const x = cx + Math.cos(ang) * W * 0.86 * rr, y = cy + 12 + Math.sin(ang) * (H - 10) * rr;
      if (Math.abs(x - cx) < 13 && y < my + 5 && y > my - 6) continue;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rng.range(0.22, 0.42))}"/>`;
    }
    return s + `</g><ellipse cx="${cx}" cy="${f(cy + H * 0.65)}" rx="${f(jawW)}" ry="${f(H * 0.35)}" fill="${pal.base}" opacity="0.1" filter="${ctx.blur(3)}"/>`;
  }
  const moustache = [[cx - 15, my + 1], [cx - 9, my - 6], [cx - 2, my - 6.5], [cx, my - 5], [cx + 2, my - 6.5], [cx + 9, my - 6], [cx + 15, my + 1], [cx, my - 2.5]];
  const tache = hairMass(ctx, moustache, tex === 'straight' ? 'straight' : 'wavy', color, rng, { detail: 2 });
  if (style === 'moustache') return tache;
  const depth = style === 'full-beard' ? 20 : 9;
  const beard = [
    [cx - W * 0.93, cy + 2], [cx - W * 0.82, cy + H * 0.6], [cx - 15, cy + H + depth * 0.6], [cx, cy + H + depth], [cx + 15, cy + H + depth * 0.6],
    [cx + W * 0.82, cy + H * 0.6], [cx + W * 0.93, cy + 2], [cx + W * 0.76, cy + 18], [cx + 16, my - 4], [cx, my - 6], [cx - 16, my - 4], [cx - W * 0.76, cy + 18],
  ];
  const btex = tex === 'straight' ? 'wavy' : tex;
  const mouthGap = `<path d="M${cx - 11},${f(my + 0.5)} Q${cx},${f(my + 9)} ${cx + 11},${f(my + 0.5)} Q${cx},${f(my + 3)} ${cx - 11},${f(my + 0.5)}Z" fill="${pal.deep}" opacity="0.65"/>`;
  return `${hairMass(ctx, beard, btex, color, rng, { detail: 1.2 })}${mouthGap}${tache}`;
}

// ---------------------------------------------------------------------------
// Clothing (presentation only; derived from the seed, not from status)

export const CLOTHING_STYLES = ['tunic', 'v-neck', 'wrap', 'high-collar', 'shawl', 'coat'];

function clothingSvg(ctx, a, g, shoulder, neckW) {
  const { cx, cy } = g;
  const h = hashString(`${a.seed}::clothing`);
  const style = CLOTHING_STYLES[h % CLOTHING_STYLES.length];
  const hue = a.clothingHue;
  const sat = 22 + (h % 25);
  const base = `hsl(${hue} ${sat}% 36%)`;
  const lit = `hsl(${hue} ${sat}% 47%)`;
  const dark = `hsl(${hue} ${sat}% 22%)`;
  const trimHue = (hue + 180 + ((h >> 5) % 60)) % 360;
  const trim = `hsl(${trimHue} 38% 58%)`;
  const fill = ctx.linear([[0, lit], [0.55, base], [1, dark]], { x1: 0, y1: 0, x2: 1, y2: 0.3 });
  const top = cy + 76;
  const L = f(cx - neckW - 8), R = f(cx + neckW + 8);
  let s = `<path d="M${f(cx - shoulder)},242 L${f(cx - shoulder + 3)},${cy + 104} Q${f(cx - shoulder + 8)},${top + 2} ${L},${top - 2} L${R},${top - 2} Q${f(cx + shoulder - 8)},${top + 2} ${f(cx + shoulder - 3)},${cy + 104} L${f(cx + shoulder)},242Z" fill="${fill}"/>`;
  s += `<g fill="none" stroke="${dark}" stroke-linecap="round" opacity="0.55"><path d="M${f(cx - shoulder + 16)},${cy + 112} q6,40 2,90" stroke-width="2"/><path d="M${f(cx + shoulder - 18)},${cy + 108} q-8,40 -4,100" stroke-width="2.4"/><path d="M${cx - 18},${cy + 118} q3,20 0,40" stroke-width="1.2"/></g>`;
  s += `<path d="M${f(cx - shoulder + 10)},${cy + 100} q14,-18 34,-20" fill="none" stroke="${lit}" stroke-width="2" opacity="0.6" stroke-linecap="round"/>`;
  const nl = f(cx - neckW - 6), nr = f(cx + neckW + 6);
  switch (style) {
    case 'tunic':
      s += `<path d="M${f(cx - neckW - 7)},${top - 2} Q${cx},${top + 18} ${f(cx + neckW + 7)},${top - 2}" fill="none" stroke="${trim}" stroke-width="4"/>`;
      break;
    case 'v-neck':
      s += `<path d="M${nl},${top - 2} L${cx},${top + 30} L${nr},${top - 2}Z" fill="${g.skin}"/>`;
      s += `<path d="M${cx - 4},${top + 4} L${cx},${top + 28} L${cx + 6},${top + 4}Z" fill="${g.shade}" opacity="0.6" filter="${ctx.blur(2)}"/>`;
      s += `<path d="M${nl},${top - 2} L${cx},${top + 30} L${nr},${top - 2}" fill="none" stroke="${trim}" stroke-width="3" stroke-linejoin="round"/>`;
      break;
    case 'wrap':
      s += `<path d="M${nl},${top - 2} L${cx + 12},${top + 40} L${nr},${top - 2}Z" fill="${g.skin}"/>`;
      s += `<path d="M${cx + 2},${top + 8} L${cx + 12},${top + 38} L${cx + 16},${top + 10}Z" fill="${g.shade}" opacity="0.5" filter="${ctx.blur(2)}"/>`;
      s += `<path d="M${nr},${top - 2} L${cx - 20},242" stroke="${dark}" stroke-width="2.5" fill="none"/><path d="M${nl},${top - 2} L${cx + 12},${top + 40} L${nr},${top - 2}" fill="none" stroke="${trim}" stroke-width="3.5"/>`;
      break;
    case 'high-collar':
      s += `<path d="M${f(cx - neckW - 2)},${top - 14} L${f(cx - neckW - 4)},${top + 4} Q${cx},${top + 10} ${f(cx + neckW + 4)},${top + 4} L${f(cx + neckW + 2)},${top - 14} Q${cx},${top - 8} ${f(cx - neckW - 2)},${top - 14}Z" fill="${base}" stroke="${trim}" stroke-width="1.6"/>`;
      s += `<path d="M${cx},${top + 6} V242" stroke="${trim}" stroke-width="1.5"/>`;
      for (let i = 0; i < 4; i++) s += `<circle cx="${cx + 4}" cy="${top + 18 + i * 13}" r="1.6" fill="${trim}"/>`;
      break;
    case 'shawl': {
      const sf = ctx.linear([[0, `hsl(${trimHue} 35% 56%)`], [1, `hsl(${trimHue} 35% 32%)`]], { x1: 0, y1: 0, x2: 1, y2: 1 });
      s += `<path d="M${f(cx - neckW - 7)},${top - 2} Q${cx},${top + 14} ${f(cx + neckW + 7)},${top - 2}" fill="none" stroke="${dark}" stroke-width="3"/>`;
      s += `<path d="M${f(cx - shoulder - 2)},${cy + 112} Q${f(cx - shoulder + 10)},${top - 6} ${f(cx - neckW - 4)},${top - 4} Q${cx + 10},${top + 34} ${f(cx + shoulder - 6)},${cy + 150} L${f(cx + shoulder - 20)},242 L${f(cx - shoulder)},242Z" fill="${sf}"/>`;
      s += `<g fill="none" stroke="hsl(${trimHue} 35% 44%)" stroke-width="1.6" opacity="0.8"><path d="M${f(cx - shoulder + 8)},${cy + 130} Q${cx},${cy + 120} ${f(cx + shoulder - 16)},${cy + 170}"/><path d="M${f(cx - shoulder + 4)},${cy + 150} Q${cx},${cy + 140} ${f(cx + shoulder - 22)},${cy + 196}"/></g>`;
      s += `<path d="M${f(cx - shoulder + 2)},${cy + 160} Q${cx},${cy + 150} ${f(cx + shoulder - 24)},${cy + 214}" fill="none" stroke="${trim}" stroke-width="2.5" stroke-dasharray="3 3"/>`;
      break;
    }
    case 'coat':
      s += `<path d="M${nl},${top - 2} L${cx - 4},${top + 44} L${f(cx - neckW - 22)},${top + 12}Z" fill="${lit}" opacity="0.9"/><path d="M${nr},${top - 2} L${cx + 4},${top + 44} L${f(cx + neckW + 22)},${top + 12}Z" fill="${dark}" opacity="0.9"/>`;
      s += `<path d="M${f(cx - neckW - 4)},${top - 2} L${cx},${top + 28} L${f(cx + neckW + 4)},${top - 2}Z" fill="hsl(${trimHue} 20% 85%)"/>`;
      for (let i = 0; i < 3; i++) s += `<circle cx="${cx}" cy="${top + 52 + i * 18}" r="2" fill="${trim}"/>`;
      break;
  }
  return s;
}

// ---------------------------------------------------------------------------

/**
 * Render a portrait.
 * Options: { size, title, background (default true), detail (lower for tiny renders) }
 */
export function renderPortrait(a, { size = 200, title, background = true, detail = 1 } = {}) {
  const v = visibleAppearance(a);
  const rng = Rng.stream(a.seed, `portrait:${a.age}:${a.events.length}`);
  const uid = `p${hashString(`${a.seed}|${a.age}|${JSON.stringify(a.events)}|${size}|${background}|${detail}|${title ?? ''}`).toString(36)}`;
  const ctx = new Ctx(uid);
  const g = geometry(a, v);
  const { cx, cy, W } = g;
  const skin = a.skin.hex;
  const P = featurePalette(skin);
  g.skin = skin;
  g.shade = P.shade;
  const hairColor = v.hairHex;
  const buildIdx = ['slight', 'lean', 'average', 'sturdy', 'broad', 'heavy'].indexOf(a.body.build) + v.buildShift;
  const shoulder = (g.child ? 58 : 74) + clamp(buildIdx, 0, 5) * 4.5;
  const neckW = W * 0.42 + clamp(buildIdx, 0, 5) * 1.1 - (g.child ? 2 : 0);

  const parts = [];
  if (background) {
    const bgHue = (a.clothingHue + 190) % 360;
    const bg = ctx.radial([[0, `hsl(${bgHue} 22% 84%)`], [0.7, `hsl(${bgHue} 18% 72%)`], [1, `hsl(${bgHue} 20% 58%)`]], { cx: 0.42, cy: 0.38, r: 0.75 });
    parts.push(`<rect width="200" height="240" fill="${bg}"/>`);
    parts.push(`<ellipse cx="${cx - 10}" cy="${cy - 20}" rx="80" ry="90" fill="hsl(${bgHue} 30% 92%)" opacity="0.45" filter="${ctx.blur(12)}"/>`);
  }
  const hair = hairSvg(ctx, a, v, g, hairColor, rng, detail);
  parts.push(hair.back);

  // Neck with the jaw's cast shadow.
  const neckFill = ctx.linear([[0, P.shade], [0.4, skin], [1, shadeHex(skin, 0.92)]]);
  parts.push(`<path d="M${f(cx - neckW)},${cy + 26} L${f(cx - neckW - 1.5)},${cy + 84} L${f(cx + neckW + 1.5)},${cy + 84} L${f(cx + neckW)},${cy + 26}Z" fill="${neckFill}"/>`);
  parts.push(`<path d="M${f(cx - neckW - 1)},${cy + 40} Q${cx},${cy + 62} ${f(cx + neckW + 1)},${cy + 40} L${f(cx + neckW + 1)},${cy + 30} L${f(cx - neckW - 1)},${cy + 30}Z" fill="${P.deep}" opacity="0.5" filter="${ctx.blur(2.5)}"/>`);
  parts.push(`<path d="M${f(cx + neckW * 0.3)},${cy + 50} L${f(cx + neckW + 1)},${cy + 84}" stroke="${P.shade}" stroke-width="5" opacity="0.5" filter="${ctx.blur(2)}"/>`);
  parts.push(clothingSvg(ctx, a, g, shoulder, neckW));

  // Ears.
  const earR = 6 + a.face.earSize * 3;
  for (const side of [-1, 1]) {
    const ex = cx + side * (W - 1);
    parts.push(`<ellipse cx="${f(ex)}" cy="${cy + 1}" rx="${f(earR * 0.62)}" ry="${f(earR)}" fill="${side < 0 ? skin : P.shade}"/>`);
    parts.push(`<path d="M${f(ex + side)},${f(cy - earR * 0.6)} q${f(side * earR * 0.45)},${f(earR * 0.5)} 0,${f(earR * 1.2)}" fill="none" stroke="${P.shadow}" stroke-width="1.2" opacity="0.8"/>`);
  }

  // Face.
  const faceD = smoothClosed(g.outline);
  const faceClip = ctx.clip(faceD);
  const faceFill = ctx.linear([[0, P.lit], [0.45, skin], [1, shadeHex(skin, 0.9)]], { x1: 0, y1: 0.2, x2: 1, y2: 0.6 });
  parts.push(`<path d="${faceD}" fill="${faceFill}"/>`);
  parts.push(faceModelling(ctx, a, g, P, faceClip));
  if (hair.shadowLine !== null) {
    parts.push(`<g clip-path="${faceClip}"><ellipse cx="${cx}" cy="${f(hair.shadowLine - 2)}" rx="${f(W * 1.1)}" ry="7" fill="${P.deep}" opacity="0.45" filter="${ctx.blur(3)}"/></g>`);
  }
  parts.push(marksSvg(ctx, a, v, g, P, rng));
  parts.push(eyesSvg(ctx, a, v, g, P, rng));
  parts.push(noseMouthSvg(ctx, a, g, P));
  if (a.age >= 16) parts.push(facialHairSvg(ctx, v.facialHair, g, hairColor, a.hair.texture, rng));
  parts.push(hair.front);
  if (v.spectacles) {
    const ey = g.ey;
    parts.push(`<g fill="none" stroke="#3a3330" stroke-width="1.5"><circle cx="${cx - 17}" cy="${f(ey)}" r="11.5" fill="#dfe8ee" fill-opacity="0.12"/><circle cx="${cx + 17}" cy="${f(ey)}" r="11.5" fill="#dfe8ee" fill-opacity="0.12"/><path d="M${cx - 6},${f(ey - 1)} q6,-3 12,0 M${cx - 28.5},${f(ey - 2)} L${f(cx - W)},${f(ey - 4)} M${cx + 28.5},${f(ey - 2)} L${f(cx + W)},${f(ey - 4)}"/></g>`);
    parts.push(`<path d="M${cx - 24},${f(ey - 6)} l5,-4 M${cx + 10},${f(ey - 6)} l5,-4" stroke="#fff" stroke-width="1.2" opacity="0.6"/>`);
  }
  const label = title ?? `Portrait of character ${a.id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="${size}" height="${Math.round(size * 1.2)}" role="img" aria-label="${escapeXml(label)}"><title>${escapeXml(label)}</title><defs>${ctx.defs.join('')}</defs>${parts.join('')}</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}
