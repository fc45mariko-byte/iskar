// Deterministic, seedable randomness. Every subsystem draws from its own named
// stream so that, e.g., appearance and social-role generation never share state.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return h >>> 0;
}

export class Rng {
  constructor(seed) {
    this.state = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0 || 0x9e3779b9;
  }

  /** Independent child stream: same parent seed + label always yields the same stream. */
  static stream(seed, label) {
    return new Rng(hashString(`${seed}::${label}`));
  }

  next() {
    // mulberry32
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  chance(p) {
    return this.next() < p;
  }

  normal(mean = 0, sd = 1) {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Marsaglia–Tsang gamma sampler (shape k, scale 1). */
  gamma(k) {
    if (k < 1) return this.gamma(k + 1) * Math.pow(this.next() || 1e-12, 1 / k);
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do {
        x = this.normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = this.next();
      if (u < 1 - 0.0331 * x ** 4) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  /** Dirichlet sample around `weights` with total concentration `alpha`. */
  dirichlet(weights, alpha) {
    const keys = Object.keys(weights);
    const draws = keys.map((k) => this.gamma(Math.max(1e-3, weights[k] * alpha)));
    const sum = draws.reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(keys.map((k, i) => [k, draws[i] / sum]));
  }

  /** Pick a key from a {key: weight} table. */
  weighted(table) {
    const entries = Object.entries(table).filter(([, w]) => w > 0);
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let r = this.next() * total;
    for (const [k, w] of entries) {
      if ((r -= w) <= 0) return k;
    }
    return entries[entries.length - 1][0];
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
}

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
