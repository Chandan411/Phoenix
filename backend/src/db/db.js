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
  challan_no TEXT,
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
CREATE TABLE IF NOT EXISTS invoice_seq (
  fy_start_year INTEGER PRIMARY KEY,
  last_seq INTEGER
);
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

// Ensure invoices table has `challan_no` column for existing DBs
try {
  const info = db.prepare("PRAGMA table_info(invoices)").all();
  const hasChallan = (info || []).some(r => r && r.name === 'challan_no');
  if (!hasChallan) {
    db.exec("ALTER TABLE invoices ADD COLUMN challan_no TEXT;");
  }
} catch (e) {
  // ignore any errors while migrating schema
}

// Ensure invoice_items table has `quantity_unit` column for existing DBs
try {
  const itemInfo = db.prepare("PRAGMA table_info(invoice_items)").all();
  const hasQuantityUnit = (itemInfo || []).some(r => r && r.name === 'quantity_unit');
  if (!hasQuantityUnit) {
    db.exec("ALTER TABLE invoice_items ADD COLUMN quantity_unit TEXT DEFAULT 'Pieces';");
  }
} catch (e) {
  // ignore any errors while migrating schema
}

// Migrate invoice_seq table from fy_start_year to ym format
try {
  const seqInfo = db.prepare("PRAGMA table_info(invoice_seq)").all();
  const hasFyStartYear = (seqInfo || []).some(r => r && r.name === 'fy_start_year');
  const hasYm = (seqInfo || []).some(r => r && r.name === 'ym');
  
  if (hasFyStartYear && !hasYm) {
    // Old schema exists, need to migrate
    db.exec("ALTER TABLE invoice_seq RENAME TO invoice_seq_old;");
    db.exec("CREATE TABLE invoice_seq (ym TEXT PRIMARY KEY, last_seq INTEGER);");
    // Note: Old sequences are not migrated since format changed from FY to YM
    db.exec("DROP TABLE invoice_seq_old;");
  } else if (!hasYm && !hasFyStartYear) {
    // Table doesn't exist, create new
    db.exec("CREATE TABLE invoice_seq (ym TEXT PRIMARY KEY, last_seq INTEGER);");
  }
} catch (e) {
  // ignore any errors while migrating schema
}
module.exports = db;
