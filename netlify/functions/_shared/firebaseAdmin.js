// netlify/functions/_shared/firebaseAdmin.js
import pkg from 'firebase-admin';
const { initializeApp, cert, getApps } = pkg;
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export function initAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
}
export { getFirestore, getAuth };
