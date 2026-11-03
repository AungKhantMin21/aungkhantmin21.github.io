// AudioWorklet processor: runs the engine synthesizer off the main thread.
import { EngineDSP } from './dsp.js';

class EngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.d = new EngineDSP(sampleRate);
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.prof) this.d.setProfile(m.prof);
      if (m.t) Object.assign(this.d.t, m.t);
      if (m.blow) this.d.blow = m.blow;
    };
  }
  process(_inputs, outputs) {
    const ch = outputs[0];
    this.d.process(ch[0], ch[0].length);
    for (let c = 1; c < ch.length; c++) ch[c].set(ch[0]);
    return true;
  }
}
registerProcessor('engine', EngineProcessor);
