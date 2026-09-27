import type { CapacitorConfig } from '@capacitor/cli';

// Keep in sync with AUTH.enabled in src/config.ts. The native sign-in plugin is only
// compiled into the apps once accounts are switched on and its IDs are configured.
const ACCOUNTS_ENABLED = false;

const nativePlugins = [
  '@capacitor-community/admob',
  '@capacitor/app',
  '@capacitor/browser',
  '@capacitor/haptics',
  '@capacitor/preferences',
  '@capacitor/splash-screen',
  '@capacitor/status-bar',
  '@revenuecat/purchases-capacitor',
  ...(ACCOUNTS_ENABLED ? ['@capgo/capacitor-social-login'] : []),
];

const config: CapacitorConfig = {
  appId: 'com.limelizardgames.slimeranch',
  appName: 'Slime Ranch Idle',
  webDir: 'dist',
  includePlugins: nativePlugins,
  backgroundColor: '#1d1040',
  ios: {
    contentInset: 'never',
    backgroundColor: '#1d1040',
  },
  android: {
    backgroundColor: '#1d1040',
  },
  plugins: {
    SocialLogin: {
      // Google & Apple use native sheets; Facebook goes through Supabase's browser flow,
      // so the Facebook SDK is left out of the app entirely.
      providers: { google: true, apple: true, facebook: false, twitter: false },
    },
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#1d1040',
      showSpinner: false,
    },
  },
};

export default config;
