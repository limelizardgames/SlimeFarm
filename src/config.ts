export const APP_NAME = 'Slimepedia: Idle Slimes';
export const APP_VERSION = '1.0.0';
export const STUDIO = 'Lime Lizard Games';

// ─────────────────────────────────────────────────────────────
//  Monetisation configuration
//  Replace the placeholder IDs below before shipping to a store.
//  While `AD_TESTING` is true, Google's official test ad units are used
//  so you can never accidentally click your own live ads.
// ─────────────────────────────────────────────────────────────

export const AD_TESTING = true;

export const ADMOB = {
  ios: {
    rewarded: 'ca-app-pub-XXXXXXXXXXXXXXXX/REWARDED_IOS',
    interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/INTERSTITIAL_IOS',
    banner: 'ca-app-pub-XXXXXXXXXXXXXXXX/BANNER_IOS',
  },
  android: {
    rewarded: 'ca-app-pub-XXXXXXXXXXXXXXXX/REWARDED_ANDROID',
    interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/INTERSTITIAL_ANDROID',
    banner: 'ca-app-pub-XXXXXXXXXXXXXXXX/BANNER_ANDROID',
  },
  // Google's public test units (https://developers.google.com/admob/ios/test-ads)
  test: {
    ios: { rewarded: 'ca-app-pub-3940256099942544/1712485313', interstitial: 'ca-app-pub-3940256099942544/4411468910', banner: 'ca-app-pub-3940256099942544/2934735716' },
    android: { rewarded: 'ca-app-pub-3940256099942544/5224354917', interstitial: 'ca-app-pub-3940256099942544/1033173712', banner: 'ca-app-pub-3940256099942544/6300978111' },
  },
};

/** Show a small banner at the very bottom? Off by default: it hurts the look of the ranch. */
export const BANNER_ENABLED = false;

/** RevenueCat public SDK keys (https://app.revenuecat.com → Project → API keys). */
export const REVENUECAT = {
  ios: 'appl_XXXXXXXXXXXXXXXXXXXXXXXXXXX',
  android: 'goog_XXXXXXXXXXXXXXXXXXXXXXXXXXX',
};

/** Product identifiers — create identical IDs in App Store Connect & Google Play Console. */
export const PRODUCTS = {
  removeAds: 'slimepedia.remove_ads',
  starter: 'slimepedia.starter_pack',
  gooPass: 'slimepedia.goo_pass',
  gemsSmall: 'slimepedia.gems_small',
  gemsMedium: 'slimepedia.gems_medium',
  gemsLarge: 'slimepedia.gems_large',
} as const;

export type ProductKey = keyof typeof PRODUCTS;

/** Shown on web / before the store responds with localised prices. */
export const FALLBACK_PRICES: Record<ProductKey, string> = {
  removeAds: '$2.99',
  starter: '$4.99',
  gooPass: '$4.99',
  gemsSmall: '$0.99',
  gemsMedium: '$4.99',
  gemsLarge: '$9.99',
};

export const GEM_PACKS: Record<'gemsSmall' | 'gemsMedium' | 'gemsLarge', number> = {
  gemsSmall: 100,
  gemsMedium: 600,
  gemsLarge: 1400,
};

export const PRODUCT_NAMES: Record<ProductKey, string> = {
  removeAds: 'Remove Ads',
  starter: 'Starter Bundle',
  gooPass: 'Golden Goo Pass',
  gemsSmall: `${GEM_PACKS.gemsSmall} Gems`,
  gemsMedium: `${GEM_PACKS.gemsMedium} Gems`,
  gemsLarge: `${GEM_PACKS.gemsLarge} Gems`,
};

// ─────────────────────────────────────────────────────────────
//  Accounts & cloud save (Supabase Auth + Postgres)
//  While `enabled` is false the game uses a local DEMO sign-in so the
//  account screens can be tested; nothing leaves the device.
//  See README → "Accounts" for the store-release checklist.
// ─────────────────────────────────────────────────────────────
export const AUTH = {
  enabled: false,
  /** Order shown on the sign-in screen. Apple must be offered on iOS when any other social login is (App Store guideline 4.8). */
  providers: ['apple', 'google', 'facebook'] as const,
  /** Supabase dashboard → Project Settings → API. The anon key is public by design; Row Level Security protects the data. */
  supabaseUrl: '',
  supabaseAnonKey: '',
  /** Google Cloud console OAuth client IDs (the Web one is also entered in Supabase → Auth → Providers → Google). */
  google: { webClientId: '', iOSClientId: '' },
  /** Deep link the Facebook browser sign-in returns to. Also add it to Supabase → Auth → URL Configuration → Redirect URLs. */
  redirectUrl: 'com.limelizardgames.slimepedia://auth-callback',
  /** Upload the save at most this often while playing (plus whenever the app is backgrounded). */
  syncEveryMs: 60_000,
};

export type AuthProvider = (typeof AUTH.providers)[number];
