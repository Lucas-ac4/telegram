import { hashString, rng } from '../util/math';

/**
 * Música generativa con WebAudio (0 KB de archivos).
 *
 * Cada mundo tiene su tonalidad, escala, progresión de acordes, tempo y timbre.
 * Capas: acordes suaves, bajo, arpegio con eco y percusión liviana. En el menú suena
 * tranquila; al jugar entra la percusión y se intensifica a medida que crece la cadena.
 * Los cambios de mundo se aplican al empezar el compás siguiente, sin cortes.
 */

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10],
};

interface Theme {
  /** Nota MIDI de la tónica (octava 4). */
  root: number;
  scale: number[];
  /** Grados de la escala para los acordes de cada compás. */
  prog: number[];
  bpm: number;
  lead: OscillatorType;
  /** Brillo general (corte del filtro en Hz). */
  bright: number;
}

const T = (root: number, scale: keyof typeof SCALES, prog: number[], bpm: number, lead: OscillatorType, bright = 2600): Theme => ({
  root,
  scale: SCALES[scale],
  prog,
  bpm,
  lead,
  bright,
});

/** Un tema por mundo (mismo orden que ZONES). */
const THEMES: Theme[] = [
  T(62, 'major', [0, 5, 3, 4], 84, 'triangle'), // Jardín nocturno
  T(64, 'dorian', [0, 3, 6, 4], 88, 'sine'), // Cascadas
  T(65, 'lydian', [0, 1, 4, 0], 86, 'sine'), // Mar de nubes
  T(57, 'minor', [0, 5, 3, 6], 90, 'triangle'), // Aurora
  T(61, 'lydian', [0, 1, 0, 4], 94, 'square', 2000), // Cosmos
  T(67, 'major', [0, 3, 4, 0], 92, 'triangle'), // Bosque de cerezos
  T(62, 'minor', [0, 6, 5, 4], 100, 'sawtooth', 1600), // Volcán dormido
  T(59, 'minor', [0, 5, 2, 6], 88, 'sine'), // Lago helado
  T(63, 'dorian', [0, 3, 0, 6], 92, 'triangle'), // Arrecife de luz
  T(60, 'minor', [0, 5, 6, 4], 104, 'square', 1800), // Tormenta eléctrica
  T(64, 'mixo', [0, 6, 3, 0], 96, 'triangle'), // Desierto de estrellas
  T(66, 'dorian', [0, 3, 4, 0], 100, 'square', 2200), // Jardín de hongos
  T(58, 'major', [0, 4, 5, 3], 98, 'triangle'), // Ruinas del sol
  T(57, 'major', [0, 4, 5, 3], 102, 'sine'), // Islas flotantes
  T(56, 'lydian', [0, 1, 5, 4], 104, 'triangle'), // Nebulosa rosa
  T(61, 'minor', [0, 5, 3, 4], 96, 'sine'), // Cueva de cristal
  T(62, 'dorian', [0, 3, 6, 0], 104, 'triangle'), // Océano de auroras
  T(55, 'mixo', [0, 6, 3, 0], 108, 'square', 2000), // Ciudad de faroles
  T(64, 'lydian', [0, 1, 4, 5], 110, 'sine'), // Vía Láctea
  T(60, 'major', [0, 4, 5, 3], 116, 'triangle', 3200), // Corazón de la luz
];

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  private out: GainNode;
  private filter: BiquadFilterNode;
  private echo: GainNode;
  private noise: AudioBuffer;
  private theme = THEMES[0];
  private pending: Theme | null = null;
  private world = 0;
  private step = 0;
  private bar = 0;
  private nextTime = 0;
  private timer = 0;
  /** 0 = menú, 1 = jugando, 2 = cadena media, 3 = cadena alta. */
  private intensity = 0;
  private volume = 0.7;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = this.volume;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.theme.bright;
    this.filter.Q.value = 0.4;
    this.filter.connect(this.out).connect(dest);

    // Eco para el arpegio
    const delay = ctx.createDelay(1);
    delay.delayTime.value = (60 / this.theme.bpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    this.echo = ctx.createGain();
    this.echo.gain.value = 0.35;
    this.echo.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(this.filter);

    const len = Math.floor(ctx.sampleRate * 0.25);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  start(): void {
    if (this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  /** Cambia de tema al comienzo del próximo compás. */
  setWorld(z: number): void {
    const theme = THEMES[Math.max(0, Math.min(THEMES.length - 1, z))];
    this.world = z;
    if (theme !== this.theme) this.pending = theme;
  }

  setIntensity(level: number): void {
    this.intensity = level;
  }

  /** Baja la música (derrota, anuncio) o la devuelve a su volumen. */
  duck(on: boolean): void {
    const t = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(on ? this.volume * 0.3 : this.volume, t, 0.25);
    this.filter.frequency.setTargetAtTime(on ? 700 : this.theme.bright, t, 0.3);
  }

  private schedule(): void {
    const ahead = this.ctx.currentTime + 0.15;
    // Si la app estuvo en segundo plano, no se intenta "recuperar" notas viejas.
    if (this.nextTime < this.ctx.currentTime - 0.5) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < ahead) {
      if (this.step === 0 && this.pending) {
        this.theme = this.pending;
        this.pending = null;
        this.filter.frequency.setTargetAtTime(this.theme.bright, this.nextTime, 0.5);
      }
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.theme.bpm / 4;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar++;
    }
  }

  /** Nota MIDI del grado `i` de la escala (puede pasar de octava). */
  private degree(i: number, octave: number): number {
    const sc = this.theme.scale;
    const o = Math.floor(i / sc.length);
    const k = ((i % sc.length) + sc.length) % sc.length;
    return this.theme.root + sc[k] + 12 * (o + octave);
  }

  private playStep(step: number, t: number): void {
    const th = this.theme;
    const chord = th.prog[this.bar % th.prog.length];
    const beat = 60 / th.bpm;
    const lvl = this.intensity;

    // Acordes: suaves, todo el compás
    if (step === 0) {
      for (const k of [0, 2, 4]) this.pad(midiHz(this.degree(chord + k, 0)), t, beat * 4);
    }

    // Bajo
    if (step === 0 || step === 8 || (lvl >= 2 && (step === 6 || step === 14))) {
      const fifth = step === 6 || step === 14;
      this.bass(midiHz(this.degree(chord + (fifth ? 4 : 0), -2)), t, beat * (fifth ? 0.45 : 0.9));
    }

    // Arpegio: negras en el menú, corcheas al jugar, semicorcheas con cadena alta
    const every = lvl === 0 ? 4 : lvl >= 3 ? 1 : 2;
    if (step % every === 0) {
      const r = rng(hashString(`${this.world}:${this.bar % 4}:${step}`));
      const shape = [0, 2, 4, 7, 2, 4, 9, 4];
      const idx = shape[Math.floor(r() * shape.length)];
      const up = lvl >= 2 && r() < 0.3 ? 7 : 0;
      const vol = (every === 1 && step % 2 === 1 ? 0.03 : 0.055) * (lvl === 0 ? 0.8 : 1);
      this.lead(midiHz(this.degree(chord + idx + up, 1)), t, beat * (every === 4 ? 0.9 : 0.35), vol);
    }

    // Percusión liviana (sólo jugando)
    if (lvl >= 1) {
      if (step === 0 || step === 8 || (lvl >= 2 && step === 10)) this.kick(t);
      if (lvl >= 2 && (step === 4 || step === 12)) this.snare(t);
      if (step % 4 === 2) this.hat(t, 0.05);
      else if (lvl >= 3 && step % 2 === 1) this.hat(t, 0.025);
    }
  }

  private env(t: number, attack: number, dur: number, vol: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, dur: number, g: GainNode, dest: AudioNode): void {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pad(freq: number, t: number, dur: number): void {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(this.filter);
    const g = this.env(t, Math.min(0.5, dur * 0.3), dur * 1.05, 0.028);
    this.osc('sawtooth', freq, t, dur, g, lp);
    const g2 = this.env(t, Math.min(0.5, dur * 0.3), dur * 1.05, 0.02);
    this.osc('sawtooth', freq * 1.004, t, dur, g2, lp);
  }

  private bass(freq: number, t: number, dur: number): void {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    lp.connect(this.filter);
    this.osc('triangle', freq, t, dur, this.env(t, 0.01, dur, 0.16), lp);
    this.osc('sine', freq / 2, t, dur, this.env(t, 0.01, dur, 0.1), lp);
  }

  private lead(freq: number, t: number, dur: number, vol: number): void {
    const g = this.env(t, 0.008, dur, vol * (this.theme.lead === 'square' || this.theme.lead === 'sawtooth' ? 0.5 : 1));
    this.osc(this.theme.lead, freq, t, dur, g, this.filter);
    g.connect(this.echo);
  }

  private kick(t: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = this.env(t, 0.004, 0.18, 0.32);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.2);
  }

  private noiseHit(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.env(t, 0.002, dur, vol);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private hat(t: number, vol: number): void {
    this.noiseHit(t, 0.04, vol, 'highpass', 7500);
  }

  private snare(t: number): void {
    this.noiseHit(t, 0.13, 0.07, 'bandpass', 1900);
  }
}
