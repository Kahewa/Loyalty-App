// Firebase client SDK setup.
//
// The keys below are PUBLIC by design — they identify the project, they do not
// authorise anything. Security comes from firestore.rules, not from secrecy.
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Before .env exists these are all undefined, and initializeFirestore throws on a
// missing projectId — which would red-screen the app instead of showing the
// "set up your .env" message on the first screen. Stand-in values keep the SDK
// quiet; isConfigured is what the UI actually branches on.
if (!isConfigured) {
  firebaseConfig.apiKey = firebaseConfig.apiKey || 'not-configured';
  firebaseConfig.projectId = firebaseConfig.projectId || 'not-configured';
  firebaseConfig.appId = firebaseConfig.appId || 'not-configured';
  firebaseConfig.authDomain = firebaseConfig.authDomain || 'not-configured.firebaseapp.com';
}

const USE_EMULATORS = process.env.EXPO_PUBLIC_USE_EMULATORS === '1';

// On Android emulators localhost is the device itself; 10.0.2.2 is the host PC.
// On a physical phone you must set EXPO_PUBLIC_EMULATOR_HOST to your PC's LAN IP.
const EMULATOR_HOST =
  process.env.EXPO_PUBLIC_EMULATOR_HOST ||
  (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// initializeAuth (not getAuth) so the session survives an app restart via AsyncStorage.
// On web that persistence helper does not exist, so fall back to the browser default.
export const auth = (() => {
  if (Platform.OS === 'web' || typeof getReactNativePersistence !== 'function') {
    return getAuth(app);
  }
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app); // already initialised (Fast Refresh)
  }
})();

// Long polling avoids the streaming-connection problems the JS SDK hits on RN.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: Platform.OS !== 'web',
});

export const functions = getFunctions(app);

let connected = false;
if (USE_EMULATORS && !connected) {
  connected = true;
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
  console.log(`[firebase] using emulators at ${EMULATOR_HOST}`);
}
