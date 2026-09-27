import { game } from '../game/game';
import {
  SPECIES, SPECIES_LIST, BASE_IDS, UPGRADES, EGG_UNLOCK_COST, TIER_NAMES, TIER_COLORS,
  HATS, THEMES, AD_GEMS_REWARD, FESTIVAL_MIN_GOO, type HatId, type ThemeId,
} from '../game/data';
import { fmt } from '../game/format';
import { slimePortrait, hatPortrait } from '../render/slimeArt';
import { ads } from '../services/ads';
import { iap } from '../services/iap';
import { audio } from '../services/audio';
import { haptic, setHaptics } from '../services/haptics';
import { GEM_PACKS, type ProductKey } from '../config';
import { icon } from './icons';
import { el, onAct, toast, confirmModal } from './dom';
import { ctx } from './context';
import { showSpecies, showFestival, adForGems, openChest } from './modals';
import { isUnseen, markDexSeen } from './hud';

export type SheetId = 'upgrades' | 'dex' | 'shop' | 'settings';

interface SheetDef {
  title: string;
  sub: () => string;
  icon: Parameters<typeof icon>[0];
  colors: [string, string];
  build: () => string;
}

const DEFS: Record<SheetId, SheetDef> = {
  upgrades: { title: 'Upgrades', sub: () => `Global goo ×${fmt(game.globalMult(), 2)}`, icon: 'up', colors: ['#7ee8a0', '#22b560'], build: buildUpgrades },
  dex: { title: 'Slimedex', sub: () => `${game.discoveredCount()} / ${SPECIES_LIST.length} discovered`, icon: 'book', colors: ['#7fd0ff', '#247fd6'], build: buildDex },
  shop: { title: 'Shop', sub: () => 'Treats, hats & more', icon: 'bag', colors: ['#ff9ccb', '#d6357c'], build: buildShop },
  settings: { title: 'Settings', sub: () => 'Slime Ranch Idle v1.0', icon: 'gear', colors: ['#b894ff', '#6a3fd6'], build: buildSettings },
};

export class Sheets {
  scrim: HTMLElement;
  sheets = {} as Record<SheetId, HTMLElement>;
  current: SheetId | null = null;
  onClosed: () => void = () => {};

  constructor(parent: HTMLElement) {
    this.scrim = el('<div class="scrim"></div>');
    this.scrim.style.zIndex = '3';
    this.scrim.addEventListener('click', () => this.close());
    parent.appendChild(this.scrim);
    for (const id of Object.keys(DEFS) as SheetId[]) {
      const d = DEFS[id];
      const sh = el<HTMLElement>(`<section class="sheet" data-sheet="${id}" style="z-index:4">
        <header class="sheet-head" style="--hc1:${d.colors[0]};--hc2:${d.colors[1]}">
          ${icon(d.icon)}<div><h2>${d.title}</h2><div class="sub" data-sub></div></div>
          <button class="x" data-act="close" aria-label="Close">${icon('close')}</button>
        </header>
        <div class="sheet-body"></div>
      </section>`);
      parent.appendChild(sh);
      this.sheets[id] = sh;
      onAct(sh, this.handlers());
    }
    // Keep the tab bar above the sheets.
    (parent.querySelector('.tabs') as HTMLElement | null)?.style.setProperty('position', 'relative');
    (parent.querySelector('.tabs') as HTMLElement | null)?.style.setProperty('z-index', '5');
  }

  open(id: SheetId) {
    if (this.current === id) return;
    if (this.current) this.sheets[this.current].classList.remove('open');
    this.current = id;
    this.render(id);
    this.sheets[id].classList.add('open');
    this.sheets[id].querySelector('.sheet-body')!.scrollTop = 0;
    this.scrim.classList.add('on');
    audio.play('whoosh');
    if (id === 'dex') setTimeout(markDexSeen, 400);
  }

  close() {
    if (!this.current) return;
    this.sheets[this.current].classList.remove('open');
    this.current = null;
    this.scrim.classList.remove('on');
    audio.play('close');
    this.onClosed();
  }

  render(id: SheetId = this.current!) {
    if (!id) return;
    const sh = this.sheets[id];
    const body = sh.querySelector<HTMLElement>('.sheet-body')!;
    const top = body.scrollTop;
    body.innerHTML = DEFS[id].build();
    body.scrollTop = top;
    sh.querySelector<HTMLElement>('[data-sub]')!.textContent = DEFS[id].sub();
    this.update();
  }

  /** Cheap per-tick refresh: affordability & progress only. */
  update() {
    if (!this.current) return;
    const sh = this.sheets[this.current];
    sh.querySelectorAll<HTMLElement>('[data-goo]').forEach((b) => b.classList.toggle('disabled', game.s.goo < Number(b.dataset.goo)));
    sh.querySelectorAll<HTMLElement>('[data-gem]').forEach((b) => b.classList.toggle('disabled', game.s.gems < Number(b.dataset.gem)));
    const fp = sh.querySelector<HTMLElement>('[data-fest-bar]');
    if (fp) fp.style.width = `${Math.min(100, (game.s.runGoo / FESTIVAL_MIN_GOO) * 100)}%`;
    const sub = sh.querySelector<HTMLElement>('[data-sub]');
    if (sub) { const t = DEFS[this.current].sub(); if (sub.textContent !== t) sub.textContent = t; }
  }

  private handlers() {
    const buy = async (key: ProductKey) => {
      const ok = await iap.buy(key);
      if (!ok) return;
      grantProduct(key, true);
      this.render();
    };
    return {
      close: () => this.close(),
      upgrade: (t: HTMLElement) => {
        if (game.buyUpgrade(t.dataset.id!)) {
          audio.play('buy');
          haptic('light');
          this.render();
        }
      },
      egg: (t: HTMLElement) => {
        const id = t.dataset.id!;
        if (game.unlockEgg(id)) {
          audio.play('fanfare');
          haptic('success');
          toast(`${SPECIES[id].name} eggs unlocked! Tap the egg chip to choose.`, 'egg');
          ctx.ranch.celebrate();
          this.render();
          if (id === 'ember') setTimeout(() => toast('Tip: drop two DIFFERENT slimes of the same level together to fuse!', 'sparkle'), 2600);
        }
      },
      festival: () => showFestival(),
      species: (t: HTMLElement) => showSpecies(t.dataset.id!),
      iap: (t: HTMLElement) => buy(t.dataset.id as ProductKey),
      adgems: () => adForGems(),
      hat: (t: HTMLElement) => {
        const id = t.dataset.id as HatId;
        if (game.buyHat(id)) { audio.play('buy'); toast(`${HATS.find((h) => h.id === id)!.name} added! Long-press a slime to wear it.`, 'hat'); this.render(); }
      },
      theme: (t: HTMLElement) => {
        const id = t.dataset.id as ThemeId;
        if (game.s.themes.includes(id)) game.setTheme(id);
        else if (!game.buyTheme(id)) return;
        audio.play('buy');
        this.render();
      },
      toggle: (t: HTMLElement) => {
        const k = t.dataset.id as 'sfx' | 'music' | 'haptics';
        game.s.settings[k] = !game.s.settings[k];
        applySettings();
        game.save();
        this.render();
      },
      restore: async () => {
        const owned = await iap.restore();
        owned.forEach((k) => grantProduct(k, false));
        toast(owned.length ? 'Purchases restored ✓' : 'No purchases to restore', 'check');
        this.render();
      },
      privacy: async () => {
        if (!(await ads.privacyOptions())) toast('Privacy options are available on the mobile app', 'info');
      },
      reset: async () => {
        const ok = await confirmModal('Reset everything?', 'This deletes your ranch, gems and Slimedex progress forever. Purchases can be restored.', 'Delete save', 'Cancel');
        if (ok) game.hardReset();
      },
    };
  }
}

export function applySettings() {
  const st = game.s.settings;
  audio.setSfx(st.sfx);
  audio.setMusic(st.music);
  setHaptics(st.haptics);
}

export function grantProduct(key: ProductKey, fresh: boolean) {
  const s = game.s;
  switch (key) {
    case 'removeAds':
      s.noAds = true;
      ads.setNoAds(true);
      if (fresh) game.addGems(50);
      break;
    case 'starter':
      s.noAds = true;
      ads.setNoAds(true);
      s.starterPack = true;
      if (!s.hats.includes('crown')) s.hats.push('crown');
      if (fresh) { game.addGems(300); openChest('epic', 'Starter Bundle'); }
      break;
    case 'gooPass':
      s.gooPass = true;
      break;
    case 'gemsSmall':
    case 'gemsMedium':
    case 'gemsLarge':
      game.addGems(GEM_PACKS[key]);
      break;
  }
  if (fresh) {
    audio.play('fanfare');
    haptic('success');
    ctx.ranch.celebrate();
    toast('Thank you for supporting the ranch! ♥', 'sparkle');
  }
  game.save();
  game.emit('change');
}

// ─────────────────────────────────────────────────────────────
//  Sheet contents
// ─────────────────────────────────────────────────────────────
const costBtn = (cls: string, act: string, id: string, goo: number, label = '') =>
  `<button class="btn small ${cls}" data-act="${act}" data-id="${id}" data-goo="${goo}">${label ? `<span class="sub">${label}</span>` : ''}<span class="cost">${icon('goo')}${fmt(goo)}</span></button>`;

function buildUpgrades(): string {
  let h = `<div class="section-title">${icon('egg')} Egg Research</div>`;
  const next = game.nextEggToUnlock();
  for (const id of BASE_IDS) {
    const sp = SPECIES[id];
    const owned = game.s.eggsUnlocked.includes(id);
    const isNext = id === next;
    if (owned) {
      h += `<div class="row maxed"><div class="thumb"><img src="${slimePortrait(id, 0, { size: 54 })}" alt=""></div>
        <div class="meta"><b>${sp.name} Egg</b><small>Unlocked · ${fmt(sp.rate)} goo/s base</small></div>
        <button class="btn small gray" data-act="noop" style="min-width:64px">${icon('check')}</button></div>`;
    } else if (isNext) {
      h += `<div class="row"><div class="thumb"><img src="${slimePortrait(id, 0, { size: 54 })}" alt=""></div>
        <div class="meta"><b>${sp.name} Egg</b><small>Start hatching ${sp.name} slimes. ${(sp.rate / SPECIES[BASE_IDS[0]].rate).toFixed(1)}× the goo of Mint!</small></div>
        ${costBtn('gold', 'egg', id, EGG_UNLOCK_COST[id], 'Unlock')}</div>`;
    } else {
      h += `<div class="row locked"><div class="thumb"><img src="${slimePortrait(id, 0, { size: 54, silhouette: true })}" alt=""></div>
        <div class="meta"><b>??? Egg</b><small>Research the previous egg first</small></div>
        <button class="btn small gray disabled" data-act="noop" style="min-width:64px">${icon('lock')}</button></div>`;
    }
  }

  h += `<div class="section-title">${icon('home')} Ranch Upgrades</div>`;
  for (const u of UPGRADES) {
    const l = game.lvl(u.id);
    const maxed = l >= u.max;
    const cost = game.upgradeCost(u);
    h += `<div class="row ${maxed ? 'maxed' : ''}"><div class="thumb">${u.icon}</div>
      <div class="meta"><b>${u.name}<span class="lvl">Lv ${l}</span></b><small>${u.desc(l)}</small>
        <div class="pbar"><i style="width:${(l / u.max) * 100}%"></i></div></div>
      ${maxed ? `<button class="btn small gold" data-act="noop">MAX</button>` : costBtn('', 'upgrade', u.id, cost)}</div>`;
  }

  const gain = game.festivalRibbons();
  h += `<div class="section-title">${icon('ribbon')} Grand Festival</div>
    <div class="row" style="background:linear-gradient(180deg,#fff,#ffe6f3)"><div class="thumb">${icon('ribbon')}</div>
      <div class="meta"><b>Blue Ribbons: ${game.s.ribbons}</b><small>${gain > 0 ? `Ready! Earn <b>+${gain}</b> ribbons (+${gain * 10}% goo forever).` : `Earn ${fmt(FESTIVAL_MIN_GOO)} goo this run to enter the festival.`}</small>
        <div class="pbar"><i data-fest-bar style="width:0;background:linear-gradient(90deg,#ff8cc0,#b894ff)"></i></div></div>
      <button class="btn small pink ${gain > 0 ? '' : 'disabled'}" data-act="festival">Enter</button></div>`;
  return h;
}

function buildDex(): string {
  const count = game.discoveredCount();
  let h = `<div class="dex-progress"><div><b>${count}/${SPECIES_LIST.length}</b><br><small>+${count * 2}% goo bonus</small></div>
    <div class="bar"><i style="width:${(count / SPECIES_LIST.length) * 100}%"></i></div></div>
    <p class="fine" style="margin:0 0 10px">Merge two identical slimes to level up. Fuse two <b>different</b> slimes of the <b>same level</b> to discover new species! Each discovery gives +2% goo.</p>`;
  const maxTier = Math.max(...SPECIES_LIST.map((s) => s.tier));
  for (let t = 1; t <= maxTier; t++) {
    const list = SPECIES_LIST.filter((s) => s.tier === t);
    h += `<div class="section-title"><span class="tier-tag" style="background:${TIER_COLORS[t]};font-size:11px">${TIER_NAMES[t]}</span></div><div class="dex-grid">`;
    for (const sp of list) {
      const mask = game.s.dex[sp.id] ?? 0;
      const known = mask > 0;
      h += `<button class="dex-card ${known ? '' : 'unknown'} ${isUnseen(sp.id) ? 'new' : ''}" data-act="species" data-id="${sp.id}">
        <i class="tier" style="background:${TIER_COLORS[t]}"></i>
        <img src="${slimePortrait(sp.id, mask & 4 ? 2 : mask & 2 ? 1 : 0, { size: 76, silhouette: !known })}" alt="">
        <b>${known ? sp.name : '???'}</b>
        <span class="vars"><i class="n ${mask & 1 ? 'on' : ''}"></i><i class="s ${mask & 2 ? 'on' : ''}"></i><i class="g ${mask & 4 ? 'on' : ''}"></i></span>
      </button>`;
    }
    h += `</div>`;
  }
  return h;
}

function buildShop(): string {
  const s = game.s;
  let h = '';
  if (!s.starterPack) {
    h += `<div class="shop-hero"><div class="ribbon">BEST VALUE</div>
      <h3>Starter Bundle</h3>
      <ul><li>Remove forced ads forever</li><li>300 gems</li><li>Epic Chest</li><li>Royal Crown hat</li></ul>
      <button class="btn gold wide" data-act="iap" data-id="starter">${iap.price('starter')}</button></div>`;
  }
  h += `<div class="shop-hero ${s.noAds ? 'owned' : ''}" style="background:linear-gradient(135deg,#7fd0ff,#9a6bff)">
      <h3>${icon('noads')} Remove Ads</h3>
      <p>${s.noAds ? 'Ads removed — thank you for supporting the ranch! ♥' : 'No more pop-up ads. Optional reward videos stay available whenever you want a bonus. Includes +50 gems!'}</p>
      ${s.noAds ? '' : `<button class="btn gold wide" data-act="iap" data-id="removeAds">${iap.price('removeAds')}</button>`}</div>`;
  h += `<div class="shop-hero ${s.gooPass ? 'owned' : ''}" style="background:linear-gradient(135deg,#8ef05a,#22b560 55%,#1a8a6a)">
      <h3>${icon('goo')} Golden Goo Pass</h3>
      <p>${s.gooPass ? 'Active — all goo is permanently doubled!' : 'Permanently <b>double</b> all goo production. Stacks with Goo Rush for 4×!'}</p>
      ${s.gooPass ? '' : `<button class="btn gold wide" data-act="iap" data-id="gooPass">${iap.price('gooPass')}</button>`}</div>`;

  h += `<div class="section-title">${icon('gem')} Gems</div><div class="gem-grid">`;
  const packs: [ProductKey, number, string][] = [['gemsSmall', GEM_PACKS.gemsSmall, ''], ['gemsMedium', GEM_PACKS.gemsMedium, 'POPULAR'], ['gemsLarge', GEM_PACKS.gemsLarge, '+40%']];
  for (const [k, n, tag] of packs) {
    h += `<div class="gem-card">${tag ? `<span class="tag">${tag}</span>` : ''}${icon('gem')}<b>${n}</b><button class="btn small pink" data-act="iap" data-id="${k}">${iap.price(k)}</button></div>`;
  }
  h += `</div>`;
  const left = game.adGemsLeft();
  h += `<div class="row" style="margin-top:10px"><div class="thumb">${icon('tv')}</div><div class="meta"><b>Free Gems</b><small>Watch a short video for +${AD_GEMS_REWARD} gems · ${left} left today</small></div>
    <button class="btn small purple ${left > 0 ? '' : 'disabled'}" data-act="adgems">${icon('tv')} +${AD_GEMS_REWARD}</button></div>`;

  h += `<div class="section-title">${icon('hat')} Hats</div><div class="cos-grid">`;
  for (const hat of HATS) {
    const owned = s.hats.includes(hat.id);
    h += `<div class="cos-card ${owned ? 'on' : ''}"><div class="prev"><img src="${hatPortrait(hat.id, 72)}" alt=""></div><b>${hat.name}</b><span class="stars">${'★'.repeat(hat.rarity)}</span>
      ${owned ? `<button class="btn small gray" data-act="noop">Owned</button>` : `<button class="btn small blue" data-act="hat" data-id="${hat.id}" data-gem="${hat.price}"><span class="cost">${icon('gem')}${hat.price}</span></button>`}</div>`;
  }
  h += `</div><p class="fine">Long-press any slime on your ranch to dress it up.</p>`;

  h += `<div class="section-title">${icon('paint')} Ranch Themes</div><div class="cos-grid">`;
  for (const t of THEMES) {
    const owned = s.themes.includes(t.id);
    const on = s.theme === t.id;
    h += `<div class="cos-card ${on ? 'on' : ''}"><div class="prev"><div class="theme-swatch" style="background:linear-gradient(180deg,${t.sky[0]},${t.sky[2]} 55%,${t.hills[1]} 55%,${t.ground[1]})"></div></div><b>${t.name}</b>
      ${on ? `<button class="btn small gray" data-act="noop">Active</button>` : owned ? `<button class="btn small" data-act="theme" data-id="${t.id}">Use</button>` : `<button class="btn small blue" data-act="theme" data-id="${t.id}" data-gem="${t.price}"><span class="cost">${icon('gem')}${t.price}</span></button>`}</div>`;
  }
  h += `</div>
    <div style="margin-top:14px"><button class="btn gray small wide" data-act="restore">Restore Purchases</button></div>
    <p class="fine">Purchases are processed by the App Store / Google Play. Prices shown in your local currency.</p>`;
  return h;
}

function buildSettings(): string {
  const st = game.s.settings;
  const tg = (id: string, on: boolean, ic: Parameters<typeof icon>[0], label: string) =>
    `<div class="set-row">${icon(ic)}<b>${label}</b><button class="toggle ${on ? 'on' : ''}" data-act="toggle" data-id="${id}" aria-label="${label}"></button></div>`;
  const s = game.s;
  return `
    ${tg('sfx', st.sfx, 'sound', 'Sound Effects')}
    ${tg('music', st.music, 'music', 'Music')}
    ${tg('haptics', st.haptics, 'phone', 'Vibration')}
    <div class="section-title">${icon('info')} Stats</div>
    <div class="stat-grid">
      <div class="stat"><small>Lifetime goo</small><b>${fmt(s.lifetimeGoo)}</b></div>
      <div class="stat"><small>Slimes hatched</small><b>${fmt(s.stats.hatched)}</b></div>
      <div class="stat"><small>Merges</small><b>${fmt(s.stats.merges)}</b></div>
      <div class="stat"><small>Fusions</small><b>${fmt(s.stats.fusions)}</b></div>
      <div class="stat"><small>Slime pets</small><b>${fmt(s.stats.taps)}</b></div>
      <div class="stat"><small>Festivals</small><b>${s.festivals}</b></div>
    </div>
    <div class="section-title">${icon('gear')} Account</div>
    <div style="display:grid;gap:10px">
      <button class="btn blue small wide" data-act="restore">Restore Purchases</button>
      <button class="btn gray small wide" data-act="privacy">Privacy & Ad Choices</button>
      <button class="btn pink small wide" data-act="reset">Reset Progress</button>
    </div>
    <p class="fine">Made with goo & love. Your progress is saved on this device automatically.</p>`;
}
