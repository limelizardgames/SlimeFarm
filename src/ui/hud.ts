import { game } from '../game/game';
import { SPECIES, UPGRADES, EGG_UNLOCK_COST, WEATHER, FOODS, type FoodId, type WeatherId } from '../game/data';
import { fmt, fmtTime } from '../game/format';
import { slimePortrait, paletteFor } from '../render/slimeArt';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { icon } from './icons';
import { el, onAct, setText, toast } from './dom';
import { showBoost, showChests, showDaily, showFestival, showPens, showWeather, showGames } from './modals';
import { playGame } from './minigames';
import { ctx } from './context';

function eggSvg(sp: string) {
  const pal = paletteFor(SPECIES[sp], 0);
  return `<svg viewBox="0 0 32 32"><path d="M16 2.5 C23 2.5 26.5 13 26.5 19 a10.5 9.5 0 0 1-21 0 C5.5 13 9 2.5 16 2.5Z" fill="#fff8ee" stroke="#2b1740" stroke-width="2.3"/>
    <circle cx="12" cy="12" r="2.6" fill="${pal.c2}"/><circle cx="20.5" cy="18" r="3.4" fill="${pal.c2}"/><circle cx="12.5" cy="23" r="2" fill="${pal.c2}"/><circle cx="19" cy="8" r="1.4" fill="${pal.c2}"/>
    <ellipse cx="11" cy="17" rx="1.8" ry="3" fill="#fff" opacity=".9" transform="rotate(20 11 17)"/></svg>`;
}

export class Hud {
  root: HTMLElement;
  private gooEl!: HTMLElement;
  private rateEl!: HTMLElement;
  private gemsEl!: HTMLElement;
  private boostEl!: HTMLElement;
  private hatchBtn!: HTMLElement;
  private costEl!: HTMLElement;
  private progEl!: HTMLElement;
  private capEl!: HTMLElement;
  private eggPick!: HTMLElement;
  private lastEgg = '';
  private lastWx: WeatherId | '' = '';
  private tray!: HTMLElement;
  private careRow!: HTMLElement;
  private lastGooShown = -1;

  constructor(parent: HTMLElement, private onTab: (id: string) => void) {
    this.root = el(`<div class="hud">
      <div class="hud-top">
        <div class="goo-card">${icon('goo', 'goo-ico')}<div><div class="goo-amount">0</div><div class="goo-rate">+0/s</div></div></div>
        <div class="hud-spacer"></div>
        <button class="pill gem-pill" data-act="gems">${icon('gem')}<span data-gems>0</span><span class="plus">+</span></button>
        <button class="icon-btn" data-act="settings" aria-label="Settings">${icon('gear')}</button>
      </div>
      <div class="left-stack">
        <button class="wx-chip" data-act="weather"><span class="wx-ico"></span><span><b data-wx-name>Sunny</b><small data-wx-sub></small></span></button>
        <div class="boost-chip">${icon('bolt')}<span data-boost>2×</span></div>
      </div>
      <div class="rail">
        <button class="rail-btn" data-act="daily">${icon('calendar')}<span class="lbl">Daily</span><span class="badge" data-daily-badge>!</span></button>
        <button class="rail-btn" data-act="chests">${icon('chest')}<span class="lbl" data-chest-lbl>Chest</span></button>
        <button class="rail-btn ad" data-act="boost"><span class="ad-tag">AD</span>${icon('bolt')}<span class="lbl">2× Goo</span></button>
        <button class="rail-btn festival" data-act="festival" style="display:none">${icon('ribbon')}<span class="lbl">Festival</span></button>
      </div>
      <div class="dock">
        <div class="care-row">
          <button class="care-btn" data-act="feed">${icon('berry')}<span>Snacks</span></button>
          <div class="pen-bar">
            <button class="pen-arrow" data-act="penPrev" aria-label="Previous pen">‹</button>
            <button class="pen-name" data-act="pens">${icon('fence')}<span data-pen-name>Meadow Pen</span></button>
            <button class="pen-arrow" data-act="penNext" aria-label="Next pen">›</button>
          </div>
          <button class="care-btn games" data-act="games">${icon('game')}<span>Games</span><span class="badge" data-ticket-badge>3</span></button>
        </div>
        <div class="snack-tray" hidden>
          ${(Object.keys(FOODS) as FoodId[]).map((f) => `<div class="snack" data-food="${f}">
            <div class="snack-drag" data-drag="${f}">${icon(f)}<b data-food-n="${f}">0</b></div>
            <button class="snack-buy" data-act="buyFood" data-id="${f}"><span data-food-cost="${f}"></span></button>
          </div>`).join('')}
          <div class="snack-side">
            <button class="btn small" data-act="feedAll">Feed all</button>
            <small>Drag a snack onto a slime</small>
          </div>
          <button class="snack-x" data-act="feed" aria-label="Close snacks">${icon('close')}</button>
        </div>
        <div class="hatch-row">
          <button class="side-chip egg-picker" data-act="egg"><img alt=""><small data-egg-name>Mint</small></button>
          <button class="hatch-btn" data-act="hatch">
            <span class="egg-ico ico"></span>
            <div class="ht"><b>HATCH</b><span>${icon('goo')}<em data-cost style="font-style:normal">0</em></span></div>
            <i class="prog"></i>
          </button>
          <button class="side-chip cap" data-act="pens"><b data-cap>0/8</b><small>Pen</small></button>
        </div>
        <nav class="tabs">
          <button class="tab active" data-act="tab" data-tab="ranch">${icon('home')}Ranch</button>
          <button class="tab" data-act="tab" data-tab="upgrades">${icon('up')}Upgrades<span class="badge" data-up-badge style="display:none">!</span></button>
          <button class="tab" data-act="tab" data-tab="dex">${icon('book')}Slimedex<span class="badge" data-dex-badge style="display:none">0</span></button>
          <button class="tab" data-act="tab" data-tab="shop">${icon('bag')}Shop</button>
        </nav>
      </div>
    </div>`);
    parent.appendChild(this.root);
    this.root.style.display = 'contents';
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    this.gooEl = q('.goo-amount');
    this.rateEl = q('.goo-rate');
    this.gemsEl = q('[data-gems]');
    this.boostEl = q('.boost-chip');
    this.hatchBtn = q('.hatch-btn');
    this.costEl = q('[data-cost]');
    this.progEl = q('.prog');
    this.capEl = q('[data-cap]');
    this.eggPick = q('.egg-picker');
    this.tray = q('.snack-tray');
    this.careRow = q('.care-row');
    this.bindSnackDrag();

    onAct(this.root, {
      hatch: () => this.hatch(),
      egg: () => {
        if (game.s.eggsUnlocked.length < 2) { toast('Unlock more eggs in Upgrades!', 'egg'); return; }
        game.cycleEgg();
        this.eggPick.animate([{ transform: 'scale(.85) rotate(-8deg)' }, { transform: 'scale(1)' }], { duration: 250, easing: 'cubic-bezier(.3,1.6,.5,1)' });
      },
      tab: (t) => this.onTab(t.dataset.tab!),
      gems: () => this.onTab('shop'),
      settings: () => this.onTab('settings'),
      daily: () => showDaily(true),
      chests: () => showChests(),
      boost: () => showBoost(),
      festival: () => showFestival(),
      weather: () => showWeather(),
      pens: () => showPens(),
      penPrev: () => this.switchPen(-1),
      penNext: () => this.switchPen(1),
      games: () => showGames((g) => playGame(g)),
      feed: () => this.toggleTray(),
      feedAll: () => {
        const n = game.feedAll();
        if (n === 0) {
          toast(game.s.food.berry <= 0 ? 'Out of berries — buy more with +' : 'Everyone here is already happy!', 'berry');
          audio.play('nope');
          return;
        }
        for (const sl of game.penSlimes()) if (sl.happy >= 60) ctx.ranch.feedFx(sl.uid, 'berry', { levelUp: false, rush: false });
        toast(`Fed ${n} slime${n > 1 ? 's' : ''}`, 'berry');
      },
      buyFood: (t) => {
        const f = t.dataset.id as FoodId;
        const n = f === 'berry' ? 5 : 1;
        if (game.buyFood(f, n)) { audio.play('buy'); toast(`+${n} ${FOODS[f].name}${n > 1 ? 's' : ''}`, f); }
        else { audio.play('nope'); toast(FOODS[f].gems ? 'Not enough gems' : 'Not enough goo', FOODS[f].gems ? 'gem' : 'goo'); }
      },
    });
  }

  switchPen(dir: number) {
    const n = game.s.pens.length;
    if (n < 2) { showPens(); return; }
    game.setActivePen((game.s.activePen + dir + n) % n);
    audio.play('whoosh');
  }

  private toggleTray(force?: boolean) {
    const open = force ?? this.tray.hidden;
    this.tray.hidden = !open;
    this.careRow.hidden = open;
    audio.play(open ? 'open' : 'close');
  }

  /** Snacks are dragged from the tray and dropped onto a slime on the ranch. */
  private bindSnackDrag() {
    let drag: { food: FoodId; ghost: HTMLElement; id: number; x0: number; y0: number; moved: boolean } | null = null;
    this.tray.addEventListener('pointerdown', (ev) => {
      const src = (ev.target as HTMLElement).closest<HTMLElement>('[data-drag]');
      if (!src) return;
      const food = src.dataset.drag as FoodId;
      if (game.s.food[food] <= 0) { toast(`No ${FOODS[food].name}s — tap + to get more`, food); audio.play('nope'); return; }
      ev.preventDefault();
      const ghost = el(`<div class="snack-ghost">${icon(food)}</div>`);
      document.body.appendChild(ghost);
      drag = { food, ghost, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, moved: false };
      src.setPointerCapture(ev.pointerId);
      place(ev);
      audio.play('pick');
    });
    const place = (ev: PointerEvent) => {
      if (!drag) return;
      drag.ghost.style.transform = `translate(${ev.clientX - 26}px, ${ev.clientY - 60}px)`;
      if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) > 8) drag.moved = true;
      ctx.ranch.foodHover = ctx.ranch.slimeAtClient(ev.clientX, ev.clientY - 34);
    };
    this.tray.addEventListener('pointermove', (ev) => { if (drag?.id === ev.pointerId) place(ev); });
    const end = (ev: PointerEvent) => {
      if (!drag || drag.id !== ev.pointerId) return;
      const { food, ghost, moved } = drag;
      drag = null;
      ghost.remove();
      const uid = ctx.ranch.slimeAtClient(ev.clientX, ev.clientY - 34);
      ctx.ranch.foodHover = null;
      if (!moved) { toast('Drag the snack onto a slime to feed it', food); return; }
      if (uid == null) { audio.play('drop'); return; }
      const r = game.feed(uid, food);
      if (!r) { toast('That slime is already full!', 'hand'); audio.play('nope'); return; }
      ctx.ranch.feedFx(uid, food, r);
      if (game.s.tutorial < 3 && game.s.stats.feeds === 1) toast('Happy slimes make up to +50% more goo!', 'hand');
    };
    this.tray.addEventListener('pointerup', end);
    this.tray.addEventListener('pointercancel', end);
  }

  setTab(id: string) {
    this.root.querySelectorAll<HTMLElement>('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
  }

  private hatch() {
    const r = game.buyHatch();
    if (r === 'full') {
      toast('Pen is full! Merge slimes or upgrade Bigger Pen', 'home');
      audio.play('nope');
      this.capEl.parentElement!.animate([{ transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: 300 });
      return;
    }
    if (r === 'poor') {
      toast('Not enough goo yet!', 'goo');
      audio.play('nope');
      return;
    }
    audio.play('pop');
    haptic('light');
    this.hatchBtn.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 200 });
  }

  /** Top/bottom space the ranch should avoid. */
  insets(): [number, number] {
    const top = this.root.querySelector('.hud-top')!.getBoundingClientRect().bottom;
    const row = this.careRow.hidden ? this.tray : this.careRow;
    const bottom = window.innerHeight - row.getBoundingClientRect().top;
    return [top, bottom];
  }

  update() {
    const s = game.s;
    // goo counter animates towards its target for a satisfying tick-up
    const target = s.goo;
    const shown = this.lastGooShown < 0 || Math.abs(target - this.lastGooShown) / Math.max(1, target) > 0.5 ? target : this.lastGooShown + (target - this.lastGooShown) * 0.25;
    this.lastGooShown = shown;
    setText(this.gooEl, fmt(shown));
    const boosted = game.boostActive();
    setText(this.rateEl, `+${fmt(game.rate())}/s${boosted ? '  ⚡2×' : ''}`);
    this.rateEl.classList.toggle('boosted', boosted);
    setText(this.gemsEl, fmt(s.gems, 1));

    this.boostEl.classList.toggle('on', boosted);
    if (boosted) setText(this.boostEl.querySelector('[data-boost]')!, `2× Goo · ${fmtTime(game.boostRemaining())}`);

    // hatch button
    const cost = game.hatchCost();
    setText(this.costEl, fmt(cost));
    const full = game.isFull();
    this.hatchBtn.classList.toggle('disabled', full || s.goo < cost);
    this.progEl.style.width = `${full ? 0 : s.eggProgress * 100}%`;
    setText(this.capEl, `${game.penSlimes().length}/${game.capacity()}`);
    setText(this.root.querySelector('[data-pen-name]')!, s.pens[s.activePen].name + (s.pens.length > 1 ? `  ${s.activePen + 1}/${s.pens.length}` : ''));
    const w = WEATHER[s.weather.id];
    if (this.lastWx !== w.id) {
      this.lastWx = w.id;
      this.root.querySelector('.wx-ico')!.innerHTML = icon(w.id);
      setText(this.root.querySelector('[data-wx-name]')!, w.name);
      setText(this.root.querySelector('[data-wx-sub]')!, w.id === 'rainbow' ? 'All +25%' : `${w.favors.map((e) => SPECIES[e].name).join(' & ')} ×${w.mult}`);
    }
    const tk = game.ticketsNow();
    const tb = this.root.querySelector<HTMLElement>('[data-ticket-badge]')!;
    tb.style.display = tk > 0 ? '' : 'none';
    setText(tb, String(tk));
    if (!this.tray.hidden) {
      for (const f of Object.keys(FOODS) as FoodId[]) {
        setText(this.root.querySelector(`[data-food-n="${f}"]`)!, String(s.food[f]));
        const cost = this.root.querySelector<HTMLElement>(`[data-food-cost="${f}"]`)!;
        const html = FOODS[f].gems ? `+1 ${icon('gem')}${FOODS[f].gems}` : `+5 ${icon('goo')}${fmt(game.berryPrice() * 5)}`;
        if (cost.dataset.h !== html.replace(/_\d+/g, '')) { cost.innerHTML = html; cost.dataset.h = html.replace(/_\d+/g, ''); }
      }
    }
    this.capEl.parentElement!.classList.toggle('full', full);

    if (this.lastEgg !== s.eggChoice) {
      this.lastEgg = s.eggChoice;
      this.eggPick.querySelector('img')!.src = slimePortrait(s.eggChoice, 0, { size: 48 });
      setText(this.eggPick.querySelector('[data-egg-name]')!, SPECIES[s.eggChoice].name);
      this.hatchBtn.querySelector('.egg-ico')!.innerHTML = eggSvg(s.eggChoice);
    }

    // rail states
    const daily = this.root.querySelector<HTMLElement>('[data-act="daily"]')!;
    daily.classList.toggle('ready', game.dailyReady());
    (this.root.querySelector('[data-daily-badge]') as HTMLElement).style.display = game.dailyReady() ? '' : 'none';
    const chest = this.root.querySelector<HTMLElement>('[data-act="chests"]')!;
    const freeReady = game.freeChestReady();
    chest.classList.toggle('ready', freeReady);
    setText(this.root.querySelector('[data-chest-lbl]')!, freeReady ? 'Free!' : fmtTime(s.freeChestAt - Date.now()).replace(/ \d+s$/, ''));
    const fest = this.root.querySelector<HTMLElement>('[data-act="festival"]')!;
    fest.style.display = s.runGoo >= 5e6 || s.festivals > 0 ? '' : 'none';

    // tab badges
    const affordable = UPGRADES.some((u) => game.lvl(u.id) < u.max && s.goo >= game.upgradeCost(u))
      || (game.nextEggToUnlock() !== undefined && s.goo >= EGG_UNLOCK_COST[game.nextEggToUnlock()!]);
    (this.root.querySelector('[data-up-badge]') as HTMLElement).style.display = affordable ? '' : 'none';
    const unseen = dexUnseen();
    const db = this.root.querySelector<HTMLElement>('[data-dex-badge]')!;
    db.style.display = unseen > 0 ? '' : 'none';
    setText(db, String(unseen));
  }

  bumpGoo() {
    const ico = this.root.querySelector('.goo-ico')!;
    ico.classList.remove('bump');
    void (ico as HTMLElement).offsetWidth;
    ico.classList.add('bump');
  }
}

// ── "NEW" tracking for the Slimedex ─────────────────────────
const SEEN_KEY = 'slime-ranch-dex-seen';
let seen: Set<string> | null = null;
function loadSeen() {
  if (seen) return seen;
  try { seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { seen = new Set(); }
  return seen;
}
export function dexUnseen() {
  const s = loadSeen();
  let n = 0;
  for (const id of Object.keys(game.s.dex)) if (!s.has(id)) n++;
  return n;
}
export function isUnseen(id: string) { return !!game.s.dex[id] && !loadSeen().has(id); }
export function markDexSeen() {
  const s = loadSeen();
  for (const id of Object.keys(game.s.dex)) s.add(id);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}
