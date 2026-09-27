import { game, type GameId, type GrantedReward } from '../game/game';
import { SPECIES, SPECIES_LIST, FOODS } from '../game/data';
import { fmt } from '../game/format';
import { drawSlime, slimePortrait, star4 } from '../render/slimeArt';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { icon } from './icons';
import { el, openModal, toast } from './dom';
import { watchAd } from './modals';
import { ctx } from './context';

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function playGame(id: GameId) {
  if (id === 'catch') gooCatch();
  else slimeMatch();
}

function favoriteSlime() {
  let best = game.penSlimes()[0] ?? game.s.slimes[0];
  for (const s of game.s.slimes) if (!best || game.baseRate(s) > game.baseRate(best)) best = s;
  return best ?? { sp: 'mint', variant: 0 as const, hat: undefined };
}

function overlay(title: string, colors: [string, string]) {
  const root = el<HTMLElement>(`<div class="mg" style="--m1:${colors[0]};--m2:${colors[1]}">
    <header class="mg-head">
      <button class="mg-quit" aria-label="Quit">${icon('close')}</button>
      <b>${title}</b>
      <div class="mg-stats"><span data-score>0</span><span data-time>0</span></div>
    </header>
    <div class="mg-stage"></div>
  </div>`);
  document.body.appendChild(root);
  return {
    root,
    stage: root.querySelector<HTMLElement>('.mg-stage')!,
    score: root.querySelector<HTMLElement>('[data-score]')!,
    time: root.querySelector<HTMLElement>('[data-time]')!,
    quit: root.querySelector<HTMLElement>('.mg-quit')!,
    close() { root.classList.add('out'); setTimeout(() => root.remove(), 250); },
  };
}

function results(id: GameId, title: string, score: number, perf: number, line: string) {
  const rewards = game.gameRewards(id, score, perf);
  const list = (rs: GrantedReward[]) => rs.map((r) => `<div class="loot-card" style="animation-delay:${0.1}s">${
    r.kind === 'goo' ? icon('goo') : r.kind === 'gems' ? icon('gem') : r.kind === 'food' ? icon(r.food) : icon('gift')}<b>${
    r.kind === 'goo' ? fmt(r.amount) : r.kind === 'gems' ? '+' + r.amount : r.kind === 'food' ? '×' + r.amount : ''}</b><small>${
    r.kind === 'goo' ? 'Goo' : r.kind === 'gems' ? 'Gems' : r.kind === 'food' ? FOODS[r.food].name : ''}</small></div>`).join('');
  const stars = Math.round(perf * 3 + 0.001);
  let done = false;
  const claim = (mult: number) => {
    if (done) return;
    done = true;
    for (let k = 0; k < mult; k++) rewards.forEach((r) => game.grant({ ...r }));
    game.save();
    audio.play('coin');
    haptic('success');
    ctx.ranch.celebrate();
    m.close();
  };
  audio.play(perf >= 0.6 ? 'fanfare' : 'coin');
  const m = openModal({
    banner: title,
    bannerColors: ['#7fd0ff', '#6a3fd6'],
    dismissable: false,
    html: `
      <div class="mg-stars">${[0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${0.15 + i * 0.18}s">★</span>`).join('')}</div>
      <h2>${line}</h2>
      <p>Score <b>${score}</b> · Best <b>${game.s.best[id]}</b></p>
      <div class="loot">${list(rewards)}</div>
      <div class="actions">
        <button class="btn purple wide" data-ad>${icon('tv')}<span>Double rewards</span></button>
        <button class="btn wide" data-ok>Collect</button>
      </div>`,
  });
  m.card.querySelector('[data-ok]')!.addEventListener('click', () => claim(1));
  m.card.querySelector('[data-ad]')!.addEventListener('click', () => watchAd('2× game rewards', () => claim(2)));
}

// ─────────────────────────────────────────────────────────────
//  Goo Catch — slide a slime to catch falling goo, dodge rocks
// ─────────────────────────────────────────────────────────────
interface Item { x: number; y: number; v: number; kind: 'goo' | 'gold' | 'rock' | 'heart'; rot: number; r: number }

function gooCatch() {
  const ui = overlay('Goo Catch', ['#9ee9ff', '#8be070']);
  const canvas = document.createElement('canvas');
  ui.stage.appendChild(canvas);
  const c = canvas.getContext('2d')!;
  const hero = favoriteSlime();
  const sp = SPECIES[hero.sp];
  let W = 0, H = 0;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    W = ui.stage.clientWidth; H = ui.stage.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  };
  resize();
  window.addEventListener('resize', resize);

  const DURATION = 40;
  let t = -3; // countdown
  let score = 0, lives = 3, x = W / 2, target = W / 2, sq = 0, sqV = 0, hurt = 0, happy = 0;
  let items: Item[] = [];
  let spawn = 0;
  let over = false;
  const parts: { x: number; y: number; vx: number; vy: number; life: number; c: string; text?: string }[] = [];
  const r = Math.min(46, W * 0.11);
  ui.score.innerHTML = `${icon('goo')}<em style="font-style:normal">0</em>`;
  const scoreNum = ui.score.querySelector('em')!;

  const move = (ev: PointerEvent) => { const b = canvas.getBoundingClientRect(); target = Math.max(r, Math.min(W - r, ev.clientX - b.left)); };
  canvas.addEventListener('pointerdown', move);
  canvas.addEventListener('pointermove', move);

  let last = performance.now();
  let raf = 0;
  let lastSec = 99;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    const groundY = H - 40;
    if (t < 0) {
      const sec = Math.ceil(-t);
      if (sec !== lastSec) { lastSec = sec; audio.play('tick'); }
    }
    if (t >= 0 && !over) {
      const speed = 1 + t / DURATION * 1.4;
      spawn -= dt;
      if (spawn < 0) {
        spawn = rand(0.35, 0.7) / speed;
        const roll = Math.random();
        const kind: Item['kind'] = roll < 0.22 + t / DURATION * 0.15 ? 'rock' : roll < 0.32 ? 'gold' : roll < 0.345 && lives < 3 ? 'heart' : 'goo';
        items.push({ x: rand(20, W - 20), y: -20, v: rand(150, 230) * speed, kind, rot: rand(0, TAU), r: kind === 'rock' ? 15 : 12 });
      }
      for (const it of items) { it.y += it.v * dt; it.rot += dt * 3; }
      const catchY = groundY - r * 1.6;
      items = items.filter((it) => {
        if (Math.abs(it.y - catchY) < 22 && Math.abs(it.x - x) < r * 1.05) {
          if (it.kind === 'rock') {
            lives--; hurt = 0.6; sqV -= 8; audio.play('hurt'); haptic('medium');
            parts.push({ x: it.x, y: it.y, vx: 0, vy: -60, life: 1, c: '#ff8a9a', text: '-1 ♥' });
            if (lives <= 0) finish();
          } else if (it.kind === 'heart') {
            lives = Math.min(3, lives + 1); audio.play('shiny');
            parts.push({ x: it.x, y: it.y, vx: 0, vy: -60, life: 1, c: '#ff8fc0', text: '+1 ♥' });
          } else {
            const pts = it.kind === 'gold' ? 5 : 1;
            score += pts; sqV += 6; happy = 0.4;
            audio.play(it.kind === 'gold' ? 'coin' : 'pop'); haptic('light');
            parts.push({ x: it.x, y: it.y, vx: 0, vy: -70, life: 1, c: it.kind === 'gold' ? '#ffe45c' : '#c8ffb0', text: '+' + pts });
            for (let i = 0; i < 6; i++) parts.push({ x: it.x, y: it.y, vx: rand(-90, 90), vy: rand(-140, -40), life: 0.6, c: it.kind === 'gold' ? '#ffd23f' : '#8ef05a' });
          }
          return false;
        }
        if (it.y > H + 30) return false;
        return true;
      });
      if (t >= DURATION) finish();
    }
    x += (target - x) * Math.min(1, dt * 14);
    sqV += (-300 * sq - 10 * sqV) * dt; sq += sqV * dt;
    hurt = Math.max(0, hurt - dt); happy = Math.max(0, happy - dt);
    for (const p of parts) { p.life -= dt * 1.4; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.text) p.vy += 300 * dt; }

    // ── draw
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#6cc8ff'); sky.addColorStop(0.75, '#d6f3ff'); sky.addColorStop(0.75, '#8be070'); sky.addColorStop(1, '#58b64c');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 4; i++) { const cx = ((i * 130 + now * 0.01) % (W + 160)) - 80, cy = 40 + i * 50; c.beginPath(); c.arc(cx, cy, 20, 0, TAU); c.arc(cx + 22, cy + 5, 16, 0, TAU); c.arc(cx - 20, cy + 6, 14, 0, TAU); c.fill(); }
    for (const it of items) drawItem(c, it);
    c.fillStyle = 'rgba(20,10,40,0.2)';
    c.beginPath(); c.ellipse(x, groundY + 2, r * 1.05, r * 0.22, 0, 0, TAU); c.fill();
    drawSlime(c, { x, y: groundY, r, sp, variant: hero.variant, hat: hero.hat, t: now / 1000, squash: Math.max(-0.6, Math.min(0.7, sq)), lean: (target - x) / 200, mood: hurt > 0 ? 'surprised' : happy > 0 ? 'excited' : 'happy', lookY: -1 });
    for (const p of parts) {
      if (p.life <= 0) continue;
      c.globalAlpha = Math.min(1, p.life * 1.5);
      if (p.text) {
        c.font = '700 20px Fredoka, sans-serif'; c.textAlign = 'center';
        c.lineWidth = 4; c.strokeStyle = '#2b1740'; c.strokeText(p.text, p.x, p.y); c.fillStyle = p.c; c.fillText(p.text, p.x, p.y);
      } else { c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, 3.5, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
    if (hurt > 0) { c.fillStyle = `rgba(255,80,100,${hurt * 0.35})`; c.fillRect(0, 0, W, H); }
    // hearts
    for (let i = 0; i < 3; i++) heart(c, 22 + i * 26, 22, 10, i < lives ? '#ff5f8f' : 'rgba(43,23,64,0.25)');
    if (t < 0) {
      const n = Math.ceil(-t);
      c.font = `700 ${90 - (Math.ceil(-t) + t) * 30}px Fredoka, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 8; c.strokeStyle = '#2b1740'; c.strokeText(String(n), W / 2, H * 0.42);
      c.fillStyle = '#fff'; c.fillText(String(n), W / 2, H * 0.42);
      c.font = '700 18px Fredoka, sans-serif'; c.lineWidth = 5;
      const tip = 'Slide to catch goo · dodge rocks!';
      c.strokeText(tip, W / 2, H * 0.42 + 70); c.fillText(tip, W / 2, H * 0.42 + 70);
    }
    if (ui.score.dataset.v !== String(score)) { ui.score.dataset.v = String(score); scoreNum.textContent = String(score); }
    ui.time.textContent = `${Math.max(0, Math.ceil(DURATION - Math.max(0, t)))}s`;
    if (!over) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  function finish() {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    setTimeout(() => {
      ui.close();
      const perf = Math.min(1, score / 60);
      results('catch', 'Goo Catch', score, perf, perf >= 0.9 ? 'Goo-tastic!' : perf >= 0.6 ? 'Great catching!' : perf >= 0.3 ? 'Nice try!' : 'Keep practicing!');
    }, 500);
  }
  ui.quit.addEventListener('click', finish);
}

function drawItem(c: CanvasRenderingContext2D, it: Item) {
  c.save();
  c.translate(it.x, it.y);
  if (it.kind === 'rock') {
    c.rotate(it.rot);
    c.fillStyle = '#9c8a7a'; c.strokeStyle = '#2b1740'; c.lineWidth = 2.5;
    c.beginPath();
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, d = it.r * (0.8 + ((i * 37) % 10) / 30); i ? c.lineTo(Math.cos(a) * d, Math.sin(a) * d) : c.moveTo(Math.cos(a) * d, Math.sin(a) * d); }
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(-4, -4, 3, 0, TAU); c.fill();
  } else if (it.kind === 'heart') {
    heart(c, 0, 0, 12, '#ff5f8f', true);
  } else {
    const gold = it.kind === 'gold';
    const g = c.createRadialGradient(-3, -2, 1, 0, 2, 14);
    g.addColorStop(0, gold ? '#fffbe0' : '#eaffc0'); g.addColorStop(1, gold ? '#f0a800' : '#2fae3a');
    c.fillStyle = g; c.strokeStyle = '#2b1740'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(0, -14); c.bezierCurveTo(8, -4, 11, 2, 11, 6); c.arc(0, 6, 11, 0, Math.PI); c.bezierCurveTo(-11, 2, -8, -4, 0, -14); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(-4, 3, 2.4, 3.6, 0.3, 0, TAU); c.fill();
    if (gold) { c.fillStyle = '#fff'; star4(c, 10, -10, 6, 1.4); }
  }
  c.restore();
}

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number, col: string, outline = true) {
  c.beginPath();
  c.moveTo(x, y + s * 0.8);
  c.bezierCurveTo(x - s * 1.6, y - s * 0.3, x - s * 0.7, y - s * 1.4, x, y - s * 0.5);
  c.bezierCurveTo(x + s * 0.7, y - s * 1.4, x + s * 1.6, y - s * 0.3, x, y + s * 0.8);
  c.fillStyle = col; c.fill();
  if (outline) { c.strokeStyle = '#2b1740'; c.lineWidth = 2; c.stroke(); }
}

// ─────────────────────────────────────────────────────────────
//  Slime Match — classic memory pairs with slime portraits
// ─────────────────────────────────────────────────────────────
function slimeMatch() {
  const ui = overlay('Slime Match', ['#ffc2e6', '#b894ff']);
  const known = SPECIES_LIST.filter((s) => game.s.dex[s.id]).map((s) => s.id);
  const pool = [...known.sort(() => Math.random() - 0.5), ...SPECIES_LIST.map((s) => s.id).filter((id) => !known.includes(id)).sort(() => Math.random() - 0.5)];
  const picks = pool.slice(0, 8);
  const deck = [...picks, ...picks].sort(() => Math.random() - 0.5);
  const grid = el<HTMLElement>(`<div class="mm-grid">${deck.map((id, i) => `
    <button class="mm-card" data-i="${i}" data-sp="${id}" aria-label="Card ${i + 1}">
      <span class="mm-inner"><span class="mm-back"></span><span class="mm-front"><img src="${slimePortrait(id, 0, { size: 80 })}" alt=""><small>${SPECIES[id].name}</small></span></span>
    </button>`).join('')}</div>`);
  ui.stage.appendChild(grid);
  ui.stage.classList.add('mm-stage');

  const LIMIT = 75;
  let open: HTMLElement[] = [];
  let moves = 0, pairs = 0, lock = false, over = false;
  const start = performance.now();
  const peek = 1400;
  // quick peek at the start
  grid.querySelectorAll<HTMLElement>('.mm-card').forEach((c) => c.classList.add('up'));
  lock = true;
  setTimeout(() => { grid.querySelectorAll<HTMLElement>('.mm-card').forEach((c) => c.classList.remove('up')); lock = false; }, peek);

  const timer = setInterval(() => {
    const left = LIMIT - (performance.now() - start - peek) / 1000;
    ui.time.textContent = `${Math.max(0, Math.ceil(Math.min(LIMIT, left)))}s`;
    ui.score.textContent = `${pairs}/8 · ${moves} move${moves === 1 ? '' : 's'}`;
    if (left <= 0) finish();
  }, 200);

  grid.addEventListener('click', (ev) => {
    const card = (ev.target as HTMLElement).closest<HTMLElement>('.mm-card');
    if (!card || lock || over || card.classList.contains('up')) return;
    card.classList.add('up');
    audio.play('flip');
    open.push(card);
    if (open.length < 2) return;
    moves++;
    const [a, b] = open;
    open = [];
    if (a.dataset.sp === b.dataset.sp) {
      pairs++;
      setTimeout(() => { a.classList.add('matched'); b.classList.add('matched'); audio.play('merge'); haptic('light'); }, 250);
      if (pairs === 8) setTimeout(finish, 700);
    } else {
      lock = true;
      setTimeout(() => { a.classList.remove('up'); b.classList.remove('up'); lock = false; audio.play('drop'); }, 750);
    }
  });

  function finish() {
    if (over) return;
    over = true;
    clearInterval(timer);
    const elapsed = (performance.now() - start - peek) / 1000;
    const timeLeft = Math.max(0, LIMIT - elapsed);
    const stars = pairs < 8 ? 0 : moves <= 14 ? 3 : moves <= 20 ? 2 : 1;
    const perf = pairs < 8 ? (pairs / 8) * 0.55 : Math.min(1, 0.45 + stars * 0.15 + (timeLeft / LIMIT) * 0.1);
    setTimeout(() => {
      ui.close();
      results('match', 'Slime Match', stars, perf, pairs < 8 ? `${pairs} of 8 pairs found` : stars === 3 ? 'Perfect memory!' : stars === 2 ? 'Sharp eyes!' : 'All matched!');
    }, 400);
  }
  ui.quit.addEventListener('click', () => { if (!over) { toast('Game ended early', 'game'); finish(); } });
}
