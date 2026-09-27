// ─────────────────────────────────────────────────────────────
//  Static game data: species, fusion recipes, upgrades, cosmetics
// ─────────────────────────────────────────────────────────────

export type Pattern =
  | 'none' | 'spots' | 'facets' | 'swirl' | 'cracks' | 'bolt' | 'bubbles'
  | 'pearls' | 'candy' | 'rainbow' | 'stars' | 'aurora' | 'drips'
  | 'sprinkles' | 'waves' | 'shine' | 'flakes' | 'honeycomb';

export type Topper =
  | 'none' | 'sprout' | 'flame' | 'drop' | 'pebble' | 'icicle' | 'puff'
  | 'stem' | 'lilypad' | 'cherry' | 'flower' | 'leaf' | 'antenna' | 'crystal'
  | 'reed' | 'straw' | 'raincloud' | 'coral' | 'lollipop' | 'halo' | 'crown'
  | 'horns' | 'fin';

export type Particle =
  | 'leaf' | 'ember' | 'bubble' | 'dust' | 'snow' | 'wind' | 'steam'
  | 'spark' | 'sparkle' | 'petal' | 'heart' | 'star' | 'drop';

export interface Species {
  id: string;
  name: string;
  tier: number;
  c1: string; // light / highlight body colour
  c2: string; // deep / shadow body colour
  pattern: Pattern;
  topper: Topper;
  particle: Particle;
  alpha?: number; // translucent bodies (glass, ghost…)
  parents?: [string, string];
  flavor: string;
  rate: number; // base goo / sec at level 1 (computed)
}

type SpeciesDef = Omit<Species, 'rate' | 'tier'> & { tier?: number; baseRate?: number };

const DEFS: SpeciesDef[] = [
  // ── Tier 1 · Elemental bases (hatched from eggs) ───────────
  { id: 'mint', name: 'Mint', c1: '#a8ffc4', c2: '#1fb468', pattern: 'none', topper: 'sprout', particle: 'leaf', baseRate: 1, flavor: 'The friendliest slime on the ranch. Smells faintly of spearmint.' },
  { id: 'ember', name: 'Ember', c1: '#ffc27a', c2: '#f2412e', pattern: 'none', topper: 'flame', particle: 'ember', baseRate: 1.7, flavor: 'Warm to the touch. Do not hug for more than three seconds.' },
  { id: 'aqua', name: 'Aqua', c1: '#9ee9ff', c2: '#2a73f0', pattern: 'bubbles', topper: 'drop', particle: 'bubble', baseRate: 2.9, flavor: 'Mostly water. Mostly.' },
  { id: 'terra', name: 'Terra', c1: '#e6c08e', c2: '#8b5530', pattern: 'spots', topper: 'pebble', particle: 'dust', baseRate: 4.9, flavor: 'Loves rolling in dirt, and being dirt.' },
  { id: 'frost', name: 'Frost', c1: '#f0fdff', c2: '#6fb9ea', pattern: 'facets', topper: 'icicle', particle: 'snow', baseRate: 8.3, flavor: 'Keeps its cool in every situation.' },
  { id: 'zephyr', name: 'Zephyr', c1: '#f6eeff', c2: '#a58ae6', pattern: 'swirl', topper: 'puff', particle: 'wind', baseRate: 14, flavor: 'Light as a breeze. Occasionally floats away.' },

  // ── Tier 2 ─────────────────────────────────────────────────
  { id: 'chili', name: 'Chili', parents: ['mint', 'ember'], c1: '#ff9d8a', c2: '#d4172f', pattern: 'none', topper: 'stem', particle: 'ember', flavor: 'Spicy personality. Spicier goo.' },
  { id: 'lily', name: 'Lily', parents: ['mint', 'aqua'], c1: '#b8fff0', c2: '#18b3a4', pattern: 'none', topper: 'lilypad', particle: 'bubble', flavor: 'Naps on lily pads. Frogs are jealous.' },
  { id: 'moss', name: 'Moss', parents: ['mint', 'terra'], c1: '#c8e89a', c2: '#4e8a2c', pattern: 'spots', topper: 'sprout', particle: 'leaf', flavor: 'Grows a little every time it rains.' },
  { id: 'gelato', name: 'Gelato', parents: ['mint', 'frost'], c1: '#e2fff4', c2: '#6fd8b8', pattern: 'sprinkles', topper: 'cherry', particle: 'sparkle', flavor: 'Mint-chip flavoured. Please do not lick.' },
  { id: 'bloom', name: 'Bloom', parents: ['mint', 'zephyr'], c1: '#ffd9f0', c2: '#ff6fb1', pattern: 'none', topper: 'flower', particle: 'petal', flavor: 'Sneezes pollen when it is happy.' },
  { id: 'tea', name: 'Tea', parents: ['ember', 'aqua'], c1: '#fbe0b4', c2: '#b86f2c', pattern: 'none', topper: 'leaf', particle: 'steam', flavor: 'Steeped to perfection. Pinkies up.' },
  { id: 'magma', name: 'Magma', parents: ['ember', 'terra'], c1: '#ffa94d', c2: '#6e1414', pattern: 'cracks', topper: 'flame', particle: 'ember', flavor: 'Molten on the inside, crunchy on the outside.' },
  { id: 'steam', name: 'Steam', parents: ['ember', 'frost'], c1: '#fbfcff', c2: '#9aa6d6', pattern: 'swirl', topper: 'puff', particle: 'steam', flavor: 'Fire met ice and they got along great.' },
  { id: 'spark', name: 'Spark', parents: ['ember', 'zephyr'], c1: '#fff7a1', c2: '#ffa800', pattern: 'bolt', topper: 'antenna', particle: 'spark', flavor: 'Hair permanently standing on end. It has no hair.' },
  { id: 'mud', name: 'Mud', parents: ['aqua', 'terra'], c1: '#c49a74', c2: '#5a3b28', pattern: 'bubbles', topper: 'none', particle: 'dust', flavor: 'Blorp.' },
  { id: 'glacier', name: 'Glacier', parents: ['aqua', 'frost'], c1: '#dbf5ff', c2: '#3a9ce0', pattern: 'facets', topper: 'crystal', particle: 'snow', flavor: 'Moves slowly, but always gets there.' },
  { id: 'cloud', name: 'Cloud', parents: ['aqua', 'zephyr'], c1: '#ffffff', c2: '#9fbcff', pattern: 'none', topper: 'puff', particle: 'drop', flavor: 'Soft as a pillow. Occasionally drizzles.' },
  { id: 'geode', name: 'Geode', parents: ['terra', 'frost'], c1: '#e2c9ff', c2: '#6a37b8', pattern: 'facets', topper: 'crystal', particle: 'sparkle', flavor: 'Plain outside, dazzling inside. Relatable.' },
  { id: 'dune', name: 'Dune', parents: ['terra', 'zephyr'], c1: '#ffe9b0', c2: '#d49a3f', pattern: 'waves', topper: 'none', particle: 'dust', flavor: 'Gets everywhere. Absolutely everywhere.' },
  { id: 'snowflake', name: 'Snowflake', parents: ['frost', 'zephyr'], c1: '#ffffff', c2: '#a9dcff', pattern: 'flakes', topper: 'icicle', particle: 'snow', flavor: 'No two are alike. Except that one.' },

  // ── Tier 3 ─────────────────────────────────────────────────
  { id: 'storm', name: 'Storm', parents: ['cloud', 'spark'], c1: '#a9b6d6', c2: '#343e63', pattern: 'bolt', topper: 'raincloud', particle: 'spark', flavor: 'Brings its own weather.' },
  { id: 'obsidian', name: 'Obsidian', parents: ['magma', 'aqua'], c1: '#8069a8', c2: '#150f22', pattern: 'facets', topper: 'crystal', particle: 'ember', flavor: 'Cooled lava with a very sharp wit.' },
  { id: 'bog', name: 'Bog', parents: ['mud', 'moss'], c1: '#a8c476', c2: '#36522a', pattern: 'bubbles', topper: 'reed', particle: 'bubble', flavor: 'Swampy, soggy, and extremely content.' },
  { id: 'glass', name: 'Glass', parents: ['dune', 'ember'], c1: '#f2ffff', c2: '#86cfe6', alpha: 0.78, pattern: 'shine', topper: 'none', particle: 'sparkle', flavor: 'You can see right through its schemes.' },
  { id: 'sakura', name: 'Sakura', parents: ['bloom', 'lily'], c1: '#ffe6f2', c2: '#ff93c1', pattern: 'none', topper: 'flower', particle: 'petal', flavor: 'Blooms once a year. Every day.' },
  { id: 'honey', name: 'Honey', parents: ['tea', 'bloom'], c1: '#ffe68a', c2: '#ee9a00', pattern: 'honeycomb', topper: 'antenna', particle: 'sparkle', flavor: 'Sweet, sticky, and buzzing with energy.' },
  { id: 'boba', name: 'Boba', parents: ['gelato', 'tea'], c1: '#f5e3cf', c2: '#b0825d', pattern: 'pearls', topper: 'straw', particle: 'bubble', flavor: 'Chewy. Extra pearls. Less ice.' },
  { id: 'aurora', name: 'Aurora', parents: ['snowflake', 'spark'], c1: '#a6ffd9', c2: '#6b4dff', pattern: 'aurora', topper: 'none', particle: 'sparkle', flavor: 'Paints the night sky when it dreams.' },
  { id: 'coral', name: 'Coral', parents: ['lily', 'dune'], c1: '#ffc0b0', c2: '#ff5d57', pattern: 'spots', topper: 'coral', particle: 'bubble', flavor: 'Home to three very small, very polite fish.' },
  { id: 'candy', name: 'Candy', parents: ['chili', 'gelato'], c1: '#ffd0e8', c2: '#ff4f9a', pattern: 'candy', topper: 'lollipop', particle: 'heart', flavor: 'Sweet and spicy. Mostly sweet.' },

  // ── Tier 4 · Epic ──────────────────────────────────────────
  { id: 'prism', name: 'Prism', parents: ['glass', 'aurora'], c1: '#ffffff', c2: '#b4a6ff', pattern: 'rainbow', topper: 'crystal', particle: 'sparkle', flavor: 'Bends light, and occasionally the rules.' },
  { id: 'galaxy', name: 'Galaxy', parents: ['aurora', 'obsidian'], c1: '#7a5cf0', c2: '#0e0838', pattern: 'stars', topper: 'none', particle: 'star', flavor: 'Contains multitudes. And snacks.' },
  { id: 'nectar', name: 'Nectar', parents: ['honey', 'sakura'], c1: '#fff0c4', c2: '#ff8fb5', pattern: 'drips', topper: 'flower', particle: 'petal', flavor: 'The rarest sweetness in the valley.' },
  { id: 'tempest', name: 'Tempest', parents: ['storm', 'magma'], c1: '#8fdcff', c2: '#262a8c', pattern: 'bolt', topper: 'horns', particle: 'spark', flavor: 'Thunder follows it around like a puppy.' },
  { id: 'parfait', name: 'Parfait', parents: ['candy', 'boba'], c1: '#fff3f8', c2: '#ff86b4', pattern: 'sprinkles', topper: 'cherry', particle: 'heart', flavor: 'Layers upon layers of delight.' },
  { id: 'reef', name: 'Reef', parents: ['coral', 'bog'], c1: '#8ff5e6', c2: '#1a8aa8', pattern: 'waves', topper: 'fin', particle: 'bubble', flavor: 'An entire ecosystem in one wobbly body.' },

  // ── Tier 5 · Legendary ─────────────────────────────────────
  { id: 'celestial', name: 'Celestial', parents: ['galaxy', 'prism'], c1: '#fff8d6', c2: '#8566ff', pattern: 'stars', topper: 'halo', particle: 'star', flavor: 'Said to have fallen from a wishing star.' },
  { id: 'phoenix', name: 'Phoenix', parents: ['tempest', 'nectar'], c1: '#ffe07a', c2: '#ff2e63', pattern: 'none', topper: 'flame', particle: 'ember', flavor: 'Reborn from its own goo, again and again.' },
  { id: 'leviathan', name: 'Leviathan', parents: ['reef', 'parfait'], c1: '#6ff6ff', c2: '#0b2a9e', pattern: 'waves', topper: 'fin', particle: 'bubble', flavor: 'Legend of the deep. Surprisingly ticklish.' },

  // ── Tier 6 · Mythic ────────────────────────────────────────
  { id: 'king', name: 'King Slime', parents: ['celestial', 'phoenix'], c1: '#fff4b8', c2: '#e6a100', pattern: 'shine', topper: 'crown', particle: 'star', flavor: 'All hail the wobbly monarch of the ranch.' },
];

export const SPECIES: Record<string, Species> = {};
export const SPECIES_LIST: Species[] = [];

// Resolve tiers + rates recursively: a fusion is worth 3× the sum of its parents.
function resolve(def: SpeciesDef): Species {
  if (SPECIES[def.id]) return SPECIES[def.id];
  let tier = 1;
  let rate = def.baseRate ?? 1;
  if (def.parents) {
    const a = resolve(DEFS.find((d) => d.id === def.parents![0])!);
    const b = resolve(DEFS.find((d) => d.id === def.parents![1])!);
    tier = Math.max(a.tier, b.tier) + 1;
    rate = (a.rate + b.rate) * 3;
  }
  const s: Species = { ...def, tier, rate } as Species;
  SPECIES[s.id] = s;
  return s;
}
DEFS.forEach(resolve);
DEFS.forEach((d) => SPECIES_LIST.push(SPECIES[d.id]));

const pairKey = (a: string, b: string) => (a < b ? `${a}+${b}` : `${b}+${a}`);
export const RECIPES: Record<string, string> = {};
for (const s of SPECIES_LIST) if (s.parents) RECIPES[pairKey(s.parents[0], s.parents[1])] = s.id;
export const fusionResult = (a: string, b: string): string | undefined => RECIPES[pairKey(a, b)];

export const BASE_IDS = SPECIES_LIST.filter((s) => s.tier === 1).map((s) => s.id);

export const TIER_NAMES = ['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
export const TIER_COLORS = ['', '#8fd694', '#5ec8ff', '#b67bff', '#ff8a3d', '#ffcf3d', '#ff5fa2'];

// Egg research: unlocking new base species for hatching
export const EGG_UNLOCK_COST: Record<string, number> = {
  mint: 0,
  ember: 150,
  aqua: 2_000,
  terra: 18_000,
  frost: 150_000,
  zephyr: 1_200_000,
};

// ── Variants (mutations) ─────────────────────────────────────
export type Variant = 0 | 1 | 2;
export const VARIANTS = [
  { name: 'Normal', mult: 1 },
  { name: 'Shiny', mult: 3 },
  { name: 'Golden', mult: 12 },
];

// ── Upgrades ────────────────────────────────────────────────
export interface UpgradeDef {
  id: string;
  name: string;
  desc: (lvl: number) => string;
  icon: string;
  baseCost: number;
  growth: number;
  max: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'goo', name: 'Gourmet Feed', icon: '🍯', baseCost: 60, growth: 1.85, max: 200, desc: (l) => `All slimes produce +25% goo. Now ×${(1.25 ** l).toFixed(2)}` },
  { id: 'pen', name: 'Bigger Pen', icon: '🏡', baseCost: 120, growth: 2.3, max: 16, desc: (l) => `Room for one more slime. Capacity ${8 + l} → ${8 + l + 1}` },
  { id: 'egg', name: 'Egg Incubator', icon: '🥚', baseCost: 200, growth: 2.0, max: 20, desc: (l) => `Free eggs hatch faster. Every ${eggInterval(l).toFixed(1)}s` },
  { id: 'hatch', name: 'Nutrient Yolk', icon: '✨', baseCost: 5_000, growth: 14, max: 6, desc: (l) => `Eggs hatch at a higher level. Now Lv ${1 + l}` },
  { id: 'tap', name: 'Tickle Glove', icon: '🧤', baseCost: 80, growth: 2.1, max: 50, desc: (l) => `Tapping a slime squeezes out ${tapSeconds(l)}s of its goo` },
  { id: 'luck', name: 'Mutation Serum', icon: '🧪', baseCost: 1_500, growth: 3.2, max: 15, desc: (l) => `Shiny chance ${(shinyChance(l) * 100).toFixed(1)}% · Golden ${(goldenChance(l) * 100).toFixed(2)}%` },
  { id: 'vault', name: 'Goo Vault', icon: '🏦', baseCost: 900, growth: 2.6, max: 10, desc: (l) => `Offline earnings stored up to ${offlineHours(l)}h` },
];

export const eggInterval = (lvl: number) => Math.max(1.5, 12 * 0.88 ** lvl);
export const tapSeconds = (lvl: number) => 2 + lvl;
export const shinyChance = (lvl: number) => 0.02 + lvl * 0.008;
export const goldenChance = (lvl: number) => 0.002 + lvl * 0.0008;
export const offlineHours = (lvl: number) => 2 + lvl;
export const penCapacity = (lvl: number) => 8 + lvl;

export const upgradeCost = (u: UpgradeDef, lvl: number) => Math.floor(u.baseCost * u.growth ** lvl);

// ── Cosmetics ───────────────────────────────────────────────
export type HatId =
  | 'party' | 'bow' | 'tophat' | 'crown' | 'wizard' | 'beanie'
  | 'cowboy' | 'flowers' | 'headphones' | 'viking' | 'chef' | 'pirate';

export interface HatDef { id: HatId; name: string; rarity: number; price: number }
export const HATS: HatDef[] = [
  { id: 'party', name: 'Party Hat', rarity: 1, price: 30 },
  { id: 'bow', name: 'Big Bow', rarity: 1, price: 30 },
  { id: 'beanie', name: 'Cozy Beanie', rarity: 1, price: 40 },
  { id: 'flowers', name: 'Flower Crown', rarity: 2, price: 60 },
  { id: 'headphones', name: 'Headphones', rarity: 2, price: 60 },
  { id: 'chef', name: 'Chef Hat', rarity: 2, price: 70 },
  { id: 'tophat', name: 'Top Hat', rarity: 3, price: 100 },
  { id: 'cowboy', name: 'Cowboy Hat', rarity: 3, price: 100 },
  { id: 'pirate', name: 'Pirate Hat', rarity: 3, price: 120 },
  { id: 'wizard', name: 'Wizard Hat', rarity: 4, price: 180 },
  { id: 'viking', name: 'Viking Helm', rarity: 4, price: 180 },
  { id: 'crown', name: 'Royal Crown', rarity: 5, price: 300 },
];

export type ThemeId = 'meadow' | 'sunset' | 'frosty' | 'moonlit' | 'candy';
export interface ThemeDef {
  id: ThemeId;
  name: string;
  price: number;
  sky: [string, string, string];
  hills: [string, string, string];
  ground: [string, string];
  accent: string;
  night?: boolean;
  snow?: boolean;
}
export const THEMES: ThemeDef[] = [
  { id: 'meadow', name: 'Sunny Meadow', price: 0, sky: ['#6cc8ff', '#a8e4ff', '#fff3d6'], hills: ['#9be07a', '#6cc35a', '#4fae4b'], ground: ['#7ed064', '#58b64c'], accent: '#ffe066' },
  { id: 'sunset', name: 'Sunset Bay', price: 150, sky: ['#5a3d9a', '#ff7eb3', '#ffc98b'], hills: ['#ffb38a', '#f28a7a', '#c96b8e'], ground: ['#f6d7a0', '#e8b77d'], accent: '#ffd166' },
  { id: 'frosty', name: 'Frosty Peaks', price: 150, sky: ['#7fb8ff', '#c7e4ff', '#f4fbff'], hills: ['#ffffff', '#dcecff', '#b9d6f7'], ground: ['#f1f8ff', '#d3e6fb'], accent: '#9fd8ff', snow: true },
  { id: 'moonlit', name: 'Moonlit Grove', price: 250, sky: ['#0b0a2e', '#2b1b63', '#4d3595'], hills: ['#2e2a6b', '#23205a', '#1a1747'], ground: ['#2f5e57', '#224a45'], accent: '#c8b6ff', night: true },
  { id: 'candy', name: 'Candy Kingdom', price: 400, sky: ['#ff9ad5', '#ffc6ec', '#fff0fa'], hills: ['#c9a6ff', '#ff9cc9', '#ffb86b'], ground: ['#ffd6ec', '#ffb8dc'], accent: '#fff08a' },
];

// ── Daily login rewards (7-day cycle) ───────────────────────
export type Reward =
  | { kind: 'goo'; minutes: number }
  | { kind: 'gems'; amount: number }
  | { kind: 'chest'; chest: ChestKind }
  | { kind: 'boost'; minutes: number };

export const DAILY_REWARDS: Reward[] = [
  { kind: 'goo', minutes: 20 },
  { kind: 'gems', amount: 10 },
  { kind: 'boost', minutes: 30 },
  { kind: 'gems', amount: 20 },
  { kind: 'chest', chest: 'rare' },
  { kind: 'goo', minutes: 120 },
  { kind: 'chest', chest: 'epic' },
];

export type ChestKind = 'wood' | 'rare' | 'epic';
export const CHESTS: Record<ChestKind, { name: string; gems: number; color: string; color2: string; rolls: number }> = {
  wood: { name: 'Wooden Chest', gems: 0, color: '#c98b4f', color2: '#8a5528', rolls: 2 },
  rare: { name: 'Rare Chest', gems: 60, color: '#5ec8ff', color2: '#2a6fd6', rolls: 3 },
  epic: { name: 'Epic Chest', gems: 160, color: '#c07bff', color2: '#6a2fd0', rolls: 4 },
};

// ── Timers & monetisation tuning ────────────────────────────
export const FREE_CHEST_COOLDOWN = 4 * 3600_000;
export const AD_CHEST_COOLDOWN = 10 * 60_000;
export const AD_BOOST_MINUTES = 15;
export const MAX_BOOST_MINUTES = 240;
export const AD_GEMS_REWARD = 5;
export const AD_GEMS_DAILY_CAP = 5;
export const INTERSTITIAL_MIN_GAP = 3 * 60_000;
export const INTERSTITIAL_GRACE = 5 * 60_000; // no forced ads in the first minutes of a session
export const FESTIVAL_MIN_GOO = 5e7;
