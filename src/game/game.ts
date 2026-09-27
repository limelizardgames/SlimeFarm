import {
  SPECIES, SPECIES_LIST, BASE_IDS, UPGRADES, VARIANTS, HATS, THEMES, CHESTS, DAILY_REWARDS,
  EGG_UNLOCK_COST, FREE_CHEST_COOLDOWN, AD_CHEST_COOLDOWN, MAX_BOOST_MINUTES, AD_GEMS_DAILY_CAP,
  FESTIVAL_MIN_GOO, fusionResult, upgradeCost, eggInterval, tapSeconds, shinyChance, goldenChance,
  offlineHours, penCapacity, FOODS, WEATHER, elementsOf, MAX_PENS, PEN_NAMES, penCost,
  HARMONY_MIN, HARMONY_BONUS, RUSH_MINUTES, HAPPY_DRAIN_SECONDS, PET_HAPPY, HAPPY_MAX_BONUS,
  MAX_TICKETS, TICKET_REGEN_MS, PET_GEM_CHANCE, PET_GEM_HAPPY_BONUS, PET_GEM_JACKPOT, PET_GEM_DAILY_CAP,
  AUTOFEED_MAX_HOURS,
  type Variant, type HatId, type ThemeId, type ChestKind, type Reward, type UpgradeDef,
  type FoodId, type WeatherId,
} from './data';
import { dayKey } from './format';
import { loadString, saveString, removeKey } from '../services/storage';

export interface SlimeData {
  uid: number;
  sp: string;
  lvl: number;
  variant: Variant;
  hat?: HatId;
  /** which pen the slime lives in */
  pen: number;
  /** 0–100; boosts production, drains over time, restored by petting & snacks */
  happy: number;
  /** Jelly Bean sugar rush (2× goo) until this timestamp */
  rushUntil?: number;
}

export interface PenData { name: string; theme: ThemeId }
export type GameId = 'catch' | 'match';

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
  stats: { merges: number; fusions: number; taps: number; ads: number; hatched: number; feeds: number; games: number; petGems: number };
  tutorial: number;
  pens: PenData[];
  activePen: number;
  food: Record<FoodId, number>;
  tickets: number;
  ticketAt: number;
  weather: { id: WeatherId; until: number };
  best: Record<GameId, number>;
  autoFeedUntil: number;
  petGemsDay: string;
  petGemsCount: number;
  /** account & cloud-save bookkeeping */
  accountNudged: boolean;
  cloudSyncedAt: number;
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
  | { kind: 'slime'; slime: SlimeData | null; sp: string; lvl: number }
  | { kind: 'food'; food: FoodId; amount: number };

type Listener = (...args: any[]) => void;

const SAVE_KEY = 'slime-ranch-idle-save-v1';
export const MAX_LEVEL = 15;
export const LEVEL_MULT = 2.4;

function freshState(): GameState {
  const now = Date.now();
  return {
    v: 2, created: now, lastSeen: now,
    goo: 25, gems: 25, runGoo: 0, lifetimeGoo: 0,
    slimes: [], nextUid: 1,
    upgrades: {}, eggsUnlocked: ['mint'], eggChoice: 'mint', paidHatches: 0, eggProgress: 0,
    dex: {}, hats: [], themes: ['meadow'], theme: 'meadow',
    boostUntil: 0, freeChestAt: now, adChestAt: 0, adGemsDay: '', adGemsCount: 0,
    dailyDay: '', dailyStreak: 0, ribbons: 0, festivals: 0,
    noAds: false, gooPass: false, starterPack: false,
    settings: { sfx: true, music: true, haptics: true },
    stats: { merges: 0, fusions: 0, taps: 0, ads: 0, hatched: 0, feeds: 0, games: 0, petGems: 0 },
    tutorial: 0,
    pens: [{ name: PEN_NAMES[0], theme: 'meadow' }],
    activePen: 0,
    food: { berry: 3, jelly: 1, apple: 0 },
    tickets: MAX_TICKETS,
    ticketAt: 0,
    weather: { id: 'sunny', until: now + 4 * 60_000 },
    best: { catch: 0, match: 0 },
    autoFeedUntil: 0,
    petGemsDay: '',
    petGemsCount: 0,
    accountNudged: false,
    cloudSyncedAt: 0,
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
    if (raw) this.applyData(raw);
    if (this.s.nextUid === 1) {
      // A brand-new ranch starts with two mint slimes ready to merge.
      this.addSlime('mint', 1, 0);
      this.addSlime('mint', 1, 0);
    }
    this.checkOffline();
  }

  /** Serialized save, e.g. for cloud backup. */
  exportSave(): string {
    this.s.lastSeen = Date.now();
    return JSON.stringify(this.s);
  }

  /** Replaces the running game with a save (from the cloud). */
  importSave(raw: string): boolean {
    const prev = this.s;
    if (!this.applyData(raw)) { this.s = prev; return false; }
    this.checkOffline();
    this.save();
    this.emit('reset');
    this.emit('theme', this.activeTheme());
    this.emit('weather', this.s.weather.id);
    this.emit('change');
    return true;
  }

  private applyData(raw: string): boolean {
    {
      try {
        const data = JSON.parse(raw) as Partial<GameState>;
        const base = freshState();
        this.s = {
          ...base, ...data,
          settings: { ...base.settings, ...data.settings },
          stats: { ...base.stats, ...data.stats },
          food: { ...base.food, ...data.food },
          best: { ...base.best, ...data.best },
        };
        // v1 → v2: single ranch becomes the first pen; slimes gain happiness
        if (!data.pens) this.s.pens = [{ name: PEN_NAMES[0], theme: data.theme ?? 'meadow' }];
        for (const sl of this.s.slimes) {
          sl.pen ??= 0;
          sl.happy ??= 70;
          if (sl.pen >= this.s.pens.length) sl.pen = 0;
        }
        this.s.activePen = Math.min(this.s.activePen ?? 0, this.s.pens.length - 1);
        this.s.v = 2;
        return true;
      } catch (e) {
        console.warn('Corrupt save, starting fresh', e);
        return false;
      }
    }
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
    const drainFrom = Math.max(this.s.lastSeen, this.s.autoFeedUntil);
    if (now > drainFrom) this.drainHappiness((now - drainFrom) / 1000);
    this.s.lastSeen = now;
  }

  // ── derived values ────────────────────────────────────────
  lvl(id: string) { return this.s.upgrades[id] ?? 0; }
  capacity() { return penCapacity(this.lvl('pen')); }
  penSlimes(pen = this.s.activePen) { return this.s.slimes.filter((s) => s.pen === pen); }
  isFull(pen = this.s.activePen) { return this.penSlimes(pen).length >= this.capacity(); }
  /** First pen with room, preferring the one on screen. */
  penWithRoom(): number {
    if (!this.isFull()) return this.s.activePen;
    const i = this.s.pens.findIndex((_, k) => !this.isFull(k));
    return i;
  }
  activeTheme(): ThemeId { return this.s.pens[this.s.activePen]?.theme ?? 'meadow'; }
  boostActive() { return Date.now() < this.s.boostUntil; }
  discoveredCount() { return Object.keys(this.s.dex).length; }

  globalMult() {
    return 1.25 ** this.lvl('goo')
      * (1 + this.s.ribbons * 0.1)
      * (1 + this.discoveredCount() * 0.02)
      * (this.s.gooPass ? 2 : 1);
  }

  /** Species × level × mutation, before any situational bonus. */
  baseRate(sl: Pick<SlimeData, 'sp' | 'lvl' | 'variant'>) {
    return SPECIES[sl.sp].rate * LEVEL_MULT ** (sl.lvl - 1) * VARIANTS[sl.variant].mult;
  }

  happyMult(sl: SlimeData) { return 1 + HAPPY_MAX_BONUS * (sl.happy / 100); }
  rushing(sl: SlimeData) { return (sl.rushUntil ?? 0) > Date.now(); }

  private harmonyCounts(): Map<string, number> {
    const m = new Map<string, number>();
    for (const sl of this.s.slimes) { const k = sl.pen + '|' + sl.sp; m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }
  harmony(sl: SlimeData, counts = this.harmonyCounts()) {
    return (counts.get(sl.pen + '|' + sl.sp) ?? 0) >= HARMONY_MIN;
  }

  weatherMult(sp: string) {
    const w = WEATHER[this.s.weather.id];
    if (w.id === 'rainbow') return w.mult;
    return elementsOf(sp).some((e) => w.favors.includes(e)) ? w.mult : 1;
  }

  /** Live goo/sec of one slime (without global multipliers). */
  slimeRate(sl: SlimeData, counts?: Map<string, number>) {
    return this.baseRate(sl)
      * this.happyMult(sl)
      * (this.rushing(sl) ? 2 : 1)
      * (this.harmony(sl, counts) ? 1 + HARMONY_BONUS : 1)
      * this.weatherMult(sl.sp);
  }

  /** goo/sec without the temporary boost */
  rawRate() {
    const counts = this.harmonyCounts();
    let sum = 0;
    for (const sl of this.s.slimes) sum += this.slimeRate(sl, counts);
    return sum * this.globalMult();
  }

  penRate(pen: number) {
    const counts = this.harmonyCounts();
    let sum = 0;
    for (const sl of this.s.slimes) if (sl.pen === pen) sum += this.slimeRate(sl, counts);
    return sum * this.globalMult() * (this.boostActive() ? 2 : 1);
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

    const room = this.penWithRoom();
    if (room >= 0) {
      this.s.eggProgress += dt / this.eggInterval();
      if (this.s.eggProgress >= 1) {
        this.s.eggProgress = 0;
        const pool = this.s.eggsUnlocked;
        const sp = pool[Math.floor(Math.random() * pool.length)];
        this.hatchSlime(sp, undefined, room);
      }
    } else {
      this.s.eggProgress = Math.min(this.s.eggProgress, 0.999);
    }

    this.drainHappiness(dt);
    this.updateWeather();
    this.ticketsNow();

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
    const k = this.s.weather.id === 'rainbow' ? 2 : 1;
    const r = Math.random();
    let v: Variant = 0;
    if (r < goldenChance(luck) * k) v = 2;
    else if (r < (goldenChance(luck) + shinyChance(luck)) * k) v = 1;
    return Math.max(v, floor) as Variant;
  }

  private addSlime(sp: string, lvl: number, variant: Variant, pen = this.s.activePen, happy = 80): SlimeData {
    const sl: SlimeData = { uid: this.s.nextUid++, sp, lvl, variant, pen, happy };
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

  hatchSlime(sp: string, lvl = 1 + this.lvl('hatch'), pen = this.s.activePen): SlimeData | null {
    if (this.isFull(pen)) return null;
    this.s.stats.hatched++;
    const sl = this.addSlime(sp, lvl, this.rollVariant(), pen);
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
    const happy = Math.max(a.happy, b.happy);
    this.s.slimes = this.s.slimes.filter((s) => s !== a && s !== b);

    if (p.kind === 'merge') {
      this.s.stats.merges++;
      const sl = this.addSlime(a.sp, a.lvl + 1, variant, b.pen, happy);
      sl.hat = hat;
      this.emit('change');
      return { kind: 'merge', slime: sl, mutated };
    }
    this.s.stats.fusions++;
    const discovered = !this.s.dex[p.sp!];
    const sl = this.addSlime(p.sp!, a.lvl, variant, b.pen, happy);
    sl.hat = hat;
    this.emit('change');
    return { kind: 'fuse', slime: sl, discovered, mutated };
  }

  releaseValue(sl: SlimeData) { return this.baseRate(sl) * this.globalMult() * 60; }

  release(uid: number): number {
    const sl = this.getSlime(uid);
    if (!sl) return 0;
    const v = this.releaseValue(sl);
    this.s.slimes = this.s.slimes.filter((s) => s !== sl);
    this.addGoo(v);
    this.emit('change');
    return v;
  }

  petGemsLeft() {
    return this.s.petGemsDay === dayKey() ? Math.max(0, PET_GEM_DAILY_CAP - this.s.petGemsCount) : PET_GEM_DAILY_CAP;
  }
  petGemChance(sl: SlimeData) { return PET_GEM_CHANCE + PET_GEM_HAPPY_BONUS * (sl.happy / 100); }

  /** Petting: cheers the slime up, squeezes out a little goo, and sometimes turns up a gem. */
  pet(uid: number): { goo: number; gems: number } {
    const sl = this.getSlime(uid);
    if (!sl) return { goo: 0, gems: 0 };
    let gems = 0;
    const left = this.petGemsLeft();
    if (left > 0 && Math.random() < this.petGemChance(sl)) {
      gems = Math.min(left, Math.random() < PET_GEM_JACKPOT ? 5 : 1);
      if (this.s.petGemsDay !== dayKey()) { this.s.petGemsDay = dayKey(); this.s.petGemsCount = 0; }
      this.s.petGemsCount += gems;
      this.s.stats.petGems += gems;
      this.s.gems += gems;
      this.emit('change');
    }
    return { goo: this.tap(uid), gems };
  }

  private tap(uid: number): number {
    const sl = this.getSlime(uid);
    if (!sl) return 0;
    this.s.stats.taps++;
    sl.happy = Math.min(100, sl.happy + PET_HAPPY);
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
      } else if (r < 0.93) {
        const food: FoodId = Math.random() < 0.25 * tierBoost ? (tierBoost === 3 && Math.random() < 0.5 ? 'apple' : 'jelly') : 'berry';
        out.push({ kind: 'food', food, amount: food === 'berry' ? 3 * tierBoost : 1 });
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
        const pen = this.penWithRoom();
        const sl = pen < 0 ? null : this.addSlime(r.sp, r.lvl, this.rollVariant(), pen);
        if (sl) { this.s.stats.hatched++; this.emit('hatched', sl, 'gift'); }
        else this.addGoo(this.baseRate({ sp: r.sp, lvl: r.lvl, variant: 0 }) * this.globalMult() * 300);
        r.slime = sl;
        break;
      }
      case 'food': this.s.food[r.food] += r.amount; break;
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
      case 'food': return [{ kind: 'food', food: r.food, amount: r.amount }];
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
    this.s.pens[this.s.activePen].theme = id;
    this.emit('theme', id);
    this.emit('change');
  }

  // ── pens ──────────────────────────────────────────────────
  nextPenCost() { return this.s.pens.length >= MAX_PENS ? Infinity : penCost(this.s.pens.length); }

  buyPen(): boolean {
    if (this.s.pens.length >= MAX_PENS || !this.spend(this.nextPenCost())) return false;
    const i = this.s.pens.length;
    const owned = this.s.themes;
    this.s.pens.push({ name: PEN_NAMES[i] ?? `Pen ${i + 1}`, theme: owned[i % owned.length] });
    this.setActivePen(i);
    return true;
  }

  setActivePen(i: number) {
    if (i < 0 || i >= this.s.pens.length || i === this.s.activePen) return;
    this.s.activePen = i;
    this.emit('pen', i);
    this.emit('theme', this.activeTheme());
    this.emit('change');
  }

  renamePen(i: number, name: string) {
    const n = name.trim().slice(0, 18);
    if (n) { this.s.pens[i].name = n; this.emit('change'); }
  }

  moveSlime(uid: number, pen: number): boolean {
    const sl = this.getSlime(uid);
    if (!sl || sl.pen === pen || this.isFull(pen)) return false;
    sl.pen = pen;
    this.emit('change');
    return true;
  }

  // ── happiness & snacks ────────────────────────────────────
  private drainHappiness(sec: number) {
    if (this.autoFeeding()) {
      for (const sl of this.s.slimes) sl.happy = 100;
      return;
    }
    const d = (sec / HAPPY_DRAIN_SECONDS) * 100;
    for (const sl of this.s.slimes) sl.happy = Math.max(0, sl.happy - d);
  }

  berryPrice() { return Math.max(25, Math.round(this.rawRate() * 20)); }

  buyFood(food: FoodId, n = 1): boolean {
    const f = FOODS[food];
    if (f.gems > 0) { if (!this.spendGems(f.gems * n)) return false; }
    else if (!this.spend(this.berryPrice() * n)) return false;
    this.s.food[food] += n;
    this.emit('change');
    return true;
  }

  /** Feeds a slime. Returns what happened, or null if it can't be fed. */
  feed(uid: number, food: FoodId): { levelUp: boolean; rush: boolean } | null {
    const sl = this.getSlime(uid);
    if (!sl || this.s.food[food] <= 0) return null;
    if (food === 'berry' && sl.happy >= 99) return null;
    this.s.food[food]--;
    this.s.stats.feeds++;
    sl.happy = Math.min(100, sl.happy + FOODS[food].happy);
    let rush = false, levelUp = false;
    if (food === 'jelly') { sl.rushUntil = Math.max(Date.now(), sl.rushUntil ?? 0) + RUSH_MINUTES * 60_000; rush = true; }
    if (food === 'apple' && sl.lvl < MAX_LEVEL) { sl.lvl++; levelUp = true; }
    this.emit('change');
    return { levelUp, rush };
  }

  /** Feeds berries to every slime in the pen below 60 happiness (hungriest first). */
  feedAll(): number {
    const hungry = this.penSlimes().filter((s) => s.happy < 60).sort((a, b) => a.happy - b.happy);
    let n = 0;
    for (const sl of hungry) { if (!this.feed(sl.uid, 'berry')) break; n++; }
    return n;
  }

  // ── auto-feeder ───────────────────────────────────────────
  autoFeeding() { return Date.now() < this.s.autoFeedUntil; }
  autoFeedRemaining() { return Math.max(0, this.s.autoFeedUntil - Date.now()); }
  canAutoFeed(minutes: number) { return this.autoFeedRemaining() + minutes * 60_000 <= AUTOFEED_MAX_HOURS * 3600_000 + 60_000; }

  addAutoFeed(minutes: number) {
    const now = Date.now();
    this.s.autoFeedUntil = Math.min(Math.max(now, this.s.autoFeedUntil) + minutes * 60_000, now + AUTOFEED_MAX_HOURS * 3600_000);
    for (const sl of this.s.slimes) sl.happy = 100;
    this.emit('change');
  }

  buyAutoFeed(minutes: number, gems: number): boolean {
    if (!this.canAutoFeed(minutes) || !this.spendGems(gems)) return false;
    this.addAutoFeed(minutes);
    this.save();
    return true;
  }

  // ── weather ───────────────────────────────────────────────
  private updateWeather() {
    const w = this.s.weather;
    if (Date.now() < w.until) return;
    let next: WeatherId;
    if ((w.id === 'rain' || w.id === 'storm') && Math.random() < 0.55) next = 'rainbow';
    else {
      const pool = Object.values(WEATHER).filter((x) => x.id !== w.id && x.weight > 0);
      let r = Math.random() * pool.reduce((a, x) => a + x.weight, 0);
      next = pool[0].id;
      for (const x of pool) { r -= x.weight; if (r <= 0) { next = x.id; break; } }
    }
    const [lo, hi] = WEATHER[next].minutes;
    this.s.weather = { id: next, until: Date.now() + (lo + Math.random() * (hi - lo)) * 60_000 };
    this.emit('weather', next);
  }

  // ── mini-game tickets & rewards ───────────────────────────
  ticketsNow(): number {
    const s = this.s;
    if (s.tickets >= MAX_TICKETS) { s.ticketAt = 0; return s.tickets; }
    if (!s.ticketAt) s.ticketAt = Date.now() + TICKET_REGEN_MS;
    while (s.tickets < MAX_TICKETS && Date.now() >= s.ticketAt) {
      s.tickets++;
      s.ticketAt = s.tickets < MAX_TICKETS ? s.ticketAt + TICKET_REGEN_MS : 0;
    }
    return s.tickets;
  }
  useTicket(): boolean {
    if (this.ticketsNow() <= 0) return false;
    this.s.tickets--;
    this.ticketsNow();
    this.emit('change');
    return true;
  }
  addTicket() { this.s.tickets++; this.emit('change'); }

  /** Rewards scale with performance (0–1) and the ranch's production. */
  gameRewards(game: GameId, score: number, perf: number): GrantedReward[] {
    this.s.stats.games++;
    const newBest = score > this.s.best[game];
    if (newBest) this.s.best[game] = score;
    const p = Math.max(0, Math.min(1, perf));
    const out: GrantedReward[] = [{ kind: 'goo', amount: this.gooForMinutes(3 + 22 * p) }];
    if (p >= 0.35) out.push({ kind: 'food', food: 'berry', amount: 2 + Math.round(4 * p) });
    if (p >= 0.6) out.push({ kind: 'food', food: 'jelly', amount: p >= 0.85 ? 2 : 1 });
    if (p >= 0.9) out.push({ kind: 'food', food: 'apple', amount: 1 });
    if (newBest && p >= 0.5) out.push({ kind: 'gems', amount: 5 });
    return out;
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
      pens: [{ name: keep.pens[0].name, theme: keep.pens[0].theme }],
      food: keep.food,
      tickets: keep.tickets,
      ticketAt: keep.ticketAt,
      weather: keep.weather,
      best: keep.best,
      autoFeedUntil: keep.autoFeedUntil,
      petGemsDay: keep.petGemsDay,
      petGemsCount: keep.petGemsCount,
      accountNudged: keep.accountNudged,
      cloudSyncedAt: keep.cloudSyncedAt,
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
