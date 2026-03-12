import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize primary app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize secondary app for user management (to avoid signing out admin)
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);

export default app;
