// Road model built from data/road.json (OpenStreetMap: Pyay Road, Parami -> City Mall St. John).
// The centerline is resampled to exactly 1 m per index, so s (metres along the road) == array index.
// Lateral offset d is positive to the right of the southbound direction of travel.
import { clamp } from '../core/util.js';

export const LANE_W = 3.5;

function buildCenterline(ctrl) {
  const raw = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, ctrl.length - 1)];
    for (let k = 0; k < 10; k++) {
      const t = k / 10, t2 = t * t, t3 = t2 * t;
      raw.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  raw.push(ctrl[ctrl.length - 1]);
  // resample to exactly 1 m spacing
  const out = [raw[0]]; let acc = 0, prev = raw[0];
  for (let i = 1; i < raw.length; i++) {
    const b = raw[i]; let d = Math.hypot(b[0] - prev[0], b[1] - prev[1]);
    while (acc + d >= 1) {
      const t = (1 - acc) / d; const p = [prev[0] + (b[0] - prev[0]) * t, prev[1] + (b[1] - prev[1]) * t];
      out.push(p); prev = p; d = Math.hypot(b[0] - prev[0], b[1] - prev[1]); acc = 0;
    }
    acc += d; prev = b;
  }
  const n = out.length, X = new Float32Array(n), Z = new Float32Array(n), TX = new Float32Array(n), TZ = new Float32Array(n);
  for (let i = 0; i < n; i++) { X[i] = out[i][0]; Z[i] = out[i][1]; }
  for (let i = 0; i < n; i++) {
    const a = Math.max(i - 3, 0), b = Math.min(i + 3, n - 1);
    const tx = X[b] - X[a], tz = Z[b] - Z[a]; const l = Math.hypot(tx, tz) || 1; TX[i] = tx / l; TZ[i] = tz / l;
  }
  return { n, X, Z, TX, TZ, len: n - 1 };
}

export async function loadRoad(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`road data ${res.status}`);
  return createRoad(await res.json());
}

export function createRoad(RD) {
  const JUNCTIONS = RD.junctions.filter((j) => j.s > 40).map((j) => Object.assign({}, j));
  const CL = buildCenterline(RD.cl);

  // per-metre cross-section: median half-width, lanes each way, smoothed curb offset (lane adds/drops taper over ~50 m)
  const MED = new Float32Array(CL.n), LANES = new Uint8Array(CL.n), CURB = new Float32Array(CL.n);
  {
    const k = CL.len / ((RD.med.length - 1) * 5 || 1);
    for (let i = 0; i < CL.n; i++) {
      const f = i / 5 / k; const a = Math.min(RD.med.length - 1, Math.floor(f)), b = Math.min(RD.med.length - 1, a + 1), t = f - a;
      MED[i] = RD.med[a] * (1 - t) + RD.med[b] * t; LANES[i] = RD.lanes[Math.min(RD.lanes.length - 1, Math.round(f))];
    }
    // smooth the median so it never steps
    const m2 = new Float32Array(CL.n);
    for (let i = 0; i < CL.n; i++) { let s = 0, c = 0; for (let j = Math.max(0, i - 20); j <= Math.min(CL.n - 1, i + 20); j++) { s += MED[j]; c++; } m2[i] = s / c; }
    MED.set(m2);
    // taper limit: median width changes at most 1 m per 20 m, so lanes shift the way real road markings do
    for (let i = 1; i < CL.n; i++) MED[i] = Math.min(MED[i], MED[i - 1] + 0.05);
    for (let i = CL.n - 2; i >= 0; i--) MED[i] = Math.min(MED[i], MED[i + 1] + 0.05);
    const raw = new Float32Array(CL.n); for (let i = 0; i < CL.n; i++) raw[i] = MED[i] + LANES[i] * LANE_W + 0.5;
    for (let i = 0; i < CL.n; i++) { let s = 0, c = 0; for (let j = Math.max(0, i - 25); j <= Math.min(CL.n - 1, i + 25); j++) { s += raw[j]; c++; } CURB[i] = s / c; }
  }

  const si = (s) => clamp(Math.round(s), 0, CL.n - 1);
  const medAt = (s) => MED[si(s)], curbAt = (s) => CURB[si(s)], lanesAt = (s) => LANES[si(s)], walkAt = (s) => CURB[si(s)] + 4;
  const raisedAt = (s) => MED[si(s)] > 0.45;
  const frameAt = (s) => { const i = si(s); return { x: CL.X[i], z: CL.Z[i], tx: CL.TX[i], tz: CL.TZ[i], nx: -CL.TZ[i], nz: CL.TX[i] }; };

  function project(x, z, hint) {
    let best = hint, bd = 1e18; const lo = Math.max(0, hint - 80), hi = Math.min(CL.n - 1, hint + 80);
    for (let i = lo; i <= hi; i++) { const dx = x - CL.X[i], dz = z - CL.Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    const dx = x - CL.X[best], dz = z - CL.Z[best];
    return { s: best + dx * CL.TX[best] + dz * CL.TZ[best], d: dx * (-CL.TZ[best]) + dz * CL.TX[best], i: best };
  }
  // global projection (for map features placed by world position), via a coarse grid
  const CLGRID = new Map();
  for (let i = 0; i < CL.n; i += 4) {
    const k = Math.floor(CL.X[i] / 40) + ',' + Math.floor(CL.Z[i] / 40);
    if (!CLGRID.has(k)) CLGRID.set(k, []); CLGRID.get(k).push(i);
  }
  function projectAny(x, z) {
    let best = -1, bd = 1e18; const cx = Math.floor(x / 40), cz = Math.floor(z / 40);
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const L = CLGRID.get((cx + a) + ',' + (cz + b)); if (!L) continue;
      for (const i of L) { const dx = x - CL.X[i], dz = z - CL.Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    }
    if (best < 0) return null; return project(x, z, best);
  }
  // a junction mouth on one side, or (side 0) a median opening — only at cross-roads and signalled junctions
  function gapAt(s, side) {
    for (const j of JUNCTIONS) {
      if (Math.abs(s - j.s) < j.w / 2) {
        if (side === 0) { if (j.side === 0 || j.signal) return j; }
        else if (j.side === 0 || j.side === side) return j;
      }
    }
    return null;
  }

  return {
    RD, CL, JUNCTIONS, MED, LANES, CURB, len: CL.len, FINISH_S: CL.len - 30,
    medAt, curbAt, lanesAt, walkAt, raisedAt, frameAt, project, projectAny, gapAt,
  };
}
