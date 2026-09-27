import { game, type GrantedReward } from '../game/game';
import {
  SPECIES, TIER_NAMES, TIER_COLORS, VARIANTS, HATS, CHESTS, DAILY_REWARDS,
  AD_BOOST_MINUTES, AD_GEMS_REWARD, FESTIVAL_MIN_GOO, FOODS, WEATHER, MAX_PENS, MAX_TICKETS,
  HARMONY_MIN, HARMONY_BONUS, THEMES, AUTOFEED_PLANS, AUTOFEED_AD_MINUTES, AUTOFEED_MAX_HOURS,
  type ChestKind, type Reward, type FoodId,
} from '../game/data';
import { fmt, fmtTime } from '../game/format';
import { slimePortrait, hatPortrait } from '../render/slimeArt';
import { ads } from '../services/ads';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { icon, ICON } from './icons';
import { openModal, queueModal, toast, el, confirmModal, type ModalHandle } from './dom';
import { ctx } from './context';

// ─────────────────────────────────────────────────────────────
//  Rewarded-ad helper
// ─────────────────────────────────────────────────────────────
export async function watchAd(label: string, grant: () => void): Promise<boolean> {
  const ok = await ads.showRewarded(label);
  if (ok) {
    game.s.stats.ads++;
    grant();
    game.save();
    haptic('success');
  } else {
    toast('Ad not available right now — try again soon', 'tv');
  }
  return ok;
}

const adBtn = (label: string, attrs = '') =>
  `<button class="btn purple wide" ${attrs}>${icon('tv')}<span>${label}</span></button>`;

// ─────────────────────────────────────────────────────────────
//  Welcome back (offline earnings)
// ─────────────────────────────────────────────────────────────
export function showOffline() {
  const { goo, ms } = game.pendingOffline;
  if (goo <= 0) return;
  game.pendingOffline = { goo: 0, ms: 0 };
  queueModal(() => {
    let claimed = false;
    const claim = (mult: number) => {
      if (claimed) return;
      claimed = true;
      game.addGoo(goo * mult);
      audio.play('coin');
      ctx.ranch.confetti(ctx.ranch.W / 2, ctx.ranch.H * 0.45, mult > 1 ? 60 : 24);
      m.close();
    };
    const m = openModal({
      banner: 'Welcome back!',
      bannerColors: ['#7fd0ff', '#247fd6'],
      dismissable: false,
      html: `
        <div class="hero-art" style="height:130px"><div class="rays" style="--ray:rgba(127,208,255,.4)"></div><img src="${slimePortrait(topSlime(), 0, { size: 150, mood: 'sleepy' })}" style="width:130px;height:130px"></div>
        <p>Your slimes kept busy for <b>${fmtTime(ms)}</b> while you were away.</p>
        <div class="reward-big">${icon('goo')}<span>${fmt(goo)}</span></div>
        <div class="actions">
          ${adBtn(`Collect ×2 · ${fmt(goo * 2)}`, 'data-ad')}
          <button class="btn" data-take>Collect</button>
        </div>`,
    });
    m.card.querySelector('[data-take]')!.addEventListener('click', () => claim(1));
    m.card.querySelector('[data-ad]')!.addEventListener('click', () => watchAd('2× offline goo', () => claim(2)));
  });
}

function topSlime() {
  let best = game.s.slimes[0];
  for (const s of game.s.slimes) if (!best || game.slimeRate(s) > game.slimeRate(best)) best = s;
  return best?.sp ?? 'mint';
}

// ─────────────────────────────────────────────────────────────
//  Daily login calendar
// ─────────────────────────────────────────────────────────────
function rewardIcon(r: Reward) {
  switch (r.kind) {
    case 'goo': return icon('goo');
    case 'gems': return icon('gem');
    case 'boost': return icon('bolt');
    case 'chest': return icon('chest');
    case 'food': return icon(r.food);
  }
}
function rewardLabel(r: Reward) {
  switch (r.kind) {
    case 'goo': return `${r.minutes}m goo`;
    case 'gems': return `${r.amount}`;
    case 'boost': return `${r.minutes}m ×2`;
    case 'chest': return CHESTS[r.chest].name.split(' ')[0];
    case 'food': return `${r.amount} ${FOODS[r.food].name.split(' ')[1]}${r.amount > 1 ? 's' : ''}`;
  }
}

export function showDaily(force = false) {
  if (!force && !game.dailyReady()) return;
  queueModal(() => {
    const ready = game.dailyReady();
    const idx = ready ? game.dailyIndex() : (game.s.dailyStreak - 1) % 7;
    const days = DAILY_REWARDS.map((r, i) => {
      const cls = i < idx || (!ready && i === idx) ? 'done' : i === idx && ready ? 'today' : '';
      return `<div class="daily-day ${cls} ${i === 6 ? 'big' : ''}">Day ${i + 1}${rewardIcon(r)}<b>${rewardLabel(r)}</b></div>`;
    }).join('');
    const m = openModal({
      banner: 'Daily Treats',
      bannerColors: ['#ffe680', '#f0a000'],
      html: `
        <p>Come back every day for a sweeter reward. Day 7 is an <b>Epic Chest!</b></p>
        <div class="daily-grid">${days}</div>
        <div class="actions">${ready ? `<button class="btn gold wide" data-claim>${icon('gift')} Claim Day ${idx + 1}</button>` : `<button class="btn gray wide" data-x2>Come back tomorrow!</button>`}</div>`,
    });
    m.card.querySelector('[data-x2]')?.addEventListener('click', () => m.close());
    m.card.querySelector('[data-claim]')?.addEventListener('click', () => {
      const r = DAILY_REWARDS[idx];
      if (r.kind === 'chest') {
        m.close();
        const granted = game.claimDaily();
        showLoot(granted, CHESTS[r.chest].name, r.chest);
        return;
      }
      const granted = game.claimDaily();
      m.close();
      celebrateGrant(granted);
    });
  });
}

function celebrateGrant(granted: GrantedReward[]) {
  audio.play('coin');
  haptic('success');
  ctx.ranch.confetti(ctx.ranch.W / 2, ctx.ranch.H * 0.45, 40);
  for (const g of granted) toast(describeGrant(g), grantIconName(g));
  ctx.refresh();
}

function grantIconName(g: GrantedReward) {
  return g.kind === 'goo' ? 'goo' : g.kind === 'gems' ? 'gem' : g.kind === 'boost' ? 'bolt' : g.kind === 'hat' ? 'hat' : g.kind === 'food' ? g.food : 'egg';
}

function describeGrant(g: GrantedReward): string {
  switch (g.kind) {
    case 'goo': return `+${fmt(g.amount)} goo`;
    case 'gems': return `+${g.amount} gems`;
    case 'boost': return `+${g.minutes} min of 2× goo`;
    case 'hat': return g.dupe ? `Duplicate ${hatName(g.hat)} → +10 gems` : `New hat: ${hatName(g.hat)}!`;
    case 'slime': return g.slime ? `${SPECIES[g.sp].name} Lv ${g.lvl} hatched!` : `Pen full — converted to goo`;
    case 'food': return `+${g.amount} ${FOODS[g.food].name}${g.amount > 1 ? 's' : ''}`;
  }
}
const hatName = (id: string) => HATS.find((h) => h.id === id)?.name ?? id;

// ─────────────────────────────────────────────────────────────
//  Discovery celebration
// ─────────────────────────────────────────────────────────────
export function showDiscovery(spId: string, variant: number, gems: number) {
  setTimeout(() => queueModal(() => {
    const sp = SPECIES[spId];
    const tc = TIER_COLORS[sp.tier];
    audio.play('fanfare');
    haptic('success');
    ctx.ranch.celebrate();
    const recipe = sp.parents ? `<p style="margin:2px 0 6px"><b>${SPECIES[sp.parents[0]].name}</b> + <b>${SPECIES[sp.parents[1]].name}</b></p>` : '';
    const m = openModal({
      banner: 'New Slime Discovered!',
      bannerColors: [lightTier(tc), tc],
      html: `
        <div class="hero-art"><div class="rays" style="--ray:${tc}66"></div><img src="${slimePortrait(spId, variant as 0, { size: 180, mood: 'excited' })}"></div>
        <h2>${sp.name} Slime</h2>
        <span class="tier-tag" style="background:${tc}">${TIER_NAMES[sp.tier]}</span>
        ${recipe}
        <p class="flavor">“${sp.flavor}”</p>
        <div class="kv"><div><small>Goo / sec (Lv 1)</small><b>${fmt(sp.rate * game.globalMult())}</b></div><div><small>Reward</small><b style="display:inline-flex;align-items:center;gap:4px">${icon('gem')} +${gems}</b></div></div>
        <div class="actions"><button class="btn wide" data-ok>Awesome!</button></div>`,
    });
    m.card.querySelector('[data-ok]')!.addEventListener('click', () => m.close());
  }), 650);
}

const lightTier = (c: string) => c + 'cc';

// ─────────────────────────────────────────────────────────────
//  Slime detail (long-press)
// ─────────────────────────────────────────────────────────────
export function showSlimeInfo(uid: number) {
  const sl = game.getSlime(uid);
  if (!sl) return;
  const sp = SPECIES[sl.sp];
  const tc = TIER_COLORS[sp.tier];
  let m: ModalHandle;
  const render = () => {
    const hats = [`<button class="hat-opt ${!sl.hat ? 'on' : ''}" data-hat="">None</button>`]
      .concat(game.s.hats.map((h) => `<button class="hat-opt ${sl.hat === h ? 'on' : ''}" data-hat="${h}"><img src="${hatPortrait(h, 50)}" alt=""></button>`))
      .join('');
    const happy = Math.round(sl.happy);
    const mood = happy >= 80 ? 'Overjoyed' : happy >= 50 ? 'Content' : happy >= 25 ? 'Peckish' : 'Hungry!';
    const foods = (Object.keys(FOODS) as FoodId[]).map((f) =>
      `<button class="food-opt ${game.s.food[f] > 0 ? '' : 'empty'}" data-feed="${f}">${icon(f)}<b>${game.s.food[f]}</b></button>`).join('');
    const pens = game.s.pens.length > 1
      ? `<div class="section-title" style="margin-top:12px">${icon('fence')} Move to pen</div><div class="pen-strip">${game.s.pens.map((p, i) =>
          `<button class="pen-opt ${i === sl.pen ? 'on' : ''} ${i !== sl.pen && game.isFull(i) ? 'full' : ''}" data-move="${i}">${p.name}<small>${game.penSlimes(i).length}/${game.capacity()}</small></button>`).join('')}</div>`
      : '';
    const perks = [
      game.autoFeeding() ? `<span class="perk feeder">Auto-fed ${fmtTime(game.autoFeedRemaining())}</span>` : '',
      game.rushing(sl) ? `<span class="perk rush">Sugar rush ${fmtTime((sl.rushUntil ?? 0) - Date.now())}</span>` : '',
      game.harmony(sl) ? `<span class="perk harmony">Harmony +${HARMONY_BONUS * 100}%</span>` : '',
      game.weatherMult(sl.sp) > 1 ? `<span class="perk weather">${WEATHER[game.s.weather.id].name} ×${game.weatherMult(sl.sp)}</span>` : '',
    ].join('');
    return `
      <div class="hero-art" style="height:140px"><div class="rays" style="--ray:${tc}55"></div><img style="width:140px;height:140px" src="${slimePortrait(sl.sp, sl.variant, { size: 150, hat: sl.hat, mood: happy < 25 ? 'sleepy' : 'happy' })}"></div>
      <h2>${sl.variant ? VARIANTS[sl.variant].name + ' ' : ''}${sp.name}</h2>
      <span class="tier-tag" style="background:${tc}">${TIER_NAMES[sp.tier]} · Lv ${sl.lvl}</span>
      <div class="happy-meter"><span>${icon('hand')} ${mood}</span><div class="bar"><i style="width:${happy}%"></i></div><b>+${Math.round((game.happyMult(sl) - 1) * 100)}%</b></div>
      ${perks ? `<div class="perks">${perks}</div>` : ''}
      <div class="kv">
        <div><small>Goo / sec</small><b>${fmt(game.slimeRate(sl) * game.globalMult())}</b></div>
        <div><small>Mutation</small><b>${VARIANTS[sl.variant].name} ×${VARIANTS[sl.variant].mult}</b></div>
      </div>
      <div class="section-title" style="margin-top:12px">${icon('berry')} Feed</div>
      <div class="food-strip">${foods}</div>
      ${pens}
      <div class="section-title" style="margin-top:12px">${icon('hat')} Hats</div>
      ${game.s.hats.length ? `<div class="hat-strip">${hats}</div>` : `<p style="margin:0 0 6px">Find hats in chests or buy them in the Shop!</p>`}
      <div class="actions" style="grid-template-columns:1fr 1fr">
        <button class="btn pink small" data-sell>Sell · ${fmt(game.releaseValue(sl))}</button>
        <button class="btn small" data-ok>Done</button>
      </div>`;
  };
  m = openModal({ html: render() });
  const rerender = () => {
    const x = m.card.querySelector('.x');
    const scroll = m.card.scrollTop;
    m.card.innerHTML = '';
    if (x) m.card.appendChild(x);
    m.card.insertAdjacentHTML('beforeend', render());
    m.card.scrollTop = scroll;
    wire();
  };
  const wire = () => {
    m.card.querySelectorAll<HTMLElement>('[data-hat]').forEach((b) => b.addEventListener('click', () => {
      game.setHat(uid, (b.dataset.hat || undefined) as any);
      audio.play('pop');
      rerender();
    }));
    m.card.querySelectorAll<HTMLElement>('[data-feed]').forEach((b) => b.addEventListener('click', () => {
      const f = b.dataset.feed as FoodId;
      if (game.s.food[f] <= 0) { toast(`No ${FOODS[f].name}s left — get more from the snack tray`, f); audio.play('nope'); return; }
      const r = game.feed(uid, f);
      if (!r) { toast(`${sp.name} is already full!`, 'hand'); audio.play('nope'); return; }
      ctx.ranch.feedFx(uid, f, r);
      rerender();
    }));
    m.card.querySelectorAll<HTMLElement>('[data-move]').forEach((b) => b.addEventListener('click', () => {
      const pen = Number(b.dataset.move);
      if (pen === sl.pen) return;
      if (!game.moveSlime(uid, pen)) { toast(`${game.s.pens[pen].name} is full`, 'fence'); audio.play('nope'); return; }
      audio.play('whoosh');
      toast(`Moved to ${game.s.pens[pen].name}`, 'fence');
      m.close();
    }));
    m.card.querySelector('[data-ok]')?.addEventListener('click', () => m.close());
    m.card.querySelector('[data-sell]')?.addEventListener('click', async () => {
      m.close();
      const ok = await confirmModal('Sell this slime?', `You'll get <b>${fmt(game.releaseValue(sl))}</b> goo. This can't be undone.`, 'Sell', 'Keep it');
      if (!ok) return;
      const e = ctx.ranch.ents.get(uid);
      const v = game.release(uid);
      if (e) { ctx.ranch.burst(e.x, e.y - 30, '#fff', 14); ctx.ranch.floatText(e.x, e.y - 60, '+' + fmt(v), '#fff7c2', 20); ctx.ranch.ents.delete(uid); }
      audio.play('coin');
    });
  };
  wire();
}

// ─────────────────────────────────────────────────────────────
//  Pens manager
// ─────────────────────────────────────────────────────────────
export function showPens() {
  let m: ModalHandle;
  const render = () => {
    const rows = game.s.pens.map((p, i) => {
      const t = THEMES.find((x) => x.id === p.theme)!;
      const slimes = game.penSlimes(i);
      const faces = slimes.slice(0, 5).map((sl) => `<img src="${slimePortrait(sl.sp, sl.variant, { size: 32 })}" alt="">`).join('');
      return `<div class="pen-row ${i === game.s.activePen ? 'on' : ''}">
        <div class="pen-swatch" style="background:linear-gradient(180deg,${t.sky[1]},${t.sky[2]} 50%,${t.ground[0]} 50%,${t.ground[1]})">${faces}</div>
        <div class="meta"><b>${escapeHtml(p.name)}</b><small>${slimes.length}/${game.capacity()} slimes · ${fmt(game.penRate(i))}/s</small></div>
        <button class="btn small gray" data-rename="${i}" aria-label="Rename">✎</button>
        ${i === game.s.activePen ? `<button class="btn small" data-go="${i}" disabled>Here</button>` : `<button class="btn small blue" data-go="${i}">Visit</button>`}
      </div>`;
    }).join('');
    const n = game.s.pens.length;
    const cost = game.nextPenCost();
    const buy = n < MAX_PENS
      ? `<button class="btn gold wide ${game.s.goo >= cost ? '' : 'disabled'}" data-buy>${icon('fence')} Build pen #${n + 1} · ${icon('goo')} ${fmt(cost)}</button>`
      : `<p>You've built every pen. What a ranch!</p>`;
    return `<h2>Your Pens</h2>
      <p>Organize slimes into pens. Every pen keeps producing while you're elsewhere. Keep <b>${HARMONY_MIN}+ of one species</b> together for a <b>+${HARMONY_BONUS * 100}% Harmony</b> bonus.</p>
      <div class="pen-list">${rows}</div>
      <div class="actions">${buy}</div>
      <p class="fine">Tip: swipe the ranch sideways to hop between pens. Each pen remembers its own theme.</p>`;
  };
  m = openModal({ html: render() });
  const rerender = () => { const x = m.card.querySelector('.x'); m.card.innerHTML = ''; if (x) m.card.appendChild(x); m.card.insertAdjacentHTML('beforeend', render()); wire(); };
  const wire = () => {
    m.card.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => { game.setActivePen(Number(b.dataset.go)); audio.play('whoosh'); m.close(); }));
    m.card.querySelectorAll<HTMLElement>('[data-rename]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.rename);
      const row = b.closest('.pen-row')!;
      const meta = row.querySelector('.meta')!;
      meta.innerHTML = `<input class="pen-input" id="pen-name-${i}" maxlength="18" value="${escapeHtml(game.s.pens[i].name)}" aria-label="Pen name">`;
      const inp = meta.querySelector('input')!;
      inp.focus(); inp.select();
      const done = () => { game.renamePen(i, inp.value); rerender(); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
      inp.addEventListener('blur', done);
    }));
    m.card.querySelector('[data-buy]')?.addEventListener('click', (ev) => {
      if ((ev.currentTarget as HTMLElement).classList.contains('disabled')) { audio.play('nope'); toast('Not enough goo yet!', 'goo'); return; }
      if (game.buyPen()) {
        audio.play('fanfare');
        haptic('success');
        m.close();
        setTimeout(() => { ctx.ranch.celebrate(); toast(`${game.s.pens[game.s.activePen].name} is open! New eggs hatch here.`, 'fence'); }, 250);
      }
    });
  };
  wire();
}

function escapeHtml(t: string) {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ─────────────────────────────────────────────────────────────
//  Weather forecast
// ─────────────────────────────────────────────────────────────
export function showWeather() {
  const w = WEATHER[game.s.weather.id];
  const favored = w.id === 'rainbow' ? 'Every slime' : w.favors.map((e) => SPECIES[e].name).join(' & ') + ' slimes';
  const list = Object.values(WEATHER).map((x) =>
    `<div class="wx-row ${x.id === w.id ? 'on' : ''}">${icon(x.id)}<div><b>${x.name}</b><small>${x.id === 'rainbow' ? 'All slimes +25%, 2× shiny chance' : `${x.favors.map((e) => SPECIES[e].name).join(' & ')} ×${x.mult}`}</small></div></div>`).join('');
  const m = openModal({
    banner: 'Ranch Weather',
    bannerColors: ['#7fd0ff', '#247fd6'],
    html: `
      <div class="hero-art" style="height:110px"><div class="rays" style="--ray:rgba(127,208,255,.4)"></div><span class="ico" style="width:84px;height:84px;position:relative">${ICON[w.id]}</span></div>
      <h2>${w.name}</h2>
      <p>${w.blurb}<br><b>${favored} ×${w.mult}</b> · changes in ${fmtTime(game.s.weather.until - Date.now())}</p>
      <p class="fine" style="margin-top:-6px">Fused slimes count as every element in their family tree.</p>
      <div class="wx-list">${list}</div>
      <div class="actions"><button class="btn wide" data-ok>Got it</button></div>`,
  });
  m.card.querySelector('[data-ok]')!.addEventListener('click', () => m.close());
}

// ─────────────────────────────────────────────────────────────
//  Mini-game hub
// ─────────────────────────────────────────────────────────────
export function showGames(play: (g: 'catch' | 'match') => void) {
  queueModal(() => {
    const t = game.ticketsNow();
    const next = game.s.ticketAt ? fmtTime(game.s.ticketAt - Date.now()) : '';
    const m = openModal({
      banner: 'Slime Games',
      bannerColors: ['#7fd0ff', '#6a3fd6'],
      html: `
        <div class="tickets">${Array.from({ length: Math.max(MAX_TICKETS, t) }, (_, i) => `<span class="${i < t ? 'on' : ''}">${icon('ticket')}</span>`).join('')}</div>
        <p style="margin-top:4px">${t > 0 ? `You have <b>${t}</b> play ticket${t > 1 ? 's' : ''}.` : 'Out of tickets!'} ${t < MAX_TICKETS ? `Next ticket in ${next}.` : ''}</p>
        <div class="game-card" style="--g1:#8ef0b0;--g2:#22b560">
          <div class="gc-art">${icon('goo')}</div>
          <div class="meta"><b>Goo Catch</b><small>Slide to catch falling goo, dodge the rocks! Best: ${game.s.best.catch}</small></div>
          <button class="btn small ${t > 0 ? '' : 'disabled'}" data-play="catch">Play</button>
        </div>
        <div class="game-card" style="--g1:#ffc2e6;--g2:#d6357c">
          <div class="gc-art"><img src="${slimePortrait('mint', 0, { size: 48 })}" alt=""></div>
          <div class="meta"><b>Slime Match</b><small>Flip cards and find matching pairs. Best: ${game.s.best.match ? game.s.best.match + '★' : '—'}</small></div>
          <button class="btn small pink ${t > 0 ? '' : 'disabled'}" data-play="match">Play</button>
        </div>
        <p class="fine">Win goo, snacks and even Golden Apples. Better scores, better prizes!</p>
        <div class="actions">${adBtn('+1 ticket', 'data-ad')}</div>`,
    });
    m.card.querySelectorAll<HTMLElement>('[data-play]').forEach((b) => b.addEventListener('click', () => {
      if (b.classList.contains('disabled')) { audio.play('nope'); toast('No tickets left — watch an ad or wait a bit', 'ticket'); return; }
      if (!game.useTicket()) return;
      m.close();
      setTimeout(() => play(b.dataset.play as 'catch' | 'match'), 220);
    }));
    m.card.querySelector('[data-ad]')!.addEventListener('click', () => watchAd('+1 game ticket', () => {
      game.addTicket();
      m.close();
      setTimeout(() => showGames(play), 250);
    }));
  });
}

// ─────────────────────────────────────────────────────────────
//  Species detail (from the Slimedex)
// ─────────────────────────────────────────────────────────────
export function showSpecies(spId: string) {
  const sp = SPECIES[spId];
  const mask = game.s.dex[spId] ?? 0;
  const known = mask > 0;
  const tc = TIER_COLORS[sp.tier];
  let hint = '';
  if (sp.parents) {
    const [a, b] = sp.parents;
    const ka = !!game.s.dex[a], kb = !!game.s.dex[b];
    if (known || (ka && kb)) {
      hint = `<div class="row" style="justify-content:center;gap:6px;box-shadow:none">
        <img src="${slimePortrait(a, 0, { size: 56 })}" width="56" height="56"><b style="font:700 22px var(--font-display)">+</b>
        <img src="${slimePortrait(b, 0, { size: 56 })}" width="56" height="56"><b style="font:700 22px var(--font-display)">=</b>
        <img src="${slimePortrait(spId, 0, { size: 56, silhouette: !known })}" width="56" height="56"></div>
        <p style="margin:0 0 6px">${known ? 'Fuse two slimes of the <b>same level</b>.' : `Fuse <b>${SPECIES[a].name}</b> and <b>${SPECIES[b].name}</b> of the same level!`}</p>`;
    } else if (ka || kb) {
      hint = `<p>Hint: one ingredient is <b>${SPECIES[ka ? a : b].name}</b>…</p>`;
    } else {
      hint = `<p>Discover more slimes to reveal a hint.</p>`;
    }
  } else {
    hint = known ? `<p>Hatched from <b>${sp.name} eggs</b>.</p>` : `<p>Unlock <b>${sp.name} eggs</b> in Upgrades → Egg Research.</p>`;
  }
  const variants = VARIANTS.map((v, i) => `<div><small>${v.name}</small><b>${mask & (1 << i) ? '✓ Found' : '—'}</b></div>`).join('');
  const m = openModal({
    html: `
      <div class="hero-art" style="height:150px">${known ? `<div class="rays" style="--ray:${tc}55"></div>` : ''}<img style="width:150px;height:150px" src="${slimePortrait(spId, 0, { size: 160, silhouette: !known })}"></div>
      <h2>${known ? sp.name + ' Slime' : '???'}</h2>
      <span class="tier-tag" style="background:${tc}">${TIER_NAMES[sp.tier]}</span>
      ${known ? `<p class="flavor">“${sp.flavor}”</p>` : '<p></p>'}
      ${hint}
      ${known ? `<div class="kv" style="grid-template-columns:1fr 1fr 1fr">${variants}</div>` : ''}
      <div class="actions"><button class="btn wide" data-ok>Close</button></div>`,
  });
  m.card.querySelector('[data-ok]')!.addEventListener('click', () => m.close());
}

// ─────────────────────────────────────────────────────────────
//  Chests
// ─────────────────────────────────────────────────────────────
function chestSvg(kind: ChestKind) {
  const c = CHESTS[kind];
  return `<svg viewBox="0 0 120 120" class="chest-big" data-chest>
    <defs><linearGradient id="cb${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.color}"/><stop offset="1" stop-color="${c.color2}"/></linearGradient></defs>
    <ellipse cx="60" cy="108" rx="44" ry="7" fill="rgba(43,23,64,.2)"/>
    <path d="M14 52 h92 v44 a8 8 0 0 1-8 8 H22 a8 8 0 0 1-8-8Z" fill="url(#cb${kind})" stroke="#2b1740" stroke-width="5" stroke-linejoin="round"/>
    <path d="M14 52 v-6 a30 26 0 0 1 30-26 h32 a30 26 0 0 1 30 26 v6Z" fill="${c.color}" stroke="#2b1740" stroke-width="5" stroke-linejoin="round"/>
    <path d="M26 24 v80 M94 24 v80" stroke="#ffd23f" stroke-width="7"/>
    <path d="M26 24 v80 M94 24 v80" stroke="#2b1740" stroke-width="1.5" opacity=".4"/>
    <path d="M14 52 h92" stroke="#2b1740" stroke-width="5"/>
    <rect x="50" y="44" width="20" height="24" rx="5" fill="#ffe45c" stroke="#2b1740" stroke-width="4"/>
    <circle cx="60" cy="55" r="3.5" fill="#2b1740"/>
    <path d="M30 32 q10-8 22-8" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55" fill="none"/>
  </svg>`;
}

/** Plays the chest-opening sequence then reveals the given loot. */
export function showLoot(granted: GrantedReward[], title: string, kind: ChestKind = 'wood') {
  queueModal(() => {
    const m = openModal({
      banner: title,
      bannerColors: [CHESTS[kind].color, CHESTS[kind].color2],
      dismissable: false,
      html: `<div class="chest-stage">${chestSvg(kind)}</div><div class="tap-hint">Tap to open!</div><div class="loot"></div><div class="actions" style="display:none"><button class="btn wide" data-ok>Collect</button></div>`,
    });
    const chest = m.card.querySelector<SVGElement>('[data-chest]')!;
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      chest.classList.add('shake');
      audio.play('whoosh');
      haptic('medium');
      setTimeout(() => {
        chest.classList.remove('shake');
        chest.classList.add('burst');
        audio.play('chest');
        haptic('heavy');
        m.card.querySelector<HTMLElement>('.tap-hint')!.style.display = 'none';
        const loot = m.card.querySelector<HTMLElement>('.loot')!;
        granted.forEach((g, i) => {
          const card = el(`<div class="loot-card" style="animation-delay:${0.15 + i * 0.14}s">${lootArt(g)}<b>${lootAmount(g)}</b><small>${lootSub(g)}</small></div>`);
          loot.appendChild(card);
          setTimeout(() => audio.play('pop'), 150 + i * 140);
        });
        setTimeout(() => {
          m.card.querySelector<HTMLElement>('.chest-stage')!.style.height = '40px';
          m.card.querySelector<HTMLElement>('.actions')!.style.display = 'grid';
        }, 350);
      }, 900);
    };
    chest.addEventListener('click', open);
    setTimeout(open, 1400);
    m.card.querySelector('[data-ok]')!.addEventListener('click', () => { m.close(); ctx.refresh(); });
  });
}

function lootArt(g: GrantedReward) {
  switch (g.kind) {
    case 'goo': return icon('goo');
    case 'gems': return icon('gem');
    case 'boost': return icon('bolt');
    case 'hat': return `<img src="${hatPortrait(g.hat, 52)}" alt="">`;
    case 'slime': return `<img src="${slimePortrait(g.sp, g.slime?.variant ?? 0, { size: 60 })}" alt="">`;
    case 'food': return icon(g.food);
  }
}
function lootAmount(g: GrantedReward) {
  switch (g.kind) {
    case 'goo': return fmt(g.amount);
    case 'gems': return '+' + g.amount;
    case 'boost': return g.minutes + ' min';
    case 'hat': return g.dupe ? '+10 💎' : 'New!';
    case 'slime': return 'Lv ' + g.lvl;
    case 'food': return '×' + g.amount;
  }
}
function lootSub(g: GrantedReward) {
  switch (g.kind) {
    case 'goo': return 'Goo';
    case 'gems': return 'Gems';
    case 'boost': return '2× Goo';
    case 'hat': return hatName(g.hat);
    case 'slime': return g.slime ? SPECIES[g.sp].name : 'Pen full → goo';
    case 'food': return FOODS[g.food].name;
  }
}

export function openChest(kind: ChestKind, title = CHESTS[kind].name) {
  const rolled = game.rollChest(kind).map((r) => game.grant(r));
  game.save();
  showLoot(rolled, title, kind);
}

export function showChests() {
  queueModal(() => {
    let m: ModalHandle;
    const body = () => {
      const free = game.freeChestReady();
      const adReady = game.adChestReady();
      return `
        <h2>Treasure Chests</h2>
        <p>Chests hold goo, gems, rare eggs and hats!</p>
        <div class="row"><div class="thumb">${icon('chest')}</div><div class="meta"><b>Free Chest</b><small>${free ? 'Ready to open!' : 'Refills in ' + fmtTime(game.s.freeChestAt - Date.now())}</small></div>
          <button class="btn small ${free ? '' : 'disabled'}" data-free>Open</button></div>
        <div class="row"><div class="thumb">${icon('chest')}</div><div class="meta"><b>Bonus Chest</b><small>${adReady ? 'Watch a short ad' : 'Ready in ' + fmtTime(game.s.adChestAt - Date.now())}</small></div>
          <button class="btn purple small ${adReady ? '' : 'disabled'}" data-ad>${icon('tv')} Open</button></div>
        <div class="row"><div class="thumb" style="background:linear-gradient(#bfe8ff,#5ec8ff)">${icon('chest')}</div><div class="meta"><b>Rare Chest</b><small>3 rewards · better eggs & hats</small></div>
          <button class="btn blue small ${game.s.gems >= CHESTS.rare.gems ? '' : 'disabled'}" data-rare><span class="cost">${icon('gem')}${CHESTS.rare.gems}</span></button></div>
        <div class="row"><div class="thumb" style="background:linear-gradient(#ead6ff,#b67bff)">${icon('chest')}</div><div class="meta"><b>Epic Chest</b><small>4 rewards · the best loot</small></div>
          <button class="btn purple small ${game.s.gems >= CHESTS.epic.gems ? '' : 'disabled'}" data-epic><span class="cost">${icon('gem')}${CHESTS.epic.gems}</span></button></div>`;
    };
    m = openModal({ html: body() });
    const on = (sel: string, fn: () => void) => m.card.querySelector(sel)?.addEventListener('click', (ev) => {
      if ((ev.currentTarget as HTMLElement).classList.contains('disabled')) { audio.play('nope'); return; }
      fn();
    });
    on('[data-free]', () => {
      game.s.freeChestAt = Date.now() + game.freeChestCooldown();
      m.close();
      openChest('wood', 'Free Chest');
    });
    on('[data-ad]', () => watchAd('Bonus Chest', () => {
      game.s.adChestAt = Date.now() + game.adChestCooldown();
      m.close();
      openChest('wood', 'Bonus Chest');
    }));
    on('[data-rare]', () => { if (game.spendGems(CHESTS.rare.gems)) { m.close(); openChest('rare'); } });
    on('[data-epic]', () => { if (game.spendGems(CHESTS.epic.gems)) { m.close(); openChest('epic'); } });
  });
}

// ─────────────────────────────────────────────────────────────
//  Goo Rush (2× boost)
// ─────────────────────────────────────────────────────────────
export function showBoost() {
  queueModal(() => {
    const rem = game.boostRemaining();
    const m = openModal({
      banner: 'Goo Rush',
      bannerColors: ['#ffe680', '#f0a000'],
      html: `
        <div class="hero-art" style="height:120px"><div class="rays"></div><span class="ico" style="width:90px;height:90px;position:relative">${ICON.bolt}</span></div>
        <h2>2× Goo Production</h2>
        <p>Every ad adds <b>${AD_BOOST_MINUTES} minutes</b> of double goo. Stacks up to 4 hours — and keeps working while you're away!</p>
        ${rem > 0 ? `<p style="margin-top:-6px"><b>Active: ${fmtTime(rem)} left</b></p>` : ''}
        <div class="actions">
          ${adBtn(`+${AD_BOOST_MINUTES} min of 2×`, `data-ad ${game.canBoost() ? '' : 'disabled'}`)}
          <button class="btn gold wide ${game.s.gems >= 30 && game.canBoost() ? '' : 'disabled'}" data-gems>+60 min for ${icon('gem')} 30</button>
        </div>`,
    });
    m.card.querySelector('[data-ad]')!.addEventListener('click', () => watchAd('2× goo boost', () => {
      game.addBoost(AD_BOOST_MINUTES);
      m.close();
      toast(`Goo Rush! +${AD_BOOST_MINUTES} min of 2× goo`, 'bolt');
      ctx.ranch.celebrate();
    }));
    m.card.querySelector('[data-gems]')!.addEventListener('click', (ev) => {
      if ((ev.currentTarget as HTMLElement).classList.contains('disabled') || !game.spendGems(30)) { audio.play('nope'); return; }
      game.addBoost(60);
      m.close();
      toast('Goo Rush! +60 min of 2× goo', 'bolt');
      ctx.ranch.celebrate();
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  Floating gift bubble
// ─────────────────────────────────────────────────────────────
export function showGift() {
  const roll = Math.random();
  const gems = roll < 0.25;
  const base = gems ? 3 : game.gooForMinutes(3);
  queueModal(() => {
    let done = false;
    const take = (mult: number) => {
      if (done) return;
      done = true;
      if (gems) game.addGems(base * mult); else game.addGoo(base * mult);
      audio.play('coin');
      toast(gems ? `+${base * mult} gems` : `+${fmt(base * mult)} goo`, gems ? 'gem' : 'goo');
      m.close();
    };
    const m = openModal({
      banner: 'A gift floated by!',
      bannerColors: ['#ff8cc0', '#d6357c'],
      html: `
        <div class="hero-art" style="height:120px"><div class="rays" style="--ray:rgba(255,140,192,.45)"></div><span class="ico" style="width:86px;height:86px;position:relative">${ICON.gift}</span></div>
        <div class="reward-big">${icon(gems ? 'gem' : 'goo')}<span>${gems ? base : fmt(base)}</span></div>
        <div class="actions">
          ${adBtn(`Open it ×5 · ${gems ? base * 5 : fmt(base * 5)}`, 'data-ad')}
          <button class="btn gray wide" data-take>Just take it</button>
        </div>`,
    });
    m.card.querySelector('[data-take]')!.addEventListener('click', () => take(1));
    m.card.querySelector('[data-ad]')!.addEventListener('click', () => watchAd('5× gift', () => take(5)));
  });
}

// ─────────────────────────────────────────────────────────────
//  Free gems via ad
// ─────────────────────────────────────────────────────────────
export function adForGems() {
  if (game.adGemsLeft() <= 0) { toast('Come back tomorrow for more free gems!', 'gem'); return; }
  watchAd(`${AD_GEMS_REWARD} gems`, () => {
    game.useAdGems();
    game.addGems(AD_GEMS_REWARD);
    toast(`+${AD_GEMS_REWARD} gems`, 'gem');
    ctx.refresh();
  });
}

// ─────────────────────────────────────────────────────────────
//  Grand Festival (prestige)
// ─────────────────────────────────────────────────────────────
export function showFestival() {
  const gain = game.festivalRibbons();
  const m = openModal({
    banner: 'Grand Slime Festival',
    bannerColors: ['#ff8cc0', '#9a6bff'],
    html: `
      <div class="hero-art" style="height:120px"><div class="rays" style="--ray:rgba(255,140,192,.45)"></div><span class="ico" style="width:86px;height:86px;position:relative">${ICON.ribbon}</span></div>
      <p>Show off your ranch at the festival! You'll start a fresh ranch but earn <b>Blue Ribbons</b>: each one permanently adds <b>+10% goo</b>.</p>
      <div class="kv"><div><small>Ribbons now</small><b>${game.s.ribbons}</b></div><div><small>You'll earn</small><b style="color:var(--pink-d)">+${gain}</b></div></div>
      <p style="font-size:12.5px">You keep: gems, Slimedex, hats, themes & purchases.<br>You reset: goo, slimes, pens, upgrades & egg research.</p>
      <div class="actions">
        <button class="btn pink wide ${gain > 0 ? '' : 'disabled'}" data-go>${gain > 0 ? `Celebrate! +${gain} ${icon('ribbon')}` : `Earn ${fmt(FESTIVAL_MIN_GOO)} goo this run`}</button>
      </div>`,
  });
  m.card.querySelector('[data-go]')!.addEventListener('click', async (ev) => {
    if ((ev.currentTarget as HTMLElement).classList.contains('disabled')) { audio.play('nope'); return; }
    m.close();
    const ok = await confirmModal('Start the festival?', 'Your ranch will reset, but your Ribbons make every future ranch faster.', 'Let\'s party!', 'Not yet');
    if (!ok) return;
    const g = game.holdFestival();
    audio.play('fanfare');
    ctx.ranch.celebrate();
    toast(`+${g} Blue Ribbons! All goo +${g * 10}%`, 'ribbon');
  });
}


// ─────────────────────────────────────────────────────────────
//  Auto-Feeder
// ─────────────────────────────────────────────────────────────
export function showAutoFeed() {
  queueModal(() => {
    let m: ModalHandle;
    const render = () => {
      const on = game.autoFeeding();
      const plans = AUTOFEED_PLANS.map((p) => {
        const ok = game.canAutoFeed(p.minutes);
        const len = p.minutes >= 60 ? `${p.minutes / 60} hours` : `${p.minutes} min`;
        return `<div class="feed-plan">${p.tag ? `<span class="tag">${p.tag}</span>` : ''}
          <b>${len}</b>
          <button class="btn small pink ${ok && game.s.gems >= p.gems ? '' : 'disabled'}" data-plan="${p.id}"><span class="cost">${icon('gem')}${p.gems}</span></button>
        </div>`;
      }).join('');
      return `
        <div class="hero-art" style="height:110px"><div class="rays" style="--ray:rgba(255,140,192,.45)"></div><span class="ico" style="width:84px;height:84px;position:relative">${ICON.berry}</span></div>
        <h2>Auto-Feeder</h2>
        <p>Keeps <b>every slime in every pen</b> at full happiness (+50% goo), even while you're away. Time stacks up to ${AUTOFEED_MAX_HOURS} hours.</p>
        ${on ? `<div class="feeder-on">${icon('check')} Running · ${fmtTime(game.autoFeedRemaining())} left</div>` : ''}
        <div class="feed-plans">${plans}</div>
        <div class="actions">${adBtn(`Free ${AUTOFEED_AD_MINUTES} min`, `data-ad ${game.canAutoFeed(AUTOFEED_AD_MINUTES) ? '' : 'disabled'}`)}</div>`;
    };
    m = openModal({ banner: 'Snack Sprinkler', bannerColors: ['#ff8cc0', '#d6357c'], html: render() });
    const done = (min: number) => {
      m.close();
      audio.play('fanfare');
      haptic('success');
      ctx.ranch.celebrate();
      toast(`Auto-Feeder on: +${min >= 60 ? min / 60 + 'h' : min + ' min'} of happy slimes`, 'berry');
    };
    m.card.querySelectorAll<HTMLElement>('[data-plan]').forEach((b) => b.addEventListener('click', () => {
      const p = AUTOFEED_PLANS.find((x) => x.id === b.dataset.plan)!;
      if (b.classList.contains('disabled')) {
        audio.play('nope');
        toast(game.canAutoFeed(p.minutes) ? 'Not enough gems' : `The feeder holds at most ${AUTOFEED_MAX_HOURS} hours`, 'gem');
        return;
      }
      if (game.buyAutoFeed(p.minutes, p.gems)) done(p.minutes);
    }));
    m.card.querySelector('[data-ad]')!.addEventListener('click', () => {
      if (!game.canAutoFeed(AUTOFEED_AD_MINUTES)) { audio.play('nope'); return; }
      watchAd('Auto-Feeder', () => { game.addAutoFeed(AUTOFEED_AD_MINUTES); done(AUTOFEED_AD_MINUTES); });
    });
  });
}
