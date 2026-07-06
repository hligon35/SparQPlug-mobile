import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

type ExpoExtra = {
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
};

const expoExtra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

const firebaseConfig = {
  apiKey: expoExtra.firebaseApiKey,
  authDomain: expoExtra.firebaseAuthDomain,
  projectId: expoExtra.firebaseProjectId,
  storageBucket: expoExtra.firebaseStorageBucket,
  messagingSenderId: expoExtra.firebaseMessagingSenderId,
  appId: expoExtra.firebaseAppId,
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfig.length > 0) {
  throw new Error(`Missing Firebase config from Expo extra: ${missingConfig.join(', ')}`);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const initializeAuth = FirebaseAuth.initializeAuth;
const getAuth = FirebaseAuth.getAuth;
const getReactNativePersistence = (
  FirebaseAuth as unknown as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
  }
).getReactNativePersistence;

export const auth = (() => {
  try {
    return getReactNativePersistence
      ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) as never })
      : initializeAuth(app);
  } catch {
    return getAuth(app);
  }
})();

export default app;
