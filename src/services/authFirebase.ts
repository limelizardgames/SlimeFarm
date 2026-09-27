// Loaded only when AUTH.enabled is true (see ./auth.ts).
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp } from 'firebase/app';
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, onAuthStateChanged, signInWithCredential,
  GoogleAuthProvider, OAuthProvider, FacebookAuthProvider, revokeAccessToken, deleteUser, signOut,
  type Auth, type User,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, type Firestore } from 'firebase/firestore';
import { AUTH, type AuthProvider } from '../config';
import type { Account, AuthBackend, CloudSave } from './auth';

const native = Capacitor.isNativePlatform();

function toAccount(u: User): Account {
  const pid = u.providerData[0]?.providerId ?? '';
  const provider: AuthProvider = pid.startsWith('apple') ? 'apple' : pid.startsWith('facebook') ? 'facebook' : 'google';
  return { uid: u.uid, name: u.displayName || u.email?.split('@')[0] || 'Rancher', email: u.email, provider, demo: false };
}

export function createFirebaseBackend(): AuthBackend {
  const app = initializeApp(AUTH.firebase);
  // In a native WebView, getAuth()'s default persistence can hang; use IndexedDB explicitly.
  const fbAuth: Auth = native ? initializeAuth(app, { persistence: indexedDBLocalPersistence }) : getAuth(app);
  const db: Firestore = getFirestore(app);

  async function nativeSignIn(p: AuthProvider) {
    if (p === 'google') {
      const r = await FirebaseAuthentication.signInWithGoogle();
      return GoogleAuthProvider.credential(r.credential?.idToken);
    }
    if (p === 'apple') {
      const r = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
      return new OAuthProvider('apple.com').credential({ idToken: r.credential?.idToken, rawNonce: r.credential?.nonce });
    }
    const r = await FirebaseAuthentication.signInWithFacebook();
    return FacebookAuthProvider.credential(r.credential?.accessToken ?? '');
  }

  return {
    async init(onChange) {
      onAuthStateChanged(fbAuth, (u) => onChange(u ? toAccount(u) : null));
    },

    async signIn(p) {
      try {
        if (native) {
          const cred = await nativeSignIn(p);
          const res = await signInWithCredential(fbAuth, cred);
          return toAccount(res.user);
        }
        // Web: the plugin opens the provider's popup through the Firebase JS SDK.
        if (p === 'google') await FirebaseAuthentication.signInWithGoogle();
        else if (p === 'apple') await FirebaseAuthentication.signInWithApple();
        else await FirebaseAuthentication.signInWithFacebook();
        return fbAuth.currentUser ? toAccount(fbAuth.currentUser) : null;
      } catch (e: any) {
        // Cancelling the provider sheet is not an error worth showing.
        if (/cancel/i.test(String(e?.message ?? e?.code ?? ''))) return null;
        throw e;
      }
    },

    async signOut() {
      await signOut(fbAuth);
      if (native) await FirebaseAuthentication.signOut().catch(() => {});
    },

    async deleteAccount() {
      const u = fbAuth.currentUser;
      if (!u) return;
      // Apple requires revoking the Sign in with Apple token when an account is deleted.
      if (native && toAccount(u).provider === 'apple') {
        try {
          const r = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
          if (r.credential?.authorizationCode) await revokeAccessToken(fbAuth, r.credential.authorizationCode);
        } catch (e) { console.warn('[auth] apple revoke failed', e); }
      }
      await deleteUser(u); // may throw auth/requires-recent-login; the UI asks the player to sign in again
      if (native) await FirebaseAuthentication.signOut().catch(() => {});
    },

    async loadCloud(uid) {
      const snap = await getDoc(doc(db, 'saves', uid));
      return snap.exists() ? (snap.data() as CloudSave) : null;
    },

    async saveCloud(uid, save: CloudSave) {
      await setDoc(doc(db, 'saves', uid), save);
    },

    async deleteCloud(uid) {
      await deleteDoc(doc(db, 'saves', uid));
    },
  };
}
