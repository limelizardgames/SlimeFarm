import { Capacitor } from '@capacitor/core';
import { AD_TESTING, ADMOB, BANNER_ENABLED } from '../config';
import { INTERSTITIAL_GRACE, INTERSTITIAL_MIN_GAP } from '../game/data';

/**
 * Ad facade.
 *  • Native (iOS/Android): Google AdMob via @capacitor-community/admob,
 *    including the UMP consent form (GDPR) and iOS App Tracking Transparency.
 *  • Web / dev: a friendly simulated ad so every reward flow can be tested.
 */

type AdMobModule = typeof import('@capacitor-community/admob');

const native = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

class AdService {
  private mod: AdMobModule | null = null;
  private ready = false;
  private rewardedLoaded = false;
  private interstitialLoaded = false;
  private sessionStart = Date.now();
  private lastInterstitial = Date.now();
  private busy = false;
  noAds = false;
  onPause: (paused: boolean) => void = () => {};

  private ids() {
    const p = platform === 'android' ? 'android' : 'ios';
    return AD_TESTING ? ADMOB.test[p] : ADMOB[p];
  }

  async init() {
    if (!native) { this.ready = true; return; }
    try {
      this.mod = await import('@capacitor-community/admob');
      const { AdMob, AdmobConsentStatus } = this.mod;
      await AdMob.initialize({ initializeForTesting: AD_TESTING });
      // iOS 14+: ask for tracking permission (personalised ads pay noticeably more).
      if (platform === 'ios') {
        const st = await AdMob.trackingAuthorizationStatus();
        if (st.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      }
      // GDPR / UMP consent
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
      this.ready = true;
      this.preload();
      if (BANNER_ENABLED && !this.noAds) this.showBanner();
    } catch (e) {
      console.warn('[ads] init failed', e);
    }
  }

  private async preload() {
    if (!this.mod || !this.ready) return;
    const { AdMob } = this.mod;
    const ids = this.ids();
    if (!this.rewardedLoaded) {
      AdMob.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: AD_TESTING })
        .then(() => { this.rewardedLoaded = true; })
        .catch((e) => console.warn('[ads] rewarded load failed', e));
    }
    if (!this.interstitialLoaded && !this.noAds) {
      AdMob.prepareInterstitial({ adId: ids.interstitial, isTesting: AD_TESTING })
        .then(() => { this.interstitialLoaded = true; })
        .catch((e) => console.warn('[ads] interstitial load failed', e));
    }
  }

  /** Resolves true when the player earned the reward. */
  async showRewarded(label: string): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    this.onPause(true);
    try {
      if (!native) return await simulateAd({ rewarded: true, label });
      if (!this.mod) return false;
      const { AdMob, RewardAdPluginEvents } = this.mod;
      if (!this.rewardedLoaded) {
        await AdMob.prepareRewardVideoAd({ adId: this.ids().rewarded, isTesting: AD_TESTING });
      }
      this.rewardedLoaded = false;
      let earned = false;
      const handles = [
        await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; }),
      ];
      const closed = new Promise<void>(async (res) => {
        handles.push(await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => res()));
        handles.push(await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => res()));
      });
      await AdMob.showRewardVideoAd();
      await Promise.race([closed, new Promise((r) => setTimeout(r, 120_000))]);
      handles.forEach((h) => h.remove());
      return earned;
    } catch (e) {
      console.warn('[ads] rewarded failed', e);
      return false;
    } finally {
      this.busy = false;
      this.onPause(false);
      this.preload();
    }
  }

  /** Occasional full-screen ad at natural breaks. Never shown to "Remove Ads" owners. */
  async maybeInterstitial(): Promise<void> {
    if (this.noAds || this.busy) return;
    const now = Date.now();
    if (now - this.sessionStart < INTERSTITIAL_GRACE) return;
    if (now - this.lastInterstitial < INTERSTITIAL_MIN_GAP) return;
    this.lastInterstitial = now;
    this.busy = true;
    this.onPause(true);
    try {
      if (!native) { await simulateAd({ rewarded: false, label: '' }); return; }
      if (!this.mod || !this.interstitialLoaded) return;
      this.interstitialLoaded = false;
      await this.mod.AdMob.showInterstitial();
    } catch (e) {
      console.warn('[ads] interstitial failed', e);
    } finally {
      this.busy = false;
      this.onPause(false);
      this.preload();
    }
  }

  async showBanner() {
    if (!this.mod || this.noAds) return;
    const { AdMob, BannerAdPosition, BannerAdSize } = this.mod;
    AdMob.showBanner({ adId: this.ids().banner, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER, margin: 0, isTesting: AD_TESTING }).catch(() => {});
  }

  setNoAds(v: boolean) {
    this.noAds = v;
    if (v && this.mod) this.mod.AdMob.removeBanner().catch(() => {});
  }

  async privacyOptions() {
    if (!this.mod) return false;
    try { await this.mod.AdMob.showPrivacyOptionsForm(); return true; } catch { return false; }
  }
}

// ─────────────────────────────────────────────────────────────
//  Simulated ad for web / development builds
// ─────────────────────────────────────────────────────────────
function simulateAd({ rewarded, label }: { rewarded: boolean; label: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const secs = rewarded ? 5 : 3;
    const el = document.createElement('div');
    el.className = 'sim-ad';
    el.innerHTML = `
      <div class="sim-ad-card">
        <div class="sim-ad-tag">AD · test mode</div>
        <div class="sim-ad-art"><div class="sim-ad-blob"></div><div class="sim-ad-blob b2"></div><div class="sim-ad-blob b3"></div></div>
        <div class="sim-ad-title">Your ad could be here!</div>
        <div class="sim-ad-sub">${rewarded ? `Watch to earn: <b>${label}</b>` : 'On a real device this is a Google AdMob ad.'}</div>
        <div class="sim-ad-bar"><div class="sim-ad-fill" style="animation-duration:${secs}s"></div></div>
        <button class="sim-ad-close" disabled>${secs}</button>
      </div>`;
    document.body.appendChild(el);
    const btn = el.querySelector<HTMLButtonElement>('.sim-ad-close')!;
    let left = secs;
    const iv = setInterval(() => {
      left--;
      if (left > 0) { btn.textContent = String(left); return; }
      clearInterval(iv);
      btn.disabled = false;
      btn.textContent = rewarded ? 'Claim reward ✓' : 'Close ✕';
    }, 1000);
    btn.onclick = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 250);
      resolve(true);
    };
  });
}

export const ads = new AdService();
