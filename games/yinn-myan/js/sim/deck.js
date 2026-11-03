// Elevated decks (Hledan flyover) as a second drivable layer above the street.
// Everything is in main-road coordinates (s, d), so project()/frameAt() work unchanged:
// a deck is a lateral strip [left(s), right(s)] at height y(s) for s0 <= s <= s1.
//
// Southbound decks are drivable (layer 1). The northbound deck beside it is part of the same
// structure: where both are at full height they are one slab with a painted line between, and the
// player can drift across it. Ramps are separate, with parapets on both sides.
//
// Heights are placeholders (H = 6.8 m, 170 m ramps) until measured from photos of the real flyover.
import { clamp } from '../core/util.js';
import { LANE_W } from './road.js';

export const DECK_SHOULDER = 0.6;   // paved margin between lane edge and parapet
export const CLEARANCE_Y = 4.4;     // below this deck height the ramp is a solid wall for street traffic
export const MOUTH = 6;             // metres at each end where the ramp is level with the street
const MOUTH_SLACK = 0.1;            // extra half-width at the mouths, so a lane-0 car isn't threading a needle

const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

function resampleOffsets(arr, s0, n, road, alignStart, alignEnd, lanes) {
  // per-metre lateral centre, smoothed (OSM traces wobble), and aligned with the street lane
  // it leaves from / lands on, so the ramp mouth sits exactly on a lane
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = i / 5, a = Math.min(arr.length - 1, Math.floor(f)), b = Math.min(arr.length - 1, a + 1), t = f - a;
    raw[i] = arr[a] * (1 - t) + arr[b] * t;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let j = Math.max(0, i - 20); j <= Math.min(n - 1, i + 20); j++) { s += raw[j]; c++; } out[i] = s / c; }
  const BL = 70, half = lanes * LANE_W / 2 + MOUTH_SLACK; // mouth half-width (see hwAt): left edge sits on the median kerb
  for (let i = 0; i < n; i++) {
    const s = s0 + i;
    if (alignStart) { const k = smooth(1 - i / BL); const lane = road.medAt(s) + half; out[i] = out[i] * (1 - k) + lane * k; }
    if (alignEnd) { const k = smooth(1 - (n - 1 - i) / BL); const lane = road.medAt(s) + half; out[i] = out[i] * (1 - k) + lane * k; }
  }
  return out;
}

function makeProfile(s0, s1, H, up, down) {
  return {
    y(s) { if (s < s0 || s > s1) return 0; return H * Math.min(smooth((s - s0 - MOUTH) / up), smooth((s1 - MOUTH - s) / down)); },
    grade(s) { const e = 0.5; return (this.y(s + e) - this.y(s - e)) / (2 * e); },
  };
}

export function createDecks(road) {
  const decks = [];
  for (const D of road.RD.decks || []) {
    const s0 = D.s0, s1 = D.s1, n = Math.floor(s1 - s0) + 1;
    const hw = D.lanes * LANE_W / 2 + DECK_SHOULDER;
    const dc = resampleOffsets(D.dc, s0, n, road, true, true, D.lanes);
    const prof = makeProfile(s0, s1, D.H, D.rampUp, D.rampDown);
    let nb = null;
    if (D.nb) {
      const N = D.nb, nn = Math.floor(N.s1 - N.s0) + 1;
      // northbound centre is negative d: align on the mirrored side, then flip back
      const dcN = resampleOffsets(N.dc.map((v) => -v), N.s0, nn, road, true, true, N.lanes).map((v) => -v);
      nb = { s0: N.s0, s1: N.s1, lanes: N.lanes, hw: N.lanes * LANE_W / 2 + DECK_SHOULDER, dc: dcN, prof: makeProfile(N.s0, N.s1, D.H, D.rampDown, D.rampUp) };
      nb.centre = (s) => nb.dc[clamp(Math.round(s - nb.s0), 0, nn - 1)];
      nb.y = (s) => nb.prof.y(s);
    }
    const deck = {
      name: D.name, s0, s1, H: D.H, lanes: D.lanes, hw, nb,
      y: (s) => prof.y(s), grade: (s) => prof.grade(s),
      centre: (s) => dc[clamp(Math.round(s - s0), 0, n - 1)],
      /** the two decks form one slab here (both at full height, side by side) */
      joined(s) {
        if (!nb || s < nb.s0 || s > nb.s1) return false;
        return Math.abs(prof.y(s) - D.H) < 0.02 && Math.abs(nb.y(s) - D.H) < 0.02 && this.centre(s) - nb.centre(s) < 12;
      },
      /** half-width: one lane + 2×MOUTH_SLACK at the mouths (ramp starts at the median kerb, barely touches the next lane), full deck width 40 m in */
      hwAt(s) { const k = smooth(Math.min(s - s0, s1 - s) / 40), m = LANE_W * D.lanes / 2 + MOUTH_SLACK; return m + (hw - m) * k; },
      right(s) { return this.centre(s) + this.hwAt(s); },
      left(s) { return this.joined(s) ? nb.centre(s) - nb.hw : this.centre(s) - this.hwAt(s); },
      inStrip(s, d) { return s >= s0 && s <= s1 && d > this.left(s) && d < this.right(s); },
      inMouth(s) { return (s >= s0 && s <= s0 + MOUTH) || (s >= s1 - MOUTH && s <= s1); },
      interior(s) { return s > s0 + MOUTH && s < s1 - MOUTH; },
    };
    decks.push(deck);
  }

  /** which deck (if any) a street-level point is blocked by: the solid ramp below clearance height */
  function streetBlock(s, d) {
    for (const k of decks) {
      if (k.interior(s) && k.y(s) < CLEARANCE_Y && d > k.centre(s) - k.hwAt(s) && d < k.right(s)) return { deck: k, l: k.centre(s) - k.hwAt(s), r: k.right(s) };
      const nb = k.nb;
      if (nb && s > nb.s0 + MOUTH && s < nb.s1 - MOUTH && nb.y(s) < CLEARANCE_Y) {
        const c = nb.centre(s); if (d > c - nb.hw && d < c + nb.hw) return { deck: k, l: c - nb.hw, r: c + nb.hw };
      }
    }
    return null;
  }

  /** update car.layer / car.deck / car.y / car.grade from the car centre's road position */
  function updateSurface(car, p) {
    let deck = car.layer === 1 ? car.deck : null;
    if (deck && (p.s < deck.s0 || p.s > deck.s1)) deck = null;           // drove off either end
    else if (deck && deck.inMouth(p.s) && !deck.inStrip(p.s, p.d)) deck = null; // slid off the side where it's level
    if (!deck) for (const k of decks) if (k.inMouth(p.s) && k.inStrip(p.s, p.d)) { deck = k; break; } // drove onto a ramp
    car.layer = deck ? 1 : 0; car.deck = deck;
    if (deck) {
      const fx = Math.sin(car.h), fz = Math.cos(car.h);
      const f = road.frameAt(p.s); const along = fx * f.tx + fz * f.tz; // heading relative to the road
      car.y = deck.y(p.s); car.grade = deck.grade(p.s) * along;
    } else { car.y = 0; car.grade = 0; }
  }

  return { decks, streetBlock, updateSurface };
}
