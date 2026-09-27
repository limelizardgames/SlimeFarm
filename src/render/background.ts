import type { ThemeDef } from '../game/data';
import { darken, lighten, rgba, seeded } from './color';
import { star4 } from './slimeArt';

/** Paints the static part of the ranch (sky, hills, ground, fence) into an offscreen canvas. */
export function paintBackground(theme: ThemeDef, W: number, H: number, dpr: number, horizon: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * dpr);
  c.height = Math.ceil(H * dpr);
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const rnd = seeded(1234);

  // ── sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 40);
  sky.addColorStop(0, theme.sky[0]);
  sky.addColorStop(0.6, theme.sky[1]);
  sky.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 60);

  if (theme.night) {
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = rnd() * horizon * 0.95, s = 0.4 + rnd() * 1.4;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.6})`;
      if (rnd() < 0.15) star4(ctx, x, y, s * 3, s * 0.7);
      else { ctx.beginPath(); ctx.arc(x, y, s * 0.7, 0, 7); ctx.fill(); }
    }
    // moon
    const mx = W * 0.78, my = horizon * 0.42, mr = Math.min(W, H) * 0.07;
    const glow = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4);
    glow.addColorStop(0, 'rgba(220,210,255,0.45)');
    glow.addColorStop(1, 'rgba(220,210,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, horizon + 40);
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(200,190,160,0.35)';
    for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.1, 0.35, 0.12]]) {
      ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, rr * mr, 0, 7); ctx.fill();
    }
  } else {
    // sun with soft rays
    const sx = W * 0.82, sy = horizon * 0.38, sr = Math.min(W, H) * 0.075;
    const glow = ctx.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 5);
    glow.addColorStop(0, rgba(theme.accent, 0.55));
    glow.addColorStop(1, rgba(theme.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, horizon + 40);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = rgba('#ffffff', 0.18);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sr * 4, -sr * 0.35);
      ctx.lineTo(sr * 4, sr * 0.35);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const sg = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 0, sx, sy, sr);
    sg.addColorStop(0, '#fffbe0');
    sg.addColorStop(1, theme.accent);
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
  }

  // ── rolling hills (3 layers, back to front)
  const hillLayer = (baseY: number, amp: number, freq: number, phase: number, col: string, snowcap = false) => {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 8) {
      const y = baseY - amp * (0.6 * Math.sin(x * freq + phase) + 0.4 * Math.sin(x * freq * 2.3 + phase * 1.7));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, baseY - amp, 0, baseY + 80);
    g.addColorStop(0, lighten(col, 0.12));
    g.addColorStop(1, darken(col, 0.12));
    ctx.fillStyle = g;
    ctx.fill();
    if (snowcap) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, baseY - amp * 1.2, W, amp * 0.5);
      ctx.restore();
    }
  };
  hillLayer(horizon - 8, 34, 0.009, 1.2, theme.hills[0], theme.snow);
  hillLayer(horizon + 4, 22, 0.014, 3.1, theme.hills[1]);
  // trees on the mid layer
  for (let i = 0; i < 7; i++) {
    const x = rnd() * W, y = horizon + 2 + rnd() * 8, s = 10 + rnd() * 10;
    drawTree(ctx, x, y, s, theme);
  }
  hillLayer(horizon + 16, 12, 0.02, 5.3, theme.hills[2]);

  // ── ground (the pen)
  const gy = horizon + 18;
  const ground = ctx.createLinearGradient(0, gy, 0, H);
  ground.addColorStop(0, theme.ground[0]);
  ground.addColorStop(1, theme.ground[1]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, gy, W, H - gy);

  // light pools for depth
  for (let i = 0; i < 5; i++) {
    const x = rnd() * W, y = gy + rnd() * (H - gy), r = 60 + rnd() * 120;
    const lg = ctx.createRadialGradient(x, y, 0, x, y, r);
    lg.addColorStop(0, 'rgba(255,255,255,0.10)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * 0.6, 0, 0, 7); ctx.fill();
  }

  // grass tufts / texture
  const tuft = darken(theme.ground[1], 0.12);
  const tuftLight = lighten(theme.ground[0], 0.2);
  const count = Math.floor((W * (H - gy)) / 1400);
  for (let i = 0; i < count; i++) {
    const x = rnd() * W, y = gy + 10 + rnd() * (H - gy);
    const s = 3 + ((y - gy) / (H - gy)) * 5;
    ctx.strokeStyle = rnd() < 0.5 ? tuft : tuftLight;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y); ctx.lineTo(x - s * 0.9, y - s);
    ctx.moveTo(x, y); ctx.lineTo(x, y - s * 1.3);
    ctx.moveTo(x + s * 0.6, y); ctx.lineTo(x + s * 0.9, y - s);
    ctx.stroke();
  }

  // flowers / decorations
  const flowerCols = theme.id === 'candy' ? ['#fff', '#ff7ab8', '#7ad8ff', '#fff08a']
    : theme.id === 'frosty' ? ['#bfe6ff', '#ffffff', '#d7ccff']
    : theme.id === 'moonlit' ? ['#b8a6ff', '#8fe6ff', '#ffd6f6']
    : ['#ffffff', '#ffe45c', '#ff8fc8', '#b69bff'];
  for (let i = 0; i < count / 6; i++) {
    const x = rnd() * W, y = gy + 20 + rnd() * (H - gy - 20);
    const s = 1.8 + ((y - gy) / (H - gy)) * 2.4;
    const col = flowerCols[Math.floor(rnd() * flowerCols.length)];
    ctx.fillStyle = col;
    for (let k = 0; k < 5; k++) {
      const a = (k * Math.PI * 2) / 5;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.8, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, 7); ctx.fill();
  }

  // ── fence along the back of the pen
  drawFence(ctx, W, gy + 6, theme);

  // ── vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, theme.night ? 'rgba(5,0,30,0.45)' : 'rgba(40,10,60,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  return c;
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, theme: ThemeDef) {
  ctx.fillStyle = darken(theme.hills[2], 0.35);
  ctx.fillRect(x - s * 0.1, y - s * 0.4, s * 0.2, s * 0.6);
  if (theme.id === 'candy') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - s * 0.06, y - s * 1.1, s * 0.12, s * 1.2);
    ctx.fillStyle = ['#ff7ab8', '#7ad8ff', '#fff08a'][Math.floor((x * 7) % 3)];
    ctx.beginPath(); ctx.arc(x, y - s * 1.2, s * 0.55, 0, 7); ctx.fill();
    return;
  }
  const col = theme.id === 'frosty' ? '#dfefff' : theme.id === 'moonlit' ? '#3b3584' : theme.id === 'sunset' ? '#e07a8a' : '#4fa84a';
  if (theme.id === 'frosty' || theme.id === 'moonlit') {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.8); ctx.lineTo(x + s * 0.6, y - s * 0.2); ctx.lineTo(x - s * 0.6, y - s * 0.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.8); ctx.lineTo(x - s * 0.2, y - s * 1.0); ctx.lineTo(x - s * 0.5, y - s * 0.3); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y - s * 0.9, s * 0.6, 0, 7); ctx.arc(x - s * 0.35, y - s * 0.6, s * 0.45, 0, 7); ctx.arc(x + s * 0.35, y - s * 0.6, s * 0.45, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(x - s * 0.2, y - s * 1.1, s * 0.25, 0, 7); ctx.fill();
  }
}

function drawFence(ctx: CanvasRenderingContext2D, W: number, y: number, theme: ThemeDef) {
  const post = theme.id === 'candy' ? '#ffffff' : theme.id === 'frosty' ? '#e8f4ff' : theme.id === 'moonlit' ? '#6b5a8a' : '#c98b4f';
  const line = theme.id === 'moonlit' ? '#3a2d55' : theme.id === 'frosty' ? '#8fb8e0' : theme.id === 'candy' ? '#ff5fa2' : '#7a4a22';
  const gap = 38;
  // rails
  for (const dy of [-16, -6]) {
    ctx.fillStyle = post;
    ctx.fillRect(0, y + dy, W, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, y + dy + 3.5, W, 1.5);
  }
  for (let x = 8; x < W; x += gap) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + 2, 7, 2.5, 0, 0, 7); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x - 4, y - 22);
    ctx.lineTo(x, y - 27);
    ctx.lineTo(x + 4, y - 22);
    ctx.lineTo(x + 4, y);
    ctx.closePath();
    ctx.fillStyle = post;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = line;
    ctx.stroke();
    if (theme.id === 'candy') {
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#ff5fa2';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x - 5, y - k * 7); ctx.lineTo(x + 5, y - k * 7 - 5); ctx.lineTo(x + 5, y - k * 7 - 8); ctx.lineTo(x - 5, y - k * 7 - 3); ctx.fill(); }
      ctx.restore();
    }
    if (theme.snow) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(x, y - 25, 5, 2.5, 0, 0, 7); ctx.fill();
    }
  }
}

