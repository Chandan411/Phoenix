const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');

const DATABASE_TYPE = process.env.DATABASE_TYPE || 'sqlite';
const DATABASE_URL = process.env.DATABASE_URL;

let db;

if (DATABASE_TYPE === 'libsql') {
  // Turso/libSQL mode
  if (!DATABASE_URL) {
    throw new Error(
      "Production database configuration missing: DATABASE_URL is required."
    );
  }

  // Turso URL format: turso://org-name/project-name?authToken=YOUR_TOKEN
  // better-sqlite3 can connect directly to Turso HTTP endpoint
  db = new Database(DATABASE_URL);

  // Apply Turso pragmas for optimal connection
  try {
    db.pragma('application_id = ' + crypto.randomBytes(8).toString('hex'));
    db.pragma('user_version = 1');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  } catch (e) {
    // Ignore pragma errors; core functionality remains
  }

} else if (DATABASE_TYPE === 'postgres') {
  if (!DATABASE_URL) {
    throw new Error(
      "Production database configuration missing: DATABASE_URL is required."
    );
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
  });

  // Query function that returns rows (mimics better-sqlite3 .all() and .get())
  const query = (sql, params = []) => pool.query(sql, params);

  // Execute non-query (mimics .run())
  const exec = (sql, params = []) => pool.query(sql, params);

  // Prepare statement (returns object with .get(), .all(), .run())
  const prepare = (sql) => {
    const stmt = {
      _sql: sql,
      _params: [],
    };

    stmt.get = (...params2) => {
      const allParams = [...params, ...params2];
      return query(stmt._sql, allParams).then((r) => r.rows[0]);
    };

    stmt.all = (...params2) => {
      const allParams = [...params, ...params2];
      return query(stmt._sql, allParams).then((r) => r.rows);
    };

    stmt.run = (...params2) => {
      const allParams = [...params, ...params2];
      return query(stmt._sql, allParams);
    };

    return stmt;
  };

  // Transaction support
  const transaction = async (callback) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  db = {
    query,
    exec,
    prepare,
    transaction,
  };

} else {
  // SQLite mode (local development - default)
  const dbPath = path.join(__dirname, '..', '..', 'billing.db');
  db = new Database(dbPath);

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

  // Migrate invoice_seq table to financial year format (fy)
  try {
    const seqInfo = db.prepare("PRAGMA table_info(invoice_seq)").all();
    const hasFy = (seqInfo || []).some(r => r && r.name === 'fy');
    const hasYm = (seqInfo || []).some(r => r && r.name === 'ym');
    const hasFyStartYear = (seqInfo || []).some(r => r && r.name === 'fy_start_year');
    
    if (hasFyStartYear && !hasFy) {
      // Old fy_start_year schema -> migrate to fy
      db.exec("ALTER TABLE invoice_seq RENAME TO invoice_seq_old;");
      db.exec("CREATE TABLE invoice_seq (fy TEXT PRIMARY KEY, last_seq INTEGER);");
      db.exec("DROP TABLE invoice_seq_old;");
    } else if (hasYm && !hasFy) {
      // Old ym (monthly) schema -> migrate to fy
      db.exec("ALTER TABLE invoice_seq RENAME TO invoice_seq_old;");
      db.exec("CREATE TABLE invoice_seq (fy TEXT PRIMARY KEY, last_seq INTEGER);");
      db.exec("DROP TABLE invoice_seq_old;");
    } else if (!hasFy && !hasYm && !hasFyStartYear) {
      // Table doesn't exist, create new with fy format
      db.exec("CREATE TABLE invoice_seq (fy TEXT PRIMARY KEY, last_seq INTEGER);");
    }
  } catch (e) {
    // ignore any errors while migrating schema
  }
}

module.exports = db;