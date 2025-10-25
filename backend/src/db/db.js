const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const db = new Database(path.join(__dirname,'..','..','billing.db'));

// create tables
db.exec(`
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE,
  invoice_date TEXT,
  customer_name TEXT,
  customer_address TEXT,
  customer_gst TEXT,
  subtotal REAL,
  total_gst REAL,
  total REAL,
  file_path TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER,
  product_name TEXT,
  hsn_sac TEXT,
  description TEXT,
  quantity REAL,
  unit_price REAL,
  cgst_rate REAL,
  sgst_rate REAL,
  igst_rate REAL,
  line_total REAL,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS parties (
  gst TEXT PRIMARY KEY,
  name TEXT,
  address TEXT
);
CREATE TABLE IF NOT EXISTS invoice_seq (id INTEGER PRIMARY KEY CHECK (id = 1), last_seq INTEGER);
INSERT OR IGNORE INTO invoice_seq (id,last_seq) VALUES (1,0);
CREATE TABLE IF NOT EXISTS parties (
  gst TEXT PRIMARY KEY,
  name TEXT,
  address TEXT
);
CREATE TABLE IF NOT EXISTS products (
  product_name TEXT PRIMARY KEY,
  hsn_sac TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function insertDefaultUsers() {
  const defaultUsers = [
    { email: 'phoenixenterprises42@gmail.com', password: '9326874362' },
    { email: 'chandan.gupta3333@gmail.com', password: '8268786060' }
  ];
  const stmt = db.prepare('INSERT OR IGNORE INTO users (email, password) VALUES (?, ?)');
  defaultUsers.forEach(async user => {
    const hash = await bcrypt.hash(user.password, 10);
    stmt.run(user.email, hash);
  });
}
insertDefaultUsers();

module.exports = db;
