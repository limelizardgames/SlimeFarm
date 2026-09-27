import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import './styles.css';

import { Capacitor } from '@capacitor/core';
import { game } from './game/game';
import { SPECIES, WEATHER, type WeatherId } from './game/data';
import { fmt } from './game/format';
import { Ranch } from './render/ranch';
import { audio } from './services/audio';
import { haptic } from './services/haptics';
import { ads } from './services/ads';
import { iap } from './services/iap';
import { Hud } from './ui/hud';
import { Sheets, applySettings, grantProduct, type SheetId } from './ui/sheets';
import { ctx } from './ui/context';
import { toast, confirmModal, modalOpen, el } from './ui/dom';
import { showOffline, showDaily, showDiscovery, showSlimeInfo, showGift } from './ui/modals';
import { FALLBACK_PRICES, PRODUCT_NAMES } from './config';

async function boot() {
  await game.load();
  applySettings();

  const canvas = document.getElementById('ranch') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui')!;

  const ranch = new Ranch(canvas, {
    merge: (a, b) => game.merge(a, b),
    preview: (a, b) => game.previewMerge(a, b),
    tap: (uid) => { const g = game.tap(uid); advanceTutorial('tap'); return g; },
    release: (uid) => game.release(uid),
    releaseValue: (uid) => { const s = game.getSlime(uid); return s ? game.releaseValue(s) : 0; },
    longPress: (uid) => showSlimeInfo(uid),
    gift: () => showGift(),
    swipe: (dir) => { if (!modalOpen() && !sheets.current) hud.switchPen(dir); },
    isRushing: (sl) => game.rushing(sl),
    sfx: (n) => audio.play(n),
    haptic: (k) => haptic(k),
    fmt: (n) => fmt(n),
    rateOf: (sl) => game.slimeRate(sl) * game.globalMult() * (game.boostActive() ? 2 : 1),
  });
  ctx.ranch = ranch;
  ranch.setTheme(game.activeTheme());
  ranch.setWeather(game.s.weather.id);

  let sheets: Sheets;
  const hud = new Hud(uiRoot, (id) => {
    if (id === 'ranch') { sheets.close(); return; }
    if (sheets.current === id) { sheets.close(); return; }
    sheets.open(id as SheetId);
    hud.setTab(id === 'settings' ? 'ranch' : id);
  });
  sheets = new Sheets(uiRoot);
  sheets.onClosed = () => {
    hud.setTab('ranch');
    // A natural pause point: occasionally show an interstitial (never for No-Ads owners).
    if (!modalOpen()) ads.maybeInterstitial();
  };
  ctx.openSheet = (id) => (id ? sheets.open(id) : sheets.close());
  ctx.refresh = () => sheets.render();

  // ── layout
  const layout = () => {
    const [top, bottom] = hud.insets();
    ranch.resize(top, bottom);
  };
  window.addEventListener('resize', layout);
  layout();
  requestAnimationFrame(layout); // after fonts settle
  document.fonts?.ready.then(layout);
  ranch.sync(game.penSlimes());

  if (import.meta.env.DEV) (window as any).__dbg = { game, ranch, sheets };

  // ── game events → visuals
  game.on('hatched', (sl) => {
    if (sl.pen !== game.s.activePen) return;
    ranch.addEnt(sl, 'egg');
    ranch.sync(game.penSlimes());
  });
  game.on('discovery', (sl, gems) => showDiscovery(sl.sp, sl.variant, gems));
  game.on('variantFound', (sl) => toast(`${sl.variant === 2 ? 'Golden' : 'Shiny'} ${SPECIES[sl.sp].name} added to the Slimedex!`, 'sparkle'));
  game.on('theme', (id) => ranch.setTheme(id));
  game.on('reset', () => { ranch.ents.clear(); ranch.setTheme(game.activeTheme()); ranch.sync(game.penSlimes(), { spawnMode: 'egg' }); sheets.render(); });
  game.on('pen', () => { ranch.ents.clear(); ranch.sync(game.penSlimes(), { spawnMode: 'pop' }); });
  game.on('weather', (id) => {
    ranch.setWeather(id);
    const w = WEATHER[id as WeatherId];
    toast(id === 'rainbow' ? 'A rainbow! All slimes +25% and double shiny chance' : `${w.name}: ${w.favors.map((e) => SPECIES[e].name).join(' & ')} slimes ×${w.mult}`, id as WeatherId);
  });
  game.on('change', () => {
    ranch.sync(game.penSlimes());
    if (game.s.stats.merges + game.s.stats.fusions > 0) advanceTutorial('merge');
  });

  // ── monetisation services
  ads.setNoAds(game.s.noAds);
  ads.onPause = (p) => (p ? audio.suspend() : audio.resume());
  iap.confirmWeb = (key, price) => confirmModal('Test purchase', `This web build simulates store purchases.<br>Buy <b>${PRODUCT_NAMES[key]}</b> for <b>${price || FALLBACK_PRICES[key]}</b>?`, 'Buy (test)', 'Cancel', '');
  ads.init();
  iap.init().then((owned) => owned.forEach((k) => grantProduct(k, false)));

  // ── audio needs a user gesture
  const unlock = () => { audio.unlock(); applySettings(); };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('touchend', unlock, { once: true });

  // ── native polish
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setOverlaysWebView?.({ overlay: true }).catch(() => {});
    });
    import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide().catch(() => {}));
    // Android hardware back: close the open sheet, otherwise send the app to the background.
    import('@capacitor/app').then(({ App }) => App.addListener('backButton', () => {
      if (modalOpen()) return;
      if (sheets.current) sheets.close();
      else App.minimizeApp();
    }));
  }

  // ── lifecycle: save when backgrounded, pay out offline goo on return
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.save();
      audio.suspend();
    } else {
      audio.resume();
      game.checkOffline();
      showOffline();
      showDaily();
    }
  });
  window.addEventListener('pagehide', () => game.save());

  // ── main loop
  let last = performance.now();
  let uiTimer = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    game.tick(dt);
    ranch.update(dt);
    ranch.draw();
    hud.update();
    uiTimer += dt;
    if (uiTimer > 0.25) { uiTimer = 0; sheets.update(); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // ── reveal
  setTimeout(() => document.getElementById('boot')?.classList.add('gone'), 350);
  setTimeout(() => {
    showOffline();
    showDaily();
    startTutorial();
  }, 700);
}

// ─────────────────────────────────────────────────────────────
//  Lightweight onboarding
// ─────────────────────────────────────────────────────────────
let hintEl: HTMLElement | null = null;
function setHint(text: string | null) {
  hintEl?.remove();
  hintEl = null;
  if (!text) return;
  hintEl = el(`<div class="hint">${text}</div>`);
  document.getElementById('ui')!.appendChild(hintEl);
}

function startTutorial() {
  if (game.s.tutorial === 0) setHint('Drag one slime onto its twin to <b>merge</b> them!');
  else if (game.s.tutorial === 1) setHint('<b>Tap</b> a slime to pet it. Happy slimes make more goo!');
}

function advanceTutorial(ev: 'merge' | 'tap') {
  const t = game.s.tutorial;
  if (t === 0 && ev === 'merge') {
    game.s.tutorial = 1;
    setTimeout(() => setHint('Nice! Now <b>tap</b> a slime to pet it. Happy slimes make more goo!'), 900);
  } else if (t === 1 && ev === 'tap') {
    game.s.tutorial = 2;
    setHint(null);
    setTimeout(() => toast('Open Snacks and drag a berry onto a slime to feed it!', 'berry'), 600);
    game.save();
  }
}

boot();
