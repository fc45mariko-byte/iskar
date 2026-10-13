// Procedural SVG portraits rendered from the structured appearance record.
// Deterministic: the same record (at the same age, with the same events)
// always produces the same picture, so a character stays recognisable across
// screens. Shading, lips and feature lines are derived from each person's own
// skin colour rather than fixed outline colours, so features read clearly
// across the whole light-to-dark range.

import { Rng, clamp } from '../appearance/rng.js';
import { EYE_COLORS, HAIR_COLORS, mixHex, shadeHex, relativeLuminance } from '../appearance/traits.js';
import { visibleAppearance } from '../appearance/lifecycle.js';

const f = (n) => Math.round(n * 10) / 10;

function smoothClosed(pts, tension = 1) {
  // Catmull-Rom → cubic Bézier, closed.
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
    const len = Math.hypot(x1 - x0, y1 - y0);
    const k = Math.max(1, Math.round(len / step));
    for (let j = 0; j < k; j++) out.push([x0 + ((x1 - x0) * j) / k, y0 + ((y1 - y0) * j) / k]);
  }
  return out;
}

/** Feature colours derived from the individual's own skin colour. */
export function featurePalette(skin) {
  const lum = relativeLuminance(skin);
  // Lip colour shifts continuously from rose-brown on lighter skin to
  // mauve-brown on deeper skin, so lips stay distinct at every tone.
  const k = clamp((lum - 0.03) / 0.5);
  const lip = mixHex(shadeHex(skin, 0.7 + 0.3 * k), mixHex('#8e4f5c', '#b25a55', k), 0.55);
  return {
    shadow: shadeHex(skin, 0.62),
    deep: shadeHex(skin, 0.42),
    line: mixHex(shadeHex(skin, 0.3), '#0d0907', 0.6),
    lip,
    lipUpper: shadeHex(lip, 0.82),
    highlight: shadeHex(skin, lum < 0.08 ? 1.6 : 1.22),
  };
}

const TEXTURE_CURL = { straight: 0, wavy: 0, curly: 5, coily: 3.6, 'tightly-coiled': 2.6 };

/** Fill an outline with hair, rendering the edge and surface by texture. */
function hairMass(pts, texture, color, rng, { opacity = 1, strands = true } = {}) {
  const dark = shadeHex(color, 0.6);
  const light = shadeHex(color, 1.6);
  const d = smoothClosed(pts);
  const clip = `h${rng.int(0, 1e9)}`;
  let s = `<clipPath id="${clip}"><path d="${d}"/></clipPath><path d="${d}" fill="${color}" opacity="${opacity}"/>`;
  const r = TEXTURE_CURL[texture];
  if (r && opacity >= 1) {
    const edge = resample(pts, r * 1.1);
    s += `<g fill="${color}" stroke="${dark}" stroke-width="0.6">`;
    for (const [x, y] of edge) s += `<circle cx="${f(x + rng.range(-1, 1))}" cy="${f(y + rng.range(-1, 1))}" r="${f(r * rng.range(0.8, 1.15))}"/>`;
    s += '</g>';
    // Surface texture inside the mass
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const count = Math.round(((x1 - x0) * (y1 - y0)) / (r * r * 5));
    s += `<g fill="none" stroke="${dark}" stroke-width="0.5" opacity="0.55" clip-path="url(#${clip})">`;
    for (let i = 0; i < count; i++) {
      const x = rng.range(x0, x1), y = rng.range(y0, y1);
      if (pointInPoly([x, y], pts)) s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.6)}"/>`;
    }
    s += '</g>';
  } else if (strands && opacity >= 1) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    s += `<g fill="none" stroke-linecap="round" clip-path="url(#${clip})">`;
    for (let i = 0; i < 9; i++) {
      const x = x0 + ((i + 0.5) * (x1 - x0)) / 9;
      const amp = texture === 'wavy' ? 3 : 0.6;
      const ya = y0 + 6, yb = y1 - 4;
      const sd = `M${f(x)},${f(ya)} C${f(x + amp)},${f(ya + (yb - ya) / 3)} ${f(x - amp)},${f(ya + (2 * (yb - ya)) / 3)} ${f(x + amp * 0.5)},${f(yb)}`;
      s += `<path d="${sd}" stroke="${i % 2 ? dark : light}" stroke-width="0.8" opacity="0.35"/>`;
    }
    s += '</g>';
  }
  return s;
}

function pointInPoly([x, y], pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function arc(cx, cy, rx, ry, a0, a1, n = 14) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

/** Face geometry derived from the record. */
function geometry(a, v) {
  const child = a.age < 14;
  const cx = 100;
  const cy = 112;
  const shapeMods = {
    oval: [0, 0.9, 0.62, 0],
    round: [2, 1, 0.82, -4],
    square: [1, 0.95, 0.92, -1],
    heart: [1, 1, 0.5, 0],
    long: [-3, 0.9, 0.7, 6],
    diamond: [-1, 0.86, 0.55, 2],
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
    [cx + jawW * 0.45, cy + H * 0.93],
    [cx, cy + H],
    [cx - jawW * 0.45, cy + H * 0.93],
    [cx - jawW, cy + H * 0.62],
    [cx - W, cy + 2],
    [cx - temple, cy - H * 0.4],
    [cx - temple * 0.75, cy - H * 0.82],
  ];
  const hairlineY = cy - H * 0.58 + v.recession * 16;
  const ey = cy - 7 + a.face.featureHeight * 5;
  const ny = cy + 13 + a.face.noseLength * 8;
  const my = Math.min(ny + 11 + a.face.length * 3, cy + H * 0.72);
  return { cx, cy, W, H, outline, hairlineY, child, ey, ny, my };
}

function eyesSvg(a, v, g, skin, rng) {
  const { cx, ey } = g;
  const { shadow, line } = featurePalette(skin);
  const dx = 13 + a.eyes.spacing * 6;
  const ew = 9 + a.eyes.size * 4;
  const eh = (a.eyes.lid === 'monolid' ? 3.2 : 3.8) + a.eyes.size * 2.2;
  const tilt = a.eyes.tilt * 6;
  const iris = EYE_COLORS[a.eyes.color];
  let s = '';
  for (const side of [-1, 1]) {
    const x = cx + side * dx;
    const rot = `rotate(${f(-side * tilt)} ${f(x)} ${f(ey)})`;
    const injured = v.eyeInjury && ((v.eyeInjury.side === 'left') === (side === -1));
    s += `<g transform="${rot}">`;
    if (a.eyes.lid === 'deep-set') s += `<ellipse cx="${f(x)}" cy="${f(ey - 3)}" rx="${f(ew + 2)}" ry="${f(eh + 3)}" fill="${shadow}" opacity="0.35"/>`;
    if (injured && v.eyeInjury.patch) {
      s += `<ellipse cx="${f(x)}" cy="${f(ey)}" rx="${f(ew + 2)}" ry="${f(eh + 4)}" fill="#1d1a18"/>`;
      s += `<line x1="${f(x - ew - 2)}" y1="${f(ey - 2)}" x2="${f(cx - side * 50)}" y2="${f(ey - 26)}" stroke="#1d1a18" stroke-width="1.6"/>`;
      s += `<line x1="${f(x + ew + 2)}" y1="${f(ey - 2)}" x2="${f(cx + side * 50)}" y2="${f(ey - 10)}" stroke="#1d1a18" stroke-width="1.6"/>`;
      s += '</g>';
      continue;
    }
    const eyePath = `M${f(x - ew)},${f(ey)} Q${f(x)},${f(ey - eh * 2)} ${f(x + ew)},${f(ey)} Q${f(x)},${f(ey + eh * 1.4)} ${f(x - ew)},${f(ey)}Z`;
    const clipId = `e${side > 0 ? 'r' : 'l'}${rng.int(0, 1e9)}`;
    s += `<clipPath id="${clipId}"><path d="${eyePath}"/></clipPath>`;
    s += `<path d="${eyePath}" fill="#f3eee6"/>`;
    s += `<g clip-path="url(#${clipId})"><circle cx="${f(x)}" cy="${f(ey - eh * 0.25)}" r="${f(eh * 1.15)}" fill="${iris}"/><circle cx="${f(x)}" cy="${f(ey - eh * 0.25)}" r="${f(eh * 0.5)}" fill="#0d0a09"/><circle cx="${f(x + eh * 0.35)}" cy="${f(ey - eh * 0.65)}" r="${f(eh * 0.22)}" fill="#fff" opacity="0.85"/></g>`;
    if (injured) s += `<line x1="${f(x - 3)}" y1="${f(ey - eh * 2.2)}" x2="${f(x + 4)}" y2="${f(ey + eh * 2)}" stroke="${mixHex(skin, '#c99a9a', 0.5)}" stroke-width="1.4"/>`;
    // Upper lid line (lashes) and crease by eyelid type
    s += `<path d="M${f(x - ew)},${f(ey)} Q${f(x)},${f(ey - eh * 2)} ${f(x + ew)},${f(ey)}" fill="none" stroke="${line}" stroke-width="${a.eyes.lid === 'monolid' ? 1.8 : 1.4}" stroke-linecap="round"/>`;
    if (a.eyes.lid === 'double') s += `<path d="M${f(x - ew * 0.8)},${f(ey - eh * 1.2)} Q${f(x)},${f(ey - eh * 2.5)} ${f(x + ew * 0.9)},${f(ey - eh * 1.0)}" fill="none" stroke="${shadow}" stroke-width="0.9"/>`;
    if (a.eyes.lid === 'hooded') s += `<path d="M${f(x - ew - 1)},${f(ey - eh * 0.6)} Q${f(x)},${f(ey - eh * 2.3)} ${f(x + ew + 1.5)},${f(ey - eh * 0.2)}" fill="none" stroke="${shadow}" stroke-width="1.3"/>`;
    s += `<path d="M${f(x - ew * 0.8)},${f(ey + eh * 0.6)} Q${f(x)},${f(ey + eh * 1.4)} ${f(x + ew * 0.8)},${f(ey + eh * 0.6)}" fill="none" stroke="${shadow}" stroke-width="0.6" opacity="0.7"/>`;
    s += '</g>';
  }
  // Brows
  const browColor = shadeHex(mixHex(HAIR_COLORS[a.hair.color], '#bdb8b0', v.grey * 0.6), 0.9);
  const bw = 1.4 + a.face.browThickness * 2.8;
  for (const side of [-1, 1]) {
    const x = cx + side * dx;
    const by = ey - eh * 2 - 5;
    const arch = 2 + a.face.browArch * 4;
    s += `<path d="M${f(x - side * (ew + 1))},${f(by + 2)} Q${f(x + side * 1)},${f(by - arch)} ${f(x + side * (ew + 3))},${f(by + 2.5)}" fill="none" stroke="${browColor}" stroke-width="${f(bw)}" stroke-linecap="round"/>`;
  }
  return s;
}

function noseMouthSvg(a, v, g, skin) {
  const { cx, cy, ny, my } = g;
  const { shadow, deep, lip, lipUpper } = featurePalette(skin);
  const nw = 6 + a.face.noseWidth * 7;
  let s = '';
  // bridge shading: higher bridge → more defined side line
  const bridgeOpacity = 0.15 + a.face.noseBridge * 0.45;
  s += `<path d="M${f(cx - 4)},${f(cy - 4)} Q${f(cx - 5 - a.face.noseBridge * 2)},${f(cy + 8)} ${f(cx - nw * 0.7)},${f(ny - 2)}" fill="none" stroke="${shadow}" stroke-width="1.1" opacity="${f(bridgeOpacity)}"/>`;
  s += `<path d="M${f(cx - nw)},${f(ny - 1)} Q${f(cx - nw - 2)},${f(ny + 4)} ${f(cx - nw * 0.45)},${f(ny + 4)} Q${f(cx)},${f(ny + 6.5)} ${f(cx + nw * 0.45)},${f(ny + 4)} Q${f(cx + nw + 2)},${f(ny + 4)} ${f(cx + nw)},${f(ny - 1)}" fill="none" stroke="${shadow}" stroke-width="1.2" stroke-linecap="round"/>`;
  s += `<ellipse cx="${f(cx - nw * 0.45)}" cy="${f(ny + 3)}" rx="${f(1.4 + a.face.noseWidth)}" ry="1.2" fill="${deep}"/>`;
  s += `<ellipse cx="${f(cx + nw * 0.45)}" cy="${f(ny + 3)}" rx="${f(1.4 + a.face.noseWidth)}" ry="1.2" fill="${deep}"/>`;

  // Lips — colour derived from the individual's skin, not a fixed pink.
  const mw = 9 + a.face.lipFullness * 4 + a.face.jaw * 2 + a.face.mouthWidth * 4;
  const up = 2 + a.face.lipFullness * 3.2;
  const lo = 2.6 + a.face.lipFullness * 4;
  s += `<path d="M${f(cx - mw)},${f(my)} Q${f(cx - mw * 0.5)},${f(my - up)} ${f(cx - 2)},${f(my - up * 0.85)} Q${f(cx)},${f(my - up * 0.5)} ${f(cx + 2)},${f(my - up * 0.85)} Q${f(cx + mw * 0.5)},${f(my - up)} ${f(cx + mw)},${f(my)}Z" fill="${lipUpper}"/>`;
  s += `<path d="M${f(cx - mw)},${f(my)} Q${f(cx)},${f(my + lo * 1.6)} ${f(cx + mw)},${f(my)}Z" fill="${lip}"/>`;
  s += `<path d="M${f(cx - mw)},${f(my)} Q${f(cx)},${f(my + 1)} ${f(cx + mw)},${f(my)}" fill="none" stroke="${deep}" stroke-width="0.9"/>`;
  s += `<ellipse cx="${f(cx)}" cy="${f(my + lo * 0.6)}" rx="${f(mw * 0.35)}" ry="${f(lo * 0.25)}" fill="#fff" opacity="0.12"/>`;
  if (a.marks.dimples) {
    for (const side of [-1, 1]) s += `<path d="M${f(cx + side * (mw + 4))},${f(my - 3)} q${side * 1},3 0,5" fill="none" stroke="${shadow}" stroke-width="0.8" opacity="0.6"/>`;
  }
  return s;
}

function marksSvg(a, v, g, skin, rng) {
  const { cx, cy, W } = g;
  let s = '';
  const shadow = shadeHex(skin, 0.6);
  if (a.marks.vitiligo) {
    const vr = new Rng(a.marks.vitiligo.seed);
    const light = mixHex(skin, '#f2e4d8', 0.75);
    for (let i = 0; i < a.marks.vitiligo.patches; i++) {
      const px = cx + vr.range(-W * 0.7, W * 0.7), py = cy + vr.range(-30, 40);
      const pts = Array.from({ length: 7 }, (_, k) => {
        const ang = (k / 7) * Math.PI * 2, rr = vr.range(3, 8);
        return [px + rr * Math.cos(ang), py + rr * Math.sin(ang)];
      });
      s += `<path d="${smoothClosed(pts)}" fill="${light}" opacity="0.9"/>`;
    }
  }
  if (a.marks.freckles) {
    const n = Math.round(10 + a.marks.freckles * 30);
    const fc = shadeHex(skin, 0.68);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const x = cx + side * rng.range(2, W * 0.75), y = cy + rng.range(4, 20) + Math.abs(x - cx) * 0.1;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rng.range(0.5, 1.1))}" fill="${fc}" opacity="0.7"/>`;
    }
  }
  for (const m of a.marks.moles) s += `<circle cx="${f(cx - W + m.x * 2 * W)}" cy="${f(cy - 40 + m.y * 90)}" r="0.9" fill="${shadeHex(skin, 0.35)}"/>`;
  if (a.marks.birthmark) s += `<ellipse cx="${f(cx - W + a.marks.birthmark.x * 2 * W)}" cy="${f(cy - 40 + a.marks.birthmark.y * 90)}" rx="4" ry="2.6" fill="${mixHex(skin, '#7a3b2e', 0.3)}" opacity="0.6"/>`;
  if (v.wrinkles > 0.05) {
    const o = f(v.wrinkles * 0.75);
    s += `<g fill="none" stroke="${shadow}" stroke-width="0.8" opacity="${o}" stroke-linecap="round">`;
    s += `<path d="M${cx - 16},${cy - 30} q16,-3 32,0"/>`;
    if (v.wrinkles > 0.4) s += `<path d="M${cx - 12},${cy - 35} q12,-2 24,0"/>`;
    s += `<path d="M${cx - 13},${cy + 20} q-6,8 -4,16"/><path d="M${cx + 13},${cy + 20} q6,8 4,16"/>`;
    for (const side of [-1, 1]) s += `<path d="M${cx + side * 31},${cy - 6} l${side * 5},-2 M${cx + side * 31},${cy - 3} l${side * 5},1"/>`;
    s += '</g>';
  }
  for (const sc of v.scars) {
    const side = sc.side === 'left' ? -1 : 1;
    const [sx, sy] = sc.location === 'brow' ? [cx + side * 20, cy - 26] : sc.location === 'chin' ? [cx + side * 6, cy + 40] : [cx + side * 24, cy + 6];
    s += `<path d="M${sx - 5},${sy - 6} L${sx + 5},${sy + 7}" stroke="${mixHex(skin, '#d8b0a6', 0.45)}" stroke-width="1.8" stroke-linecap="round"/>`;
    s += `<path d="M${sx - 5},${sy - 6} L${sx + 5},${sy + 7}" stroke="${shadow}" stroke-width="0.5" stroke-dasharray="1.5 2"/>`;
  }
  for (const t of v.tattoos) {
    const tcol = mixHex(shadeHex(skin, 0.3), '#1b2a4a', 0.5);
    const [tx, ty] = t.location === 'forehead' ? [cx, cy - 34] : t.location === 'chin' ? [cx, cy + 42] : [cx - 25, cy + 8];
    s += `<g stroke="${tcol}" stroke-width="1.1" fill="none" opacity="0.85"><path d="M${tx - 6},${ty} l6,-5 l6,5 l-6,5z"/><path d="M${tx},${ty - 9} v-3 M${tx},${ty + 9} v3"/></g>`;
  }
  return s;
}

function facialHairSvg(style, g, color, rng, skin) {
  if (style === 'none') return '';
  const { cx, cy, H, W, my } = g;
  if (style === 'stubble') {
    let s = `<g fill="${color}" opacity="0.45">`;
    for (let i = 0; i < 160; i++) {
      const ang = rng.range(0.1, Math.PI - 0.1);
      const rr = rng.range(0.55, 1);
      const x = cx + Math.cos(ang) * W * 0.85 * rr, y = cy + 10 + Math.sin(ang) * (H - 8) * rr;
      if (Math.abs(x - cx) < 14 && y < my + 4 && y > my - 6) continue;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="0.5"/>`;
    }
    return s + '</g>';
  }
  const moustache = [[cx - 15, my - 1], [cx - 8, my - 7], [cx, my - 6], [cx + 8, my - 7], [cx + 15, my - 1], [cx, my - 3]];
  if (style === 'moustache') return `<path d="${smoothClosed(moustache)}" fill="${color}"/>`;
  const depth = style === 'full-beard' ? 18 : 9;
  const beard = [
    [cx - W * 0.92, cy + 4], [cx - W * 0.8, cy + H * 0.6], [cx - 14, cy + H + depth * 0.6], [cx, cy + H + depth], [cx + 14, cy + H + depth * 0.6],
    [cx + W * 0.8, cy + H * 0.6], [cx + W * 0.92, cy + 4], [cx + W * 0.75, cy + 18], [cx + 16, my - 5], [cx, my - 7], [cx - 16, my - 5], [cx - W * 0.75, cy + 18],
  ];
  const mouthGap = `<ellipse cx="${cx}" cy="${my + 2}" rx="11" ry="5" fill="${mixHex(skin, '#7a3d3a', 0.3)}" opacity="0.9"/>`;
  return `<g>${hairMass(beard, 'curly', color, rng, { strands: false }).replace(/r="[\d.]+"/g, (m) => `r="${f(parseFloat(m.slice(3)) * 0.5)}"`)}${mouthGap}</g>`;
}

function hairSvg(a, v, g, color, rng) {
  const { cx, cy, W, H, hairlineY } = g;
  const tex = a.hair.texture;
  const style = v.hairStyle;
  const curl = TEXTURE_CURL[tex];
  const vol = { straight: 4, wavy: 6, curly: 9, coily: 11, 'tightly-coiled': 12 }[tex];
  const back = [];
  const front = [];

  const cap = (extra, sideDrop = 8) => {
    const outer = arc(cx, cy - 6, W + extra, H + extra - 2, Math.PI * 1.04, Math.PI * 1.96, 16);
    const right = [[cx + W + extra * 0.5, cy + sideDrop]];
    const left = [[cx - W - extra * 0.5, cy + sideDrop]];
    const hairline = [
      [cx + W - 2, cy - 6],
      [cx + W * 0.7, hairlineY + 6],
      [cx + W * 0.25, hairlineY],
      [cx - W * 0.25, hairlineY],
      [cx - W * 0.7, hairlineY + 6],
      [cx - W + 2, cy - 6],
    ];
    return [...left, ...outer, ...right, ...hairline];
  };

  if (style === 'headwrap') {
    const wrapColor = `hsl(${(a.clothingHue + 140) % 360} 45% 38%)`;
    const pts = [[cx - W - 4, cy - 10], ...arc(cx, cy - 18, W + 10, H + 4, Math.PI * 1.05, Math.PI * 1.95, 14), [cx + W + 4, cy - 10], [cx + W * 0.4, cy - H * 0.55], [cx - W * 0.4, cy - H * 0.55]];
    const top = arc(cx + 6, cy - H - 8, 26, 16, Math.PI, Math.PI * 2, 10);
    front.push(`<path d="${smoothClosed(pts)}" fill="${wrapColor}"/>`);
    front.push(`<path d="${smoothClosed([...top, [cx + 26, cy - H + 6], [cx - 16, cy - H + 4]])}" fill="${wrapColor}" stroke="rgba(0,0,0,.25)" stroke-width="0.8"/>`);
    front.push(`<g stroke="rgba(0,0,0,.22)" stroke-width="1" fill="none"><path d="M${cx - W},${cy - 30} Q${cx},${cy - H - 10} ${cx + W},${cy - 44}"/><path d="M${cx - W + 6},${cy - 18} Q${cx},${cy - H} ${cx + W - 4},${cy - 30}"/></g>`);
    return { back: '', front: front.join('') };
  }
  if (style === 'shaved') {
    front.push(hairMass(cap(1, -4), tex, color, rng, { opacity: 0.35, strands: false }));
    return { back: '', front: front.join('') };
  }
  if (style === 'afro') {
    const r = W + 18 + vol;
    const pts = arc(cx, cy - 20, r, r * 0.92, Math.PI * 0.85, Math.PI * 2.15, 26);
    back.push(hairMass(pts, tex, color, rng));
    front.push(hairMass(cap(3, 4), tex, color, rng));
    return { back: back.join(''), front: front.join('') };
  }
  const longLen = { shoulder: cy + 46, long: 222, braids: 214, locs: 210, twists: cy + 40 }[style];
  if (longLen && style !== 'braids' && style !== 'locs' && style !== 'twists') {
    const pts = [...arc(cx, cy - 8, W + vol + 4, H + vol, Math.PI * 1.0, Math.PI * 2.0, 16), [cx + W + vol + 8, longLen - 10], [cx + W * 0.7, longLen], [cx - W * 0.7, longLen], [cx - W - vol - 8, longLen - 10]];
    back.push(hairMass(pts, tex, color, rng));
  }
  if (style === 'braids' || style === 'locs' || style === 'twists') {
    const strands = style === 'braids' ? 7 : style === 'locs' ? 10 : 12;
    const sw = style === 'braids' ? 6 : style === 'locs' ? 5.5 : 4.5;
    const dark = shadeHex(color, 0.65);
    let g2 = '<g>';
    for (let i = 0; i < strands; i++) {
      const t = i / (strands - 1);
      const x0 = cx - W - 4 + t * (2 * W + 8);
      const side = x0 < cx ? -1 : 1;
      if (Math.abs(x0 - cx) < W * 0.55) continue; // face area — only side and back strands hang visibly
      const xEnd = x0 + side * rng.range(4, 12);
      const yEnd = longLen - rng.range(0, 14);
      g2 += `<path d="M${f(x0)},${f(cy - 20)} Q${f(x0 + side * 8)},${f((cy + yEnd) / 2)} ${f(xEnd)},${f(yEnd)}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
      if (style !== 'locs') g2 += `<path d="M${f(x0)},${f(cy - 20)} Q${f(x0 + side * 8)},${f((cy + yEnd) / 2)} ${f(xEnd)},${f(yEnd)}" stroke="${dark}" stroke-width="${sw * 0.7}" fill="none" stroke-dasharray="2 2.4"/>`;
    }
    for (let i = 0; i < 5; i++) {
      const x0 = cx - W * 0.5 + i * W * 0.25;
      g2 += `<path d="M${f(x0)},${f(cy - 30)} Q${f(x0 + rng.range(-6, 6))},${f(cy + 30)} ${f(x0 + rng.range(-4, 4))},${f(longLen - 6)}" stroke="${shadeHex(color, 0.85)}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
    }
    back.push(g2 + '</g>');
    front.push(hairMass(cap(style === 'locs' ? 6 : 3, 2), tex === 'straight' ? 'straight' : tex, color, rng));
    if (style === 'braids') {
      // cornrow parting lines over the cap
      let rows = `<g stroke="${dark}" stroke-width="0.9" fill="none" opacity="0.8">`;
      for (let i = -3; i <= 3; i++) rows += `<path d="M${f(cx + i * 6)},${f(hairlineY)} Q${f(cx + i * 9)},${f(cy - H - 4)} ${f(cx + i * 12)},${f(cy - H - 2)}"/>`;
      front.push(rows + '</g>');
    }
    return { back: back.join(''), front: front.join('') };
  }
  const capExtra = { 'close-crop': 2 + curl * 0.3, short: vol, shoulder: vol, long: vol, bun: Math.min(vol, 6), topknot: Math.min(vol, 5) }[style] ?? vol;
  front.push(hairMass(cap(capExtra, style === 'close-crop' ? -2 : 8), tex, color, rng));
  if (style === 'shoulder' || style === 'long') {
    // side curtains framing the face
    for (const side of [-1, 1]) {
      const pts = [[cx + side * (W - 6), cy - 18], [cx + side * (W + vol + 6), cy - 14], [cx + side * (W + vol + 4), longLen - 14], [cx + side * (W - 2), longLen - 20], [cx + side * (W + 1), cy + 10]];
      front.push(hairMass(pts, tex, color, rng));
    }
  }
  if (style === 'bun') back.push(hairMass(arc(cx, cy - H - 10, 18, 15, 0, Math.PI * 2, 14).slice(0, -1), tex, color, rng));
  if (style === 'topknot') front.push(hairMass(arc(cx, cy - H - 8, 11, 9, 0, Math.PI * 2, 12).slice(0, -1), tex, color, rng));
  return { back: back.join(''), front: front.join('') };
}

/** Render a portrait. Options: { size, background } */
export function renderPortrait(a, { size = 200, title } = {}) {
  const v = visibleAppearance(a);
  const rng = Rng.stream(a.seed, `portrait:${a.age}:${a.events.length}`);
  const g = geometry(a, v);
  const { cx, cy, W, H } = g;
  const skin = a.skin.hex;
  const skinShadow = shadeHex(skin, 0.7);
  const skinHi = featurePalette(skin).highlight;
  const hairColor = v.hairHex;
  const bg = `hsl(${(a.clothingHue + 190) % 360} 18% 86%)`;
  const cloth = `hsl(${a.clothingHue} 32% 34%)`;
  const clothHi = `hsl(${a.clothingHue} 30% 44%)`;
  const buildIdx = ['slight', 'lean', 'average', 'sturdy', 'broad', 'heavy'].indexOf(a.body.build) + v.buildShift;
  const shoulder = (g.child ? 52 : 64) + clamp(buildIdx, 0, 5) * 4;
  const neckW = 14 + clamp(buildIdx, 0, 5) * 1.2;
  const uid = `p${(a.seed + a.age).replace(/[^a-z0-9]/gi, '').slice(-12)}${rng.int(0, 1e6)}`;

  const hair = hairSvg(a, v, g, hairColor, rng);
  const parts = [];
  parts.push(`<defs><radialGradient id="${uid}f" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="${skinHi}" stop-opacity="0.35"/><stop offset="0.55" stop-color="${skin}" stop-opacity="0"/><stop offset="1" stop-color="${skinShadow}" stop-opacity="0.55"/></radialGradient></defs>`);
  parts.push(`<rect width="200" height="240" fill="${bg}"/>`);
  parts.push(hair.back);
  // neck + shoulders
  parts.push(`<path d="M${cx - neckW},${cy + 30} L${cx - neckW - 1},${cy + 82} L${cx + neckW + 1},${cy + 82} L${cx + neckW},${cy + 30}Z" fill="${skin}"/>`);
  parts.push(`<path d="M${cx - neckW},${cy + 44} Q${cx},${cy + 58} ${cx + neckW},${cy + 44} L${cx + neckW},${cy + 56} Q${cx},${cy + 66} ${cx - neckW},${cy + 56}Z" fill="${skinShadow}" opacity="0.5"/>`);
  parts.push(`<path d="M${cx - shoulder},240 L${cx - shoulder + 4},${cy + 100} Q${cx - shoulder + 10},${cy + 80} ${cx - neckW - 6},${cy + 76} Q${cx},${cy + 96} ${cx + neckW + 6},${cy + 76} Q${cx + shoulder - 10},${cy + 80} ${cx + shoulder - 4},${cy + 100} L${cx + shoulder},240Z" fill="${cloth}"/>`);
  parts.push(`<path d="M${cx - neckW - 6},${cy + 76} Q${cx},${cy + 96} ${cx + neckW + 6},${cy + 76}" fill="none" stroke="${clothHi}" stroke-width="3"/>`);
  // ears
  const earR = 6 + a.face.earSize * 3;
  for (const side of [-1, 1]) {
    parts.push(`<ellipse cx="${f(cx + side * (W - 1))}" cy="${cy + 2}" rx="${f(earR * 0.6)}" ry="${f(earR)}" fill="${skin}"/>`);
    parts.push(`<ellipse cx="${f(cx + side * (W))}" cy="${cy + 2}" rx="${f(earR * 0.3)}" ry="${f(earR * 0.6)}" fill="${skinShadow}" opacity="0.6"/>`);
  }
  // face
  const facePath = smoothClosed(g.outline);
  parts.push(`<path d="${facePath}" fill="${skin}"/>`);
  parts.push(`<path d="${facePath}" fill="url(#${uid}f)"/>`);
  // cheekbone contour
  const cheekO = f(0.1 + a.face.cheekbones * 0.22);
  for (const side of [-1, 1]) parts.push(`<ellipse cx="${f(cx + side * (W - 9))}" cy="${cy + 14}" rx="7" ry="11" fill="${skinShadow}" opacity="${cheekO}" transform="rotate(${side * -18} ${f(cx + side * (W - 9))} ${cy + 14})"/>`);
  parts.push(`<ellipse cx="${cx - 10}" cy="${cy - 28}" rx="14" ry="6" fill="${skinHi}" opacity="0.22"/>`);
  parts.push(marksSvg(a, v, g, skin, rng));
  parts.push(eyesSvg(a, v, g, skin, rng));
  parts.push(noseMouthSvg(a, v, g, skin));
  if (a.age >= 16) parts.push(facialHairSvg(v.facialHair, g, shadeHex(hairColor, 0.95), rng, skin));
  parts.push(hair.front);
  if (v.spectacles) {
    parts.push(`<g fill="none" stroke="#3a3330" stroke-width="1.4"><circle cx="${cx - 17}" cy="${cy - 4}" r="11"/><circle cx="${cx + 17}" cy="${cy - 4}" r="11"/><path d="M${cx - 6},${cy - 5} q6,-3 12,0 M${cx - 28},${cy - 6} L${cx - W},${cy - 8} M${cx + 28},${cy - 6} L${cx + W},${cy - 8}"/></g>`);
  }
  const label = title ?? `Portrait of character ${a.id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="${size}" height="${Math.round(size * 1.2)}" role="img" aria-label="${escapeXml(label)}"><title>${escapeXml(label)}</title>${parts.join('')}</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}
