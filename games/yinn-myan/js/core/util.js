export const $ = (id) => document.getElementById(id);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const fmtKs = (n) => Math.round(n).toLocaleString('en-US') + ' Ks';

/** Seeded random stream. One stream is shared by texture and world generation, in that order,
 *  so the generated scenery is the same on every load. */
export function makeRng(seed = 20261103) {
  let s = seed;
  return () => ((s = Math.imul(s ^ (s >>> 15), s | 1) ^ (s + Math.imul(s ^ (s >>> 7), s | 61))) >>> 0) / 4294967296;
}

export const isTouch = ('ontouchstart' in window) || matchMedia('(pointer:coarse)').matches;
