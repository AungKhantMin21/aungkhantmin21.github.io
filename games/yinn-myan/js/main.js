// Yinn Myan (ယာဉ်မြန်) — game shell: state machine, HUD, menu, main loop.
import * as THREE from 'three';
import { $, clamp, fmtKs, makeRng, isTouch } from './core/util.js';
import { CARS, SOUND } from './data/cars.js';
import { loadRoad } from './sim/road.js';
import { createVehicleSim } from './sim/vehicle.js';
import { createControls } from './input/controls.js';
import { createAudio } from './audio/audio.js';
import { createStage } from './render/stage.js';
import { createTextures } from './render/textures.js';
import { buildWorld, bakeStatic, signalState } from './render/world.js';
import { buildCar, setCarTextures } from './render/car-model.js';

const STORE = { car: 'pyay-car', steer: 'pyay-steer' }; // keys kept from v6 so saved choices survive
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

const road = await loadRoad(new URL('../data/road.json', import.meta.url));
const SC = await fetch(new URL('../data/scenery.json', import.meta.url)).then((r) => (r.ok ? r.json() : null)).catch(() => null); // real surroundings (tools/scenery.py)
const { CL, RD, project, FINISH_S } = road;

const audio = createAudio(SOUND);
const game = { t: 0 };
let state = 'menu', shake = 0, toastTimer = 0, orbit = 0, lastImpactT = -9;

const controls = createControls({
  isTouch,
  onReset: () => { if (state === 'drive') resetToLane(); },
  onPause: () => { if (state === 'drive' || state === 'pause') togglePause(); },
});
const { input, keys } = controls;

const IMPACTS = []; // recent impacts, for tests and debugging
const KIND_NAME = { median: 'Hit the median', curb: 'Hit the curb', barricade: 'Hit a barricade', end: 'Ran out of road', parapet: 'Hit the flyover barrier', ramp: 'Hit the flyover ramp wall' };
const sim = createVehicleSim(road, input, {
  onBlow: (b) => audio.blow(b),
  onImpact: ({ vn, kind, dmg }) => {
    const kmh = vn * 3.6;
    const ip = project(car.x, car.z, car.hint); IMPACTS.push({ s: Math.round(ip.s), d: +ip.d.toFixed(1), kind, kmh: Math.round(kmh), layer: car.layer });
    if (IMPACTS.length > 50) IMPACTS.shift();
    if (game.t - lastImpactT > 0.6 && kmh > 6) {
      lastImpactT = game.t;
      toast(`${KIND_NAME[kind]} at ${Math.round(kmh)} km/h`, `Repair bill +${fmtKs(dmg * sim.spec.value * 0.55)}${car.damage > 0.5 ? ' · steering pulls, engine weak' : ''}`, kmh > 25);
      audio.crash(Math.min(1, vn / 12)); shake = Math.min(0.6, vn * 0.05);
    }
  },
  onTotal: () => { if (state === 'drive') setTimeout(() => endRun('total'), 900); },
});
const car = sim.car;
sim.spec = CARS[0];
sim.easy = store.get(STORE.steer) !== 'real';

// ---------------- rendering ----------------
const stage = createStage();
const { renderer, scene, camera, sky, sun, SUN_DIR } = stage;
const R = makeRng();
let TEX = null, SIGNALS = [], carMesh = null;

// ---------------- game ----------------
function toast(h, s, bad) { $('toastH').textContent = h; $('toastS').textContent = s; $('toastH').className = 'h' + (bad ? ' bad' : ''); $('toast').classList.add('show'); toastTimer = 3; }
function resetToLane() {
  const p = project(car.x, car.z, car.hint); const s = clamp(p.s, 10, CL.len - 20);
  car.repair += 150000; toast('Towed back to the lane', 'Tow truck +150,000 Ks', false);
  const keep = {}; ['damage', 'repair', 'fines', 'fuel', 'kwh', 'time', 'crashes', 'reds'].forEach((k) => (keep[k] = car[k]));
  sim.resetCar(false, s, car.layer); Object.assign(car, keep, { lastS: s }); // stays on the deck if it was up there
}
function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
function energyText() {
  if (sim.spec.ev) { const co2 = car.kwh * 0.45; return [car.kwh.toFixed(2) + ' kWh · ' + co2.toFixed(1) + ' kg', co2]; }
  const co2 = car.fuel * 2.31; return [car.fuel.toFixed(2) + ' L · ' + co2.toFixed(1) + ' kg', co2];
}
function endRun(why) {
  if (state !== 'drive') return; state = 'end'; $('topbtns').hidden = true;
  const SPEC = sim.spec;
  const km = Math.max(0, (clamp(car.lastS, 0, CL.len) - 30) / 1000);
  $('endH').textContent = why === 'total' ? `${SPEC.short} written off` : 'Made it to St. John';
  $('endMy').textContent = why === 'total' ? 'ကားပျက်ပြီ' : 'ရောက်ပြီ';
  $('endP').textContent = why === 'total' ? `The ${SPEC.short} is beyond repair. On a real road this is where someone gets hurt, and the bank still wants its money.` : 'You got there. Here is what the run actually cost.';
  const [en, co2] = energyText(); const energyCost = SPEC.ev ? car.kwh * 350 : car.fuel * 2600; const total = car.repair + car.fines + energyCost;
  $('endStats').innerHTML = `<div>Time<b>${fmtTime(car.time)}</b></div><div>Distance<b>${km.toFixed(2)} km</b></div><div>Crashes<b>${car.crashes}</b></div>
   <div>Repairs<b>${fmtKs(car.repair)}</b></div><div>Fines<b>${fmtKs(car.fines)}</b></div><div>Red lights<b>${car.reds}</b></div>
   <div>${SPEC.ev ? 'Energy' : 'Fuel'}<b>${en.split(' · ')[0]}</b></div><div>CO₂<b>${co2.toFixed(1)} kg</b></div><div>Total cost<b class="bad">${fmtKs(total)}</b></div>`;
  $('endOv').hidden = false; $('againBtn').focus();
}
function updateSignals() {
  let nearest = null;
  for (const sg of SIGNALS) {
    const st = signalState(sg, game.t); sg.state = st;
    sg.lamps.forEach((l, i) => { const on = (st === 'red' && i === 0) || (st === 'amber' && i === 1) || (st === 'green' && i === 2); l.material.emissive.setHex(on ? l.userData.on : 0x000000); l.material.color.setHex(on ? l.userData.on : 0x111111); });
    const ahead = sg.stop - car.lastS; if (ahead > -2 && ahead < 170 && (!nearest || ahead < nearest.ahead)) nearest = { ahead, st };
  }
  const Lc = $('light');
  if (state === 'drive' && nearest && car.lastDside > 0 && car.layer !== 1) {
    Lc.classList.add('on'); const c = { red: '#ef5350', amber: '#f3b13a', green: '#4cc38a' }[nearest.st];
    $('lightDot').style.background = c; $('lightTxt').textContent = `${nearest.st[0].toUpperCase() + nearest.st.slice(1)} light · ${Math.max(0, Math.round(nearest.ahead))} m`;
  } else Lc.classList.remove('on');
}
function checkRedLights(prevS, s, d) {
  if (d <= 0 || car.layer === 1) return; // the flyover passes over the junction signals
  for (const sg of SIGNALS) if (prevS < sg.stop && s >= sg.stop && sg.state === 'red') { car.fines += 50000; car.reds++; toast('Ran a red light', 'Traffic fine +50,000 Ks', true); audio.ding(); }
}

const DEBUG_CAM = { on: false };
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(); let camInit = false;
const _tp = new THREE.Vector3(), _tl = new THREE.Vector3();
function render(dt) {
  const SPEC = sim.spec;
  if (carMesh) {
    carMesh.rotation.order = 'YXZ'; // yaw, then pitch and roll about the car's own axes
    carMesh.position.set(car.x, car.y, car.z); carMesh.rotation.y = car.h;
    const latA = car.vx * car.r; const rollK = SPEC.truck ? 0.011 : 0.0065;
    carMesh.rotation.z = clamp(latA * rollK, -0.09, 0.09); carMesh.rotation.x = clamp(car.ax * 0.0045, -0.05, 0.05) - Math.atan(car.grade);
    carMesh.position.y = car.y + (SPEC.truck ? Math.abs(carMesh.rotation.z) * 0.3 : 0);
    const wh = carMesh.userData.wheels; const roll = car.vx / SPEC.wr * dt;
    wh.forEach((w) => { w.w.rotation.x += roll * (car.spin > 0.05 && (SPEC.drive === 'RWD') !== w.front ? 1 + car.spin * 3 : 1); if (w.front) w.piv.rotation.y = car.steer; });
    const braking = (input.brake > 0.1 && car.gear > 0) || input.hand; carMesh.userData.tlMat.emissiveIntensity = braking ? 3.5 : 0.35;
  }
  const fx = Math.sin(car.h), fz = Math.cos(car.h); const speed = Math.hypot(car.vx, car.vy);
  if (state === 'menu') { // slow orbit around the parked car
    orbit += dt * 0.18; const r = SPEC.L * 1.35 + 1.6; _tp.set(car.x + Math.sin(orbit) * r, car.y + 1.3 + SPEC.H * 0.25, car.z + Math.cos(orbit) * r); _tl.set(car.x, car.y + SPEC.H * 0.42, car.z);
    camPos.copy(_tp); camLook.copy(_tl); camInit = false;
  } else {
    const back = SPEC.L * 1.15 + 1.3 + speed * 0.02, up = SPEC.H + 0.85 + speed * 0.008;
    const cy = car.y - car.grade * back; // camera follows the ramp behind the car
    _tp.set(car.x - fx * back, cy + up, car.z - fz * back); _tl.set(car.x + fx * 4, car.y + car.grade * 4 + SPEC.H * 0.75, car.z + fz * 4);
    if (!camInit) { camPos.copy(_tp); camLook.copy(_tl); camInit = true; }
    camPos.lerp(_tp, 1 - Math.exp(-dt * 6.5)); camLook.lerp(_tl, 1 - Math.exp(-dt * 10));
  }
  camera.position.copy(camPos); sky.position.copy(camPos);
  if (DEBUG_CAM.on) { // tests: put the camera exactly where a reference photo was taken
    camera.position.set(DEBUG_CAM.x, DEBUG_CAM.y, DEBUG_CAM.z); sky.position.copy(camera.position);
    if (camera.view && camera.view.enabled) camera.clearViewOffset();
    camera.fov = DEBUG_CAM.fov; camera.lookAt(DEBUG_CAM.lx, DEBUG_CAM.ly, DEBUG_CAM.lz); camera.updateProjectionMatrix();
    sun.target.position.set(DEBUG_CAM.lx, 0, DEBUG_CAM.lz); sun.position.set(DEBUG_CAM.lx + SUN_DIR.x * 120, SUN_DIR.y * 120, DEBUG_CAM.lz + SUN_DIR.z * 120);
    renderer.render(scene, camera); return;
  }
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.8); }
  const w = innerWidth, h = innerHeight;
  if (state === 'menu' && w > h) camera.setViewOffset(w, h, -w * 0.24, 0, w, h); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  camera.lookAt(camLook); camera.fov = (state === 'menu' ? 42 : 58) + clamp(speed * 0.22, 0, 11); camera.updateProjectionMatrix();
  // shadow camera follows the car, snapped to shadow texels so edges don't shimmer
  { const tx = car.x + fx * 10, tz = car.z + fz * 10, step = 64 / sun.shadow.mapSize.x; const sx = Math.round(tx / step) * step, sz = Math.round(tz / step) * step;
    sun.target.position.set(sx, car.y, sz); sun.position.set(sx + SUN_DIR.x * 120, car.y + SUN_DIR.y * 120, sz + SUN_DIR.z * 120); }
  renderer.render(scene, camera);
}
function hud() {
  const SPEC = sim.spec;
  const kmh = Math.abs(car.vx) * 3.6; $('spd').textContent = Math.round(kmh);
  $('gearTxt').textContent = SPEC.ev ? (car.gear < 0 ? 'R' : 'D') : (car.gear < 0 ? 'R' : 'D' + car.gear);
  const rp = clamp(car.rpm / SPEC.red, 0, 1); const rf = $('rpmFill'); rf.style.width = (SPEC.ev ? clamp(car.load, 0, 1) * 100 : rp * 100) + '%'; rf.classList.toggle('red', !SPEC.ev && car.rpm > SPEC.red - 600);
  $('rpmLbl').textContent = SPEC.ev ? 'Power' : Math.round(car.rpm / 10) * 10 + ' rpm';
  const dm = clamp(car.damage, 0, 1); $('dmgTxt').textContent = Math.round(dm * 100) + '%'; const df = $('dmgFill'); df.style.width = (dm * 100) + '%'; df.style.background = dm < 0.3 ? '#4cc38a' : dm < 0.65 ? '#f3b13a' : '#ef5350';
  $('repTxt').textContent = fmtKs(car.repair); $('repTxt').classList.toggle('bad', car.repair > 0);
  $('fineTxt').textContent = fmtKs(car.fines); $('fineTxt').classList.toggle('bad', car.fines > 0);
  $('fuelLbl').textContent = SPEC.ev ? 'Energy · CO₂' : 'Fuel · CO₂'; $('fuelTxt').textContent = energyText()[0];
  { const s0 = car.lastS; const n = RD.landmarks.find((l) => l.s > s0 + 15); $('nextTxt').textContent = n ? `Next: ${n.name} · ${n.s - s0 > 950 ? ((n.s - s0) / 1000).toFixed(1) + ' km' : Math.round((n.s - s0) / 10) * 10 + ' m'}` : 'Next: City Mall St. John'; }
  $('routeFill').style.width = (clamp((car.lastS - 30) / (CL.len - 60), 0, 1) * 100) + '%'; $('distTxt').textContent = (Math.max(0, car.lastS - 30) / 1000).toFixed(2) + ' km';
}
function setHud(on) { ['route', 'money', 'dash'].forEach((id) => ($(id).style.display = on ? '' : 'none')); $('touch').style.visibility = on ? 'visible' : 'hidden'; $('topbtns').hidden = !on; }
const resize = stage.resize;
addEventListener('resize', resize);
const portrait = () => isTouch && innerHeight > innerWidth;

// ---------------- menu ----------------
function selectCar(i) {
  sim.spec = CARS[i]; store.set(STORE.car, sim.spec.id);
  if (carMesh) scene.remove(carMesh); carMesh = buildCar(sim.spec); scene.add(carMesh); sim.resetCar(true);
  document.querySelectorAll('.car').forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
  const s = sim.spec;
  $('spec').innerHTML = `<div>Engine<b>${s.ev ? 'Electric' : s.engine.split(' ')[0]}</b></div><div>Power<b>${s.ps}</b></div><div>Torque<b>${s.nm}</b></div><div>Weight<b>${(s.mass - 75).toLocaleString()} kg</b></div>
    <div>Drive<b>${s.drive}</b></div><div>Gearbox<b>${s.box}</b></div><div>0–100<b id="zt">…</b></div><div>Top speed<b id="vt">…</b></div>
    <div class="wide">${s.name} · ${s.engine}.</div>`;
  $('carName').textContent = s.short; audio.setProfile(s);
  setTimeout(() => { const r = sim.simulateAccel(); $('zt').textContent = r.t100 ? r.t100.toFixed(1) + ' s' : '—'; $('vt').textContent = Math.round(r.vmax) + ' km/h'; }, 20);
}
{
  const wrap = $('cars');
  CARS.forEach((c, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'car'; b.id = 'car-' + c.id;
    b.innerHTML = `<b>${c.short}</b><span>${c.sub}</span>`; b.addEventListener('click', () => selectCar(i)); wrap.appendChild(b);
  });
}
function syncSteer() {
  $('stEasy').setAttribute('aria-pressed', sim.easy ? 'true' : 'false'); $('stReal').setAttribute('aria-pressed', sim.easy ? 'false' : 'true');
  store.set(STORE.steer, sim.easy ? 'easy' : 'real');
}
$('stEasy').addEventListener('click', () => { sim.easy = true; syncSteer(); });
$('stReal').addEventListener('click', () => { sim.easy = false; syncSteer(); });
syncSteer();
function start() {
  if (portrait()) return;
  $('menuOv').hidden = true; $('endOv').hidden = true; $('pauseOv').hidden = true;
  audio.init(); audio.resume(); sim.resetCar(true); camInit = false; game.t = 0; state = 'drive'; setHud(true);
  // try to go fullscreen + lock landscape on phones (works on Android Chrome; iOS ignores it)
  if (isTouch) {
    const el = document.documentElement;
    try { const p = el.requestFullscreen && el.requestFullscreen({ navigationUI: 'hide' }); if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {}); } catch (e) {}
  }
}
function toMenu() { state = 'menu'; $('endOv').hidden = true; $('pauseOv').hidden = true; $('menuOv').hidden = false; setHud(false); sim.resetCar(true); input.throttle = input.brake = input.steer = 0; }
function togglePause() {
  if (state === 'drive') { state = 'pause'; $('pauseOv').hidden = false; audio.suspend(); }
  else if (state === 'pause') { state = 'drive'; $('pauseOv').hidden = true; audio.resume(); }
}
$('startBtn').addEventListener('click', start); $('againBtn').addEventListener('click', start); $('garageBtn').addEventListener('click', toMenu);
$('pauseBtn').addEventListener('click', togglePause); $('resumeBtn').addEventListener('click', togglePause); $('quitBtn').addEventListener('click', () => { audio.resume(); toMenu(); });
$('sndBtn').addEventListener('click', () => {
  audio.mute(!audio.muted); $('sndBtn').classList.toggle('off', audio.muted); $('sndWave').style.display = audio.muted ? 'none' : '';
  $('sndBtn').setAttribute('aria-label', audio.muted ? 'Turn sound on' : 'Turn sound off');
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'drive') togglePause(); });
addEventListener('resize', () => { if (portrait() && state === 'drive') togglePause(); });

// ---------------- loop ----------------
let last = performance.now(), hudT = 0, audioT = 0;
const QUAL = { pr: renderer.getPixelRatio(), max: renderer.getPixelRatio(), acc: 0, n: 0, cool: 3 };
function governQuality(dt) {
  if (state !== 'drive') return; QUAL.acc += dt; QUAL.n++; QUAL.cool -= dt;
  if (QUAL.acc >= 2) {
    const fps = QUAL.n / QUAL.acc; QUAL.acc = 0; QUAL.n = 0; if (QUAL.cool > 0) return;
    if (fps < 54) {
      if (QUAL.pr > 0.8) { QUAL.pr = Math.max(0.7, QUAL.pr - 0.2); renderer.setPixelRatio(QUAL.pr); resize(); QUAL.cool = 2; }
      else if (sun.shadow.mapSize.x > 1024) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map && sun.shadow.map.dispose(); sun.shadow.map = null; QUAL.cool = 2; }
      else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); }); QUAL.cool = 2; }
      else if (camera.far > 330) { camera.far = 330; scene.fog.far = 300; scene.fog.near = 50; QUAL.cool = 2; }
    } else if (fps > 59 && QUAL.pr < QUAL.max - 0.05 && QUAL.cool < -6) { QUAL.pr = Math.min(QUAL.max, QUAL.pr + 0.1); renderer.setPixelRatio(QUAL.pr); resize(); QUAL.cool = 4; }
  }
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const SPEC = sim.spec;
  if (state === 'drive') {
    controls.read(dt); const steps = Math.ceil(dt / (1 / 240)); const h = dt / steps;
    for (let i = 0; i < steps; i++) sim.step(h);
    const p = project(car.x, car.z, car.hint); car.hint = p.i; checkRedLights(car.lastS, p.s, p.d); car.lastS = p.s; car.lastDside = p.d;
    car.time += dt; game.t += dt;
    if (p.s > FINISH_S && p.d > 0) endRun('finish');
    if (car.damage > 0.6 && Math.random() < dt * 2) shake = Math.max(shake, 0.03);
  } else if (state !== 'pause') { game.t += dt; }
  if (state !== 'pause') {
    updateSignals(); audioT -= dt;
    if (audioT <= 0) {
      audioT = 1 / 30;
      audio.update({ rpm: SPEC.ev ? car.rpm : Math.max(car.rpm, SPEC.idle), load: state === 'drive' ? car.load : 0, boost: car.boost || 0, speed: Math.abs(car.vx), slip: state === 'drive' ? car.slip + car.spin * 0.4 : 0, on: 1 });
    }
  }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
  hudT -= dt; if (hudT <= 0 && state !== 'menu') { hud(); hudT = 0.08; }
  governQuality(dt); render(dt); requestAnimationFrame(frame);
}

// ---------------- boot ----------------
async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('700 34px Padauk'), document.fonts.load('800 44px "Saira Condensed"')]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) {}
  await new Promise((r) => setTimeout(r, 30));
  const T0 = performance.now();
  const tx = createTextures(renderer, R); TEX = tx.TEX; setCarTextures(TEX);
  const T1 = performance.now();
  SIGNALS = buildWorld({ scene, road, decks: sim.surface.decks, SC, TEX, R, canvasTex: tx.canvasTex, signTex: tx.signTex }).SIGNALS;
  const T2 = performance.now();
  window.__cells = bakeStatic(scene, sun); window.__boot = [T1 - T0, T2 - T1, performance.now() - T2].map(Math.round);
  resize(); setHud(false);
  $('startBtn').disabled = false; $('startBtn').textContent = 'Start engine';
  const k = CARS.findIndex((c) => c.id === store.get(STORE.car));
  selectCar(k >= 0 ? k : 0); requestAnimationFrame(frame);
  // start the engine sound on the menu after the first tap anywhere
  addEventListener('pointerdown', () => audio.init(), { once: true });
}

// test hooks (tests/sim.py)
window.__pyay = window.__yinn = {
  allowed: sim.allowed, raisedAt: road.raisedAt, JUNCTIONS: road.JUNCTIONS, get CLlen() { return CL.len; }, collide: sim.collide, project,
  teleport(s, layer = 0) { sim.resetCar(false, s, layer); car.lastS = s; camInit = false; },
  step: sim.step, decks: sim.surface.decks, impacts: IMPACTS, debugCam: DEBUG_CAM, medAt: road.medAt, curbAt: road.curbAt,
  renderInfo: () => renderer.info.render, setEasy(v) { sim.easy = v; }, readInput: controls.read, physics: sim.physics, frameAt: road.frameAt,
  get t() { return game.t; }, scene, renderer, get ENV() { return stage.ENV; }, car, input, CARS, get SPEC() { return sim.spec; }, start, keys, selectCar,
  simulateAccel: sim.simulateAccel, get state() { return state; },
};

await boot();
