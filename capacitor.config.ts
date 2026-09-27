import type { CapacitorConfig } from '@capacitor/cli';

// Keep in sync with AUTH.enabled in src/config.ts. The native Firebase plugin needs
// GoogleService-Info.plist / google-services.json, and on Android it crashes at launch
// without them, so it is only compiled into the apps once accounts are switched on.
const ACCOUNTS_ENABLED = false;

const nativePlugins = [
  '@capacitor-community/admob',
  '@capacitor/app',
  '@capacitor/haptics',
  '@capacitor/preferences',
  '@capacitor/splash-screen',
  '@capacitor/status-bar',
  '@revenuecat/purchases-capacitor',
  ...(ACCOUNTS_ENABLED ? ['@capacitor-firebase/authentication'] : []),
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
    FirebaseAuthentication: {
      // Native SDKs do the provider handshake; the Firebase JS SDK holds the session
      // (so Firestore cloud saves work the same on every platform).
      skipNativeAuth: true,
      providers: ['apple.com', 'google.com', 'facebook.com'],
    },
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#1d1040',
      showSpinner: false,
    },
  },
};

export default config;
