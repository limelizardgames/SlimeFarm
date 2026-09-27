import { AUTH, type AuthProvider } from '../config';

/**
 * Accounts & cloud saves.
 *
 *  • Firebase mode (AUTH.enabled = true): Sign in with Apple / Google / Facebook through
 *    @capacitor-firebase/authentication (native SDKs on iOS & Android, popups on web) and
 *    store the save in Firestore at `saves/{uid}`. Implemented in ./authFirebase.
 *  • Demo mode (default): a simulated sign-in with a local "cloud", so the whole account
 *    flow can be tested before the Firebase project exists.
 *
 * Guest play always works; signing in is optional (App Store guideline 5.1.1).
 */

export interface Account {
  uid: string;
  name: string;
  email: string | null;
  provider: AuthProvider;
  demo: boolean;
}

export interface CloudSave {
  data: string;
  updatedAt: number;
  lifetimeGoo: number;
  slimes: number;
  species: number;
  device: string;
}

export interface AuthBackend {
  init(onChange: (a: Account | null) => void): Promise<void>;
  signIn(p: AuthProvider): Promise<Account | null>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  loadCloud(uid: string): Promise<CloudSave | null>;
  saveCloud(uid: string, save: CloudSave): Promise<void>;
  deleteCloud(uid: string): Promise<void>;
}

// ── demo backend ─────────────────────────────────────────────
const DEMO_USER = 'slime-ranch-demo-account';
const DEMO_CLOUD = 'slime-ranch-demo-cloud-';
const ls = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

class DemoBackend implements AuthBackend {
  private onChange: (a: Account | null) => void = () => {};
  async init(onChange: (a: Account | null) => void) {
    this.onChange = onChange;
    const raw = ls.get(DEMO_USER);
    onChange(raw ? (JSON.parse(raw) as Account) : null);
  }
  async signIn(p: AuthProvider) {
    await wait(900);
    const label = { apple: 'Apple', google: 'Google', facebook: 'Facebook' }[p];
    const acct: Account = { uid: `demo-${p}`, name: `Rancher (${label})`, email: null, provider: p, demo: true };
    ls.set(DEMO_USER, JSON.stringify(acct));
    this.onChange(acct);
    return acct;
  }
  async signOut() { ls.del(DEMO_USER); this.onChange(null); }
  async deleteAccount() {
    const raw = ls.get(DEMO_USER);
    if (raw) ls.del(DEMO_CLOUD + (JSON.parse(raw) as Account).uid);
    await this.signOut();
  }
  async loadCloud(uid: string) { await wait(300); const r = ls.get(DEMO_CLOUD + uid); return r ? (JSON.parse(r) as CloudSave) : null; }
  async saveCloud(uid: string, save: CloudSave) { ls.set(DEMO_CLOUD + uid, JSON.stringify(save)); }
  async deleteCloud(uid: string) { ls.del(DEMO_CLOUD + uid); }
}

// ── service facade ───────────────────────────────────────────
class AuthService {
  user: Account | null = null;
  demo = !AUTH.enabled;
  private backend: AuthBackend | null = null;
  private listeners: ((a: Account | null) => void)[] = [];

  onChange(fn: (a: Account | null) => void) { this.listeners.push(fn); }

  async init() {
    const backend = AUTH.enabled ? await import('./authFirebase').then((m) => m.createFirebaseBackend()) : new DemoBackend();
    this.backend = backend;
    await backend.init((a) => {
      this.user = a;
      this.listeners.forEach((f) => f(a));
    });
  }

  private get b() {
    if (!this.backend) throw new Error('auth not initialised');
    return this.backend;
  }

  signIn(p: AuthProvider) { return this.b.signIn(p); }
  signOut() { return this.b.signOut(); }

  async deleteAccount() {
    if (this.user) await this.b.deleteCloud(this.user.uid).catch(() => {});
    await this.b.deleteAccount();
  }

  loadCloud() { return this.user ? this.b.loadCloud(this.user.uid) : Promise.resolve(null); }
  saveCloud(save: CloudSave) { return this.user ? this.b.saveCloud(this.user.uid, save) : Promise.resolve(); }
}

export const auth = new AuthService();
