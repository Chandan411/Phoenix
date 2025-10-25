const Database = require('better-sqlite3');
const path = require('path');

// Update this path if your DB is elsewhere
const dbPath = path.join(__dirname, '../billing.db');
const db = new Database(dbPath);

try {
  // Delete all invoice items first (to avoid foreign key constraint errors)
  db.prepare('DELETE FROM invoice_items').run();
  // Then delete all invoices
  db.prepare('DELETE FROM invoices').run();
  // Optionally reset invoice sequence if you use one
  if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='invoice_seq'").get()) {
    db.prepare('UPDATE invoice_seq SET last_seq = 0 WHERE id = 1').run();
  }
  console.log('All invoices and invoice items have been deleted.');
} catch (err) {
  console.error('Error clearing invoices:', err);
} finally {
  db.close();
}