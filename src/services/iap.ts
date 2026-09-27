import { Capacitor } from '@capacitor/core';
import { FALLBACK_PRICES, PRODUCTS, REVENUECAT, type ProductKey } from '../config';

/**
 * In-app purchases.
 *  • Native: RevenueCat (@revenuecat/purchases-capacitor) — handles StoreKit & Google Play
 *    Billing, receipt validation and "Restore Purchases" for you.
 *  • Web / dev: purchases are simulated after a confirmation, so shop flows can be tested.
 */

type RCModule = typeof import('@revenuecat/purchases-capacitor');

const native = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform();

const NON_CONSUMABLE: ProductKey[] = ['removeAds', 'starter', 'gooPass'];

class IapService {
  private mod: RCModule | null = null;
  private products = new Map<string, any>();
  confirmWeb: (key: ProductKey, price: string) => Promise<boolean> = async () => true;

  async init(): Promise<ProductKey[]> {
    if (!native) return [];
    try {
      this.mod = await import('@revenuecat/purchases-capacitor');
      const { Purchases } = this.mod;
      await Purchases.configure({ apiKey: platform === 'android' ? REVENUECAT.android : REVENUECAT.ios });
      const ids = Object.values(PRODUCTS);
      const { products } = await Purchases.getProducts({ productIdentifiers: ids, type: 'NON_SUBSCRIPTION' as any });
      for (const p of products) this.products.set(p.identifier, p);
      return this.owned(await Purchases.getCustomerInfo().then((r) => r.customerInfo));
    } catch (e) {
      console.warn('[iap] init failed', e);
      return [];
    }
  }

  price(key: ProductKey): string {
    return this.products.get(PRODUCTS[key])?.priceString ?? FALLBACK_PRICES[key];
  }

  private owned(info: any): ProductKey[] {
    const ids: string[] = info?.allPurchasedProductIdentifiers ?? [];
    return NON_CONSUMABLE.filter((k) => ids.includes(PRODUCTS[k]));
  }

  /** Resolves true if the purchase completed. */
  async buy(key: ProductKey): Promise<boolean> {
    if (!native) return this.confirmWeb(key, this.price(key));
    if (!this.mod) return false;
    const product = this.products.get(PRODUCTS[key]);
    if (!product) { console.warn('[iap] product not loaded', key); return false; }
    try {
      await this.mod.Purchases.purchaseStoreProduct({ product });
      return true;
    } catch (e: any) {
      if (!e?.userCancelled) console.warn('[iap] purchase failed', e);
      return false;
    }
  }

  /** Ties purchases to the signed-in account so they follow the player across devices. */
  async logIn(uid: string): Promise<ProductKey[]> {
    if (!native || !this.mod) return [];
    try {
      const { customerInfo } = await this.mod.Purchases.logIn({ appUserID: uid });
      return this.owned(customerInfo);
    } catch (e) { console.warn('[iap] logIn failed', e); return []; }
  }

  async logOut() {
    if (!native || !this.mod) return;
    await this.mod.Purchases.logOut().catch(() => {});
  }

  async restore(): Promise<ProductKey[]> {
    if (!native || !this.mod) return [];
    try {
      const { customerInfo } = await this.mod.Purchases.restorePurchases();
      return this.owned(customerInfo);
    } catch (e) {
      console.warn('[iap] restore failed', e);
      return [];
    }
  }
}

export const iap = new IapService();
