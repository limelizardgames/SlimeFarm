import {
  SPECIES, SPECIES_LIST, BASE_IDS, UPGRADES, VARIANTS, HATS, THEMES, CHESTS, DAILY_REWARDS,
  EGG_UNLOCK_COST, FREE_CHEST_COOLDOWN, AD_CHEST_COOLDOWN, MAX_BOOST_MINUTES, AD_GEMS_DAILY_CAP,
  FESTIVAL_MIN_GOO, fusionResult, upgradeCost, eggInterval, tapSeconds, shinyChance, goldenChance,
  offlineHours, penCapacity,
  type Variant, type HatId, type ThemeId, type ChestKind, type Reward, type UpgradeDef,
} from './data';
import { dayKey } from './format';
import { loadString, saveString, removeKey } from '../services/storage';

export interface SlimeData {
  uid: number;
  sp: string;
  lvl: number;
  variant: Variant;
  hat?: HatId;
}

export interface Settings { sfx: boolean; music: boolean; haptics: boolean }

export interface GameState {
  v: number;
  created: number;
  lastSeen: number;
  goo: number;
  gems: number;
  runGoo: number;
  lifetimeGoo: number;
  slimes: SlimeData[];
  nextUid: number;
  upgrades: Record<string, number>;
  eggsUnlocked: string[];
  eggChoice: string;
  paidHatches: number;
  eggProgress: number;
  /** species id → bitmask of discovered variants (1 normal, 2 shiny, 4 golden) */
  dex: Record<string, number>;
  hats: HatId[];
  themes: ThemeId[];
  theme: ThemeId;
  boostUntil: number;
  freeChestAt: number;
  adChestAt: number;
  adGemsDay: string;
  adGemsCount: number;
  dailyDay: string;
  dailyStreak: number;
  ribbons: number;
  festivals: number;
  noAds: boolean;
  gooPass: boolean;
  starterPack: boolean;
  settings: Settings;
  stats: { merges: number; fusions: number; taps: number; ads: number; hatched: number };
  tutorial: number;
}

export type MergeOutcome =
  | { kind: 'merge'; slime: SlimeData; mutated: boolean }
  | { kind: 'fuse'; slime: SlimeData; discovered: boolean; mutated: boolean }
  | { kind: 'fail'; reason: 'level' | 'recipe' | 'max' };

export type GrantedReward =
  | { kind: 'goo'; amount: number }
  | { kind: 'gems'; amount: number }
  | { kind: 'boost'; minutes: number }
  | { kind: 'hat'; hat: HatId; dupe: boolean }
  | { kind: 'slime'; slime: SlimeData | null; sp: string; lvl: number };

type Listener = (...args: any[]) => void;

const SAVE_KEY = 'slime-ranch-idle-save-v1';
export const MAX_LEVEL = 15;
export const LEVEL_MULT = 2.4;

function freshState(): GameState {
  const now = Date.now();
  return {
    v: 1, created: now, lastSeen: now,
    goo: 25, gems: 25, runGoo: 0, lifetimeGoo: 0,
    slimes: [], nextUid: 1,
    upgrades: {}, eggsUnlocked: ['mint'], eggChoice: 'mint', paidHatches: 0, eggProgress: 0,
    dex: {}, hats: [], themes: ['meadow'], theme: 'meadow',
    boostUntil: 0, freeChestAt: now, adChestAt: 0, adGemsDay: '', adGemsCount: 0,
    dailyDay: '', dailyStreak: 0, ribbons: 0, festivals: 0,
    noAds: false, gooPass: false, starterPack: false,
    settings: { sfx: true, music: true, haptics: true },
    stats: { merges: 0, fusions: 0, taps: 0, ads: 0, hatched: 0 },
    tutorial: 0,
  };
}

export class Game {
  s: GameState = freshState();
  private listeners: Record<string, Listener[]> = {};
  private saveTimer = 0;
  /** goo gained while away, awaiting the "welcome back" dialog */
  pendingOffline = { goo: 0, ms: 0 };

  // ── events ────────────────────────────────────────────────
  on(ev: string, fn: Listener) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev: string, ...args: any[]) { this.listeners[ev]?.forEach((f) => f(...args)); }

  // ── persistence ───────────────────────────────────────────
  async load() {
    const raw = await loadString(SAVE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw) as Partial<GameState>;
        const base = freshState();
        this.s = { ...base, ...data, settings: { ...base.settings, ...data.settings }, stats: { ...base.stats, ...data.stats } };
      } catch (e) {
        console.warn('Corrupt save, starting fresh', e);
      }
    }
    if (this.s.nextUid === 1) {
      // A brand-new ranch starts with two mint slimes ready to merge.
      this.addSlime('mint', 1, 0);
      this.addSlime('mint', 1, 0);
    }
    this.checkOffline();
  }

  save() {
    this.s.lastSeen = Date.now();
    saveString(SAVE_KEY, JSON.stringify(this.s));
  }

  hardReset() {
    removeKey(SAVE_KEY);
    this.s = freshState();
    location.reload();
  }

  checkOffline() {
    const now = Date.now();
    const away = Math.max(0, now - this.s.lastSeen);
    if (away < 60_000) return;
    const capMs = offlineHours(this.lvl('vault')) * 3600_000;
    const ms = Math.min(away, capMs);
    // Boost applies only to the part of the absence it actually covered.
    const boostedMs = Math.max(0, Math.min(this.s.boostUntil, this.s.lastSeen + ms) - this.s.lastSeen);
    const base = this.rawRate();
    const goo = base * (ms / 1000) + base * (boostedMs / 1000);
    this.pendingOffline = { goo, ms: away };
    this.s.lastSeen = now;
  }

  // ── derived values ────────────────────────────────────────
  lvl(id: string) { return this.s.upgrades[id] ?? 0; }
  capacity() { return penCapacity(this.lvl('pen')); }
  isFull() { return this.s.slimes.length >= this.capacity(); }
  boostActive() { return Date.now() < this.s.boostUntil; }
  discoveredCount() { return Object.keys(this.s.dex).length; }

  globalMult() {
    return 1.25 ** this.lvl('goo')
      * (1 + this.s.ribbons * 0.1)
      * (1 + this.discoveredCount() * 0.02)
      * (this.s.gooPass ? 2 : 1);
  }

  slimeRate(sl: SlimeData) {
    return SPECIES[sl.sp].rate * LEVEL_MULT ** (sl.lvl - 1) * VARIANTS[sl.variant].mult;
  }

  /** goo/sec without the temporary boost */
  rawRate() {
    let sum = 0;
    for (const sl of this.s.slimes) sum += this.slimeRate(sl);
    return sum * this.globalMult();
  }

  rate() { return this.rawRate() * (this.boostActive() ? 2 : 1); }

  hatchCost(sp = this.s.eggChoice) {
    return Math.floor(10 * SPECIES[sp].rate * 1.09 ** this.s.paidHatches);
  }

  eggInterval() { return eggInterval(this.lvl('egg')); }

  // ── core loop ─────────────────────────────────────────────
  tick(dt: number) {
    const gain = this.rate() * dt;
    this.addGoo(gain);

    if (!this.isFull()) {
      this.s.eggProgress += dt / this.eggInterval();
      if (this.s.eggProgress >= 1) {
        this.s.eggProgress = 0;
        const pool = this.s.eggsUnlocked;
        const sp = pool[Math.floor(Math.random() * pool.length)];
        this.hatchSlime(sp);
      }
    } else {
      this.s.eggProgress = Math.min(this.s.eggProgress, 0.999);
    }

    this.saveTimer += dt;
    if (this.saveTimer > 10) { this.saveTimer = 0; this.save(); }
  }

  addGoo(n: number) {
    this.s.goo += n;
    this.s.runGoo += n;
    this.s.lifetimeGoo += n;
  }

  spend(n: number): boolean {
    if (this.s.goo < n) return false;
    this.s.goo -= n;
    return true;
  }

  spendGems(n: number): boolean {
    if (this.s.gems < n) return false;
    this.s.gems -= n;
    this.emit('change');
    return true;
  }

  addGems(n: number) { this.s.gems += n; this.emit('change'); }

  // ── slimes ────────────────────────────────────────────────
  private rollVariant(floor: Variant = 0): Variant {
    const luck = this.lvl('luck');
    const r = Math.random();
    let v: Variant = 0;
    if (r < goldenChance(luck)) v = 2;
    else if (r < goldenChance(luck) + shinyChance(luck)) v = 1;
    return Math.max(v, floor) as Variant;
  }

  private addSlime(sp: string, lvl: number, variant: Variant): SlimeData {
    const sl: SlimeData = { uid: this.s.nextUid++, sp, lvl, variant };
    this.s.slimes.push(sl);
    this.markDex(sl);
    return sl;
  }

  /** Records a discovery; returns true if this species/variant is new. */
  private markDex(sl: SlimeData): boolean {
    const bit = 1 << sl.variant;
    const prev = this.s.dex[sl.sp] ?? 0;
    if (prev & bit) return false;
    const speciesNew = prev === 0;
    this.s.dex[sl.sp] = prev | bit;
    if (speciesNew) {
      const gems = SPECIES[sl.sp].tier * 5;
      this.s.gems += gems;
      this.emit('discovery', sl, gems);
    } else {
      this.emit('variantFound', sl);
    }
    return true;
  }

  hatchSlime(sp: string, lvl = 1 + this.lvl('hatch')): SlimeData | null {
    if (this.isFull()) return null;
    this.s.stats.hatched++;
    const sl = this.addSlime(sp, lvl, this.rollVariant());
    this.emit('hatched', sl);
    return sl;
  }

  buyHatch(): SlimeData | null | 'full' | 'poor' {
    if (this.isFull()) return 'full';
    const cost = this.hatchCost();
    if (!this.spend(cost)) return 'poor';
    this.s.paidHatches++;
    const sl = this.hatchSlime(this.s.eggChoice);
    this.emit('change');
    return sl;
  }

  cycleEgg() {
    const list = this.s.eggsUnlocked;
    const i = list.indexOf(this.s.eggChoice);
    this.s.eggChoice = list[(i + 1) % list.length];
    this.emit('change');
  }

  getSlime(uid: number) { return this.s.slimes.find((s) => s.uid === uid); }

  previewMerge(a: SlimeData, b: SlimeData): { kind: 'merge' | 'fuse' | 'fail'; sp?: string; known?: boolean; reason?: string } {
    if (a.lvl !== b.lvl) return { kind: 'fail', reason: 'Levels must match' };
    if (a.sp === b.sp) {
      if (a.lvl >= MAX_LEVEL) return { kind: 'fail', reason: 'Max level' };
      return { kind: 'merge', sp: a.sp };
    }
    const r = fusionResult(a.sp, b.sp);
    if (!r) return { kind: 'fail', reason: 'No reaction' };
    return { kind: 'fuse', sp: r, known: !!this.s.dex[r] };
  }

  /** Drop slime `a` onto slime `b`. */
  merge(aUid: number, bUid: number): MergeOutcome {
    const a = this.getSlime(aUid), b = this.getSlime(bUid);
    if (!a || !b || a === b) return { kind: 'fail', reason: 'recipe' };
    const p = this.previewMerge(a, b);
    if (p.kind === 'fail') return { kind: 'fail', reason: p.reason === 'Max level' ? 'max' : p.reason === 'No reaction' ? 'recipe' : 'level' };

    const inherited = Math.max(a.variant, b.variant) as Variant;
    const variant = this.rollVariant(inherited);
    const mutated = variant > inherited;
    const hat = b.hat ?? a.hat;
    this.s.slimes = this.s.slimes.filter((s) => s !== a && s !== b);

    if (p.kind === 'merge') {
      this.s.stats.merges++;
      const sl = this.addSlime(a.sp, a.lvl + 1, variant);
      sl.hat = hat;
      this.emit('change');
      return { kind: 'merge', slime: sl, mutated };
    }
    this.s.stats.fusions++;
    const discovered = !this.s.dex[p.sp!];
    const sl = this.addSlime(p.sp!, a.lvl, variant);
    sl.hat = hat;
    this.emit('change');
    return { kind: 'fuse', slime: sl, discovered, mutated };
  }

  releaseValue(sl: SlimeData) { return this.slimeRate(sl) * this.globalMult() * 60; }

  release(uid: number): number {
    const sl = this.getSlime(uid);
    if (!sl) return 0;
    const v = this.releaseValue(sl);
    this.s.slimes = this.s.slimes.filter((s) => s !== sl);
    this.addGoo(v);
    this.emit('change');
    return v;
  }

  tap(uid: number): number {
    const sl = this.getSlime(uid);
    if (!sl) return 0;
    this.s.stats.taps++;
    const g = this.slimeRate(sl) * this.globalMult() * (this.boostActive() ? 2 : 1) * tapSeconds(this.lvl('tap'));
    this.addGoo(g);
    return g;
  }

  setHat(uid: number, hat: HatId | undefined) {
    const sl = this.getSlime(uid);
    if (sl) { sl.hat = hat; this.emit('change'); }
  }

  // ── upgrades & research ───────────────────────────────────
  upgradeCost(u: UpgradeDef) { return upgradeCost(u, this.lvl(u.id)); }

  buyUpgrade(id: string): boolean {
    const u = UPGRADES.find((x) => x.id === id)!;
    const l = this.lvl(id);
    if (l >= u.max) return false;
    if (!this.spend(upgradeCost(u, l))) return false;
    this.s.upgrades[id] = l + 1;
    this.emit('change');
    return true;
  }

  nextEggToUnlock(): string | undefined {
    return BASE_IDS.find((id) => !this.s.eggsUnlocked.includes(id));
  }

  unlockEgg(id: string): boolean {
    if (this.s.eggsUnlocked.includes(id)) return false;
    if (!this.spend(EGG_UNLOCK_COST[id])) return false;
    this.s.eggsUnlocked.push(id);
    this.s.eggChoice = id;
    this.emit('change');
    return true;
  }

  // ── boosts, chests, rewards ───────────────────────────────
  addBoost(minutes: number) {
    const now = Date.now();
    const start = Math.max(now, this.s.boostUntil);
    this.s.boostUntil = Math.min(start + minutes * 60_000, now + MAX_BOOST_MINUTES * 60_000);
    this.emit('change');
  }

  boostRemaining() { return Math.max(0, this.s.boostUntil - Date.now()); }
  canBoost() { return this.boostRemaining() < (MAX_BOOST_MINUTES - 5) * 60_000; }

  freeChestReady() { return Date.now() >= this.s.freeChestAt; }
  adChestReady() { return Date.now() >= this.s.adChestAt; }

  adGemsLeft() {
    if (this.s.adGemsDay !== dayKey()) return AD_GEMS_DAILY_CAP;
    return Math.max(0, AD_GEMS_DAILY_CAP - this.s.adGemsCount);
  }
  useAdGems() {
    if (this.s.adGemsDay !== dayKey()) { this.s.adGemsDay = dayKey(); this.s.adGemsCount = 0; }
    this.s.adGemsCount++;
  }

  /** Seconds-of-production value, never less than a small floor so early chests feel good. */
  gooForMinutes(min: number) {
    return Math.max(this.rawRate() * min * 60, 50 * min);
  }

  rollChest(kind: ChestKind): GrantedReward[] {
    const c = CHESTS[kind];
    const out: GrantedReward[] = [];
    const tierBoost = kind === 'epic' ? 3 : kind === 'rare' ? 2 : 1;
    out.push({ kind: 'goo', amount: this.gooForMinutes(10 * tierBoost + Math.random() * 20 * tierBoost) });
    for (let i = 1; i < c.rolls; i++) {
      const r = Math.random();
      if (r < 0.35) out.push({ kind: 'gems', amount: Math.round((3 + Math.random() * 7) * tierBoost) });
      else if (r < 0.6) {
        const pool = HATS.filter((h) => h.rarity <= tierBoost + 2);
        const hat = pool[Math.floor(Math.random() * pool.length)];
        out.push({ kind: 'hat', hat: hat.id, dupe: this.s.hats.includes(hat.id) });
      } else if (r < 0.85) {
        const pool = this.s.eggsUnlocked;
        const sp = pool[Math.floor(Math.random() * pool.length)];
        out.push({ kind: 'slime', sp, lvl: 1 + this.lvl('hatch') + tierBoost, slime: null });
      } else out.push({ kind: 'boost', minutes: 10 * tierBoost });
    }
    return out;
  }

  grant(r: GrantedReward): GrantedReward {
    switch (r.kind) {
      case 'goo': this.addGoo(r.amount); break;
      case 'gems': this.s.gems += r.amount; break;
      case 'boost': this.addBoost(r.minutes); break;
      case 'hat':
        if (this.s.hats.includes(r.hat)) { this.s.gems += 10; r.dupe = true; }
        else this.s.hats.push(r.hat);
        break;
      case 'slime': {
        const sl = this.isFull() ? null : this.addSlime(r.sp, r.lvl, this.rollVariant());
        if (sl) { this.s.stats.hatched++; this.emit('hatched', sl, 'gift'); }
        else this.addGoo(this.slimeRate({ uid: 0, sp: r.sp, lvl: r.lvl, variant: 0 }) * this.globalMult() * 300);
        r.slime = sl;
        break;
      }
    }
    this.emit('change');
    return r;
  }

  rewardToGranted(r: Reward): GrantedReward[] {
    switch (r.kind) {
      case 'goo': return [{ kind: 'goo', amount: this.gooForMinutes(r.minutes) }];
      case 'gems': return [{ kind: 'gems', amount: r.amount }];
      case 'boost': return [{ kind: 'boost', minutes: r.minutes }];
      case 'chest': return this.rollChest(r.chest);
    }
  }

  // ── daily ─────────────────────────────────────────────────
  dailyReady() { return this.s.dailyDay !== dayKey(); }
  dailyIndex() {
    // streak continues if claimed yesterday, else resets
    const yesterday = dayKey(Date.now() - 86_400_000);
    const continuing = this.s.dailyDay === yesterday;
    return continuing ? this.s.dailyStreak % DAILY_REWARDS.length : 0;
  }
  claimDaily(): GrantedReward[] {
    if (!this.dailyReady()) return [];
    const idx = this.dailyIndex();
    this.s.dailyStreak = idx + 1;
    this.s.dailyDay = dayKey();
    const granted = this.rewardToGranted(DAILY_REWARDS[idx]).map((g) => this.grant(g));
    this.save();
    return granted;
  }

  // ── cosmetics ─────────────────────────────────────────────
  buyHat(id: HatId): boolean {
    const h = HATS.find((x) => x.id === id)!;
    if (this.s.hats.includes(id) || !this.spendGems(h.price)) return false;
    this.s.hats.push(id);
    this.emit('change');
    return true;
  }
  buyTheme(id: ThemeId): boolean {
    const t = THEMES.find((x) => x.id === id)!;
    if (this.s.themes.includes(id) || !this.spendGems(t.price)) return false;
    this.s.themes.push(id);
    this.setTheme(id);
    return true;
  }
  setTheme(id: ThemeId) {
    if (!this.s.themes.includes(id)) return;
    this.s.theme = id;
    this.emit('theme', id);
    this.emit('change');
  }

  // ── festival (prestige) ───────────────────────────────────
  festivalRibbons() {
    if (this.s.runGoo < FESTIVAL_MIN_GOO) return 0;
    return Math.floor(3 * Math.sqrt(this.s.runGoo / FESTIVAL_MIN_GOO));
  }

  holdFestival(): number {
    const gain = this.festivalRibbons();
    if (gain <= 0) return 0;
    const keep = this.s;
    const fresh = freshState();
    this.s = {
      ...fresh,
      created: keep.created,
      gems: keep.gems,
      lifetimeGoo: keep.lifetimeGoo,
      dex: keep.dex,
      hats: keep.hats,
      themes: keep.themes,
      theme: keep.theme,
      freeChestAt: keep.freeChestAt,
      adChestAt: keep.adChestAt,
      adGemsDay: keep.adGemsDay,
      adGemsCount: keep.adGemsCount,
      dailyDay: keep.dailyDay,
      dailyStreak: keep.dailyStreak,
      ribbons: keep.ribbons + gain,
      festivals: keep.festivals + 1,
      noAds: keep.noAds,
      gooPass: keep.gooPass,
      starterPack: keep.starterPack,
      settings: keep.settings,
      stats: keep.stats,
      tutorial: keep.tutorial,
      goo: 100 * (1 + keep.ribbons + gain),
    };
    this.addSlime('mint', 1, 0);
    this.addSlime('mint', 1, 0);
    this.save();
    this.emit('reset');
    this.emit('change');
    return gain;
  }

  // ── misc helpers for UI ───────────────────────────────────
  speciesCount() { return SPECIES_LIST.length; }
  eggReadyUnlocks() { return BASE_IDS.filter((id) => !this.s.eggsUnlocked.includes(id)); }
  freeChestCooldown() { return FREE_CHEST_COOLDOWN; }
  adChestCooldown() { return AD_CHEST_COOLDOWN; }
}

export const game = new Game();
