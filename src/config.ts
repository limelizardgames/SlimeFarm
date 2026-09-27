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
  removeAds: 'slimeranch.remove_ads',
  starter: 'slimeranch.starter_pack',
  gooPass: 'slimeranch.goo_pass',
  gemsSmall: 'slimeranch.gems_small',
  gemsMedium: 'slimeranch.gems_medium',
  gemsLarge: 'slimeranch.gems_large',
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
