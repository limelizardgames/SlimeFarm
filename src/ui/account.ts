import { Capacitor } from '@capacitor/core';
import { game } from '../game/game';
import { fmt } from '../game/format';
import { auth, type Account, type CloudSave } from '../services/auth';
import { iap } from '../services/iap';
import { audio } from '../services/audio';
import { haptic } from '../services/haptics';
import { AUTH, type AuthProvider } from '../config';
import { icon } from './icons';
import { openModal, queueModal, toast, confirmModal, type ModalHandle } from './dom';
import { grantProduct } from './sheets';
import { ctx } from './context';

// Official-style provider marks for the sign-in buttons.
const LOGO: Record<AuthProvider, string> = {
  apple: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.64c-.02-2.1 1.72-3.12 1.8-3.17-.98-1.43-2.5-1.63-3.05-1.65-1.3-.13-2.53.76-3.19.76-.66 0-1.67-.74-2.75-.72-1.41.02-2.72.82-3.45 2.09-1.47 2.55-.38 6.33 1.06 8.4.7 1.01 1.54 2.15 2.63 2.11 1.06-.04 1.46-.68 2.73-.68 1.28 0 1.64.68 2.75.66 1.14-.02 1.86-1.03 2.55-2.05.8-1.17 1.13-2.31 1.15-2.37-.03-.01-2.21-.85-2.23-3.38zM14.28 6.46c.58-.7.97-1.68.86-2.65-.83.03-1.84.55-2.44 1.25-.54.62-1.01 1.61-.88 2.56.93.07 1.88-.47 2.46-1.16z"/></svg>`,
  google: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.97 10.97 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>`,
};
const LABEL: Record<AuthProvider, string> = { apple: 'Apple', google: 'Google', facebook: 'Facebook' };

let syncing = false;
let lastUpload = 0;

// ─────────────────────────────────────────────────────────────
//  Boot & background sync
// ─────────────────────────────────────────────────────────────
export async function initAccount() {
  let first = true;
  auth.onChange((a) => {
    ctx.refresh();
    if (!a) { if (!first) iap.logOut(); first = false; return; }
    iap.logIn(a.uid).then((owned) => owned.forEach((k) => grantProduct(k, false)));
    // On launch with a remembered session, sync quietly; interactive sign-ins sync from signIn().
    if (first) syncNow(false);
    first = false;
  });
  await auth.init().catch((e) => console.warn('[auth] init failed', e));
  setInterval(() => { if (auth.user && Date.now() - lastUpload > AUTH.syncEveryMs) upload(); }, 15_000);
  document.addEventListener('visibilitychange', () => { if (document.hidden && auth.user) upload(); });
}

function summary(): CloudSave {
  const s = game.s;
  return {
    data: '',
    updatedAt: Date.now(),
    lifetimeGoo: s.lifetimeGoo,
    slimes: s.slimes.length,
    species: Object.keys(s.dex).length,
    device: Capacitor.getPlatform(),
  };
}

async function upload() {
  if (!auth.user || syncing) return;
  try {
    const sum = summary();
    game.s.cloudSyncedAt = sum.updatedAt;
    sum.data = game.exportSave();
    await auth.saveCloud(sum);
    lastUpload = Date.now();
    game.save();
  } catch (e) {
    console.warn('[cloud] upload failed', e);
  }
}

/** Compares device and cloud saves; asks the player when both have diverged. */
export async function syncNow(interactive: boolean) {
  if (!auth.user || syncing) return;
  syncing = true;
  try {
    const cloud = await auth.loadCloud();
    const local = game.s;
    if (!cloud) { syncing = false; await upload(); if (interactive) toast('Ranch backed up to the cloud', 'check'); return; }
    const cloudIsNewer = cloud.updatedAt > local.cloudSyncedAt + 5_000;
    if (!cloudIsNewer) { syncing = false; await upload(); if (interactive) toast('Cloud save up to date', 'check'); return; }
    // A fresh device (barely played) just takes the cloud ranch.
    if (local.lifetimeGoo < 2_000 && local.festivals === 0) {
      if (game.importSave(cloud.data)) { lastUpload = Date.now(); toast('Welcome back! Your ranch was loaded from the cloud', 'check'); }
      syncing = false;
      return;
    }
    syncing = false;
    await chooseSave(cloud);
  } catch (e) {
    syncing = false;
    console.warn('[cloud] sync failed', e);
    if (interactive) toast('Could not reach the cloud. Your ranch is safe on this device', 'info');
  }
}

function chooseSave(cloud: CloudSave): Promise<void> {
  return new Promise((resolve) => {
    queueModal(() => {
      const local = game.s;
      const when = (t: number) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const card = (title: string, g: number, sl: number, sp: number, t: string, attr: string, cls: string) => `
        <button class="save-card ${cls}" ${attr}>
          <b>${title}</b>
          <span>${icon('goo')} ${fmt(g)} lifetime goo</span>
          <span>${sl} slimes · ${sp} species</span>
          <small>${t}</small>
        </button>`;
      const m = openModal({
        banner: 'Two ranches found',
        bannerColors: ['#7fd0ff', '#247fd6'],
        dismissable: false,
        html: `
          <p>This device and your cloud save have different progress. Which ranch do you want to keep playing?</p>
          <div class="save-choice">
            ${card('This device', local.lifetimeGoo, local.slimes.length, Object.keys(local.dex).length, 'Playing now', 'data-local', '')}
            ${card('Cloud save', cloud.lifetimeGoo, cloud.slimes, cloud.species, `Saved ${when(cloud.updatedAt)} · ${cloud.device}`, 'data-cloud', cloud.lifetimeGoo > local.lifetimeGoo ? 'best' : '')}
          </div>
          <p class="fine">The ranch you don't pick is replaced. Purchases are safe either way.</p>`,
        onClose: resolve,
      });
      m.card.querySelector('[data-local]')!.addEventListener('click', async () => { m.close(); await upload(); toast('Kept this device\'s ranch and backed it up', 'check'); });
      m.card.querySelector('[data-cloud]')!.addEventListener('click', () => {
        m.close();
        if (game.importSave(cloud.data)) { lastUpload = Date.now(); toast('Cloud ranch loaded', 'check'); ctx.ranch.celebrate(); }
        else toast('That cloud save could not be read', 'info');
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  Account screen
// ─────────────────────────────────────────────────────────────
function providerButtons() {
  // Apple first on iOS (and it must be offered wherever other social logins are).
  const order = [...AUTH.providers];
  return order.map((p) => `<button class="sso sso-${p}" data-sso="${p}"><span class="sso-logo">${LOGO[p]}</span><span>Continue with ${LABEL[p]}</span></button>`).join('');
}

export function showAccount() {
  queueModal(() => {
    let m: ModalHandle;
    const render = (busy: AuthProvider | null = null) => {
      const a = auth.user;
      const demo = auth.demo ? `<div class="demo-note">Demo mode: sign-in is simulated on this device until Supabase is connected for the app-store builds.</div>` : '';
      if (!a) {
        return `
          <div class="acct-hero">${icon('fence')}</div>
          <h2>Save your ranch</h2>
          <p>Sign in to back up your slimes to the cloud, keep purchases with your account, and play on any phone or tablet.</p>
          <div class="sso-list ${busy ? 'busy' : ''}">${providerButtons()}</div>
          ${busy ? `<p class="fine">Connecting to ${LABEL[busy]}…</p>` : ''}
          ${demo}
          <p class="fine">Playing as a guest works too. Your progress stays on this device.</p>`;
      }
      return `
        <div class="acct-avatar sso-${a.provider}"><span>${(a.name[0] ?? 'R').toUpperCase()}</span><i>${LOGO[a.provider]}</i></div>
        <h2>${escapeHtml(a.name)}</h2>
        <p style="margin-top:0">${a.email ? escapeHtml(a.email) + ' · ' : ''}Signed in with ${LABEL[a.provider]}</p>
        <div class="kv">
          <div><small>Cloud save</small><b>${game.s.cloudSyncedAt ? agoText(game.s.cloudSyncedAt) : 'Not yet'}</b></div>
          <div><small>Ranch</small><b>${game.s.slimes.length} slimes</b></div>
        </div>
        ${demo}
        <div class="actions">
          <button class="btn blue wide" data-sync>${icon('check')} Back up now</button>
          <button class="btn gray wide" data-out>Sign out</button>
          <button class="link-danger" data-delete>Delete account</button>
        </div>`;
    };
    m = openModal({ html: render() });
    const rerender = (busy: AuthProvider | null = null) => {
      const x = m.card.querySelector('.x');
      m.card.innerHTML = '';
      if (x) m.card.appendChild(x);
      m.card.insertAdjacentHTML('beforeend', render(busy));
      wire();
    };
    const wire = () => {
      m.card.querySelectorAll<HTMLElement>('[data-sso]').forEach((b) => b.addEventListener('click', async () => {
        const p = b.dataset.sso as AuthProvider;
        rerender(p);
        try {
          const a = await auth.signIn(p);
          if (!a) { rerender(); return; }
          audio.play('fanfare');
          haptic('success');
          toast(`Signed in as ${a.name}`, 'check');
          game.s.accountNudged = true;
          // Close first: a "which ranch?" prompt may need the screen.
          m.close();
          await syncNow(true);
        } catch (e) {
          console.warn('[auth] sign-in failed', e);
          toast(`${LABEL[p]} sign-in didn't work. Please try again`, 'info');
          rerender();
        }
      }));
      m.card.querySelector('[data-sync]')?.addEventListener('click', async () => { await syncNow(true); rerender(); });
      m.card.querySelector('[data-out]')?.addEventListener('click', async () => {
        await upload();
        await auth.signOut();
        toast('Signed out. Your ranch stays on this device', 'check');
        rerender();
      });
      m.card.querySelector('[data-delete]')?.addEventListener('click', async () => {
        m.close();
        const ok = await confirmModal('Delete your account?', 'This permanently deletes your account and its cloud save. The ranch on this device is kept as a guest ranch.', 'Delete account', 'Cancel');
        if (!ok) return;
        try {
          await auth.deleteAccount();
          game.s.cloudSyncedAt = 0;
          toast('Account deleted', 'check');
        } catch (e: any) {
          console.warn('[auth] delete failed', e);
          toast(/recent-login/.test(String(e?.code)) ? 'For security, sign out and back in, then delete again' : 'Could not delete the account right now', 'info');
        }
      });
    };
    wire();
  });
}

/** One-time gentle prompt once a ranch is worth protecting. */
export function maybeNudgeAccount() {
  if (auth.user || game.s.accountNudged || game.discoveredCount() < 6) return;
  game.s.accountNudged = true;
  game.save();
  setTimeout(() => showAccount(), 1200);
}

// ── settings card ────────────────────────────────────────────
export function accountCardHtml() {
  const a: Account | null = auth.user;
  if (!a) {
    return `<div class="row acct-row"><div class="thumb">${icon('fence')}</div>
      <div class="meta"><b>Playing as guest</b><small>Sign in with Apple, Google or Facebook to back up your ranch.</small></div>
      <button class="btn small blue" data-act="account">Sign in</button></div>`;
  }
  return `<div class="row acct-row"><div class="thumb acct-mini sso-${a.provider}">${(a.name[0] ?? 'R').toUpperCase()}</div>
    <div class="meta"><b>${escapeHtml(a.name)}</b><small>${LABEL[a.provider]} · ${game.s.cloudSyncedAt ? 'backed up ' + agoText(game.s.cloudSyncedAt) : 'not backed up yet'}</small></div>
    <button class="btn small gray" data-act="account">Manage</button></div>`;
}

function agoText(t: number) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function escapeHtml(t: string) {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
