import type { ConfigContext, ExpoConfig } from 'expo/config';

// One bundle id for every variant keeps passkeys and universal links on a single App ID.
const BUNDLE_ID = 'org.mychurchflow.app';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ChurchFlow',
  slug: 'churchflow',
  scheme: 'churchflow',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
    infoPlist: {
      // The e2e build talks to a local API over plain http.
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#f6f8fa',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
