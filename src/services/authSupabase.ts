// Loaded only when AUTH.enabled is true (see ./auth.ts).
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Preferences } from '@capacitor/preferences';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { createClient, type Session, type SupportedStorage } from '@supabase/supabase-js';
import { AUTH, type AuthProvider } from '../config';
import type { Account, AuthBackend, CloudSave } from './auth';

const native = Capacitor.isNativePlatform();
const ios = Capacitor.getPlatform() === 'ios';

/** WKWebView localStorage can be purged by iOS, so keep the session in native storage. */
const storage: SupportedStorage = native
  ? {
      getItem: async (key) => (await Preferences.get({ key })).value,
      setItem: async (key, value) => { await Preferences.set({ key, value }); },
      removeItem: async (key) => { await Preferences.remove({ key }); },
    }
  : window.localStorage;

function toAccount(session: Session | null): Account | null {
  const u = session?.user;
  if (!u) return null;
  const p = String(u.app_metadata?.provider ?? '');
  const provider: AuthProvider = p === 'apple' ? 'apple' : p === 'facebook' ? 'facebook' : 'google';
  const meta = u.user_metadata ?? {};
  const name = meta.full_name || meta.name || u.email?.split('@')[0] || 'Rancher';
  return { uid: u.id, name, email: u.email ?? null, provider, demo: false };
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const isCancel = (e: any) => /cancel/i.test(String(e?.code ?? e?.message ?? e));

export function createSupabaseBackend(): AuthBackend {
  const sb = createClient(AUTH.supabaseUrl, AUTH.supabaseAnonKey, {
    auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: !native, flowType: 'pkce' },
  });
  let socialReady: Promise<void> | null = null;
  const initSocial = () => (socialReady ??= SocialLogin.initialize({
    google: { webClientId: AUTH.google.webClientId, iOSClientId: AUTH.google.iOSClientId || undefined, mode: 'online' },
    apple: {},
  }));

  /** Apple & Google: native sheet → ID token → Supabase session. */
  async function idTokenSignIn(p: 'apple' | 'google') {
    await initSocial();
    const rawNonce = randomNonce();
    const hashed = await sha256Hex(rawNonce);
    const res = p === 'google'
      ? (await SocialLogin.login({ provider: 'google', options: { nonce: hashed } })).result
      : (await SocialLogin.login({ provider: 'apple', options: { nonce: hashed } })).result;
    const token = (res as { idToken?: string | null }).idToken;
    if (!token) throw new Error(`${p} did not return an ID token`);
    const { data, error } = await sb.auth.signInWithIdToken({ provider: p, token, nonce: rawNonce });
    if (error) throw error;
    // Apple only shares the name on the first sign-in; keep it on the profile.
    const profile = (res as { profile?: { givenName?: string | null; familyName?: string | null } }).profile;
    const fullName = [profile?.givenName, profile?.familyName].filter(Boolean).join(' ');
    if (p === 'apple' && fullName && !data.user?.user_metadata?.full_name) await sb.auth.updateUser({ data: { full_name: fullName } });
    return toAccount(data.session);
  }

  /** Facebook, Apple on Android, and every provider on the web: Supabase's OAuth page in a browser, then back via deep link. */
  async function oauthSignIn(p: AuthProvider) {
    if (!native) {
      // Full-page redirect; the session is picked up from the URL when the game reloads.
      const { error } = await sb.auth.signInWithOAuth({ provider: p, options: { redirectTo: location.origin + location.pathname } });
      if (error) throw error;
      return null;
    }
    const { data, error } = await sb.auth.signInWithOAuth({ provider: p, options: { redirectTo: AUTH.redirectUrl, skipBrowserRedirect: true } });
    if (error || !data.url) throw error ?? new Error('No sign-in URL');
    return new Promise<Account | null>((resolve, reject) => {
      let done = false;
      const finish = (fn: () => void) => { if (!done) { done = true; subs.forEach((h) => h.then((x) => x.remove())); fn(); } };
      const subs = [
        App.addListener('appUrlOpen', async ({ url }) => {
          if (!url.startsWith(AUTH.redirectUrl)) return;
          Browser.close().catch(() => {});
          const code = new URL(url).searchParams.get('code');
          if (!code) return finish(() => resolve(null));
          const { data: s, error: e } = await sb.auth.exchangeCodeForSession(code);
          finish(() => (e ? reject(e) : resolve(toAccount(s.session))));
        }),
        Browser.addListener('browserFinished', () => setTimeout(() => finish(() => resolve(null)), 800)),
      ];
      Browser.open({ url: data.url, presentationStyle: 'popover' }).catch((e) => finish(() => reject(e)));
    });
  }

  return {
    async init(onChange) {
      sb.auth.onAuthStateChange((_ev, session) => onChange(toAccount(session)));
      const { data } = await sb.auth.getSession();
      onChange(toAccount(data.session));
    },

    async signIn(p) {
      try {
        // Native sheets: Google on iOS & Android, Apple on iOS. Apple on Android and Facebook use the browser flow.
        if (p === 'google' && native) return await idTokenSignIn('google');
        if (p === 'apple' && ios) return await idTokenSignIn('apple');
        return await oauthSignIn(p);
      } catch (e) {
        if (isCancel(e)) return null;
        throw e;
      }
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async deleteAccount() {
      // Deleting users needs the service role, so it runs in the `delete-account` Edge Function.
      // For Apple users we pass a fresh authorization code so the function can revoke the Apple token.
      let appleAuthorizationCode: string | undefined;
      const { data: s } = await sb.auth.getSession();
      if (ios && s.session?.user.app_metadata?.provider === 'apple') {
        try {
          await initSocial();
          const r = await SocialLogin.login({ provider: 'apple', options: {} });
          appleAuthorizationCode = (r.result as { authorizationCode?: string }).authorizationCode;
        } catch (e) { if (!isCancel(e)) console.warn('[auth] apple re-auth failed', e); }
      }
      const { error } = await sb.functions.invoke('delete-account', { body: { appleAuthorizationCode } });
      if (error) throw error;
      await sb.auth.signOut().catch(() => {});
    },

    async loadCloud(uid) {
      const { data, error } = await sb.from('saves').select('data, updated_at, lifetime_goo, slimes, species, device').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { data: data.data, updatedAt: data.updated_at, lifetimeGoo: data.lifetime_goo, slimes: data.slimes, species: data.species, device: data.device };
    },

    async saveCloud(uid, save: CloudSave) {
      const { error } = await sb.from('saves').upsert({
        user_id: uid,
        data: save.data,
        updated_at: save.updatedAt,
        lifetime_goo: save.lifetimeGoo,
        slimes: save.slimes,
        species: save.species,
        device: save.device,
      });
      if (error) throw error;
    },

    async deleteCloud(uid) {
      await sb.from('saves').delete().eq('user_id', uid);
    },
  };
}
