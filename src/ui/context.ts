import type { Ranch } from '../render/ranch';

/** Late-bound references shared across UI modules. */
export const ctx = {
  ranch: null as unknown as Ranch,
  openSheet: (_id: 'upgrades' | 'dex' | 'shop' | 'settings' | null) => {},
  refresh: () => {},
};
