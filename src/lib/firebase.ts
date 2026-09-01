import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore, connectFirestoreEmulator, setLogLevel } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Keep real errors visible while suppressing noisy info/warn logs
setLogLevel('error');

// Filter out internal SDK initial connection retry notices from bubbling as unhandled application crashes
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const fullText = args
      .map(arg => (typeof arg === 'string' ? arg : (arg?.message || (arg ? String(arg) : ''))))
      .join(' ');

    if (
      fullText.includes('@firebase/firestore') &&
      (fullText.includes('Could not reach Cloud Firestore backend') ||
       fullText.includes('offline mode until it is able to successfully connect'))
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
// Storage — ใช้เฉพาะภาพถ่ายบ้านนักเรียน (student_home_photos/{uid}/...) ดู storage.rules
export const storage = getStorage(app);

// TASK 5: In dev mode, enforce session-scoped persistence to prevent stale tab states
if (import.meta.env.DEV) {
  setPersistence(auth, browserSessionPersistence).catch(err => {
    console.warn('Notice: Could not set session persistence for auth in dev mode:', err);
  });
}

// Connect to local Firebase Emulators if explicitly enabled in local development mode
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    console.log('⚡ Connected to local Firebase Emulator Suite (Auth: 9099, Firestore: 8080, Storage: 9199)');
  } catch (emulatorErr) {
    console.warn('Notice: Firebase Emulator connection skipped or already initialized:', emulatorErr);
  }
}
