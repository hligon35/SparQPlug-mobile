const appJson = require('./app.json');

const expo = appJson.expo;

const defaultPublicConfig = {
  apiBaseUrl: 'https://sparqplug-api.hligon.workers.dev/api/v1',
  firebaseApiKey: 'AIzaSyAQcMkDRbf5mbgeqiirlt0jcpA2K5eifXE',
  firebaseAuthDomain: 'sparqplug-64f2b.firebaseapp.com',
  firebaseProjectId: 'sparqplug-64f2b',
  firebaseStorageBucket: 'sparqplug-64f2b.firebasestorage.app',
  firebaseMessagingSenderId: '1026157911910',
  firebaseAppId: '1:1026157911910:web:6b1093ea614b9e0c4732a7',
  firebaseMeasurementId: 'G-T4P29CQ8F8',
};

module.exports = () => ({
  ...expo,
  extra: {
    ...expo.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultPublicConfig.apiBaseUrl,
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? defaultPublicConfig.firebaseApiKey,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? defaultPublicConfig.firebaseAuthDomain,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? defaultPublicConfig.firebaseProjectId,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? defaultPublicConfig.firebaseStorageBucket,
    firebaseMessagingSenderId:
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? defaultPublicConfig.firebaseMessagingSenderId,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? defaultPublicConfig.firebaseAppId,
    firebaseMeasurementId:
      process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? defaultPublicConfig.firebaseMeasurementId,
  },
});