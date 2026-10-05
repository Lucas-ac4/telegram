/**
 * Sonido sintetizado con WebAudio (0 KB de archivos → carga instantánea).
 * Cada pase suena; los perfectos encadenados suben de nota (escala pentatónica),
 * así un "Perfecto" se escucha distinto sin mirar la pantalla.
 */
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private nextCricket = 0;
  muted = false;

  /** Llamar en el primer gesto del usuario (regla de los navegadores). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state !== 'running') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** Pausa todo el audio (app en segundo plano). */
  suspend(): void {
    void this.ctx?.suspend();
  }

  /** Colchón nocturno suave: dos senoidales graves con respiración lenta. */
  private startAmbient(): void {
    const ctx = this.ctx!;
    this.ambient = ctx.createGain();
    this.ambient.gain.value = 0.045;
    this.ambient.connect(this.master!);
    for (const [f, detune] of [
      [110, 0],
      [164.81, 4],
      [220, -3],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.35;
      lfo.connect(lfoGain).connect(g.gain);
      o.connect(g).connect(this.ambient);
      o.start();
      lfo.start();
    }
  }

  /** Grillos de fondo; se llama desde el loop. */
  tickAmbient(time: number): void {
    if (!this.ctx || this.muted || time < this.nextCricket) return;
    this.nextCricket = time + 2.5 + Math.random() * 4;
    const base = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) this.tone(base, 0.035, 'sine', 0.012, undefined, i * 0.07);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  private noise(dur: number, vol: number, from: number, to: number): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(from, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  /** Pase normal: nota suave según la cadena. */
  pass(chain: number): void {
    const f = PENTA[chain % 5];
    this.tone(f, 0.28, 'triangle', 0.16);
    this.tone(f * 2, 0.18, 'sine', 0.05);
    this.noise(0.12, 0.05, 2500, 6000);
  }

  /** Perfecto: más brillante y sube con la racha. */
  perfect(streak: number): void {
    const f = PENTA[Math.min(PENTA.length - 1, 2 + streak)];
    this.tone(f, 0.4, 'triangle', 0.2);
    this.tone(f * 1.5, 0.32, 'sine', 0.09, undefined, 0.04);
    this.tone(f * 2, 0.5, 'sine', 0.06, undefined, 0.08);
    this.noise(0.25, 0.07, 5000, 9000);
  }

  gold(): void {
    this.tone(1318.5, 0.09, 'square', 0.05);
    this.tone(1975.5, 0.22, 'square', 0.045, undefined, 0.07);
  }

  /** Tic de mecha corta. */
  tick(): void {
    this.tone(1900, 0.03, 'square', 0.035);
  }

  jump(): void {
    this.tone(420, 0.16, 'sine', 0.08, 900);
  }

  fail(): void {
    this.noise(0.5, 0.22, 3000, 300);
    this.tone(330, 0.5, 'triangle', 0.14, 110, 0.04);
  }

  record(): void {
    [0, 2, 4, 7].forEach((n, i) => this.tone(PENTA[n], 0.35, 'triangle', 0.12, undefined, 0.1 + i * 0.09));
  }

  click(): void {
    this.tone(880, 0.06, 'sine', 0.08, 1200);
  }
}
