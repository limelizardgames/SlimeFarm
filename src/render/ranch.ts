import { SPECIES, THEMES, TIER_COLORS, type ThemeDef, type Particle as PKind } from '../game/data';
import type { SlimeData, MergeOutcome } from '../game/game';
import { drawSlime, paletteFor, star4, star5, type Mood } from './slimeArt';
import { paintBackground } from './background';
import { lighten, rgba } from './color';
import { WeatherFx } from './weather';
import { FOODS, type FoodId, type WeatherId } from '../game/data';

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────
interface Ent {
  uid: number;
  data: SlimeData;
  x: number; y: number; z: number;
  // hop
  hopFrom: [number, number]; hopTo: [number, number]; hopT: number; hopDur: number; hopH: number;
  hopsLeft: number; idle: number;
  // squash spring
  sq: number; sqV: number;
  lean: number; leanV: number;
  blink: number; blinkT: number;
  look: [number, number];
  mood: Mood; moodT: number;
  facing: number;
  spawn: number;    // 0→1 pop-in
  egg: number;      // >0 while still an egg falling/cracking
  eggY: number; eggV: number;
  state: 'free' | 'held' | 'merging' | 'gone';
  mergeTo?: [number, number]; mergeT: number;
  burp: number;
  ambient: number;
  shake: number;
  seed: number;
}

interface Part {
  kind: 'berry' | 'gem' | 'dot' | 'star' | 'star5' | 'heart' | 'petal' | 'leaf' | 'snow' | 'ring' | 'drop' | 'bubble' | 'text' | 'spark' | 'goo';
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  g: number; rot: number; vr: number; drag: number;
  text?: string; bold?: boolean;
}

export interface RanchHandlers {
  merge(a: number, b: number): MergeOutcome;
  preview(a: SlimeData, b: SlimeData): { kind: 'merge' | 'fuse' | 'fail'; sp?: string; known?: boolean; reason?: string };
  tap(uid: number): { goo: number; gems: number };
  gemFx(x: number, y: number, n: number): void;
  autoFeeding(): boolean;
  release(uid: number): number;
  releaseValue(uid: number): number;
  longPress(uid: number): void;
  gift(): void;
  swipe(dir: number): void;
  isRushing(sl: SlimeData): boolean;
  sfx(name: string): void;
  haptic(kind: 'light' | 'medium' | 'heavy' | 'success'): void;
  fmt(n: number): string;
  rateOf(sl: SlimeData): number;
}

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const back = (t: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// ─────────────────────────────────────────────────────────────
export class Ranch {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  insetTop = 0; insetBottom = 0;
  horizon = 0; penTop = 0; penBottom = 0;
  theme: ThemeDef = THEMES[0];
  bg: HTMLCanvasElement | null = null;
  ents = new Map<number, Ent>();
  private pending = new Set<number>();
  parts: Part[] = [];
  time = 0;
  clouds: { x: number; y: number; s: number; v: number }[] = [];
  ambient: { x: number; y: number; vx: number; vy: number; ph: number }[] = [];
  flash = 0;
  shakeScreen = 0;

  // interaction
  private press: { uid: number | null; x: number; y: number; t: number; id: number; dragging: boolean; lp: number } | null = null;
  private hover: { uid: number; kind: 'merge' | 'fuse' | 'fail'; label: string } | null = null;
  private overSell = false;
  private pointer: [number, number] = [0, 0];

  gift: { x: number; y: number; t: number; dir: number; alive: boolean; pop: number } | null = null;
  giftTimer = 70;
  paused = false;
  wx = new WeatherFx();
  foodHover: number | null = null;
  private combo = { uid: -1, n: 0, t: 0 };
  private feedTimer = 1;

  constructor(canvas: HTMLCanvasElement, private h: RanchHandlers) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.bindInput();
    for (let i = 0; i < 5; i++) this.clouds.push({ x: Math.random(), y: Math.random(), s: rand(0.7, 1.4), v: rand(0.004, 0.012) });
    for (let i = 0; i < 18; i++) this.ambient.push({ x: Math.random(), y: Math.random(), vx: rand(-0.01, 0.01), vy: rand(-0.01, 0.01), ph: rand(0, TAU) });
  }

  // ── layout ────────────────────────────────────────────────
  resize(insetTop: number, insetBottom: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    this.insetTop = insetTop;
    this.insetBottom = insetBottom;
    this.W = W; this.H = H; this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.horizon = Math.max(insetTop + 40, Math.min(H * 0.3, insetTop + 120));
    this.penTop = this.horizon + 58;
    this.penBottom = H - insetBottom - 14;
    this.bg = paintBackground(this.theme, W, H, dpr, this.horizon);
    for (const e of this.ents.values()) { const [x, y] = this.clampPen(e.x, e.y, this.radius(e.data)); e.x = x; e.y = y; }
  }

  setTheme(id: string) {
    this.theme = THEMES.find((t) => t.id === id) ?? THEMES[0];
    if (this.W) this.bg = paintBackground(this.theme, this.W, this.H, this.dpr, this.horizon);
  }

  radius(d: SlimeData) {
    const base = clamp(Math.min(this.W, this.H * 0.55) * 0.088, 26, 64);
    const crowd = clamp(1.12 - this.ents.size * 0.014, 0.8, 1);
    return base * crowd * (1 + (d.lvl - 1) * 0.055) * (1 + (SPECIES[d.sp].tier - 1) * 0.05);
  }

  private clampPen(x: number, y: number, r: number): [number, number] {
    return [clamp(x, r * 1.2, this.W - r * 1.2), clamp(y, this.penTop + r * 0.4, Math.max(this.penTop + r, this.penBottom))];
  }

  private depthScale(y: number) {
    const t = clamp((y - this.penTop) / Math.max(1, this.penBottom - this.penTop), 0, 1);
    return 0.86 + t * 0.14;
  }

  // ── entity sync ───────────────────────────────────────────
  sync(slimes: SlimeData[], opts: { spawnMode?: 'egg' | 'pop' | 'none'; at?: [number, number] } = {}) {
    const alive = new Set(slimes.map((s) => s.uid));
    for (const [uid, e] of this.ents) if (!alive.has(uid) && e.state !== 'merging') this.ents.delete(uid);
    for (const d of slimes) {
      if (this.pending.has(d.uid)) continue;
      const e = this.ents.get(d.uid);
      if (e) { e.data = d; continue; }
      this.addEnt(d, opts.spawnMode ?? 'none', opts.at);
    }
  }

  addEnt(d: SlimeData, mode: 'egg' | 'pop' | 'none', at?: [number, number]): Ent {
    const r = this.radius(d);
    const [x, y] = at ? this.clampPen(at[0], at[1], r) : this.findSpot(r);
    const e: Ent = {
      uid: d.uid, data: d, x, y, z: 0,
      hopFrom: [x, y], hopTo: [x, y], hopT: 1, hopDur: 0.5, hopH: 0, hopsLeft: 0, idle: rand(0.5, 3),
      sq: 0, sqV: 0, lean: 0, leanV: 0,
      blink: 0, blinkT: rand(1, 4), look: [0, 0], mood: 'happy', moodT: 0, facing: 1,
      spawn: mode === 'none' ? 1 : 0, egg: mode === 'egg' ? 1 : 0, eggY: -this.H * 0.2, eggV: 0,
      state: 'free', mergeT: 0, burp: rand(3, 8), ambient: rand(0.5, 3), shake: 0, seed: Math.random() * 1000,
    };
    if (mode === 'egg') { e.eggY = y - (y - this.insetTop) - 40; e.spawn = 0; }
    this.ents.set(d.uid, e);
    return e;
  }

  private findSpot(r: number): [number, number] {
    let best: [number, number] = [this.W / 2, (this.penTop + this.penBottom) / 2];
    let bestD = -1;
    for (let i = 0; i < 14; i++) {
      const p = this.clampPen(rand(0, this.W), rand(this.penTop, this.penBottom), r);
      let d = 1e9;
      for (const e of this.ents.values()) d = Math.min(d, Math.hypot(e.x - p[0], (e.y - p[1]) * 1.4));
      if (d > bestD) { bestD = d; best = p; }
    }
    return best;
  }

  // ── update ────────────────────────────────────────────────
  update(dt: number) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.shakeScreen = Math.max(0, this.shakeScreen - dt * 3);

    for (const c of this.clouds) { c.x += c.v * dt; if (c.x > 1.25) { c.x = -0.25; c.y = Math.random(); } }
    for (const a of this.ambient) {
      a.x = (a.x + a.vx * dt + 1) % 1;
      a.y = (a.y + a.vy * dt + 1) % 1;
      a.ph += dt;
    }

    for (const e of this.ents.values()) this.updateEnt(e, dt);
    this.updateGift(dt);
    if (this.h.autoFeeding()) {
      this.feedTimer -= dt;
      if (this.feedTimer < 0 && this.ents.size) {
        this.feedTimer = rand(1.2, 2.4);
        const targets = [...this.ents.values()].filter((e) => e.state === 'free' && e.egg <= 0);
        const t = targets[Math.floor(Math.random() * targets.length)];
        if (t) {
          const [fx, fy] = this.feederPos();
          const r = this.radius(t.data);
          const dur = 0.8;
          const tx = t.x, ty = t.y - r * 1.2;
          this.emit('berry', fx, fy - 30, (tx - fx) / dur, (ty - (fy - 30)) / dur - 0.5 * 700 * dur, '#ff4d7a', dur, 7, 700, 0);
          setTimeout(() => { if (this.ents.has(t.uid)) { t.sqV += 7; t.mood = 'excited'; t.moodT = 0.8; this.burst(t.x, t.y - r, '#ff8fb8', 5, 'dot', 80); } }, dur * 1000);
        }
      }
    }
    this.wx.update(dt, this.wxHost());

    // long press
    if (this.press && !this.press.dragging && this.press.uid != null && this.press.lp > 0) {
      if (performance.now() - this.press.t > 480) {
        const uid = this.press.uid;
        this.press.lp = 0;
        this.h.haptic('medium');
        const e = this.ents.get(uid);
        if (e) { e.sqV -= 5; e.mood = 'surprised'; e.moodT = 0.6; }
        this.press = null;
        this.h.longPress(uid);
      }
    }

    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }

  private updateEnt(e: Ent, dt: number) {
    const r = this.radius(e.data);
    // spring physics for squash & lean
    e.sqV += (-340 * e.sq - 11 * e.sqV) * dt;
    e.sq += e.sqV * dt;
    e.leanV += (-200 * e.lean - 9 * e.leanV) * dt;
    e.lean += e.leanV * dt;
    if (e.shake > 0) { e.shake -= dt; e.lean = Math.sin(e.shake * 40) * 0.35 * (e.shake / 0.5); }

    // blinking & look-around
    e.blinkT -= dt;
    if (e.blinkT < 0) { e.blink = 1; e.blinkT = rand(2, 5); }
    e.blink = Math.max(0, e.blink - dt * 7);
    if (e.moodT > 0) e.moodT -= dt;
    if (e.moodT <= 0) e.mood = e.data.happy < 20 ? 'sleepy' : 'happy';

    if (e.egg > 0) {
      // falling egg → bounce → crack
      e.eggV += 1500 * dt;
      e.eggY += e.eggV * dt;
      if (e.eggY >= e.y) {
        e.eggY = e.y;
        if (e.eggV > 250) { e.eggV *= -0.35; this.h.sfx('thud'); }
        else {
          e.eggV = 0;
          e.egg -= dt * 2.4;
          if (e.egg <= 0) {
            e.egg = 0;
            this.burst(e.x, e.y - r * 0.6, paletteFor(SPECIES[e.data.sp], e.data.variant).c1, 14, 'dot');
            this.burst(e.x, e.y - r * 0.6, '#fffbe8', 8, 'star');
            e.sqV = -9;
            e.mood = 'excited'; e.moodT = 1.2;
            this.h.sfx('pop');
          }
        }
      }
      return;
    }
    if (e.spawn < 1) e.spawn = Math.min(1, e.spawn + dt * 3.2);

    if (e.state === 'merging' && e.mergeTo) {
      e.mergeT += dt / 0.22;
      const t = ease(Math.min(1, e.mergeT));
      e.x += (e.mergeTo[0] - e.x) * t;
      e.y += (e.mergeTo[1] - e.y) * t;
      e.z = Math.max(0, e.z - dt * 200);
      if (e.mergeT >= 1) { e.state = 'gone'; this.ents.delete(e.uid); }
      return;
    }

    if (e.state === 'held') {
      const [px, py] = this.pointer;
      const tx = px, ty = py + r * 0.9;
      const dx = tx - e.x;
      e.x += dx * Math.min(1, dt * 18);
      e.y += (ty - e.y) * Math.min(1, dt * 18);
      e.z += (26 - e.z) * Math.min(1, dt * 12);
      e.lean += clamp(dx * 0.004, -0.3, 0.3);
      e.look = [clamp(dx / 30, -1, 1), 0.4];
      e.mood = 'held'; e.moodT = 0.2;
      return;
    }

    // idle hop AI
    if (e.hopT < 1) {
      e.hopT += dt / e.hopDur;
      const t = Math.min(1, e.hopT);
      e.x = e.hopFrom[0] + (e.hopTo[0] - e.hopFrom[0]) * t;
      e.y = e.hopFrom[1] + (e.hopTo[1] - e.hopFrom[1]) * t;
      e.z = Math.sin(t * Math.PI) * e.hopH;
      if (e.hopT >= 1) {
        e.z = 0;
        e.sqV += 7.5; // landing squish
        if (e.hopsLeft > 0) { e.hopsLeft--; e.idle = 0.12; }
        else e.idle = rand(1.2, 4.5);
      }
    } else {
      e.z = Math.max(0, e.z - dt * 120);
      e.idle -= dt;
      if (e.idle < 0) {
        if (e.hopsLeft <= 0) e.hopsLeft = Math.floor(rand(0, 3));
        const ang = rand(0, TAU);
        const dist = rand(r * 0.6, r * 1.8);
        const [tx, ty] = this.clampPen(e.x + Math.cos(ang) * dist, e.y + Math.sin(ang) * dist * 0.5, r);
        e.hopFrom = [e.x, e.y];
        e.hopTo = [tx, ty];
        e.hopT = 0;
        e.hopDur = rand(0.42, 0.55);
        e.hopH = rand(r * 0.35, r * 0.7);
        e.facing = Math.sign(tx - e.x) || 1;
        e.sqV -= 6; // takeoff stretch
        e.leanV += e.facing * 2.5;
        e.look = [e.facing * 0.8, 0];
      }
    }
    // gentle separation so slimes don't stack
    for (const o of this.ents.values()) {
      if (o === e || o.state !== 'free' || o.egg > 0) continue;
      const dx = e.x - o.x, dy = (e.y - o.y) * 1.6;
      const d = Math.hypot(dx, dy);
      const min = (r + this.radius(o.data)) * 0.75;
      if (d > 0.01 && d < min) {
        const push = ((min - d) / min) * 40 * dt;
        e.x += (dx / d) * push;
        e.y += (dy / d) * push * 0.5;
      }
    }
    [e.x, e.y] = this.clampPen(e.x, e.y, r);

    // production burp: a little "+goo" floats up
    e.burp -= dt;
    if (e.burp < 0) {
      e.burp = rand(6, 11);
      const g = this.h.rateOf(e.data) * 8;
      this.floatText(e.x, e.y - r * 2 - e.z, '+' + this.h.fmt(g), '#fffbe6', 13, false);
    }
    // species ambient particle
    e.ambient -= dt;
    if (e.ambient < 0) {
      e.ambient = rand(0.8, 2.2);
      this.speciesParticle(e, r);
      if (e.data.happy > 85 && Math.random() < 0.35) this.emit('heart', e.x + rand(-r, r) * 0.5, e.y - r * 1.8 - e.z, rand(-8, 8), -30, '#ff8fb8', 1.2, 4, -5);
      if (e.data.variant > 0) this.emit('star', e.x + rand(-r, r), e.y - rand(0, r * 1.6) - e.z, 0, -10, e.data.variant === 2 ? '#fff1a0' : '#ffffff', 0.9, rand(3, 6));
    }
  }

  private speciesParticle(e: Ent, r: number) {
    const sp = SPECIES[e.data.sp];
    const pal = paletteFor(sp, e.data.variant);
    const x = e.x + rand(-r * 0.6, r * 0.6), y = e.y - r * rand(0.8, 1.8) - e.z;
    const map: Record<PKind, () => void> = {
      leaf: () => this.emit('leaf', x, y, rand(-10, 10), -15, '#7ee06a', 2, 5, 25),
      ember: () => this.emit('dot', x, y, rand(-8, 8), -40, rand(0, 1) < 0.5 ? '#ffb02e' : '#ff5a2a', 1.2, rand(1.5, 3), -10),
      bubble: () => this.emit('bubble', x, y, rand(-5, 5), -25, '#ffffff', 1.8, rand(2.5, 5), -5),
      dust: () => this.emit('dot', x, e.y - 2, rand(-20, 20), -8, rgba(pal.c2, 0.6), 1, rand(2, 3.5), 5),
      snow: () => this.emit('snow', x, y - r, rand(-6, 6), 12, '#ffffff', 2.2, rand(3, 5), 0),
      wind: () => this.emit('ring', x, y, rand(10, 25), -5, 'rgba(255,255,255,0.6)', 1, 4, 0),
      steam: () => this.emit('dot', x, y, rand(-5, 5), -22, 'rgba(255,255,255,0.55)', 1.8, rand(4, 7), -3),
      spark: () => this.emit('spark', x, y, rand(-40, 40), rand(-40, 0), '#fff59a', 0.5, 3, 0),
      sparkle: () => this.emit('star', x, y, 0, -12, lighten(pal.c1, 0.4), 1, rand(3, 5.5), 0),
      petal: () => this.emit('petal', x, y, rand(-15, 15), -10, lighten(pal.c2, 0.3), 2.5, 4, 18),
      heart: () => this.emit('heart', x, y, rand(-6, 6), -25, '#ff6fa8', 1.4, 5, -4),
      star: () => this.emit('star5', x, y, rand(-6, 6), -18, '#fff3a0', 1.5, 4, 0),
      drop: () => this.emit('drop', x, y - r * 0.3, 0, 30, '#7fc8ff', 0.8, 3, 200),
    };
    map[sp.particle]();
  }

  private updateGift(dt: number) {
    if (!this.gift) {
      this.giftTimer -= dt;
      if (this.giftTimer < 0 && !this.paused) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.gift = { x: dir > 0 ? -40 : this.W + 40, y: this.horizon * 0.55 + this.insetTop * 0.5, t: 0, dir, alive: true, pop: 0 };
      }
      return;
    }
    const g = this.gift;
    g.t += dt;
    if (!g.alive) {
      g.pop += dt;
      if (g.pop > 0.4) { this.gift = null; this.giftTimer = rand(90, 150); }
      return;
    }
    g.x += g.dir * Math.max(22, this.W / 16) * dt;
    if ((g.dir > 0 && g.x > this.W + 60) || (g.dir < 0 && g.x < -60)) { this.gift = null; this.giftTimer = rand(60, 120); }
  }

  // ── particles ─────────────────────────────────────────────
  emit(kind: Part['kind'], x: number, y: number, vx: number, vy: number, color: string, life: number, size: number, g = 0, drag = 0.5) {
    this.parts.push({ kind, x, y, vx, vy, life, max: life, size, color, g, rot: rand(0, TAU), vr: rand(-3, 3), drag });
  }

  burst(x: number, y: number, color: string, n: number, kind: Part['kind'] = 'dot', speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.4, speed);
      this.emit(kind, x, y, Math.cos(a) * s, Math.sin(a) * s - 40, color, rand(0.5, 1), rand(2.5, 6), 260, 2);
    }
  }

  confetti(x: number, y: number, n = 40) {
    const cols = ['#ff5fa2', '#5ec8ff', '#ffe45c', '#7dff9a', '#b67bff', '#ff9f43'];
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), s = rand(180, 420);
      this.emit('petal', x, y, Math.cos(a) * s, Math.sin(a) * s, cols[i % cols.length], rand(1.2, 2), rand(4, 7), 420, 1.6);
    }
  }

  floatText(x: number, y: number, text: string, color: string, size = 18, bold = true) {
    this.parts.push({ kind: 'text', x, y, vx: 0, vy: -38, life: 1.3, max: 1.3, size, color, g: 0, rot: 0, vr: 0, drag: 1.2, text, bold });
  }

  ring(x: number, y: number, color: string, size = 60) {
    this.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size, color, g: 0, rot: 0, vr: 0, drag: 0 });
  }

  // ── input ─────────────────────────────────────────────────
  private toLocal(ev: PointerEvent): [number, number] {
    const b = this.canvas.getBoundingClientRect();
    return [ev.clientX - b.left, ev.clientY - b.top];
  }

  private hit(x: number, y: number, except?: number): Ent | null {
    let best: Ent | null = null;
    let bestY = -1;
    for (const e of this.ents.values()) {
      if (e.uid === except || e.state !== 'free' || e.egg > 0) continue;
      const r = this.radius(e.data) * this.depthScale(e.y);
      const dx = (x - e.x) / (r * 1.15), dy = (y - (e.y - r * 0.85 - e.z)) / (r * 1.05);
      if (dx * dx + dy * dy <= 1 && e.y > bestY) { best = e; bestY = e.y; }
    }
    return best;
  }

  private sellZone() {
    const r = 34;
    return { x: 16 + r, y: this.penBottom - r - 6, r };
  }

  private bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (ev) => {
      if (this.press) return;
      const [x, y] = this.toLocal(ev);
      this.pointer = [x, y];
      // gift bubble first
      if (this.gift?.alive && Math.hypot(x - this.gift.x, y - this.giftY()) < 42) {
        this.gift.alive = false;
        this.burst(this.gift.x, this.giftY(), '#ffe45c', 18, 'star');
        this.h.sfx('pop');
        this.h.haptic('light');
        this.h.gift();
        return;
      }
      const e = this.hit(x, y);
      this.press = { uid: e?.uid ?? null, x, y, t: performance.now(), id: ev.pointerId, dragging: false, lp: 1 };
      if (e) { c.setPointerCapture(ev.pointerId); e.sqV += 4; }
    });
    c.addEventListener('pointermove', (ev) => {
      const [x, y] = this.toLocal(ev);
      this.pointer = [x, y];
      const p = this.press;
      if (!p || p.id !== ev.pointerId || p.uid == null) return;
      if (!p.dragging && Math.hypot(x - p.x, y - p.y) > 9) {
        const e = this.ents.get(p.uid);
        if (!e) { this.press = null; return; }
        p.dragging = true;
        e.state = 'held';
        e.hopT = 1;
        this.h.sfx('pick');
        this.h.haptic('light');
      }
      if (p.dragging) this.updateHover(p.uid, x, y);
    });
    const end = (ev: PointerEvent) => {
      const p = this.press;
      if (!p || p.id !== ev.pointerId) return;
      this.press = null;
      if (p.uid == null) {
        const [x, y] = this.toLocal(ev);
        const dx = x - p.x, dy = y - p.y;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - p.t < 700) this.h.swipe(dx < 0 ? 1 : -1);
        return;
      }
      const e = this.ents.get(p.uid);
      if (!e) return;
      if (!p.dragging) {
        if (ev.type === 'pointerup' && p.lp > 0) this.tapEnt(e);
        return;
      }
      this.drop(e);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  private updateHover(uid: number, x: number, y: number) {
    const e = this.ents.get(uid)!;
    const sz = this.sellZone();
    this.overSell = Math.hypot(x - sz.x, y - sz.y) < sz.r + 14;
    const t = this.overSell ? null : this.hit(x, y + this.radius(e.data) * 0.4, uid);
    if (!t) { this.hover = null; return; }
    const pv = this.h.preview(e.data, t.data);
    const label = pv.kind === 'merge' ? `Lv ${t.data.lvl + 1}!`
      : pv.kind === 'fuse' ? (pv.known ? SPECIES[pv.sp!].name + '!' : 'Mystery!')
      : pv.reason ?? 'Nope';
    if (!this.hover || this.hover.uid !== t.uid) this.h.haptic('light');
    this.hover = { uid: t.uid, kind: pv.kind, label };
  }

  private tapEnt(e: Ent) {
    const { goo: g, gems } = this.h.tap(e.uid);
    const r = this.radius(e.data);
    const now = performance.now();
    if (this.combo.uid === e.uid && now - this.combo.t < 900) this.combo.n++;
    else this.combo = { uid: e.uid, n: 1, t: now };
    this.combo.t = now;
    const n = this.combo.n;
    e.sqV += 9;
    e.mood = 'excited';
    e.moodT = 0.7;
    e.leanV += (Math.random() < 0.5 ? -1 : 1) * 3;
    this.floatText(e.x, e.y - r * 2.1, '+' + this.h.fmt(g), '#fff7c2', 20);
    if (n >= 3) this.floatText(e.x + r * 1.2, e.y - r * 1.4, n >= 10 ? `Purr ×${n}! ♥` : `Purr ×${n}`, '#ffc2dc', 14 + Math.min(10, n));
    for (let i = 0; i < 3 + Math.min(6, n); i++) this.emit('heart', e.x + rand(-r, r) * 0.6, e.y - r * 1.4, rand(-30, 30), rand(-90, -60), '#ff6fa8', 0.9, rand(5, 8), 60);
    this.burst(e.x, e.y - r * 0.8, paletteFor(SPECIES[e.data.sp], e.data.variant).c1, 6, 'goo', 120);
    this.h.sfx('squish');
    this.h.haptic('light');
    if (gems > 0) {
      const gy = e.y - r * 1.2;
      this.emit('gem', e.x, gy, rand(-40, 40), -260, '#ff5fb8', 0.9, 13, 600, 0.2);
      this.burst(e.x, gy, '#ffc2f0', 12, 'star', 180);
      this.floatText(e.x - r * 1.2, e.y - r * 2.5, gems > 1 ? `JACKPOT +${gems}` : '+1 gem!', '#ffb3e6', gems > 1 ? 24 : 19);
      this.h.sfx('shiny');
      this.h.haptic('success');
      const b = this.canvas.getBoundingClientRect();
      setTimeout(() => this.h.gemFx(b.left + e.x, b.top + gy - 40, gems), 350);
    }
  }

  private drop(e: Ent) {
    const hv = this.hover;
    this.hover = null;
    const r = this.radius(e.data);
    if (this.overSell) {
      this.overSell = false;
      const v = this.h.release(e.uid);
      if (v >= 0) {
        this.burst(e.x, e.y - r, paletteFor(SPECIES[e.data.sp], e.data.variant).c1, 16);
        this.floatText(e.x + 30, e.y - r * 2, '+' + this.h.fmt(v), '#fff7c2', 20);
        this.ents.delete(e.uid);
        this.h.sfx('coin');
        return;
      }
    }
    e.state = 'free';
    e.sqV += 8;
    [e.x, e.y] = this.clampPen(e.x, e.y, r);
    if (!hv) { this.h.sfx('drop'); return; }
    const target = this.ents.get(hv.uid);
    if (!target) return;
    const out = this.h.merge(e.uid, target.uid);
    if (out.kind === 'fail') {
      target.shake = 0.5;
      e.hopFrom = [e.x, e.y];
      const away = Math.sign(e.x - target.x) || 1;
      e.hopTo = this.clampPen(e.x + away * r * 1.6, e.y + 10, r);
      e.hopT = 0; e.hopDur = 0.35; e.hopH = r * 0.5;
      e.mood = 'surprised'; e.moodT = 0.8;
      this.floatText(target.x, target.y - this.radius(target.data) * 2.2, hv.label, '#ffd0d8', 16);
      this.h.sfx('nope');
      this.h.haptic('medium');
      return;
    }
    // merge animation: both fly together, then the new one pops out
    const mx = target.x, my = target.y;
    for (const m of [e, target]) { m.state = 'merging'; m.mergeTo = [mx, my]; m.mergeT = 0; }
    const newSl = out.slime;
    this.pending.add(newSl.uid);
    const pal = paletteFor(SPECIES[newSl.sp], newSl.variant);
    setTimeout(() => {
      this.pending.delete(newSl.uid);
      const ne = this.addEnt(newSl, 'pop', [mx, my]);
      ne.sqV = -12;
      ne.mood = 'excited'; ne.moodT = 1.5;
      const nr = this.radius(newSl);
      this.ring(mx, my - nr * 0.8, '#ffffff', nr * 2.6);
      this.burst(mx, my - nr * 0.8, pal.c1, 22, 'dot', 220);
      this.burst(mx, my - nr * 0.8, '#fffbe0', 10, 'star', 200);
      const tierCol = TIER_COLORS[SPECIES[newSl.sp].tier];
      if (out.kind === 'merge') {
        this.floatText(mx, my - nr * 2.4, `Level ${newSl.lvl}!`, '#ffffff', 22);
        this.h.sfx('merge');
        this.h.haptic('medium');
      } else {
        this.floatText(mx, my - nr * 2.4, SPECIES[newSl.sp].name + '!', lighten(tierCol, 0.4), 24);
        this.flash = 0.6;
        this.confetti(mx, my - nr);
        this.h.sfx('fuse');
        this.h.haptic('heavy');
      }
      if (out.mutated) {
        this.floatText(mx, my - nr * 3.1, newSl.variant === 2 ? '✦ GOLDEN ✦' : '✦ SHINY ✦', '#fff1a0', 20);
        this.burst(mx, my - nr, '#fff1a0', 24, 'star5', 260);
        this.h.sfx('shiny');
      }
    }, 210);
  }

  private giftY() { return this.gift ? this.gift.y + Math.sin(this.gift.t * 2.2) * 10 : 0; }

  // ── rendering ─────────────────────────────────────────────
  draw() {
    const ctx = this.ctx;
    const { W, H, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.shakeScreen > 0) ctx.translate(rand(-1, 1) * this.shakeScreen * 6, rand(-1, 1) * this.shakeScreen * 6);
    if (this.bg) ctx.drawImage(this.bg, 0, 0, W, H);
    else { ctx.fillStyle = '#6cc8ff'; ctx.fillRect(0, 0, W, H); }

    this.drawSkyLife(ctx);
    this.wx.drawBack(ctx, this.wxHost());

    // entities sorted by depth
    const list = [...this.ents.values()].sort((a, b) => (a.state === 'held' ? 1 : 0) - (b.state === 'held' ? 1 : 0) || a.y - b.y);
    // shadows first
    for (const e of list) {
      if (e.egg > 0 && e.eggY < e.y - 400) continue;
      const r = this.radius(e.data) * this.depthScale(e.y) * (e.spawn < 1 ? back(e.spawn) : 1);
      const lift = e.egg > 0 ? (e.y - e.eggY) : e.z;
      const k = 1 / (1 + lift / 60);
      ctx.fillStyle = `rgba(20,10,40,${0.22 * k})`;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 1, r * 1.05 * (0.6 + 0.4 * k), r * 0.24 * (0.6 + 0.4 * k), 0, 0, TAU);
      ctx.fill();
    }
    if (this.press?.dragging) this.drawSellZone(ctx);

    if (this.h.autoFeeding()) this.drawFeeder(ctx);
    for (const e of list) this.drawEnt(ctx, e);

    this.drawHover(ctx);
    this.drawParticles(ctx);
    this.wx.drawFront(ctx, this.wxHost());
    this.drawGift(ctx);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawSkyLife(ctx: CanvasRenderingContext2D) {
    const { W, horizon } = this;
    const th = this.theme;
    if (!th.night) {
      for (const c of this.clouds) {
        const x = c.x * W * 1.5 - W * 0.25, y = this.insetTop * 0.4 + 12 + c.y * (horizon - this.insetTop * 0.4 - 30);
        this.drawCloud(ctx, x, y, 26 * c.s, th.id === 'sunset' ? 'rgba(255,220,235,0.85)' : 'rgba(255,255,255,0.9)');
      }
    }
    const t = this.time;
    for (const a of this.ambient) {
      if (th.night) {
        // fireflies over the pen
        const x = a.x * W, y = this.penTop - 20 + a.y * (this.penBottom - this.penTop);
        const al = 0.4 + 0.6 * Math.abs(Math.sin(a.ph * 1.3));
        const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
        g.addColorStop(0, `rgba(255,250,170,${al})`);
        g.addColorStop(1, 'rgba(255,250,170,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 10, y - 10, 20, 20);
      } else if (th.snow) {
        const x = (a.x * W + Math.sin(t + a.ph) * 12), y = ((a.y + t * 0.04) % 1) * this.H;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(x, y, 1.5 + (a.ph % 2), 0, TAU); ctx.fill();
      } else if (th.id === 'candy') {
        const x = a.x * W, y = a.y * this.H;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(a.ph))})`;
        star4(ctx, x, y, 4, 1);
      } else {
        // butterflies / pollen motes over the meadow
        const x = a.x * W, y = this.penTop - 30 + a.y * (this.penBottom - this.penTop) * 0.9;
        if (a.ph % 5 < 0.2) continue;
        ctx.fillStyle = `rgba(255,255,230,${0.35 + 0.3 * Math.sin(a.ph * 2)})`;
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
      }
    }
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.arc(x + s * 0.9, y + s * 0.2, s * 0.8, 0, TAU);
    ctx.arc(x - s * 0.9, y + s * 0.25, s * 0.7, 0, TAU);
    ctx.arc(x + s * 0.3, y - s * 0.45, s * 0.75, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,180,230,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.65, s * 1.6, s * 0.28, 0, 0, TAU);
    ctx.fill();
  }

  private drawEnt(ctx: CanvasRenderingContext2D, e: Ent) {
    const sp = SPECIES[e.data.sp];
    const baseR = this.radius(e.data) * this.depthScale(e.y);
    if (e.egg > 0) { this.drawEgg(ctx, e, baseR); return; }
    const pop = e.spawn < 1 ? back(e.spawn) : 1;
    const r = baseR * pop;
    if (r < 1) return;
    const gy = e.y - e.z;
    const lookX = e.state === 'held' ? e.look[0] : Math.sin(this.time * 0.7 + e.seed) * 0.6 + e.facing * 0.2;

    if (this.h.isRushing(e.data)) {
      const pulse = 1 + Math.sin(this.time * 8) * 0.08;
      const g = ctx.createRadialGradient(e.x, gy - r * 0.7, r * 0.4, e.x, gy - r * 0.7, r * 1.7 * pulse);
      g.addColorStop(0, 'rgba(255,150,220,0.45)');
      g.addColorStop(1, 'rgba(180,120,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, gy - r * 0.7, r * 1.7 * pulse, 0, TAU); ctx.fill();
    }
    if (this.foodHover === e.uid) {
      ctx.save();
      ctx.strokeStyle = '#ffd6ea';
      ctx.shadowColor = '#ff8fc0';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.5;
      const p = 1 + Math.sin(this.time * 10) * 0.05;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 1, r * 1.3 * p, r * 0.38 * p, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // aura for shiny / golden
    if (e.data.variant > 0) {
      const g = ctx.createRadialGradient(e.x, gy - r * 0.8, r * 0.3, e.x, gy - r * 0.8, r * 1.9);
      const c = e.data.variant === 2 ? '255,215,80' : '200,170,255';
      g.addColorStop(0, `rgba(${c},0.35)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, gy - r * 0.8, r * 1.9, 0, TAU); ctx.fill();
    }

    drawSlime(ctx, {
      x: e.x, y: gy, r, sp, variant: e.data.variant, t: this.time + e.seed,
      squash: clamp(e.sq, -0.7, 0.8), lean: e.lean, blink: e.blink, lookX, lookY: e.look[1],
      mood: e.mood, hat: e.data.hat,
    });

    // level badge
    const bx = e.x + r * 0.95, by = gy - r * 0.2;
    const tierCol = TIER_COLORS[sp.tier];
    ctx.beginPath(); ctx.arc(bx, by, r * 0.32 + 3, 0, TAU);
    ctx.fillStyle = '#2b1740'; ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by, r * 0.32 + 1, 0, TAU);
    const bgc = ctx.createLinearGradient(bx, by - r * 0.3, bx, by + r * 0.3);
    bgc.addColorStop(0, lighten(tierCol, 0.35)); bgc.addColorStop(1, tierCol);
    ctx.fillStyle = bgc; ctx.fill();
    ctx.fillStyle = '#2b1740';
    ctx.font = `700 ${Math.round(r * 0.38 + 3)}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(e.data.lvl), bx, by + 1);

    // hungry thought bubble
    if (e.data.happy < 25 && e.state === 'free') {
      const tx = e.x - r * 0.9, ty = gy - r * 2.3 + Math.sin(this.time * 2 + e.seed) * 3;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = '#2b1740';
      ctx.lineWidth = 2;
      for (const [dx, dy, rr] of [[r * 0.45, r * 0.75, 3], [r * 0.25, r * 0.45, 4.5]] as [number, number, number][]) {
        ctx.beginPath(); ctx.arc(tx + dx, ty + dy, rr, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(tx, ty, 16, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // tiny berry
      ctx.fillStyle = FOODS.berry.color;
      for (const [bx2, by2] of [[-4, 1], [4, 1], [0, 5]]) { ctx.beginPath(); ctx.arc(tx + bx2, ty + by2 - 1, 4, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#5cc94b';
      ctx.beginPath(); ctx.ellipse(tx + 1, ty - 7, 4, 2, -0.4, 0, TAU); ctx.fill();
    }
  }

  private feederPos(): [number, number] { return [this.W * 0.5, this.penTop - 4]; }

  /** The Auto-Feeder machine: a candy-striped hopper that tosses berries to slimes. */
  private drawFeeder(ctx: CanvasRenderingContext2D) {
    const [x, y] = this.feederPos();
    const t = this.time;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#2b1740';
    // shadow & post
    ctx.fillStyle = 'rgba(20,10,40,0.2)';
    ctx.beginPath(); ctx.ellipse(0, 4, 22, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c98b4f';
    ctx.beginPath(); ctx.rect(-4, -26, 8, 30); ctx.fill(); ctx.stroke();
    // hopper bowl
    ctx.beginPath();
    ctx.moveTo(-22, -46); ctx.lineTo(22, -46); ctx.lineTo(12, -24); ctx.lineTo(-12, -24); ctx.closePath();
    const g = ctx.createLinearGradient(-22, 0, 22, 0);
    g.addColorStop(0, '#ff8fc0'); g.addColorStop(1, '#d6357c');
    ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = -3; i < 4; i++) ctx.fillRect(i * 10 + ((t * 8) % 10), -48, 4, 26);
    ctx.restore();
    // heaped berries
    const bob = Math.sin(t * 6) * 1.2;
    for (const [bx, by] of [[-11, -49], [-3, -52], [6, -50], [13, -48], [2, -56]] as [number, number][]) {
      ctx.fillStyle = '#ff4d7a'; ctx.beginPath(); ctx.arc(bx, by + bob, 4.5, 0, TAU); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
    }
    // spinning sprinkler head
    ctx.save();
    ctx.translate(0, -62 + bob);
    ctx.rotate(t * 4);
    ctx.fillStyle = '#ffe45c';
    for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.ellipse(8, 0, 7, 3.5, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // ── feeding, weather & helpers used by the UI ─────────────
  private wxHost() {
    return {
      W: this.W, H: this.H, horizon: this.horizon, penTop: this.penTop, penBottom: this.penBottom,
      insetTop: this.insetTop, time: this.time,
      onThunder: () => { this.shakeScreen = 0.5; this.h.sfx('thunder'); this.h.haptic('medium'); },
    };
  }

  setWeather(id: WeatherId) { this.wx.set(id); }

  /** Slime under a viewport point (for dragging snacks from the DOM tray). */
  slimeAtClient(cx: number, cy: number): number | null {
    const b = this.canvas.getBoundingClientRect();
    return this.hit(cx - b.left, cy - b.top + 10)?.uid ?? null;
  }

  feedFx(uid: number, food: FoodId, res: { levelUp: boolean; rush: boolean }) {
    const e = this.ents.get(uid);
    this.h.sfx('chomp');
    this.h.haptic('light');
    if (!e) return;
    const r = this.radius(e.data);
    e.sqV += 12;
    e.mood = 'excited';
    e.moodT = 1.4;
    this.burst(e.x, e.y - r * 1.1, FOODS[food].color, 10, 'dot', 120);
    for (let i = 0; i < 6; i++) this.emit('heart', e.x + rand(-r, r) * 0.6, e.y - r * 1.5, rand(-40, 40), rand(-110, -70), '#ff6fa8', 1.1, rand(6, 9), 60);
    this.floatText(e.x, e.y - r * 2.2, food === 'berry' ? 'Yum!' : food === 'jelly' ? 'Sugar rush!' : 'Level up!', '#ffd6ea', 20);
    if (res.levelUp) {
      this.ring(e.x, e.y - r * 0.8, '#fff3a0', r * 2.6);
      this.burst(e.x, e.y - r, '#fff3a0', 18, 'star5', 220);
      this.h.sfx('merge');
    }
  }


  private drawEgg(ctx: CanvasRenderingContext2D, e: Ent, r: number) {
    const sp = SPECIES[e.data.sp];
    const pal = paletteFor(sp, e.data.variant);
    const x = e.x, y = e.eggY;
    const wob = e.eggV === 0 ? Math.sin(this.time * 40) * 0.12 * (1 - e.egg) : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wob);
    const w = r * 0.72, h = r * 0.95;
    ctx.beginPath();
    ctx.moveTo(0, -h * 2);
    ctx.bezierCurveTo(w * 1.1, -h * 2, w * 1.2, -h * 0.2, 0, 0);
    ctx.bezierCurveTo(-w * 1.2, -h * 0.2, -w * 1.1, -h * 2, 0, -h * 2);
    const g = ctx.createRadialGradient(-w * 0.4, -h * 1.4, 1, 0, -h, h * 1.4);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#fff6ea'); g.addColorStop(1, '#ecdcc8');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#8a6a55'; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = pal.c2;
    for (const [dx, dy, s] of [[-0.4, -1.4, 0.22], [0.35, -0.9, 0.28], [-0.2, -0.45, 0.18], [0.3, -1.65, 0.14]]) {
      ctx.beginPath(); ctx.arc(dx * w * 1.6, dy * h, s * w * 1.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (e.egg < 0.7 && e.eggV === 0) {
      ctx.strokeStyle = '#6a4a35'; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-w * 0.8, -h * 1.1);
      for (let i = 0; i < 6; i++) ctx.lineTo(-w * 0.8 + i * w * 0.32, -h * 1.1 + (i % 2 ? -h * 0.18 : h * 0.1));
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSellZone(ctx: CanvasRenderingContext2D) {
    const z = this.sellZone();
    const on = this.overSell;
    const pulse = 1 + Math.sin(this.time * 8) * 0.04;
    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.scale(on ? 1.15 * pulse : pulse, on ? 1.15 * pulse : pulse);
    ctx.fillStyle = on ? 'rgba(255,120,140,0.95)' : 'rgba(40,20,70,0.55)';
    ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,0.6)';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, z.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '22px system-ui';
    ctx.fillText('🏷️', 0, -6);
    ctx.font = '700 11px Fredoka, sans-serif';
    ctx.fillText('SELL', 0, 16);
    ctx.restore();
    if (on && this.press?.uid != null) {
      const v = this.h.releaseValue(this.press.uid);
      ctx.fillStyle = '#fff';
      ctx.font = '700 13px Fredoka, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('+' + this.h.fmt(v), z.x + z.r + 10, z.y);
    }
  }

  private drawHover(ctx: CanvasRenderingContext2D) {
    const hv = this.hover;
    if (!hv || !this.press?.dragging) return;
    const t = this.ents.get(hv.uid);
    if (!t) return;
    const r = this.radius(t.data) * this.depthScale(t.y);
    const col = hv.kind === 'merge' ? '#7dffb0' : hv.kind === 'fuse' ? '#e0a6ff' : '#ff8a9a';
    const pulse = 1 + Math.sin(this.time * 10) * 0.05;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = col;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 1, r * 1.3 * pulse, r * 0.38 * pulse, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    // label bubble
    ctx.font = '700 14px Fredoka, sans-serif';
    const tw = ctx.measureText(hv.label).width + 20;
    const lx = t.x, ly = t.y - r * 2.3 - 6;
    ctx.fillStyle = hv.kind === 'fail' ? 'rgba(90,20,40,0.85)' : 'rgba(40,20,80,0.85)';
    roundRectPath(ctx, lx - tw / 2, ly - 14, tw, 26, 13);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hv.label, lx, ly);
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const a = Math.min(1, p.life / p.max * 1.6);
      ctx.globalAlpha = a;
      switch (p.kind) {
        case 'dot':
        case 'goo':
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.kind === 'goo' ? 1 : 0.5 + a * 0.5), 0, TAU); ctx.fill();
          if (p.kind === 'goo') { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, TAU); ctx.fill(); }
          break;
        case 'berry':
          ctx.fillStyle = p.color;
          for (const [dx, dy] of [[-3, 0], [3, 0], [0, 4]]) { ctx.beginPath(); ctx.arc(p.x + dx, p.y + dy, p.size * 0.55, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#5cc94b';
          ctx.beginPath(); ctx.ellipse(p.x, p.y - 5, 3.5, 1.8, 0, 0, TAU); ctx.fill();
          break;
        case 'gem': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.sin(p.rot) * 0.3);
          const s = p.size;
          ctx.beginPath();
          ctx.moveTo(-s * 0.6, -s * 0.55); ctx.lineTo(s * 0.6, -s * 0.55); ctx.lineTo(s, -s * 0.1); ctx.lineTo(0, s * 0.8); ctx.lineTo(-s, -s * 0.1); ctx.closePath();
          const gg = ctx.createLinearGradient(0, -s, 0, s);
          gg.addColorStop(0, '#ffd6f4'); gg.addColorStop(0.5, '#ff5fb8'); gg.addColorStop(1, '#c02a8a');
          ctx.fillStyle = gg; ctx.fill();
          ctx.lineWidth = 2.2; ctx.strokeStyle = '#2b1740'; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect(-s * 0.45, -s * 0.4, s * 0.25, s * 0.18);
          ctx.restore();
          break;
        }
        case 'star':
          ctx.fillStyle = p.color;
          star4(ctx, p.x, p.y, p.size * (0.5 + a * 0.5), p.size * 0.28);
          break;
        case 'star5':
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          star5(ctx, 0, 0, p.size, p.size * 0.45); ctx.fill();
          ctx.restore();
          break;
        case 'spark':
          ctx.strokeStyle = p.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
          break;
        case 'heart':
          ctx.fillStyle = p.color;
          heartPath(ctx, p.x, p.y, p.size); ctx.fill();
          break;
        case 'petal':
        case 'leaf':
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        case 'snow':
          ctx.strokeStyle = p.color; ctx.lineWidth = 1.2;
          for (let k = 0; k < 3; k++) {
            const an = p.rot + (k * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(p.x - Math.cos(an) * p.size, p.y - Math.sin(an) * p.size);
            ctx.lineTo(p.x + Math.cos(an) * p.size, p.y + Math.sin(an) * p.size);
            ctx.stroke();
          }
          break;
        case 'bubble':
          ctx.strokeStyle = p.color; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.arc(p.x + Math.sin(p.life * 6) * 2, p.y, p.size, 0, TAU); ctx.stroke();
          break;
        case 'drop':
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.6, p.size, 0, 0, TAU); ctx.fill();
          break;
        case 'ring': {
          const k = 1 - p.life / p.max;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * (1 - k) + 0.5;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * (0.3 + k), p.size * (0.3 + k) * 0.55, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'text': {
          const k = 1 - p.life / p.max;
          const sc = k < 0.15 ? back(k / 0.15) : 1;
          ctx.font = `${p.bold ? 700 : 600} ${p.size * sc}px Fredoka, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(43,23,64,0.85)';
          ctx.lineJoin = 'round';
          ctx.strokeText(p.text!, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text!, p.x, p.y);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawGift(ctx: CanvasRenderingContext2D) {
    const g = this.gift;
    if (!g) return;
    const x = g.x, y = this.giftY();
    const s = g.alive ? 1 : 1 + g.pop * 3;
    ctx.save();
    ctx.globalAlpha = g.alive ? 1 : Math.max(0, 1 - g.pop * 2.5);
    ctx.translate(x, y);
    ctx.scale(s, s);
    // string
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, 26); ctx.quadraticCurveTo(6, 40, 0, 52); ctx.stroke();
    // bubble
    const bg = ctx.createRadialGradient(-8, -10, 2, 0, 0, 30);
    bg.addColorStop(0, 'rgba(255,255,255,0.95)');
    bg.addColorStop(0.5, 'rgba(255,230,140,0.55)');
    bg.addColorStop(1, 'rgba(255,170,90,0.75)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    // present
    ctx.fillStyle = '#ff5fa2';
    roundRectPath(ctx, -11, -6, 22, 17, 3); ctx.fill();
    ctx.fillStyle = '#ff86bd';
    roundRectPath(ctx, -13, -11, 26, 7, 3); ctx.fill();
    ctx.fillStyle = '#ffe45c';
    ctx.fillRect(-2.5, -11, 5, 22);
    ctx.beginPath(); ctx.ellipse(-5, -13, 5, 3, -0.5, 0, TAU); ctx.ellipse(5, -13, 5, 3, 0.5, 0, TAU); ctx.fill();
    // sparkles
    ctx.fillStyle = '#fff';
    star4(ctx, 18 * Math.cos(g.t * 3), 18 * Math.sin(g.t * 3), 4, 1);
    ctx.restore();
  }

  /** Celebration used by UI for big moments. */
  celebrate() {
    this.confetti(this.W / 2, this.H * 0.55, 70);
    this.flash = 0.5;
  }

  spawnAtCenter(d: SlimeData) {
    this.addEnt(d, 'egg');
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.4, x - s * 0.5, y - s * 1.1, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 1.1, x + s * 1.1, y - s * 0.4, x, y + s * 0.35);
  ctx.closePath();
}
