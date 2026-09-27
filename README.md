# 🟢 Slime Ranch Idle

A cozy idle/merge game for phones and tablets. Collect colorful slimes that make goo, **merge** twins to level them up, **fuse** different species to discover new ones (Ember + Frost = Steam!), and fill out the Slimedex.

Built with **TypeScript + Vite + HTML Canvas**, wrapped for **iOS & Android with Capacitor**. Every slime, hat, background, icon and sound is generated in code, so there are no art or audio assets to license.

## Gameplay

| System | Details |
|---|---|
| **Merge** | Drag a slime onto an identical one of the same level to level it up (×2.4 goo per level, max Lv 15). |
| **Fuse** | Drop two *different* species of the *same level* together. 35 recipes, 41 species across 6 tiers (Common → Mythic King Slime). |
| **Mutations** | Every hatch or merge can roll **Shiny** (×3) or **Golden** (×12). Merged slimes inherit the rarest mutation from their parents. |
| **Hatching** | Free eggs drop on a timer. Paid hatches let you choose which unlocked egg to hatch. |
| **Egg Research** | Unlock 6 elemental base species: Mint, Ember, Aqua, Terra, Frost, Zephyr. |
| **Upgrades** | Gourmet Feed, Bigger Pen, Egg Incubator, Nutrient Yolk, Tickle Glove, Mutation Serum, Goo Vault. |
| **Slimedex** | Each discovery gives gems and +2% goo. Hints show recipes once you've found both ingredients. |
| **Tap / Long-press** | Tap a slime to squeeze out bonus goo. Long-press it for details, hats, and selling. Drag it to the SELL bubble to sell it. |
| **Offline earnings** | Goo keeps accumulating while you're away. The Goo Vault upgrade raises the cap. |
| **Pens** | Build up to 6 pens. Each has its own name and theme, and every pen produces goo even while you're looking at another. Keep 3+ of one species in a pen for a **Harmony** bonus (+20%). Swipe sideways or use the ‹ › bar to switch pens; move slimes from their detail card. |
| **Petting & snacks** | Each slime has happiness (up to +50% goo). It drains slowly and is restored by petting (tap, with combo hearts) and snacks dragged from the tray: Goo Berry, Jelly Bean (sugar rush, 2× for 5 min) and Golden Apple (+1 level). Hungry slimes show a thought bubble. |
| **Gems from petting** | Every pet has a 2% chance (up to 4% for a fully happy slime) to turn up a gem. 10% of finds are a 5-gem jackpot. Capped at 25 gems/day so auto-clickers can't farm them. Tune in `src/game/data.ts` (`PET_GEM_*`). |
| **Auto-Feeder** | Spend gems (30 min / 2 h / 8 h for 15 / 45 / 120 gems) or watch an ad (10 min) to keep every slime in every pen at full happiness, including while offline. Stacks up to 24 h. A berry-tossing feeder appears on the ranch while it runs. |
| **Accounts & cloud save** | Optional sign-in with Apple, Google or Facebook. Backs the ranch up to the cloud, links purchases to the account, and asks which ranch to keep when device and cloud differ. Includes in-app account deletion. Runs in demo mode until Firebase is configured (see below). |
| **Weather** | Sunny, cloudy, rain, thunderstorms, snow, wind and rainbows cycle every few minutes, each with full visual effects. Each weather boosts slimes of matching elements (fusions count every element in their family tree). Rainbows boost all slimes and double shiny chances. |
| **Mini games** | **Goo Catch** (catch falling goo, dodge rocks) and **Slime Match** (memory pairs). Plays cost tickets (3 max, +1 every 20 min, or +1 per rewarded ad). Rewards are goo, snacks, Golden Apples and gems. |
| **Grand Festival** | Prestige: reset your ranch to earn Blue Ribbons (+10% goo each, permanent). |
| **Cosmetics** | 12 hats and 5 ranch themes: Meadow, Sunset, Frosty, Moonlit, Candy. |
| **Retention** | 7-day daily login calendar, free chest every 4 h, a gift balloon that drifts across the sky, and hungry slimes that miss you. |

## Monetisation

| Type | Where |
|---|---|
| **Rewarded ads** (opt-in) | 2× Goo Rush (+15 min, stacks to 4 h) · 2× offline earnings · Bonus chest (10 min cooldown) · Free gems (5/day) · 5× gift balloon · +1 game ticket · 2× game rewards · 10 min Auto-Feeder |
| **Interstitials** | Only on closing a menu. At least 3 min apart, never in the first 5 min of a session, never for Remove Ads owners. |
| **Banner** | Supported but **off** by default (`BANNER_ENABLED` in `src/config.ts`). It hurts the look of the ranch. |
| **IAP: Remove Ads** $2.99 | Removes forced ads and adds +50 gems. Rewarded ads stay available as an optional bonus. |
| **IAP: Starter Bundle** $4.99 | No ads + 300 gems + Epic chest + Royal Crown hat |
| **IAP: Golden Goo Pass** $4.99 | Permanent 2× goo |
| **IAP: Gem packs** $0.99 / $4.99 / $9.99 | 100 / 600 / 1400 gems. Gems buy chests, hats, themes and boosts. |

In a web browser, ads and purchases are **simulated** (a test-ad overlay and a "test purchase" confirmation), so every flow can be tested without a store.

- **Ads:** Google AdMob via `@capacitor-community/admob`, including the GDPR/UMP consent form and the iOS App Tracking Transparency prompt.
- **IAP:** RevenueCat via `@revenuecat/purchases-capacitor`, which handles StoreKit, Play Billing, receipt validation and Restore Purchases.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 — open with your browser's phone emulation
npm run build      # typecheck + production build into dist/
```

## Ship to the App Store / Google Play

Native projects are already set up in `ios/` and `android/`. They include portrait lock, app icons, splash screens and AdMob manifest entries.

1. **AdMob:** create an app for each platform at <https://admob.google.com>, then create *Rewarded*, *Interstitial* (and optionally *Banner*) ad units.
   - Put the unit IDs in `src/config.ts` → `ADMOB`, and set `AD_TESTING = false` for release builds.
   - Replace the **test App IDs** in `ios/App/App/Info.plist` (`GADApplicationIdentifier`) and `android/app/src/main/AndroidManifest.xml` (`com.google.android.gms.ads.APPLICATION_ID`).
   - Add Google's full `SKAdNetworkItems` list to `Info.plist`.
2. **Products:** create these in App Store Connect and Google Play Console:

   | Product ID | Type |
   |---|---|
   | `slimeranch.remove_ads` | non-consumable |
   | `slimeranch.starter_pack` | non-consumable |
   | `slimeranch.goo_pass` | non-consumable |
   | `slimeranch.gems_small` | consumable |
   | `slimeranch.gems_medium` | consumable |
   | `slimeranch.gems_large` | consumable |

3. **RevenueCat:** create a project, connect both stores, import the products, and paste the public SDK keys into `src/config.ts` → `REVENUECAT`.
4. **Build:**
   ```bash
   npm run cap:ios       # builds, syncs, opens Xcode → set Team & signing → Product ▸ Archive
   npm run cap:android   # builds, syncs, opens Android Studio → Build ▸ Generate Signed Bundle
   ```
5. **Store listing:**
   - Privacy policy URL (required, because the app shows ads).
   - App Privacy "nutrition label": Identifiers/Usage Data used for third-party advertising.
   - Age rating.
   - Screenshots.
6. **Change app icons:** edit `public/icon.svg`, then run `node scripts/gen-assets.cjs` (requires Playwright) to regenerate every icon and splash screen.

## Accounts (Apple / Google / Facebook sign-in)

Sign-in uses **Firebase Authentication** via `@capacitor-firebase/authentication`: native sheets on iOS and Android, popups on the web. Cloud saves are stored in **Firestore** at `saves/{uid}`. Until it is switched on, the game runs a clearly-labelled **demo sign-in** that stays on the device, so every screen and flow can be tested now.

Guest play always works. Signing in is optional, which is what the App Store requires for games.

### Turning it on for the store builds

1. **Firebase project:** create one at <https://console.firebase.google.com>.
   - Add a **Web app** and paste its config into `src/config.ts` → `AUTH.firebase`.
   - Set `AUTH.enabled = true` in `src/config.ts` **and** `ACCOUNTS_ENABLED = true` in `capacitor.config.ts`.
2. **Native apps:** in the same Firebase project, add an **iOS app** (bundle id `com.limelizardgames.slimeranch`) and an **Android app**.
   - Put `GoogleService-Info.plist` into `ios/App/App/` (and add it to the Xcode target).
   - Put `google-services.json` into `android/app/`.
3. **Providers:** enable these in *Authentication → Sign-in method*.
   - **Google:** on Android, add your release and debug SHA-1/SHA-256 fingerprints in Firebase. On iOS, add the `REVERSED_CLIENT_ID` URL scheme in Xcode.
   - **Apple:** in Xcode add the *Sign in with Apple* capability. In the Apple Developer portal, create a Services ID and key and enter them in Firebase.
   - **Facebook:** create an app at <https://developers.facebook.com> and copy its App ID and secret into Firebase. Then follow the plugin's Facebook setup, which adds the App ID and client token to `Info.plist` and `strings.xml`.
   - Set `rgcfaIncludeGoogle = true` and `rgcfaIncludeFacebook = true` in `android/variables.gradle`.
   - Full guides: <https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/authentication/docs>
4. **Firestore:** create the database and publish these rules:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /saves/{uid} {
         allow read, write, delete: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
5. **RevenueCat:** no setup needed. Signing in calls `Purchases.logIn(uid)`, so purchases follow the account.
6. **Run `npm run cap:sync`**, then build.

### App Store / Play rules already handled
- Sign in with Apple is offered alongside the other social logins (Apple guideline 4.8).
- Accounts can be deleted inside the app (Settings → Account → Delete account), which also revokes the Apple token (guideline 5.1.1(v)).
- Login is never required to play.
- In the App Privacy / Data safety forms, declare **Email address / Name / User ID** as used for *App functionality* (account & cloud save).

## Project layout

```
src/
  game/data.ts        species, recipes, upgrades, hats, themes, tuning constants
  game/game.ts        game state, economy, save/load, offline, prestige
  render/slimeArt.ts  procedural slime renderer (body, face, patterns, toppers, hats)
  render/ranch.ts     the ranch scene: hop physics, particles, drag-to-merge input
  render/background.ts themed sky / hills / fence painter
  render/weather.ts   rain, storms, snow, wind, rainbows
  ui/minigames.ts     Goo Catch & Slime Match
  ui/account.ts       sign-in screen, cloud sync, save-conflict chooser
  services/           ads, IAP, audio synth, haptics, durable storage, auth (+ authFirebase)
  ui/                 HUD, bottom sheets, modals, icons
  config.ts           ← ad unit IDs, product IDs, prices
```
