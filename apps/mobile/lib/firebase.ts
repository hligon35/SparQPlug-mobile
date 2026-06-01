import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.['firebaseApiKey'] as string,
  authDomain: Constants.expoConfig?.extra?.['firebaseAuthDomain'] as string,
  projectId: Constants.expoConfig?.extra?.['firebaseProjectId'] as string,
  storageBucket: Constants.expoConfig?.extra?.['firebaseStorageBucket'] as string,
  messagingSenderId: Constants.expoConfig?.extra?.['firebaseMessagingSenderId'] as string,
  appId: Constants.expoConfig?.extra?.['firebaseAppId'] as string,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const initializeAuth = FirebaseAuth.initializeAuth;
const getReactNativePersistence = (
  FirebaseAuth as unknown as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
  }
).getReactNativePersistence;

export const auth = getReactNativePersistence
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) as never })
  : initializeAuth(app);

export default app;
