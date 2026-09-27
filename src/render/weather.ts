import type { WeatherId } from '../game/data';
import { star4 } from './slimeArt';

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Drop { x: number; y: number; v: number; len: number }
interface Flake { x: number; y: number; v: number; r: number; ph: number }
interface Leaf { x: number; y: number; vx: number; vy: number; rot: number; vr: number; c: string; s: number }
interface Splash { x: number; y: number; t: number }
interface Cloud { x: number; y: number; s: number; v: number }

export interface WeatherHost {
  W: number; H: number; horizon: number; penTop: number; penBottom: number; insetTop: number; time: number;
  onThunder(): void;
}

/** Animated weather layers drawn behind (sky) and in front of (precipitation) the slimes. */
export class WeatherFx {
  id: WeatherId = 'sunny';
  k = 0; // fade-in 0 → 1
  private drops: Drop[] = [];
  private flakes: Flake[] = [];
  private leaves: Leaf[] = [];
  private splashes: Splash[] = [];
  private clouds: Cloud[] = [];
  private flash = 0;
  private bolt: [number, number][] | null = null;
  private nextBolt = 5;

  set(id: WeatherId) {
    if (id === this.id) return;
    this.id = id;
    this.k = 0;
    this.drops = []; this.flakes = []; this.leaves = []; this.splashes = [];
    this.clouds = Array.from({ length: 7 }, (_, i) => ({ x: i / 6 + rand(-0.05, 0.05), y: rand(0, 1), s: rand(0.9, 1.6), v: rand(0.006, 0.014) }));
  }

  update(dt: number, h: WeatherHost) {
    this.k = Math.min(1, this.k + dt / 2.5);
    const { W, H } = h;
    const wet = this.id === 'rain' || this.id === 'storm';
    for (const c of this.clouds) { c.x += c.v * dt * (this.id === 'windy' ? 3 : 1); if (c.x > 1.3) c.x = -0.3; }

    if (wet) {
      const target = this.id === 'storm' ? 260 : 150;
      while (this.drops.length < target * this.k) this.drops.push({ x: rand(-40, W + 40), y: rand(-H, 0), v: rand(700, 1000), len: rand(10, 20) });
      const slant = this.id === 'storm' ? 0.28 : 0.12;
      for (const d of this.drops) {
        d.y += d.v * dt;
        d.x += d.v * slant * dt;
        const floor = h.penTop + ((d.x * 7919) % 1000) / 1000 * (h.H - h.penTop);
        if (d.y > floor) {
          if (d.y < H && Math.random() < 0.5) this.splashes.push({ x: d.x, y: d.y, t: 0 });
          d.y = rand(-80, -10);
          d.x = rand(-80, W);
        }
      }
      for (const s of this.splashes) s.t += dt * 3.2;
      this.splashes = this.splashes.filter((s) => s.t < 1);
    }
    if (this.id === 'storm') {
      this.flash = Math.max(0, this.flash - dt * 2.2);
      this.nextBolt -= dt;
      if (this.nextBolt < 0) {
        this.nextBolt = rand(5, 11);
        this.flash = 1;
        let x = rand(W * 0.1, W * 0.9), y = 0;
        const pts: [number, number][] = [[x, y]];
        while (y < h.horizon + 10) { x += rand(-24, 24); y += rand(14, 30); pts.push([x, y]); }
        this.bolt = pts;
        h.onThunder();
      }
      if (this.flash < 0.6) this.bolt = null;
    }
    if (this.id === 'snow') {
      while (this.flakes.length < 140 * this.k) this.flakes.push({ x: rand(0, W), y: rand(-H, 0), v: rand(25, 60), r: rand(1.2, 3.4), ph: rand(0, TAU) });
      for (const f of this.flakes) {
        f.y += f.v * dt;
        f.ph += dt;
        f.x += Math.sin(f.ph) * 12 * dt;
        if (f.y > H + 5) { f.y = rand(-40, -5); f.x = rand(0, W); }
      }
    }
    if (this.id === 'windy') {
      const cols = ['#7ee06a', '#5cc94b', '#ffb35c', '#ff8fc0', '#c7e86a'];
      while (this.leaves.length < 26 * this.k) this.leaves.push({ x: rand(-W, 0), y: rand(h.insetTop, H), vx: rand(160, 260), vy: rand(-20, 20), rot: rand(0, TAU), vr: rand(-5, 5), c: cols[Math.floor(rand(0, cols.length))], s: rand(4, 7) });
      for (const l of this.leaves) {
        l.x += l.vx * dt;
        l.y += (l.vy + Math.sin(h.time * 3 + l.rot) * 30) * dt;
        l.rot += l.vr * dt;
        if (l.x > W + 20) { l.x = rand(-80, -10); l.y = rand(h.insetTop, H); }
      }
    }
  }

  /** Sky tint, clouds and rainbow: drawn above the background, below slimes. */
  drawBack(ctx: CanvasRenderingContext2D, h: WeatherHost) {
    const { W, H, horizon } = h;
    const k = this.k;
    const tint: Record<WeatherId, string | null> = {
      sunny: null,
      cloudy: `rgba(70,80,110,${0.14 * k})`,
      rain: `rgba(30,45,95,${0.26 * k})`,
      storm: `rgba(15,20,55,${0.42 * k})`,
      snow: `rgba(210,225,255,${0.16 * k})`,
      windy: null,
      rainbow: `rgba(255,240,250,${0.08 * k})`,
    };
    const t = tint[this.id];
    if (t) { ctx.fillStyle = t; ctx.fillRect(0, 0, W, H); }

    if (this.id === 'sunny') {
      // warm god-rays from the top right
      ctx.save();
      ctx.globalAlpha = 0.1 * k;
      ctx.translate(W * 0.85, -20);
      for (let i = 0; i < 5; i++) {
        ctx.rotate(0.18 + Math.sin(h.time * 0.2 + i) * 0.01);
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#fff6c0'); g.addColorStop(1, 'rgba(255,246,192,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-16, 0, 32 + i * 6, H);
      }
      ctx.restore();
    }

    if (this.id === 'rainbow') {
      const cx = W * 0.5, cy = horizon + 30, R = Math.max(W, horizon * 2) * 0.62;
      const cols = ['#ff5d6c', '#ffa94d', '#ffe45c', '#7ee06a', '#5ec8ff', '#9a6bff'];
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, horizon + 12); ctx.clip();
      ctx.globalAlpha = 0.55 * k;
      cols.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.arc(cx, cy, R - i * 10, Math.PI, 0);
        ctx.stroke();
      });
      ctx.restore();
      for (let i = 0; i < 12; i++) {
        const a = Math.PI + ((i + 0.5) / 12) * Math.PI;
        const tw = Math.abs(Math.sin(h.time * 2 + i));
        ctx.fillStyle = `rgba(255,255,255,${0.7 * tw * k})`;
        star4(ctx, cx + Math.cos(a) * (R - 25), cy + Math.sin(a) * (R - 25), 5 * tw + 1, 1.2);
      }
    }

    const overcast = this.id === 'cloudy' || this.id === 'rain' || this.id === 'storm' || this.id === 'snow';
    if (overcast) {
      const dark = this.id === 'storm' ? '#5a6385' : this.id === 'rain' ? '#8a93b0' : this.id === 'snow' ? '#e8efff' : '#d8dfee';
      const shade = this.id === 'storm' ? '#3b4262' : this.id === 'rain' ? '#6b7494' : '#b8c2d8';
      for (const c of this.clouds) {
        const x = c.x * W * 1.4 - W * 0.2, y = h.insetTop * 0.3 + c.y * (horizon * 0.55);
        const s = 34 * c.s;
        ctx.globalAlpha = 0.92 * k;
        blob(ctx, x, y + s * 0.2, s, shade);
        blob(ctx, x, y, s, dark);
        ctx.globalAlpha = 1;
      }
    }
    if (this.id === 'storm' && this.bolt) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,250,200,${this.flash})`;
      ctx.shadowColor = '#fff7a0';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      this.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Precipitation & flashes: drawn over the slimes. */
  drawFront(ctx: CanvasRenderingContext2D, h: WeatherHost) {
    const { W, H } = h;
    if (this.id === 'rain' || this.id === 'storm') {
      const slant = this.id === 'storm' ? 0.28 : 0.12;
      ctx.strokeStyle = 'rgba(200,220,255,0.55)';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const d of this.drops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * slant, d.y - d.len); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220,235,255,0.7)';
      ctx.lineWidth = 1.2;
      for (const s of this.splashes) {
        ctx.globalAlpha = 1 - s.t;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 2 + s.t * 7, 1 + s.t * 2.2, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (this.id === 'storm' && this.flash > 0) {
      ctx.fillStyle = `rgba(235,240,255,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.id === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (const f of this.flakes) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); }
    }
    if (this.id === 'windy') {
      for (const l of this.leaves) {
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.rot);
        ctx.fillStyle = l.c;
        ctx.beginPath(); ctx.ellipse(0, 0, l.s, l.s * 0.45, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const y = h.insetTop + ((i * 173 + h.time * 20) % (H - h.insetTop));
        const x = ((h.time * 420 + i * 311) % (W + 300)) - 150;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 50, y - 10, x + 110, y);
        ctx.stroke();
      }
    }
  }
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, s, 0, TAU);
  ctx.arc(x + s * 1.0, y + s * 0.2, s * 0.8, 0, TAU);
  ctx.arc(x - s * 1.0, y + s * 0.25, s * 0.75, 0, TAU);
  ctx.arc(x + s * 0.4, y - s * 0.45, s * 0.8, 0, TAU);
  ctx.arc(x - s * 0.5, y - s * 0.3, s * 0.65, 0, TAU);
  ctx.fill();
}
