import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

const firebaseConfig = {
  apiKey:
    runtimeEnv?.['EXPO_PUBLIC_FIREBASE_API_KEY'] ??
    (Constants.expoConfig?.extra?.['firebaseApiKey'] as string | undefined),
  authDomain:
    runtimeEnv?.['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] ??
    (Constants.expoConfig?.extra?.['firebaseAuthDomain'] as string | undefined),
  projectId:
    runtimeEnv?.['EXPO_PUBLIC_FIREBASE_PROJECT_ID'] ??
    (Constants.expoConfig?.extra?.['firebaseProjectId'] as string | undefined),
  storageBucket:
    runtimeEnv?.['EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'] ??
    (Constants.expoConfig?.extra?.['firebaseStorageBucket'] as string | undefined),
  messagingSenderId:
    runtimeEnv?.['EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'] ??
    (Constants.expoConfig?.extra?.['firebaseMessagingSenderId'] as string | undefined),
  appId:
    runtimeEnv?.['EXPO_PUBLIC_FIREBASE_APP_ID'] ??
    (Constants.expoConfig?.extra?.['firebaseAppId'] as string | undefined),
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfig.length > 0) {
  throw new Error(`Missing Firebase config: ${missingConfig.join(', ')}`);
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
