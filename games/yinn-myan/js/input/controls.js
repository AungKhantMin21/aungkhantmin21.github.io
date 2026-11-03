// Keyboard + analog touch steering. Thumb pad: the further you slide, the harder you turn.
// Keys ramp to full lock in ~0.3 s. No steering assists of any kind.
import { $, clamp } from '../core/util.js';

/** @param {{isTouch:boolean, onReset:()=>void, onPause:()=>void}} opts */
export function createControls({ isTouch, onReset, onPause }) {
  const input = { throttle: 0, brake: 0, steer: 0, hand: 0 };
  const keys = {};
  const T = { gas: false, brk: false, hb: false, steerId: null, steer: 0, x0: 0 };

  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyR') onReset();
    if (e.code === 'Escape' || e.code === 'KeyP') onPause();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });

  if (isTouch) {
    document.body.classList.add('touch');
    $('keys').innerHTML = 'Thumb down on the <b>steering pad</b> and slide: the further you slide, the harder you turn · hold <b>BRAKE</b> when stopped to reverse';
  }
  {
    const pad = $('steerPad'), knob = $('knob');
    const range = () => Math.max(60, pad.clientWidth * 0.32);
    pad.addEventListener('pointerdown', (e) => { e.preventDefault(); T.steerId = e.pointerId; T.x0 = e.clientX; T.steer = 0; try { pad.setPointerCapture(e.pointerId); } catch (_) {} pad.classList.add('down'); });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== T.steerId) return; const v = clamp((e.clientX - T.x0) / range(), -1, 1); T.steer = -v; // left positive
      knob.style.transform = `translateX(${v * range()}px)`;
    });
    const end = (e) => { if (e.pointerId !== T.steerId) return; T.steerId = null; T.steer = 0; knob.style.transform = ''; pad.classList.remove('down'); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pad.addEventListener(ev, end));
  }
  [['gas', 'gas'], ['brk', 'brk'], ['hb', 'hb']].forEach(([id, k]) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); T[k] = true; el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (_) {} });
    const up = () => { T[k] = false; el.classList.remove('down'); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, up));
  });
  $('rst').addEventListener('pointerdown', (e) => { e.preventDefault(); onReset(); });

  function read(dt) {
    const gasOn = keys.ArrowUp || keys.KeyW || T.gas, brkOn = keys.ArrowDown || keys.KeyS || T.brk;
    // pedals ramp like a real foot: tap to feather, hold for full
    input.throttle = gasOn ? Math.min(1, input.throttle + dt * 1.6) : Math.max(0, input.throttle - dt * 5);
    input.brake = brkOn ? Math.min(1, input.brake + dt * 3) : Math.max(0, input.brake - dt * 6);
    input.hand = (keys.Space || T.hb) ? 1 : 0;
    const L = keys.ArrowLeft || keys.KeyA, Rr = keys.ArrowRight || keys.KeyD;
    let target;
    if (T.steerId !== null) target = T.steer; // analog thumb position
    else if (L || Rr) target = (L ? 1 : 0) - (Rr ? 1 : 0);
    else target = 0;
    // keys ramp to full lock in ~0.3 s; the thumb pad is filtered lightly so it stays analog
    const rate = T.steerId !== null ? 14 : (target === 0 ? 6 : 3.5);
    input.steer = clamp(input.steer + clamp(target - input.steer, -rate * dt, rate * dt), -1, 1);
  }

  return { input, keys, read };
}
