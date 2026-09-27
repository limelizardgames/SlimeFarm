// All sound is synthesised with WebAudio: no audio assets to license or ship.

type Wave = OscillatorType;

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  sfxOn = true;
  musicOn = true;
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private last: Record<string, number> = {};

  /** Must be called from a user gesture (browsers & iOS require it). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.55 : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.16 : 0;
      this.musicBus.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicOn) this.startMusic();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfxBus.gain.value = on ? 0.55 : 0;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.3);
    if (on) this.startMusic();
  }

  suspend() { this.ctx?.suspend(); }
  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }

  private tone(freq: number, dur: number, opts: { type?: Wave; vol?: number; to?: number; delay?: number; attack?: number; bus?: GainNode; filter?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const v = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(opts.bus ?? this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noiseBuf: AudioBuffer | null = null;
  private noise(dur: number, cutoff: number, vol: number, delay = 0) {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2.5, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  play(name: string) {
    if (!this.ctx || !this.sfxOn) return;
    const now = performance.now();
    if (now - (this.last[name] ?? 0) < 40) return; // de-dupe bursts
    this.last[name] = now;
    const pitch = 1 + (Math.random() - 0.5) * 0.08;
    switch (name) {
      case 'pop': this.tone(520 * pitch, 0.14, { to: 1100, type: 'sine', vol: 0.35 }); break;
      case 'squish':
        this.tone(340 * pitch, 0.16, { to: 170, type: 'triangle', vol: 0.4, filter: 1400 });
        this.tone(900 * pitch, 0.06, { to: 1300, type: 'sine', vol: 0.12, delay: 0.05 });
        break;
      case 'pick': this.tone(380, 0.1, { to: 720, type: 'sine', vol: 0.22 }); break;
      case 'drop': this.tone(520, 0.12, { to: 260, type: 'triangle', vol: 0.25, filter: 1600 }); break;
      case 'thud': this.tone(140, 0.12, { to: 70, type: 'sine', vol: 0.35 }); break;
      case 'nope':
        this.tone(330, 0.1, { type: 'square', vol: 0.08, filter: 1200 });
        this.tone(247, 0.16, { type: 'square', vol: 0.08, filter: 1200, delay: 0.1 });
        break;
      case 'click': this.tone(1200, 0.04, { type: 'triangle', vol: 0.12 }); break;
      case 'coin':
        this.tone(988, 0.08, { type: 'square', vol: 0.07, filter: 3000 });
        this.tone(1319, 0.22, { type: 'square', vol: 0.07, filter: 3000, delay: 0.07 });
        break;
      case 'buy':
        [659, 880, 1175].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.2, delay: i * 0.05 }));
        break;
      case 'merge':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f * pitch, 0.22, { type: 'triangle', vol: 0.22, delay: i * 0.05 }));
        this.tone(2093, 0.3, { type: 'sine', vol: 0.06, delay: 0.2 });
        break;
      case 'fuse':
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.22, delay: i * 0.06 }));
        [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.4, { type: 'sine', vol: 0.06, delay: 0.3 + i * 0.07 }));
        break;
      case 'shiny':
        [1760, 2217, 2637, 3520].forEach((f, i) => this.tone(f, 0.25, { type: 'sine', vol: 0.08, delay: 0.25 + i * 0.06 }));
        break;
      case 'fanfare':
        [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.62]].forEach(([f, d]) =>
          this.tone(f, 0.35, { type: 'triangle', vol: 0.25, delay: d }));
        [262, 330, 392].forEach((f) => this.tone(f, 1.0, { type: 'sine', vol: 0.12, delay: 0.62, attack: 0.05 }));
        break;
      case 'chest':
        this.tone(90, 0.4, { to: 60, type: 'sawtooth', vol: 0.12, filter: 400 });
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.2, delay: 0.35 + i * 0.06 }));
        break;
      case 'whoosh': this.tone(200, 0.25, { to: 900, type: 'sawtooth', vol: 0.05, filter: 1800 }); break;
      case 'open': this.tone(600, 0.08, { to: 900, type: 'sine', vol: 0.12 }); break;
      case 'close': this.tone(700, 0.08, { to: 450, type: 'sine', vol: 0.1 }); break;
      case 'thunder': this.noise(2.2, 180, 0.5); this.tone(55, 1.6, { to: 35, type: 'sine', vol: 0.3, attack: 0.05 }); break;
      case 'chomp':
        [0, 0.12, 0.24].forEach((d) => this.noise(0.07, 1800, 0.25, d));
        this.tone(660, 0.12, { to: 990, type: 'triangle', vol: 0.15, delay: 0.34 });
        break;
      case 'tick': this.tone(1500, 0.03, { type: 'square', vol: 0.05, filter: 3000 }); break;
      case 'flip': this.tone(900, 0.06, { to: 1400, type: 'triangle', vol: 0.12 }); break;
      case 'hurt': this.tone(300, 0.25, { to: 90, type: 'sawtooth', vol: 0.12, filter: 900 }); break;
    }
  }

  // ── background music: a gentle generative marimba loop ────
  private startMusic() {
    if (!this.ctx || this.musicTimer != null) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 100);
  }

  private schedule() {
    const ctx = this.ctx!;
    if (!this.musicOn) { if (this.musicTimer) clearInterval(this.musicTimer); this.musicTimer = null; return; }
    const beat = 60 / 92 / 2; // eighth notes
    // I–vi–IV–V in C major pentatonic flavour
    const chords = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
    const scale = [523.3, 587.3, 659.3, 784, 880, 1046.5];
    while (this.nextNote < ctx.currentTime + 0.3) {
      const bar = Math.floor(this.step / 8) % 4;
      const pos = this.step % 8;
      const delay = this.nextNote - ctx.currentTime;
      if (pos === 0) chords[bar].forEach((f) => this.tone(f / 2, beat * 7, { type: 'sine', vol: 0.12, delay, attack: 0.2, bus: this.musicBus }));
      if (pos === 0 || pos === 4) this.tone(chords[bar][0] / 4, beat * 3, { type: 'triangle', vol: 0.18, delay, bus: this.musicBus });
      const pattern = [1, 0, 1, 1, 0, 1, 0, 1];
      if (pattern[pos] && Math.random() < 0.8) {
        const n = scale[(bar * 2 + Math.floor(Math.random() * 4)) % scale.length];
        this.tone(n, beat * 1.6, { type: 'sine', vol: 0.1, delay, bus: this.musicBus });
        this.tone(n * 4, beat * 0.4, { type: 'sine', vol: 0.015, delay, bus: this.musicBus });
      }
      this.nextNote += beat;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();
