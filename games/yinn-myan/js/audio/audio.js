// Audio graph: engine synth (AudioWorklet, ScriptProcessor fallback) -> master -> street reverb + compressor.
import { EngineDSP } from './dsp.js';

export function createAudio(soundProfiles) {
  let ctx = null, node = null, dsp = null, master = null, muted = false, ready = false, usingWorklet = false, pendingProfile = null;

  async function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
    // short street-reflection reverb for weight
    const conv = ctx.createConvolver(); const len = ctx.sampleRate * 0.45 | 0; const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * 0.6; }
    conv.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.18;
    master.connect(comp); master.connect(conv); conv.connect(wet); wet.connect(comp); comp.connect(ctx.destination);
    try {
      if (!ctx.audioWorklet) throw new Error('no worklet');
      await ctx.audioWorklet.addModule(new URL('./engine-worklet.js', import.meta.url));
      node = new AudioWorkletNode(ctx, 'engine', { outputChannelCount: [2] }); usingWorklet = true;
    } catch (e) {
      dsp = new EngineDSP(ctx.sampleRate);
      node = ctx.createScriptProcessor(1024, 0, 2);
      node.onaudioprocess = (ev) => { const L = ev.outputBuffer.getChannelData(0); dsp.process(L, L.length); ev.outputBuffer.getChannelData(1).set(L); };
    }
    node.connect(master); ready = true;
    if (pendingProfile) send({ prof: pendingProfile });
  }
  function send(m) {
    if (!ready) return;
    if (usingWorklet) node.port.postMessage(m);
    else { if (m.prof) dsp.setProfile(m.prof); if (m.t) Object.assign(dsp.t, m.t); if (m.blow) dsp.blow = m.blow; }
  }
  return {
    init,
    setProfile(spec) { pendingProfile = soundProfiles[spec.sound]; send({ prof: pendingProfile }); },
    update(o) { send({ t: o }); },
    blow(b) { send({ blow: 0.6 * b }); },
    crash(v) {
      if (!ctx) return; const t = ctx.currentTime; const n = ctx.sampleRate; const b = ctx.createBuffer(1, n, n); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1);
      const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600 + v * 2500; const g = ctx.createGain();
      g.gain.setValueAtTime(0.7 * v + 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6 + v * 0.5); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 1.3);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(85, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.35);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.9 * v + 0.15, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.4); o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.45);
      // glass + plastic tinkle on big hits
      if (v > 0.5) {
        const s2 = ctx.createBufferSource(); s2.buffer = b; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000; const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.25, t + 0.05); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.9); s2.connect(hp); hp.connect(g2); g2.connect(master); s2.start(t + 0.05); s2.stop(t + 1);
      }
    },
    ding() {
      if (!ctx) return; const t = ctx.currentTime; const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 660; const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
    },
    mute(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    get muted() { return muted; },
  };
}
