const admin = require('firebase-admin');

// Confirm the exact bucket name on the Storage page of the Firebase console.
// New projects: <id>.firebasestorage.app, older ones: <id>.appspot.com
admin.initializeApp({ storageBucket: 'vistaar-invoice.firebasestorage.app' });

module.exports = {
  admin,
  db: admin.firestore(),
  bucket: admin.storage().bucket(),
};