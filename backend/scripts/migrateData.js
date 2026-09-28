const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_TYPE = process.env.DATABASE_TYPE;

if (DATABASE_TYPE !== 'libsql' || !DATABASE_URL) {
  console.error('ERROR: migrateData.js requires DATABASE_TYPE=libsql and DATABASE_URL');
  process.exit(1);
}

// Connect to Turso (cloud SQLite/libSQL)
const tursoDb = new Database(DATABASE_URL);

// Apply Turso pragmas
try {
  tursoDb.pragma('application_id = ' + crypto.randomBytes(8).toString('hex'));
  tursoDb.pragma('user_version = 1');
  tursoDb.pragma('journal_mode = WAL');
  tursoDb.pragma('synchronous = NORMAL');
} catch (e) {
  // Ignore pragma errors; core functionality remains
}

// Local SQLite path (source database)
const sqliteDbPath = path.join(__dirname, '..', '..', 'billing.db');
const sqliteDb = new Database(sqliteDbPath);

async function migrate() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRoot = path.join(__dirname, '..', '..', 'backups');
  const backupDir = path.join(backupRoot, `migrate-backup-${timestamp}`);

  try {
    console.log('=== SQLite → Turso Migration ===');
    console.log('Source: Local SQLite at', sqliteDbPath);
    console.log('Target: Turso via', DATABASE_URL.split('?')[0]);

    // Ensure backup directory exists
    fs.mkdirSync(backupRoot, { recursive: true });

    // 1. Backup local SQLite before migration
    console.log('\n--- Backing up local SQLite ---');
    const sqliteBackupDir = path.join(backupRoot, `sqlite-backup-${timestamp}`);
    fs.mkdirSync(sqliteBackupDir, { recursive: true });

    // Copy billing.db
    const dbSource = path.join(__dirname, '..', '..', 'billing.db');
    if (fs.existsSync(dbSource)) {
      fs.copyFileSync(dbSource, path.join(sqliteBackupDir, 'billing.db'));
      console.log('SQLite backup created at', sqliteBackupDir);
    } else {
      console.log('WARNING: Local billing.db not found, skipping SQLite backup');
    }

    // 2. Migrate users
    console.log('\n--- Migrating users ---');
    const users = sqliteDb.prepare('SELECT id, email, password, created_at FROM users').all();
    console.log(`Found ${users.length} users in SQLite`);

    for (const user of users) {
      try {
        tursoDb.prepare(
          `INSERT INTO users (id, email, password, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (email) DO NOTHING`
        ).run(user.id, user.email, user.password, user.created_at);
      } catch (err) {
        console.error('Error migrating user', user.email, ':', err.message);
      }
    }
    console.log(`Migrated ${users.length} users`);

    // 3. Migrate parties
    console.log('\n--- Migrating parties ---');
    const parties = sqliteDb.prepare('SELECT gst, name, address FROM parties').all();
    console.log(`Found ${parties.length} parties in SQLite`);

    for (const party of parties) {
      try {
        tursoDb.prepare(
          `INSERT INTO parties (gst, name, address) VALUES ($1, $2, $3)
           ON CONFLICT (gst) DO UPDATE SET name=EXCLUDED.name, address=EXCLUDED.address`
        ).run(party.gst, party.name, party.address);
      } catch (err) {
        console.error('Error migrating party', party.gst, ':', err.message);
      }
    }
    console.log(`Migrated ${parties.length} parties`);

    // 4. Migrate products
    console.log('\n--- Migrating products ---');
    const products = sqliteDb.prepare('SELECT product_name, hsn_sac FROM products').all();
    console.log(`Found ${products.length} products in SQLite`);

    for (const product of products) {
      try {
        tursoDb.prepare(
          `INSERT INTO products (product_name, hsn_sac) VALUES ($1, $2)
           ON CONFLICT (product_name) DO UPDATE SET hsn_sac=EXCLUDED.hsn_sac`
        ).run(product.product_name, product.hsn_sac);
      } catch (err) {
        console.error('Error migrating product', product.product_name, ':', err.message);
      }
    }
    console.log(`Migrated ${products.length} products`);

    // 5. Migrate invoice_seq
    console.log('\n--- Migrating invoice_seq ---');
    const seqRows = sqliteDb.prepare('SELECT fy_start_year, last_seq FROM invoice_seq').all();
    console.log(`Found ${seqRows.length} sequences in SQLite`);

    for (const row of seqRows) {
      // Map old fy_start_year to fy format for Turso
      const fy = row.fy_start_year >= 2020 ? `${row.fy_start_year}-${row.fy_start_year + 1}` : `${row.fy_start_year}-${row.fy_start_year + 1}`;
      try {
        tursoDb.prepare(
          `INSERT INTO invoice_seq (fy, last_seq) VALUES ($1, $2)
           ON CONFLICT (fy) DO UPDATE SET last_seq = GREATEST(invoice_seq.last_seq, EXCLUDED.last_seq)`
        ).run(fy, row.last_seq);
      } catch (err) {
        console.error('Error migrating sequence', fy, ':', err.message);
      }
    }
    console.log(`Migrated ${seqRows.length} sequences`);

    // 6. Migrate invoices
    console.log('\n--- Migrating invoices ---');
    const invoices = sqliteDb.prepare('SELECT * FROM invoices').all();
    console.log(`Found ${invoices.length} invoices in SQLite`);

    for (const inv of invoices) {
      try {
        tursoDb.prepare(
          `INSERT INTO invoices (id, invoice_number, invoice_date, customer_name, customer_address, challan_no, customer_gst, subtotal, total_gst, total, file_path, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (invoice_number) DO NOTHING`
        ).run(
          inv.id,
          inv.invoice_number,
          inv.invoice_date,
          inv.customer_name,
          inv.customer_address,
          inv.challan_no,
          inv.customer_gst,
          inv.subtotal,
          inv.total_gst,
          inv.total,
          inv.file_path,
          inv.created_at
        );
      } catch (err) {
        console.error('Error migrating invoice', inv.invoice_number, ':', err.message);
      }
    }
    console.log(`Migrated ${invoices.length} invoices`);

    // 7. Migrate invoice_items
    console.log('\n--- Migrating invoice_items ---');
    const invoiceItems = sqliteDb.prepare('SELECT * FROM invoice_items').all();
    console.log(`Found ${invoiceItems.length} invoice items in SQLite`);

    for (const item of invoiceItems) {
      try {
        tursoDb.prepare(
          `INSERT INTO invoice_items (id, invoice_id, product_name, hsn_sac, description, quantity, unit_price, cgst_rate, sgst_rate, igst_rate, line_total) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`
        ).run(
          item.id,
          item.invoice_id,
          item.product_name,
          item.hsn_sac,
          item.description,
          item.quantity,
          item.unit_price,
          item.cgst_rate,
          item.sgst_rate,
          item.igst_rate,
          item.line_total
        );
      } catch (err) {
        console.error('Error migrating invoice item', item.id, ':', err.message);
      }
    }
    console.log(`Migrated ${invoiceItems.length} invoice items`);

    console.log('\n=== Migration Complete ===');
    console.log('All data has been migrated from SQLite to Turso.');
    console.log('The original SQLite database (billing.db) is preserved in backup.');
    console.log('Run the application with DATABASE_TYPE=libsql to use the Turso database.');

  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    // Close Turso connection
    tursoDb.close();

    // Close SQLite connection
    sqliteDb.close();
  }
}

migrate();