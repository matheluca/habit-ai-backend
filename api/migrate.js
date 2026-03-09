/**
 * MIGRAÇÃO FIRESTORE: Monolítico → Subcoleções
 * 
 * Arquivo: api/migrate.js (em seu projeto Vercel)
 */

import admin from 'firebase-admin';

// Inicializar Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

// ... resto do código ...
