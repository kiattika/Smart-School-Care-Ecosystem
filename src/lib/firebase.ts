import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, getFirestore, connectFirestoreEmulator, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Keep real errors visible while suppressing noisy info/warn logs
setLogLevel('error');

// Filter out internal SDK initial connection retry notices from bubbling as unhandled application crashes
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('@firebase/firestore') &&
      args[0].includes('Could not reach Cloud Firestore backend')
    ) {
      console.warn('Notice: Firestore operating in offline/retry mode until backend connection establishes.');
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

try {
  initializeFirestore(app, {
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch {
  // Firestore instance already initialized
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// Connect to local Firebase Emulators if explicitly enabled in local development mode
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.log('⚡ Connected to local Firebase Emulator Suite (Auth: 9099, Firestore: 8080)');
  } catch (emulatorErr) {
    console.warn('Notice: Firebase Emulator connection skipped or already initialized:', emulatorErr);
  }
}
