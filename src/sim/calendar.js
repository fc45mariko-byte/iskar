// Calendrier : jour 0 = 1er janvier 1920.

import { monthName } from '../world/fr.js';

const EPOCH = Date.UTC(1920, 0, 1);
const DAY_MS = 86400000;

export function dateOf(day) {
  const d = new Date(EPOCH + day * DAY_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}
export function dayOf(y, m, d) {
  return Math.round((Date.UTC(y, m, d) - EPOCH) / DAY_MS);
}
export function fmtDate(day, { year = true } = {}) {
  const { y, m, d } = dateOf(day);
  return `${d === 1 ? '1er' : d} ${monthName(m)}${year ? ` ${y}` : ''}`;
}
export function fmtMonth(day) {
  const { y, m } = dateOf(day);
  const n = monthName(m);
  return `${n[0].toUpperCase()}${n.slice(1)} ${y}`;
}
