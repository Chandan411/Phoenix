const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const { admin } = require('./src/firestore');
const invoices = require('./src/invoices');

const app = express();
app.use(express.json({ limit: '5mb' }));

// Verify the Firebase ID token on every protected request
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/invoices', requireAuth, invoices);

exports.api = onRequest(
  { region: 'asia-south1', memory: '512MiB', timeoutSeconds: 60 },
  app
);
