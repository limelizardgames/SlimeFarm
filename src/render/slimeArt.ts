import type { Species, HatId, Variant } from '../game/data';
import { SPECIES } from '../game/data';
import { darken, lighten, mix, rgba, hueShift, seeded, hashStr } from './color';

export type Mood = 'happy' | 'surprised' | 'sleepy' | 'excited' | 'held';

export interface SlimeDrawOpts {
  x: number;          // centre x
  y: number;          // ground contact y
  r: number;          // base radius
  sp: Species;
  variant?: Variant;
  t?: number;         // seconds, drives wobble & animated toppers
  squash?: number;    // + flattens, − stretches
  lean?: number;      // −1..1 horizontal lean of the top
  blink?: number;     // 0 open … 1 closed
  lookX?: number;
  lookY?: number;
  mood?: Mood;
  hat?: HatId;
  wobble?: number;
  silhouette?: boolean; // undiscovered codex entries
}

export interface Palette { c1: string; c2: string; line: string }

const paletteCache = new Map<string, Palette>();
export function paletteFor(sp: Species, variant: Variant = 0): Palette {
  const key = sp.id + variant;
  let p = paletteCache.get(key);
  if (p) return p;
  let c1 = sp.c1, c2 = sp.c2;
  if (variant === 1) { c1 = hueShift(sp.c1, 140, 0.25); c2 = hueShift(sp.c2, 140, 0.2); }
  if (variant === 2) { c1 = '#fff6c2'; c2 = mix('#e0a200', sp.c2, 0.15); }
  p = { c1, c2, line: darken(c2, 0.45) };
  paletteCache.set(key, p);
  return p;
}

interface BodyGeom { cx: number; cy: number; w: number; h: number; topX: number; topY: number }

function bodyPath(ctx: CanvasRenderingContext2D, x: number, ground: number, w: number, h: number, t: number, amp: number, lean: number): BodyGeom {
  const N = 30;
  const cy = ground - h;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th);
    let px: number, py: number;
    if (s > 0) {
      // bottom half: flatter base that spreads slightly
      py = Math.pow(s, 0.32);
      px = c * (1 + 0.1 * s);
    } else {
      py = s * 1.02;
      px = c;
    }
    const wob = 1 + amp * (Math.sin(3 * th + t * 3.1) * 0.55 + Math.sin(5 * th - t * 2.2) * 0.3) * (s < 0 ? 1 : 0.25);
    const up = (1 - py) / 2; // 1 at top, 0 at bottom
    pts.push([x + px * w * wob + lean * w * 0.35 * up * up, cy + py * h * (s < 0 ? wob : 1)]);
  }
  ctx.beginPath();
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[N - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < N; i++) {
    const p = pts[i], n = pts[(i + 1) % N];
    const m = mid(p, n);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
  return { cx: x + lean * w * 0.12, cy, w, h, topX: x + lean * w * 0.35, topY: cy - h * 1.02 };
}

export function drawSlime(ctx: CanvasRenderingContext2D, o: SlimeDrawOpts) {
  const t = o.t ?? 0;
  const sq = o.squash ?? 0;
  const r = o.r;
  const w = r * (1 + sq * 0.28);
  const h = r * 0.86 * (1 - sq * 0.32);
  const pal = paletteFor(o.sp, o.variant ?? 0);
  const lean = o.lean ?? 0;
  const lw = Math.max(1.6, r * 0.065);

  ctx.save();
  const g = bodyPath(ctx, o.x, o.y, w, h, t, o.wobble ?? 0.035, lean);

  if (o.silhouette) {
    ctx.fillStyle = 'rgba(40,30,80,0.55)';
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `700 ${r * 0.9}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', g.cx, g.cy + h * 0.1);
    ctx.restore();
    return;
  }

  // ── body fill
  const grad = ctx.createRadialGradient(g.cx - w * 0.35, g.cy - h * 0.55, r * 0.05, g.cx, g.cy, w * 1.35);
  grad.addColorStop(0, lighten(pal.c1, 0.35));
  grad.addColorStop(0.35, pal.c1);
  grad.addColorStop(0.8, mix(pal.c1, pal.c2, 0.75));
  grad.addColorStop(1, pal.c2);
  ctx.globalAlpha = o.sp.alpha ?? 1;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── interior (clipped)
  ctx.save();
  ctx.clip();
  drawPattern(ctx, o, g, pal, t);
  if (o.variant === 2) drawPatternShine(ctx, g, t);
  // bottom inner shade
  const sh = ctx.createLinearGradient(0, g.cy, 0, o.y);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, rgba(darken(pal.c2, 0.3), 0.45));
  ctx.fillStyle = sh;
  ctx.fillRect(g.cx - w * 1.5, g.cy, w * 3, h * 1.2);
  // rim light on the right edge
  ctx.globalCompositeOperation = 'lighter';
  const rim = ctx.createRadialGradient(g.cx + w * 0.9, g.cy + h * 0.1, 0, g.cx + w * 0.9, g.cy + h * 0.1, w * 0.6);
  rim.addColorStop(0, 'rgba(255,255,255,0.18)');
  rim.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(g.cx, g.cy - h, w * 1.5, h * 2.2);
  ctx.restore();

  // ── outline (patterns replaced the current path, so trace the body again)
  bodyPath(ctx, o.x, o.y, w, h, t, o.wobble ?? 0.035, lean);
  ctx.lineWidth = lw;
  ctx.strokeStyle = pal.line;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // ── glossy highlights
  ctx.save();
  ctx.translate(g.cx - w * 0.45 + lean * w * 0.15, g.cy - h * 0.5);
  ctx.rotate(-0.55);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.2, h * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(g.cx - w * 0.2 + lean * w * 0.2, g.cy - h * 0.78, r * 0.055, 0, Math.PI * 2);
  ctx.fill();

  drawFace(ctx, o, g, pal);

  if (o.hat) drawHat(ctx, o.hat, g.topX, g.topY + h * 0.12, r, t, lean);
  else drawTopper(ctx, o.sp, g.topX, g.topY + h * 0.06, r, t, pal);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
function drawFace(ctx: CanvasRenderingContext2D, o: SlimeDrawOpts, g: BodyGeom, pal: Palette) {
  const r = o.r;
  const mood = o.mood ?? 'happy';
  const lx = (o.lookX ?? 0) * r * 0.08;
  const ly = (o.lookY ?? 0) * r * 0.06;
  const fy = g.cy + g.h * 0.02 + ly;
  const fx = g.cx + lx + (o.lean ?? 0) * g.w * 0.08;
  const ex = g.w * 0.33;
  const ew = r * 0.12, eh = r * 0.17;
  const blink = mood === 'sleepy' ? 0.85 : o.blink ?? 0;
  const ink = '#2b1740';

  // blush
  ctx.fillStyle = 'rgba(255,110,150,0.38)';
  for (const sgn of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(fx + sgn * (ex + r * 0.1), fy + eh * 0.95, r * 0.13, r * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const sgn of [-1, 1]) {
    const x = fx + sgn * ex;
    if (mood === 'excited') {
      // happy closed ^ ^ eyes
      ctx.strokeStyle = ink;
      ctx.lineWidth = r * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - ew, fy + eh * 0.2);
      ctx.quadraticCurveTo(x, fy - eh * 0.9, x + ew, fy + eh * 0.2);
      ctx.stroke();
      continue;
    }
    if (blink > 0.75) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = r * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - ew, fy);
      ctx.quadraticCurveTo(x, fy + eh * 0.55, x + ew, fy);
      ctx.stroke();
      continue;
    }
    const sy = mood === 'surprised' || mood === 'held' ? 1.12 : 1;
    const hh = eh * sy * (1 - blink);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(x, fy, ew * sy, hh, 0, 0, Math.PI * 2);
    ctx.fill();
    // iris tint
    ctx.fillStyle = rgba(mix(pal.c2, '#3a1d6e', 0.5), 0.55);
    ctx.beginPath();
    ctx.ellipse(x, fy + hh * 0.35, ew * 0.75 * sy, hh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // sparkles
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - ew * 0.3, fy - hh * 0.38, ew * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + ew * 0.35, fy + hh * 0.35, ew * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // mouth
  const my = fy + eh * 0.95;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = r * 0.055;
  ctx.lineCap = 'round';
  if (mood === 'surprised' || mood === 'held') {
    ctx.beginPath();
    ctx.ellipse(fx, my + r * 0.04, r * 0.07, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (mood === 'excited') {
    ctx.beginPath();
    ctx.moveTo(fx - r * 0.13, my - r * 0.02);
    ctx.quadraticCurveTo(fx, my + r * 0.26, fx + r * 0.13, my - r * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff7a9a';
    ctx.beginPath();
    ctx.ellipse(fx, my + r * 0.09, r * 0.06, r * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // tiny cat-like "w" smile
    const s = r * 0.075;
    ctx.beginPath();
    ctx.moveTo(fx - s * 1.6, my);
    ctx.quadraticCurveTo(fx - s * 0.8, my + s * 1.3, fx, my + s * 0.1);
    ctx.quadraticCurveTo(fx + s * 0.8, my + s * 1.3, fx + s * 1.6, my);
    ctx.stroke();
  }
}

// ─────────────────────────────────────────────────────────────
function drawPatternShine(ctx: CanvasRenderingContext2D, g: BodyGeom, t: number) {
  const x = g.cx - g.w * 2 + ((t * 0.6) % 3) * g.w * 1.6;
  const lg = ctx.createLinearGradient(x, g.cy - g.h, x + g.w * 0.8, g.cy + g.h);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(g.cx - g.w * 2, g.cy - g.h * 2, g.w * 4, g.h * 4);
}

function drawPattern(ctx: CanvasRenderingContext2D, o: SlimeDrawOpts, g: BodyGeom, pal: Palette, t: number) {
  const rnd = seeded(hashStr(o.sp.id));
  const { cx, cy, w, h } = g;
  const r = o.r;
  switch (o.sp.pattern) {
    case 'spots': {
      ctx.fillStyle = rgba(darken(pal.c2, 0.1), 0.35);
      for (let i = 0; i < 6; i++) {
        const a = rnd() * Math.PI * 2, d = 0.3 + rnd() * 0.6;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * w * d, cy + Math.sin(a) * h * d * 0.9, r * (0.07 + rnd() * 0.1), r * (0.06 + rnd() * 0.08), rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'facets': {
      for (let i = 0; i < 7; i++) {
        const x = cx + (rnd() - 0.5) * w * 1.8, y = cy + (rnd() - 0.5) * h * 1.6, s = r * (0.18 + rnd() * 0.25);
        ctx.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s * 0.8, y + s * 0.3);
        ctx.lineTo(x - s * 0.5, y + s * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'swirl': {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = r * 0.06;
      ctx.lineCap = 'round';
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        const ox = cx + (k ? w * 0.45 : -w * 0.5), oy = cy + h * (k ? 0.45 : 0.25);
        for (let a = 0; a < Math.PI * 3.2; a += 0.2) {
          const rr = r * 0.03 * a;
          const px = ox + Math.cos(a + t * 0.8) * rr, py = oy + Math.sin(a + t * 0.8) * rr * 0.7;
          a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    }
    case 'cracks': {
      ctx.save();
      ctx.shadowColor = '#ffb020';
      ctx.shadowBlur = r * 0.3;
      ctx.strokeStyle = `rgba(255,${190 + Math.sin(t * 3) * 40},60,0.95)`;
      ctx.lineWidth = r * 0.055;
      ctx.lineJoin = 'round';
      for (let i = 0; i < 4; i++) {
        let x = cx + (rnd() - 0.5) * w * 1.4, y = cy + (rnd() - 0.5) * h * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 3; j++) { x += (rnd() - 0.5) * r * 0.5; y += (rnd() - 0.3) * r * 0.4; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'bolt': {
      ctx.fillStyle = `rgba(255,248,170,${0.55 + 0.3 * Math.sin(t * 5)})`;
      const bx = cx + w * 0.45, by = cy + h * 0.2, s = r * 0.32;
      ctx.beginPath();
      ctx.moveTo(bx, by - s);
      ctx.lineTo(bx - s * 0.5, by + s * 0.1);
      ctx.lineTo(bx - s * 0.05, by + s * 0.1);
      ctx.lineTo(bx - s * 0.3, by + s);
      ctx.lineTo(bx + s * 0.45, by - s * 0.15);
      ctx.lineTo(bx + s * 0.02, by - s * 0.15);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'bubbles': {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = r * 0.03;
      for (let i = 0; i < 6; i++) {
        const speed = 0.2 + rnd() * 0.3;
        const phase = (t * speed + rnd()) % 1;
        const x = cx + (rnd() - 0.5) * w * 1.3 + Math.sin(t * 2 + i) * r * 0.04;
        const y = g.cy + h - phase * h * 1.9;
        const s = r * (0.04 + rnd() * 0.06);
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'pearls': {
      for (let i = 0; i < 9; i++) {
        const x = cx + (rnd() - 0.5) * w * 1.6, y = cy + h * (0.45 + rnd() * 0.5);
        const s = r * 0.1;
        const pg = ctx.createRadialGradient(x - s * 0.3, y - s * 0.3, 0, x, y, s);
        pg.addColorStop(0, '#7a5a4a');
        pg.addColorStop(1, '#2d1a14');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'candy': {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.6);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = -5; i <= 5; i++) ctx.fillRect(i * r * 0.36, -r * 2, r * 0.16, r * 4);
      ctx.restore();
      break;
    }
    case 'rainbow': {
      const bands = ['#ff6b8a', '#ffb35c', '#ffe45c', '#7dff9a', '#6bd4ff', '#a98bff'];
      const bh = (h * 2.1) / bands.length;
      ctx.globalAlpha = 0.5;
      bands.forEach((c, i) => {
        ctx.fillStyle = c;
        const off = Math.sin(t * 1.5 + i * 0.6) * r * 0.05;
        ctx.fillRect(cx - w * 1.5, cy - h * 1.05 + i * bh + off, w * 3, bh + 1);
      });
      ctx.globalAlpha = 1;
      break;
    }
    case 'stars': {
      for (let i = 0; i < 14; i++) {
        const x = cx + (rnd() - 0.5) * w * 1.9, y = cy + (rnd() - 0.5) * h * 1.9;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + rnd() * 2) + i));
        const s = r * (0.02 + rnd() * 0.04) * (0.6 + tw * 0.6);
        ctx.fillStyle = `rgba(255,255,255,${tw})`;
        star4(ctx, x, y, s * 2.2, s * 0.5);
      }
      const neb = ctx.createRadialGradient(cx + w * 0.3, cy + h * 0.3, 0, cx + w * 0.3, cy + h * 0.3, w);
      neb.addColorStop(0, 'rgba(255,120,220,0.35)');
      neb.addColorStop(1, 'rgba(255,120,220,0)');
      ctx.fillStyle = neb;
      ctx.fillRect(cx - w * 2, cy - h * 2, w * 4, h * 4);
      break;
    }
    case 'aurora': {
      const cols = ['rgba(120,255,200,0.55)', 'rgba(140,120,255,0.5)', 'rgba(255,140,230,0.4)'];
      ctx.lineWidth = r * 0.22;
      ctx.lineCap = 'round';
      cols.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.beginPath();
        for (let x = -1.3; x <= 1.3; x += 0.1) {
          const px = cx + x * w;
          const py = cy - h * 0.2 + i * r * 0.25 + Math.sin(x * 3 + t * 1.2 + i) * r * 0.12;
          x <= -1.3 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
      break;
    }
    case 'drips': {
      ctx.fillStyle = rgba(lighten(pal.c1, 0.2), 0.8);
      ctx.beginPath();
      ctx.moveTo(cx - w * 1.2, cy - h * 1.2);
      ctx.lineTo(cx + w * 1.2, cy - h * 1.2);
      const top = cy - h * 0.45;
      for (let x = 1.2; x >= -1.2; x -= 0.2) {
        const d = (Math.sin(x * 9 + 1) * 0.5 + 0.5) * h * 0.35 + Math.sin(t * 1.3 + x * 4) * r * 0.03;
        ctx.lineTo(cx + x * w, top + d);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'sprinkles': {
      const cols = ['#ff5fa2', '#5ec8ff', '#ffe45c', '#7dff9a', '#b67bff', '#ffffff'];
      for (let i = 0; i < 14; i++) {
        const x = cx + (rnd() - 0.5) * w * 1.7, y = cy + (rnd() - 0.6) * h * 1.5;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rnd() * Math.PI);
        ctx.fillStyle = cols[i % cols.length];
        roundRect(ctx, -r * 0.07, -r * 0.022, r * 0.14, r * 0.044, r * 0.022);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'waves': {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = r * 0.06;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        const y0 = cy - h * 0.1 + k * r * 0.28;
        for (let x = -1.2; x <= 1.2; x += 0.08) {
          const py = y0 + Math.sin(x * 7 + t * 2 + k) * r * 0.05;
          x <= -1.2 ? ctx.moveTo(cx + x * w, py) : ctx.lineTo(cx + x * w, py);
        }
        ctx.stroke();
      }
      break;
    }
    case 'shine': {
      drawPatternShine(ctx, g, t);
      break;
    }
    case 'flakes': {
      ctx.strokeStyle = 'rgba(150,200,255,0.7)';
      ctx.lineWidth = r * 0.025;
      for (let i = 0; i < 5; i++) {
        const x = cx + (rnd() - 0.5) * w * 1.6, y = cy + (rnd() - 0.4) * h * 1.4, s = r * (0.08 + rnd() * 0.06);
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI) / 3 + t * 0.3;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
          ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
          ctx.stroke();
        }
      }
      break;
    }
    case 'honeycomb': {
      ctx.strokeStyle = 'rgba(200,120,0,0.35)';
      ctx.lineWidth = r * 0.035;
      const s = r * 0.17;
      for (let row = -4; row <= 4; row++) {
        for (let col = -5; col <= 5; col++) {
          const x = cx + col * s * 1.75 + (row % 2) * s * 0.87, y = cy + row * s * 1.5;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3 + Math.PI / 6;
            const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s;
            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      break;
    }
  }
}

// ─────────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function star4(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const d = i % 2 ? r : R;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export function star5(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const d = i % 2 ? r : R;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function outlined(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, line: string, lw: number) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = line;
  ctx.stroke();
}

// ─────────────────────────────────────────────────────────────
//  Species toppers (the little thing on each slime's head)
// ─────────────────────────────────────────────────────────────
function drawTopper(ctx: CanvasRenderingContext2D, sp: Species, x: number, y: number, r: number, t: number, pal: Palette) {
  const s = r / 40;
  const lw = Math.max(1.4, 2.2 * s);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const sway = Math.sin(t * 2.2) * 0.12;
  switch (sp.topper) {
    case 'sprout': {
      ctx.rotate(sway);
      ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(0, 2 * s); ctx.quadraticCurveTo(1 * s, -6 * s, 0, -10 * s); ctx.stroke();
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -9 * s);
        ctx.quadraticCurveTo(d * 12 * s, -20 * s, d * 16 * s, -10 * s);
        ctx.quadraticCurveTo(d * 8 * s, -4 * s, 0, -9 * s);
        outlined(ctx, d < 0 ? '#7ee06a' : '#5cc94b', '#2e7d32', lw);
      }
      break;
    }
    case 'flame': {
      const f = 1 + Math.sin(t * 9) * 0.08;
      for (const [c, k] of [['#ff5a2a', 1], ['#ffb02e', 0.68], ['#fff3a0', 0.38]] as [string, number][]) {
        ctx.beginPath();
        const H = 24 * s * k * f, W = 10 * s * k;
        ctx.moveTo(0, 3 * s);
        ctx.bezierCurveTo(-W * 1.4, -H * 0.2, -W * 0.3, -H * 0.6, Math.sin(t * 6) * 2 * s, -H);
        ctx.bezierCurveTo(W * 0.4, -H * 0.55, W * 1.4, -H * 0.2, 0, 3 * s);
        ctx.fillStyle = c; ctx.fill();
      }
      break;
    }
    case 'drop': {
      ctx.translate(0, -4 * s + Math.sin(t * 3) * 1.5 * s);
      ctx.beginPath();
      ctx.moveTo(0, -12 * s);
      ctx.quadraticCurveTo(8 * s, 0, 0, 4 * s);
      ctx.quadraticCurveTo(-8 * s, 0, 0, -12 * s);
      outlined(ctx, '#7fd6ff', '#2a6fd6', lw);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(-2 * s, -2 * s, 1.6 * s, 0, 7); ctx.fill();
      break;
    }
    case 'pebble': {
      ctx.beginPath(); ctx.ellipse(-3 * s, -3 * s, 7 * s, 5 * s, -0.2, 0, 7);
      outlined(ctx, '#b8a38a', '#6b5a48', lw);
      ctx.beginPath(); ctx.ellipse(6 * s, -1 * s, 4 * s, 3.4 * s, 0.3, 0, 7);
      outlined(ctx, '#9c8a74', '#6b5a48', lw);
      break;
    }
    case 'icicle': {
      for (const [dx, hh] of [[-7, 12], [0, 18], [7, 11]]) {
        ctx.beginPath();
        ctx.moveTo(dx * s - 4 * s, 2 * s);
        ctx.lineTo(dx * s, -hh * s);
        ctx.lineTo(dx * s + 4 * s, 2 * s);
        ctx.closePath();
        const ig = ctx.createLinearGradient(0, -hh * s, 0, 2 * s);
        ig.addColorStop(0, '#ffffff'); ig.addColorStop(1, '#9fdcff');
        outlined(ctx, ig, '#5aa7d8', lw * 0.8);
      }
      break;
    }
    case 'puff': {
      ctx.translate(0, -5 * s + Math.sin(t * 2) * 1.5 * s);
      ctx.beginPath();
      ctx.arc(-6 * s, 0, 6 * s, Math.PI * 0.5, Math.PI * 1.6);
      ctx.arc(0, -4 * s, 7 * s, Math.PI * 1.1, Math.PI * 1.95);
      ctx.arc(7 * s, 0, 6 * s, Math.PI * 1.4, Math.PI * 0.5);
      ctx.closePath();
      outlined(ctx, '#ffffff', mix(pal.c2, '#6a7ab8', 0.5), lw);
      break;
    }
    case 'stem': {
      ctx.rotate(sway * 0.6);
      ctx.strokeStyle = '#2f8a3a'; ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.moveTo(0, 2 * s); ctx.quadraticCurveTo(2 * s, -8 * s, 8 * s, -12 * s); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-4 * s, -1 * s, 7 * s, 3 * s, 0.2, 0, 7);
      outlined(ctx, '#4fbf5a', '#2f8a3a', lw);
      break;
    }
    case 'lilypad': {
      ctx.beginPath();
      ctx.ellipse(0, -2 * s, 14 * s, 5 * s, 0, 0.25, Math.PI * 2 - 0.1);
      ctx.lineTo(0, -2 * s);
      ctx.closePath();
      outlined(ctx, '#58c46a', '#2d7d3d', lw);
      drawFlower(ctx, 3 * s, -8 * s, 6 * s, '#ffc2e1', '#ffe45c', lw * 0.7, t);
      break;
    }
    case 'cherry': {
      ctx.strokeStyle = '#3d7a2a'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(0, -8 * s); ctx.quadraticCurveTo(4 * s, -18 * s, 9 * s, -20 * s); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -4 * s, 7 * s, 0, 7);
      outlined(ctx, '#ff2e4d', '#9e0f2a', lw);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(-2.5 * s, -6.5 * s, 2 * s, 0, 7); ctx.fill();
      break;
    }
    case 'flower': {
      ctx.rotate(sway * 0.5);
      drawFlower(ctx, 0, -8 * s, 10 * s, lighten(pal.c2, 0.35), '#ffe45c', lw, t);
      break;
    }
    case 'leaf': {
      ctx.rotate(0.4 + sway);
      ctx.beginPath();
      ctx.moveTo(0, 2 * s);
      ctx.quadraticCurveTo(12 * s, -8 * s, 0, -20 * s);
      ctx.quadraticCurveTo(-12 * s, -8 * s, 0, 2 * s);
      outlined(ctx, '#6fcf5a', '#2f7d2a', lw);
      ctx.strokeStyle = '#2f7d2a'; ctx.lineWidth = lw * 0.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16 * s); ctx.stroke();
      break;
    }
    case 'antenna': {
      for (const d of [-1, 1]) {
        ctx.strokeStyle = pal.line; ctx.lineWidth = 2.2 * s;
        const bx = d * 11 * s + Math.sin(t * 4 + d) * 1.5 * s, by = -18 * s;
        ctx.beginPath(); ctx.moveTo(d * 4 * s, 2 * s); ctx.quadraticCurveTo(d * 4 * s, -12 * s, bx, by); ctx.stroke();
        ctx.save();
        ctx.shadowColor = '#fff38a'; ctx.shadowBlur = 8 * s;
        ctx.beginPath(); ctx.arc(bx, by, 3.6 * s, 0, 7);
        outlined(ctx, '#fff59a', pal.line, lw * 0.8);
        ctx.restore();
      }
      break;
    }
    case 'crystal': {
      for (const [dx, hh, rot] of [[-7, 12, -0.35], [0, 20, 0], [7, 14, 0.35]]) {
        ctx.save();
        ctx.translate(dx * s, 2 * s);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(-4 * s, 0); ctx.lineTo(-4 * s, -hh * s * 0.7); ctx.lineTo(0, -hh * s);
        ctx.lineTo(4 * s, -hh * s * 0.7); ctx.lineTo(4 * s, 0); ctx.closePath();
        const cg = ctx.createLinearGradient(-4 * s, 0, 4 * s, 0);
        cg.addColorStop(0, lighten(pal.c1, 0.5)); cg.addColorStop(1, pal.c2);
        outlined(ctx, cg, pal.line, lw * 0.8);
        ctx.restore();
      }
      break;
    }
    case 'reed': {
      ctx.rotate(sway);
      ctx.strokeStyle = '#4a7a2a'; ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.moveTo(0, 2 * s); ctx.lineTo(0, -20 * s); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -22 * s, 3.4 * s, 7 * s, 0, 0, 7);
      outlined(ctx, '#8a5a30', '#4a2e18', lw * 0.8);
      break;
    }
    case 'straw': {
      ctx.rotate(0.3);
      ctx.beginPath();
      ctx.rect(-3 * s, -24 * s, 6 * s, 26 * s);
      outlined(ctx, '#ff7eb9', '#b83d7a', lw);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 4; i++) ctx.fillRect(-3 * s, -22 * s + i * 6 * s, 6 * s, 2 * s);
      break;
    }
    case 'raincloud': {
      ctx.translate(0, -14 * s + Math.sin(t * 2) * 2 * s);
      ctx.strokeStyle = '#6fb8ff'; ctx.lineWidth = 1.6 * s;
      for (let i = 0; i < 3; i++) {
        const ph = (t * 1.8 + i * 0.33) % 1;
        ctx.beginPath();
        ctx.moveTo((i - 1) * 6 * s, 4 * s + ph * 10 * s);
        ctx.lineTo((i - 1) * 6 * s - 1.5 * s, 8 * s + ph * 10 * s);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(-7 * s, 0, 6 * s, Math.PI * 0.5, Math.PI * 1.6);
      ctx.arc(0, -4 * s, 8 * s, Math.PI * 1.1, Math.PI * 1.95);
      ctx.arc(8 * s, 0, 6 * s, Math.PI * 1.4, Math.PI * 0.5);
      ctx.closePath();
      outlined(ctx, '#8b95b8', '#3b4668', lw);
      break;
    }
    case 'coral': {
      ctx.strokeStyle = '#ff6f61'; ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(0, 2 * s); ctx.lineTo(0, -12 * s);
      ctx.moveTo(0, -6 * s); ctx.lineTo(-7 * s, -14 * s);
      ctx.moveTo(0, -8 * s); ctx.lineTo(7 * s, -18 * s);
      ctx.stroke();
      ctx.strokeStyle = '#ffb0a3'; ctx.lineWidth = 2.2 * s; ctx.stroke();
      break;
    }
    case 'lollipop': {
      ctx.rotate(0.25 + sway * 0.5);
      ctx.fillStyle = '#fff'; ctx.fillRect(-1.5 * s, -14 * s, 3 * s, 16 * s);
      ctx.beginPath(); ctx.arc(0, -20 * s, 9 * s, 0, 7);
      outlined(ctx, '#ff8fc8', '#c23d82', lw);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      for (let a = 0; a < 12; a += 0.3) ctx.lineTo(Math.cos(a + t) * a * 0.62 * s, -20 * s + Math.sin(a + t) * a * 0.62 * s);
      ctx.stroke();
      break;
    }
    case 'halo': {
      ctx.save();
      ctx.shadowColor = '#fff4a0'; ctx.shadowBlur = 12 * s;
      ctx.strokeStyle = '#ffe36b'; ctx.lineWidth = 3.5 * s;
      ctx.beginPath(); ctx.ellipse(0, -12 * s + Math.sin(t * 2) * 2 * s, 14 * s, 4.5 * s, 0, 0, 7); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'crown': {
      drawHatCrown(ctx, s, lw);
      break;
    }
    case 'horns': {
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * 4 * s, 2 * s);
        ctx.quadraticCurveTo(d * 16 * s, -2 * s, d * 14 * s, -16 * s);
        ctx.quadraticCurveTo(d * 10 * s, -6 * s, d * 12 * s, 2 * s);
        ctx.closePath();
        outlined(ctx, '#fff4c2', '#7a6a3a', lw);
      }
      break;
    }
    case 'fin': {
      ctx.rotate(sway * 0.4);
      ctx.beginPath();
      ctx.moveTo(-10 * s, 3 * s);
      ctx.quadraticCurveTo(-4 * s, -20 * s, 10 * s, -18 * s);
      ctx.quadraticCurveTo(4 * s, -8 * s, 10 * s, 3 * s);
      ctx.closePath();
      outlined(ctx, lighten(pal.c2, 0.25), pal.line, lw);
      break;
    }
  }
  ctx.restore();
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, petal: string, center: string, lw: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.3);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, R * 0.5, R * 0.36, a, 0, 7);
    outlined(ctx, petal, darken(petal, 0.35), lw);
  }
  ctx.beginPath(); ctx.arc(0, 0, R * 0.32, 0, 7);
  outlined(ctx, center, darken(center, 0.35), lw);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
//  Hats (cosmetics) — replace the species topper when worn
// ─────────────────────────────────────────────────────────────
function drawHatCrown(ctx: CanvasRenderingContext2D, s: number, lw: number) {
  ctx.beginPath();
  ctx.moveTo(-14 * s, 2 * s);
  ctx.lineTo(-16 * s, -14 * s);
  ctx.lineTo(-7 * s, -6 * s);
  ctx.lineTo(0, -18 * s);
  ctx.lineTo(7 * s, -6 * s);
  ctx.lineTo(16 * s, -14 * s);
  ctx.lineTo(14 * s, 2 * s);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -18 * s, 0, 2 * s);
  g.addColorStop(0, '#fff3a0'); g.addColorStop(1, '#f0a800');
  outlined(ctx, g, '#8a5a00', lw);
  for (const [cx, c] of [[-7, '#ff4d6d'], [0, '#4dc3ff'], [7, '#7dff9a']] as [number, string][]) {
    ctx.beginPath(); ctx.arc(cx * s, -2 * s, 2.4 * s, 0, 7);
    outlined(ctx, c, '#8a5a00', lw * 0.6);
  }
}

export function drawHat(ctx: CanvasRenderingContext2D, hat: HatId, x: number, y: number, r: number, t: number, lean = 0) {
  const s = r / 40;
  const lw = Math.max(1.4, 2.2 * s);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean * 0.25 - 0.12);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (hat) {
    case 'party': {
      ctx.beginPath(); ctx.moveTo(-12 * s, 2 * s); ctx.lineTo(0, -28 * s); ctx.lineTo(12 * s, 2 * s); ctx.closePath();
      outlined(ctx, '#5ec8ff', '#1f5d9e', lw);
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#ffe45c';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-6 * s + i * 5 * s, -4 * s - i * 6 * s, 2.4 * s, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, -29 * s, 4 * s, 0, 7); outlined(ctx, '#ff5fa2', '#9e1f5d', lw * 0.8);
      break;
    }
    case 'bow': {
      ctx.translate(8 * s, -2 * s);
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(d * 14 * s, -14 * s, d * 18 * s, 8 * s, 0, 0);
        outlined(ctx, '#ff5fa2', '#a01f5d', lw);
      }
      ctx.beginPath(); ctx.arc(0, 0, 3.6 * s, 0, 7); outlined(ctx, '#ff8fc0', '#a01f5d', lw);
      break;
    }
    case 'tophat': {
      ctx.beginPath(); ctx.ellipse(0, 0, 17 * s, 4.5 * s, 0, 0, 7); outlined(ctx, '#2d2440', '#0f0a18', lw);
      ctx.beginPath(); ctx.rect(-10 * s, -22 * s, 20 * s, 22 * s); outlined(ctx, '#3a2f55', '#0f0a18', lw);
      ctx.fillStyle = '#ff4d6d'; ctx.fillRect(-10 * s, -7 * s, 20 * s, 4.5 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-7 * s, -20 * s, 3 * s, 12 * s);
      break;
    }
    case 'crown': drawHatCrown(ctx, s, lw); break;
    case 'wizard': {
      ctx.beginPath();
      ctx.moveTo(-15 * s, 2 * s);
      ctx.quadraticCurveTo(-4 * s, -14 * s, 2 * s, -32 * s);
      ctx.quadraticCurveTo(10 * s, -30 * s, 14 * s, -36 * s);
      ctx.quadraticCurveTo(8 * s, -12 * s, 15 * s, 2 * s);
      ctx.closePath();
      outlined(ctx, '#6a3fd6', '#2a1466', lw);
      ctx.beginPath(); ctx.ellipse(0, 2 * s, 19 * s, 4.5 * s, 0, 0, 7); outlined(ctx, '#5530b8', '#2a1466', lw);
      ctx.fillStyle = '#ffe45c';
      star5(ctx, -2 * s, -12 * s, 4 * s, 1.8 * s); ctx.fill();
      star5(ctx, 6 * s, -4 * s, 2.6 * s, 1.2 * s); ctx.fill();
      break;
    }
    case 'beanie': {
      ctx.beginPath(); ctx.arc(0, 0, 14 * s, Math.PI, 0); ctx.closePath(); outlined(ctx, '#ff8a5c', '#9e3d1f', lw);
      ctx.beginPath(); ctx.rect(-15 * s, -3 * s, 30 * s, 6 * s); outlined(ctx, '#ffd08a', '#9e3d1f', lw);
      ctx.beginPath(); ctx.arc(0, -16 * s, 5 * s, 0, 7); outlined(ctx, '#fff', '#9e3d1f', lw);
      break;
    }
    case 'cowboy': {
      ctx.beginPath();
      ctx.moveTo(-22 * s, -2 * s);
      ctx.quadraticCurveTo(0, 8 * s, 22 * s, -2 * s);
      ctx.quadraticCurveTo(24 * s, -8 * s, 18 * s, -4 * s);
      ctx.quadraticCurveTo(0, 2 * s, -18 * s, -4 * s);
      ctx.quadraticCurveTo(-24 * s, -8 * s, -22 * s, -2 * s);
      outlined(ctx, '#b0703a', '#5a3214', lw);
      ctx.beginPath();
      ctx.moveTo(-11 * s, -2 * s);
      ctx.quadraticCurveTo(-12 * s, -20 * s, -4 * s, -18 * s);
      ctx.quadraticCurveTo(0, -14 * s, 4 * s, -18 * s);
      ctx.quadraticCurveTo(12 * s, -20 * s, 11 * s, -2 * s);
      ctx.closePath();
      outlined(ctx, '#c6844a', '#5a3214', lw);
      ctx.fillStyle = '#5a3214'; ctx.fillRect(-11 * s, -6 * s, 22 * s, 3 * s);
      break;
    }
    case 'flowers': {
      const cols = ['#ff8fc8', '#ffe45c', '#8fd3ff', '#ffb38a', '#c8a6ff'];
      ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.ellipse(0, 0, 18 * s, 5 * s, 0, Math.PI, 0); ctx.stroke();
      cols.forEach((c, i) => {
        const a = Math.PI + (i + 0.5) * (Math.PI / cols.length);
        drawFlower(ctx, Math.cos(a) * 18 * s, Math.sin(a) * 5 * s - 2 * s, 5 * s, c, '#fff3a0', lw * 0.5, t * 0.3 + i);
      });
      break;
    }
    case 'headphones': {
      ctx.strokeStyle = '#3a3a55'; ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.arc(0, 8 * s, 20 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      for (const d of [-1, 1]) {
        ctx.beginPath(); roundRect(ctx, d * 20 * s - 5 * s, 2 * s, 10 * s, 14 * s, 4 * s);
        outlined(ctx, '#ff5fa2', '#3a3a55', lw);
      }
      break;
    }
    case 'viking': {
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * 10 * s, -6 * s);
        ctx.quadraticCurveTo(d * 24 * s, -8 * s, d * 22 * s, -24 * s);
        ctx.quadraticCurveTo(d * 16 * s, -12 * s, d * 8 * s, -12 * s);
        ctx.closePath();
        outlined(ctx, '#fff4d6', '#7a6a3a', lw);
      }
      ctx.beginPath(); ctx.arc(0, 2 * s, 14 * s, Math.PI, 0); ctx.closePath();
      outlined(ctx, '#b8c2cc', '#4a5560', lw);
      ctx.fillStyle = '#8a96a0'; ctx.fillRect(-14 * s, -1 * s, 28 * s, 4 * s);
      break;
    }
    case 'chef': {
      ctx.beginPath(); ctx.rect(-10 * s, -8 * s, 20 * s, 10 * s); outlined(ctx, '#ffffff', '#9aa0b8', lw);
      ctx.beginPath();
      ctx.arc(-8 * s, -14 * s, 7 * s, 0, 7);
      ctx.moveTo(15 * s, -14 * s); ctx.arc(8 * s, -14 * s, 7 * s, 0, 7);
      ctx.moveTo(8 * s, -20 * s); ctx.arc(0, -20 * s, 8 * s, 0, 7);
      outlined(ctx, '#ffffff', '#9aa0b8', lw);
      break;
    }
    case 'pirate': {
      ctx.beginPath();
      ctx.moveTo(-20 * s, 0);
      ctx.quadraticCurveTo(-12 * s, -24 * s, 0, -18 * s);
      ctx.quadraticCurveTo(12 * s, -24 * s, 20 * s, 0);
      ctx.quadraticCurveTo(0, -6 * s, -20 * s, 0);
      outlined(ctx, '#2d2440', '#0f0a18', lw);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, -10 * s, 3.6 * s, 0, 7); ctx.fill();
      ctx.fillRect(-4 * s, -6 * s, 8 * s, 1.6 * s);
      break;
    }
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
//  Cached portrait images for DOM (codex, cards, buttons)
// ─────────────────────────────────────────────────────────────
const portraitCache = new Map<string, string>();

export function slimePortrait(spId: string, variant: Variant = 0, opts: { size?: number; hat?: HatId; silhouette?: boolean; mood?: Mood } = {}): string {
  const size = opts.size ?? 96;
  const key = `${spId}|${variant}|${size}|${opts.hat ?? ''}|${opts.silhouette ? 1 : 0}|${opts.mood ?? ''}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  const dpr = 2;
  const c = document.createElement('canvas');
  c.width = c.height = size * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const r = size * 0.3;
  // soft ground shadow
  if (!opts.silhouette) {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(size / 2, size * 0.84, r * 1.05, r * 0.2, 0, 0, 7);
    ctx.fill();
  }
  drawSlime(ctx, {
    x: size / 2, y: size * 0.84, r, sp: SPECIES[spId], variant, t: 0.6,
    hat: opts.hat, silhouette: opts.silhouette, mood: opts.mood, wobble: 0,
  });
  const url = c.toDataURL();
  portraitCache.set(key, url);
  return url;
}

export function hatPortrait(hat: HatId, size = 64): string {
  const key = `hat|${hat}|${size}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  drawHat(ctx, hat, size / 2, size * 0.72, size * 0.9, 0, 0.45);
  const url = c.toDataURL();
  portraitCache.set(key, url);
  return url;
}
