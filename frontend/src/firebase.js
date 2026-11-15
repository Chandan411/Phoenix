import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'vistaar-invoice.firebaseapp.com',
  projectId: 'vistaar-invoice',
  storageBucket: 'vistaar-invoice.firebasestorage.app',
  messagingSenderId: '520732872947',
  appId: '1:520732872947:web:28484d8cc6956a7baaa786',
});

export const auth = getAuth(app);

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}