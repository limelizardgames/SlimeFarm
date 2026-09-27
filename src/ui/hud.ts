import { game } from '../game/game';
import { SPECIES, UPGRADES, EGG_UNLOCK_COST } from '../game/data';
import { fmt, fmtTime } from '../game/format';
import { slimePortrait, paletteFor } from '../render/slimeArt';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { icon } from './icons';
import { el, onAct, setText, toast } from './dom';
import { showBoost, showChests, showDaily, showFestival } from './modals';

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
  private lastGooShown = -1;

  constructor(parent: HTMLElement, private onTab: (id: string) => void) {
    this.root = el(`<div class="hud">
      <div class="hud-top">
        <div class="goo-card">${icon('goo', 'goo-ico')}<div><div class="goo-amount">0</div><div class="goo-rate">+0/s</div></div></div>
        <div class="hud-spacer"></div>
        <button class="pill gem-pill" data-act="gems">${icon('gem')}<span data-gems>0</span><span class="plus">+</span></button>
        <button class="icon-btn" data-act="settings" aria-label="Settings">${icon('gear')}</button>
      </div>
      <div class="boost-chip">${icon('bolt')}<span data-boost>2×</span></div>
      <div class="rail">
        <button class="rail-btn" data-act="daily">${icon('calendar')}<span class="lbl">Daily</span><span class="badge" data-daily-badge>!</span></button>
        <button class="rail-btn" data-act="chests">${icon('chest')}<span class="lbl" data-chest-lbl>Chest</span></button>
        <button class="rail-btn ad" data-act="boost"><span class="ad-tag">AD</span>${icon('bolt')}<span class="lbl">2× Goo</span></button>
        <button class="rail-btn festival" data-act="festival" style="display:none">${icon('ribbon')}<span class="lbl">Festival</span></button>
      </div>
      <div class="dock">
        <div class="hatch-row">
          <button class="side-chip egg-picker" data-act="egg"><img alt=""><small data-egg-name>Mint</small></button>
          <button class="hatch-btn" data-act="hatch">
            <span class="egg-ico ico"></span>
            <div class="ht"><b>HATCH</b><span>${icon('goo')}<em data-cost style="font-style:normal">0</em></span></div>
            <i class="prog"></i>
          </button>
          <div class="side-chip cap"><b data-cap>0/8</b><small>Pen</small></div>
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
    });
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
    const bottom = window.innerHeight - this.root.querySelector('.hatch-row')!.getBoundingClientRect().top;
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
    setText(this.capEl, `${s.slimes.length}/${game.capacity()}`);
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
