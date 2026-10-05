/**
 * Efectos de sonido sintetizados con WebAudio (0 KB de archivos).
 * El audio sólo arranca después del primer toque (regla de los navegadores).
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowd: GainNode | null = null;
  muted = false;

  /** Llamar en el primer gesto del usuario. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);
    this.startCrowd();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  /** Murmullo de estadio: ruido filtrado en loop. */
  private startCrowd(): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.6;
    this.crowd = ctx.createGain();
    this.crowd.gain.value = 0.12;
    src.connect(filter).connect(this.crowd).connect(this.master!);
    src.start();
  }

  /** Ovación (sube el murmullo un momento). */
  cheer(): void {
    if (!this.ctx || !this.crowd) return;
    const t = this.ctx.currentTime;
    this.crowd.gain.cancelScheduledValues(t);
    this.crowd.gain.setTargetAtTime(0.45, t, 0.08);
    this.crowd.gain.setTargetAtTime(0.12, t + 0.8, 0.5);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  coin(): void {
    this.tone(1320, 0.08, 'square', 0.06);
    this.tone(1980, 0.16, 'square', 0.05, undefined, 0.06);
  }
  jump(): void {
    this.tone(330, 0.18, 'triangle', 0.25, 760);
  }
  slide(): void {
    this.noise(0.28, 0.35, 1800);
  }
  lane(): void {
    this.noise(0.08, 0.18, 3000);
  }
  land(): void {
    this.tone(140, 0.08, 'sine', 0.3, 70);
  }
  hit(): void {
    this.tone(180, 0.4, 'sawtooth', 0.25, 50);
    this.noise(0.35, 0.5, 900);
  }
  /**
   * Silbato de árbitro: tono agudo con "trino" (la bolita del silbato vibrando),
   * armónico suave y soplido de aire. Dos pitazos: corto + largo.
   */
  whistle(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const blast = (start: number, dur: number, vol: number) => {
      const t = ctx.currentTime + start;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(vol, t + 0.025);
      out.gain.setValueAtTime(vol, t + dur - 0.07);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2900;
      bp.Q.value = 1.2;
      out.connect(bp).connect(this.master!);

      // Trino: un LFO rápido modula la frecuencia.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 32;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 170;
      lfo.connect(lfoGain);

      for (const [mult, v] of [[1, 1], [2, 0.18]] as const) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2750 * mult, t);
        osc.frequency.linearRampToValueAtTime(2820 * mult, t + 0.05);
        lfoGain.connect(osc.frequency);
        const g = ctx.createGain();
        g.gain.value = v;
        osc.connect(g).connect(out);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      }
      lfo.start(t);
      lfo.stop(t + dur + 0.02);

      // Soplido de aire.
      const len = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const ng = ctx.createGain();
      ng.gain.value = 0.12;
      noise.connect(ng).connect(out);
      noise.start(t);
    };
    blast(0, 0.16, 0.22);
    blast(0.24, 0.55, 0.22);
  }
}
