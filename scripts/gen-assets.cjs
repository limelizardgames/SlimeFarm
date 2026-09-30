// Renders app icons & splash screens for iOS/Android from public/icon.svg.
// Usage: node scripts/gen-assets.cjs   (requires Playwright + Chromium)
const fs = require('fs');
const path = require('path');
const pwPath = (() => { try { return require.resolve('playwright'); } catch { return require('child_process').execSync('npm root -g').toString().trim() + '/playwright'; } })();
const { chromium } = require(pwPath);
const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'public/icon.svg'), 'utf8');
const square = svg.replace('rx="112"', 'rx="0"');
const b64 = (s) => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64');

async function shot(page, w, h, html, out, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;${transparent ? 'background:transparent' : ''}">${html}</body></html>`);
  await page.waitForTimeout(50);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: transparent });
  console.log('wrote', path.relative(root, out), `${w}x${h}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const img = (src, w, h, extra = '') => `<img src="${src}" style="width:${w}px;height:${h}px;display:block;${extra}">`;

  // iOS app icon (must be square & opaque — iOS applies its own mask)
  await shot(page, 1024, 1024, img(b64(square), 1024, 1024), path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'));
  await shot(page, 1024, 1024, img(b64(square), 1024, 1024), path.join(root, 'resources/icon-1024.png'));

  // Android launcher icons
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    const s = Math.round(48 * k), f = Math.round(108 * k);
    const dir = path.join(root, `android/app/src/main/res/mipmap-${d}`);
    await shot(page, s, s, img(b64(svg), s, s), path.join(dir, 'ic_launcher.png'), true);
    await shot(page, s, s, img(b64(square), s, s, 'border-radius:50%'), path.join(dir, 'ic_launcher_round.png'), true);
    await shot(page, f, f, img(b64(square), f, f), path.join(dir, 'ic_launcher_foreground.png'), true);
  }

  // Splash screens: the Lime Lizard Games studio card (the web boot screen picks up from here).
  const studio = fs.readFileSync(path.join(root, 'src/assets/lime-lizard-games.svg'), 'utf8');
  // iOS scales the 2732² image to fill the screen, so a phone only shows the middle ~45% of it; keep the logo small there.
  const splash = (w, h, k = 0.5) => {
    const s = Math.round(Math.min(w, h) * k);
    return `<div style="width:${w}px;height:${h}px;display:grid;place-items:center;background:radial-gradient(circle at 50% 44%, #2c3633, #131917 58%, #0b0f0e)">${img(b64(studio), s, Math.round(s * 1026.42 / 1166.18))}</div>`;
  };
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
    await shot(page, 2732, 2732, splash(2732, 2732, 0.26), path.join(root, 'ios/App/App/Assets.xcassets/Splash.imageset', f));
  const sizes = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
  for (const [d, [w, h]] of Object.entries(sizes)) {
    await shot(page, w, h, splash(w, h), path.join(root, `android/app/src/main/res/drawable-port-${d}/splash.png`));
    await shot(page, h, w, splash(h, w), path.join(root, `android/app/src/main/res/drawable-land-${d}/splash.png`));
  }
  await shot(page, 480, 800, splash(480, 800), path.join(root, 'android/app/src/main/res/drawable/splash.png'));
  await browser.close();
})();
