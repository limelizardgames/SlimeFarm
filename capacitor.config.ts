import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.limelizardgames.slimeranch',
  appName: 'Slime Ranch Idle',
  webDir: 'dist',
  backgroundColor: '#1d1040',
  ios: {
    contentInset: 'never',
    backgroundColor: '#1d1040',
  },
  android: {
    backgroundColor: '#1d1040',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#1d1040',
      showSpinner: false,
    },
  },
};

export default config;
