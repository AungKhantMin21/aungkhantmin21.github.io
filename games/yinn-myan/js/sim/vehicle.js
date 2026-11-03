// Vehicle simulation: bicycle model with weight transfer, Pacejka-like tyres, combined slip,
// engine/gearbox/torque converter/turbo, EV motor, damage. Ported unchanged from v6.
// The sim knows nothing about rendering or UI; it reports impacts and blow-off through `events`.
import { clamp, lerp } from '../core/util.js';
import { LANE_W } from './road.js';
import { createDecks } from './deck.js';

const G = 9.81;

function tire(alpha, Fz, mu) { return mu * Math.max(0, Fz) * Math.sin(1.45 * Math.atan(12 * alpha)); } // road tyre: peak near 9°, keeps ~75% grip when sliding

/**
 * @param {ReturnType<import('./road.js').createRoad>} road
 * @param {{throttle:number,brake:number,steer:number,hand:number}} input
 * @param {{onBlow?:(boost:number)=>void, onImpact?:(e:{vn:number,vt:number,kind:string,dmg:number})=>void, onTotal?:()=>void}} events
 */
export function createVehicleSim(road, input, events = {}) {
  const { frameAt, medAt, curbAt, raisedAt, gapAt, project, JUNCTIONS } = road;
  const surface = createDecks(road);
  const car = {};
  const sim = { car, spec: null, easy: true, surface };

  function torqueCurve(rpm) {
    const c = sim.spec.curve; if (rpm <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i++) { if (rpm <= c[i][0]) { const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return lerp(c[i - 1][1], c[i][1], t); } }
    return c[c.length - 1][1];
  }

  /** put the car in a lane at s; layer 1 = on the deck covering s (if any) */
  function resetCar(full, s, layer = 0) {
    const SPEC = sim.spec;
    s = s === undefined ? 30 : s; const f = frameAt(s);
    const deck = layer === 1 ? surface.decks.find((k) => s >= k.s0 && s <= k.s1) : null;
    const d = deck ? deck.centre(s) : medAt(s) + LANE_W * 1.5;
    Object.assign(car, {
      layer: deck ? 1 : 0, deck, y: deck ? deck.y(s) : 0, grade: 0,
      x: f.x + f.nx * d, z: f.z + f.nz * d, h: Math.atan2(f.tx, f.tz), vx: 0, vy: 0, r: 0, ax: 0, steer: 0, gear: 1, rpm: SPEC.idle || 0, hint: Math.round(s),
      spin: 0, slip: 0, revHold: 0, shiftT: 0, boost: 0, load: 0, wheelSpin: 0,
    });
    if (full) Object.assign(car, { damage: 0, repair: 0, fines: 0, fuel: 0, kwh: 0, time: 0, crashes: 0, lastS: s, reds: 0, lastDside: 1 });
  }

  function physics(dt) {
    const S = sim.spec, EASY = sim.easy, dmgK = 1 - car.damage * 0.55; const v = car.vx; const speed = Math.hypot(car.vx, car.vy);
    let thr = input.throttle, brk = input.brake;
    if (car.gear > 0) { if (Math.abs(v) < 0.4 && brk > 0.5 && thr < 0.05) { car.revHold += dt; if (car.revHold > 0.5) { car.gear = -1; car.revHold = 0; } } else car.revHold = 0; }
    else { const t = thr; thr = brk; brk = t; if (v > -0.3 && brk > 0.3) { car.gear = 1; brk = 0; } }
    let Fx = 0;
    if (S.ev) {
      const ratio = S.gears[0]; const motorRpm = Math.abs(v) / S.wr * ratio * 60 / (2 * Math.PI); car.rpm = motorRpm;
      const w = Math.max(1, motorRpm * 2 * Math.PI / 60); let Tq = Math.min(S.evT, S.evP / w) * thr * dmgK; if (motorRpm > S.evMax || Math.abs(v) * 3.6 > S.vlim) Tq = 0;
      // regenerative braking on lift-off
      let regen = 0; if (thr < 0.05 && Math.abs(v) > 1.5) regen = -Math.sign(v) * S.mass * G * 0.11;
      Fx = Tq * ratio * 0.92 / S.wr * (car.gear > 0 ? 1 : -1) + regen; car.load = thr;
      car.kwh += Math.max(0, (Tq * w) / 0.88 - (regen * v < 0 ? Math.abs(regen * v) * 0.6 : 0)) * dt / 3.6e6 + 0.0003 * dt / 3.6;
    } else {
      const ratio = car.gear > 0 ? S.gears[car.gear - 1] : 3.0;
      const wheelRpm = Math.abs(v) / S.wr * 60 / (2 * Math.PI); const lockRpm = wheelRpm * ratio * S.final;
      // torque converter: engine can run above wheel speed; stall speed ~2200 rpm at full throttle
      const conv = S.idle + thr * (2300 - S.idle); const rpm = Math.max(lockRpm, lerp(S.idle, conv, clamp(1 - lockRpm / conv, 0, 1)), S.idle);
      if (car.shiftT > 0) { car.shiftT -= dt; }
      car.rpm = lerp(car.rpm, rpm, clamp(dt * 14, 0, 1));
      // boost builds with lag above ~2000 rpm
      if (S.turbo) {
        const tgt = thr > 0.3 && car.rpm > 1900 ? clamp((car.rpm - 1900) / 900, 0, 1) * thr : 0; car.boost += (tgt - car.boost) * clamp(dt * (tgt > car.boost ? 1.6 : 4), 0, 1);
        if (car.boost > 0.55 && thr < 0.15 && !car.blown) { car.blown = true; events.onBlow && events.onBlow(car.boost); }
        if (thr > 0.3) car.blown = false;
      }
      // automatic: shift points depend on throttle (light foot = early shifts)
      if (car.gear > 0 && car.shiftT <= 0) {
        const up = lerp(2300, S.red - 250, thr * thr), dn = lerp(1150, 2900, thr);
        if (car.rpm > up && car.gear < S.gears.length && lockRpm > up * 0.95) { car.gear++; car.shiftT = 0.32; }
        else if (car.rpm < dn && car.gear > 1) { const nr = lockRpm * S.gears[car.gear - 2] / S.gears[car.gear - 1]; if (nr < S.red - 400) { car.gear--; car.shiftT = 0.25; } }
      }
      let Tq = torqueCurve(car.rpm); if (S.turbo) Tq *= 0.6 + 0.4 * car.boost;
      if (S.vlim && Math.abs(v) * 3.6 > S.vlim) Tq = 0; // JDM 180 km/h speed limiter
      if (car.rpm > S.red) Tq = 0; // limiter
      Tq *= thr * dmgK; if (car.shiftT > 0) Tq *= 0.25;
      // engine braking off throttle
      const eb = thr < 0.05 ? -0.12 * torqueCurve(car.rpm) * (car.rpm / S.red) : 0;
      const mult = car.gear > 0 ? 1 : -1;
      Fx = (Tq + eb * (Math.abs(v) > 0.5 ? 1 : 0)) * ratio * S.final * S.eff / S.wr * mult;
      // creep in Drive with no pedals
      if (thr < 0.05 && brk < 0.05 && Math.abs(v) < 2.2) Fx += mult * 420 * (1 - Math.abs(v) / 2.2);
      car.load = thr;
      const P = Math.max(0, Tq * car.rpm * 2 * Math.PI / 60) / 1000; car.fuel += (P * S.fuel.gpk / 3600 + 0.12 + 0.06 * car.rpm / 1000) * dt / 740;
    }
    const Fzf = S.mass * G * S.b / S.wb - S.mass * car.ax * S.hcg / S.wb, Fzr = S.mass * G * S.a / S.wb + S.mass * car.ax * S.hcg / S.wb;
    const mu = S.mu; const driveFz = S.drive === 'FWD' ? Fzf : Fzr;
    const maxFx = mu * driveFz * 0.98; let spin = 0;
    if (EASY && Math.abs(Fx) > maxFx * 0.85 && Math.sign(Fx) === Math.sign(v || 1)) Fx = Math.sign(Fx) * maxFx * 0.85; // traction control
    if (Math.abs(Fx) > maxFx) { spin = (Math.abs(Fx) - maxFx) / maxFx; Fx = Math.sign(Fx) * maxFx; }
    let Fb = 0; if (brk > 0 && Math.abs(v) > 0.05) Fb = -Math.sign(v) * brk * mu * S.mass * G * 0.92;
    if (input.hand && Math.abs(v) > 0.05) Fb += -Math.sign(v) * mu * Fzr * 0.7;
    const Fdrag = -0.5 * 1.2 * S.cd * S.area * v * Math.abs(v) - (Math.abs(v) > 0.1 ? Math.sign(v) * 0.013 * S.mass * G : 0);
    // steering ratio narrows with speed so that full input always lands near the grip limit (turns hard at 120 km/h, never twitchy at 30)
    const vv = Math.max(Math.abs(v), 6), x = input.steer, curve = x * (0.45 + 0.55 * Math.abs(x));
    const dMax = Math.min(0.6, Math.atan(S.wb * 0.95 * S.mu * G / (vv * vv)) * 1.2 + 0.008);
    let d = curve * dMax * (v < 0 ? -1 : 1);
    d += car.damage * 0.025; car.steer = d;
    const vxe = Math.max(Math.abs(v), 1.5), sg = v >= 0 ? 1 : -1;
    const af = Math.atan2(car.vy + S.a * car.r, vxe) - d * sg, ar = Math.atan2(car.vy - S.b * car.r, vxe);
    // combined slip: drive/brake force uses up lateral grip on that axle (RWD power-oversteer, FWD understeer)
    const fDrive = S.drive === 'FWD' ? Math.abs(Fx) : 0, rDrive = S.drive === 'RWD' ? Math.abs(Fx) : 0;
    const frontUse = clamp((fDrive + Math.abs(Fb) * 0.65) / (mu * Fzf), 0, 0.985), rearUse = clamp((rDrive + Math.abs(Fb) * 0.35 + (spin > 0 && S.drive === 'RWD' ? mu * Fzr * 0.5 : 0)) / (mu * Fzr), 0, 0.985);
    const muRear = input.hand ? mu * 0.42 : mu * 1.08; // road-car setup: rear grips a little more, so the limit is a gentle push wide, not a spin
    let Fyf = -tire(af, Fzf, mu) * Math.sqrt(1 - frontUse * frontUse), Fyr = -tire(ar, Fzr, muRear) * Math.sqrt(1 - rearUse * rearUse);
    if (Math.abs(v) < 1.5) { const k = Math.abs(v) / 1.5; Fyf *= k; Fyr *= k; }
    const dvx = (Fx + Fb + Fdrag - Fyf * Math.sin(d)) / S.mass - G * car.grade + car.vy * car.r; // grade: gravity along a ramp
    const dvy = (Fyr + Fyf * Math.cos(d)) / S.mass - car.vx * car.r;
    const dr = (S.a * Fyf * Math.cos(d) - S.b * Fyr) / S.Iz;
    const vxOld = car.vx; car.vx += dvx * dt; car.vy += dvy * dt; car.r += dr * dt;
    if (Math.abs(v) < 1.5) { car.vy *= 1 - clamp(dt * 8, 0, 1); car.r = lerp(car.r, car.vx * Math.tan(d) / S.wb, clamp(dt * 10, 0, 1)); }
    else if (EASY && !input.hand) {
      // stability control: only acts when the car starts to slide (oversteer), pulling yaw back to what the wheels ask for
      const rkin = car.vx * Math.tan(d) / S.wb, rlim = 0.9 * S.mu * G / Math.max(Math.abs(car.vx), 3); const rk = Math.sign(rkin) * Math.min(Math.abs(rkin), rlim); const beta = Math.atan2(car.vy, Math.abs(car.vx));
      if (Math.abs(beta) > 0.06 || Math.abs(car.r) > Math.abs(rk) * 1.25 + 0.05) { car.r += (rk - car.r) * clamp(dt * 3.5, 0, 1); car.vy *= 1 - clamp(dt * 1.5, 0, 1); }
    }
    if (brk > 0 && Math.sign(vxOld) !== Math.sign(car.vx) && Math.abs(car.vx) < 0.5) car.vx = 0;
    if (thr < 0.05 && brk > 0.3 && Math.abs(car.vx) < 0.1) car.vx = 0;
    car.ax = lerp(car.ax, (car.vx - vxOld) / dt, 0.2);
    const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = fz, lz = -fx;
    car.x += (fx * car.vx + lx * car.vy) * dt; car.z += (fz * car.vx + lz * car.vy) * dt; car.h += car.r * dt;
    car.spin = spin; car.slip = Math.max(Math.abs(ar), Math.abs(af)) * (speed > 4 ? 1 : 0) + (spin > 0.05 && speed < 25 ? spin * 0.5 : 0);
  }

  function allowed(s, d, layer = 0, deck = null) {
    const ad = Math.abs(d), side = d >= 0 ? 1 : -1;
    if (s < -2 || s > road.len + 2) return { ok: false, kind: 'end' };
    if (layer === 1 && deck && deck.interior(s)) return deck.inStrip(s, d) ? { ok: true } : { ok: false, kind: 'parapet' }; // up on the deck: only its parapets matter
    if (layer === 0) { const b = surface.streetBlock(s, d); if (b) return { ok: false, kind: 'ramp', block: b }; }
    if (raisedAt(s) && ad < medAt(s) && !gapAt(s, 0)) return { ok: false, kind: 'median' };
    const cb = curbAt(s); if (ad > cb) { const j = gapAt(s, side); if (!j) return { ok: false, kind: 'curb' }; if (ad > cb + 55) return { ok: false, kind: 'barricade' }; }
    return { ok: true };
  }

  function collide() {
    const SPEC = sim.spec;
    const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = fz, lz = -fx; const hw = SPEC.W / 2, hl = SPEC.L / 2;
    let worst = null;
    for (const [cf, cl] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [0, hw], [0, -hw]]) {
      const x = car.x + fx * cf + lx * cl, z = car.z + fz * cf + lz * cl; const p = project(x, z, car.hint); const a = allowed(p.s, p.d, car.layer, car.deck); if (a.ok) continue;
      const f = frameAt(p.s); let pen, nx, nz; const ad = Math.abs(p.d), side = p.d >= 0 ? 1 : -1;
      if (a.kind === 'median') { pen = medAt(p.s) - ad; nx = f.nx * side; nz = f.nz * side; }
      else if (a.kind === 'curb') {
        pen = ad - curbAt(p.s); nx = -f.nx * side; nz = -f.nz * side;
        const j = JUNCTIONS.find((j) => (j.side === 0 || j.side === side) && Math.abs(p.s - j.s) < j.w / 2 + 8);
        if (j) { const lo = j.s - j.w / 2, hi = j.s + j.w / 2; const ps = p.s < lo ? lo - p.s : p.s - hi; if (ps < pen) { pen = ps; const s2 = p.s < lo ? 1 : -1; nx = f.tx * s2; nz = f.tz * s2; } }
      }
      else if (a.kind === 'parapet') { // keep inside the deck strip
        const L = car.deck.left(p.s), Rr = car.deck.right(p.s);
        if (p.d > Rr) { pen = p.d - Rr; nx = -f.nx; nz = -f.nz; } else { pen = L - p.d; nx = f.nx; nz = f.nz; }
        if (pen > 1) { // deep on the left = in the northbound lanes where the decks split: hit the gore wall end-on
          for (let k = 1; k <= 12; k++) {
            const sj = [p.s - k, p.s + k].find((q) => car.deck.joined(q));
            if (sj !== undefined) { if (k < pen) { pen = k; const s2 = sj < p.s ? -1 : 1; nx = f.tx * s2; nz = f.tz * s2; } break; }
          }
        }
      }
      else if (a.kind === 'ramp') { // keep out of the solid ramp: push to the nearer side
        const { l, r } = a.block;
        if (p.d - l < r - p.d) { pen = p.d - l; nx = -f.nx; nz = -f.nz; } else { pen = r - p.d; nx = f.nx; nz = f.nz; }
      }
      else if (a.kind === 'barricade') { pen = ad - (curbAt(p.s) + 55); nx = -f.nx * side; nz = -f.nz * side; }
      else { pen = p.s < 0 ? -p.s : p.s - road.len; const s2 = p.s < 0 ? 1 : -1; nx = f.tx * s2; nz = f.tz * s2; }
      if (!worst || pen > worst.pen) worst = { pen, nx, nz, kind: a.kind, cf, cl };
    }
    if (!worst) return;
    car.x += worst.nx * (worst.pen + 0.01); car.z += worst.nz * (worst.pen + 0.01);
    let wx = fx * car.vx + lx * car.vy, wz = fz * car.vx + lz * car.vy;
    const rpx = fx * worst.cf + lx * worst.cl, rpz = fz * worst.cf + lz * worst.cl;
    const vn = (wx + car.r * rpz) * worst.nx + (wz - car.r * rpx) * worst.nz;
    if (vn < 0) {
      const J = -(1.18) * vn; wx += worst.nx * J * 0.9; wz += worst.nz * J * 0.9;
      const tx = -worst.nz, tz = worst.nx; const vt = wx * tx + wz * tz; wx -= tx * vt * 0.18; wz -= tz * vt * 0.18;
      car.r += (rpx * worst.nz - rpz * worst.nx) * J * 0.12; car.r *= 0.8; car.vx = wx * fx + wz * fz; car.vy = wx * lx + wz * lz;
      impact(-vn, Math.abs(vt), worst.kind);
    }
  }

  function impact(vn, vt, kind) {
    if (vn < 0.8) { addDamage(vt * 0.0006); return; }
    // impact energy scales with mass x speed²; light cars crumple sooner, repair bills scale with the car's value
    const massK = Math.sqrt(sim.spec.mass / 1200); const k = (kind === 'curb' ? 0.0055 : kind === 'median' ? 0.0062 : 0.0075) * massK;
    const dmg = vn * vn * k; addDamage(dmg); car.crashes++;
    events.onImpact && events.onImpact({ vn, vt, kind, dmg });
  }

  function addDamage(d) {
    car.damage = Math.min(1.2, car.damage + d); car.repair += d * sim.spec.value * 0.55;
    if (car.damage >= 1) events.onTotal && events.onTotal();
  }

  // measure the car's real 0–100 and top speed by running the physics, so the numbers always match the model
  function simulateAccel() {
    const saveInput = { ...input }, saveCar = { ...car }, saveEvents = { ...events };
    for (const k of Object.keys(events)) delete events[k];
    resetCar(true); input.throttle = 1; input.brake = 0; input.steer = 0; input.hand = 0;
    let t = 0, t100 = null, vmax = 0; const dt = 1 / 120;
    for (let i = 0; i < 120 * 90; i++) {
      physics(dt); t += dt; const k = car.vx * 3.6; if (!t100 && k >= 100) t100 = t; if (k > vmax) vmax = k;
      car.x = 0; car.z = 0; car.h = 0; car.vy = 0; car.r = 0; if (t > 40 && k < vmax - 0.1) break;
    }
    Object.assign(input, saveInput); Object.assign(car, saveCar); Object.assign(events, saveEvents); resetCar(true);
    return { t100, vmax };
  }

  /** one 240 Hz substep: which surface we're on, then physics, then collisions */
  function step(dt) {
    surface.updateSurface(car, project(car.x, car.z, car.hint));
    physics(dt); collide();
  }

  return Object.assign(sim, { resetCar, physics, collide, allowed, simulateAccel, step });
}
