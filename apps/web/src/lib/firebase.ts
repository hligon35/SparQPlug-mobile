import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

function getRequiredEnv(key: keyof ImportMetaEnv) {
  const value = import.meta.env[key];

  if (!value) {
    throw new Error(`Missing required Firebase environment variable: ${key}`);
  }

  return value as string;
}

const firebaseConfig = {
  apiKey: getRequiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getRequiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getRequiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getRequiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getRequiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getRequiredEnv('VITE_FIREBASE_APP_ID'),
  measurementId: getRequiredEnv('VITE_FIREBASE_MEASUREMENT_ID'),
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
