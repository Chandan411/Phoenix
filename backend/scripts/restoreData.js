const fs = require('fs');
const path = require('path');

const backendDir = path.resolve(__dirname, '..');
const dbPath = path.join(backendDir, 'billing.db');
const invoicesDir = path.join(backendDir, 'storage', 'invoices');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyIfExists(sourcePath, destPath) {
  if (!fs.existsSync(sourcePath)) return;
  ensureDir(path.dirname(destPath));
  fs.copyFileSync(sourcePath, destPath);
}

function copyDirIfExists(sourcePath, destPath) {
  if (!fs.existsSync(sourcePath)) return;
  ensureDir(destPath);
  fs.cpSync(sourcePath, destPath, { recursive: true });
}

function main() {
  const backupRoot = path.join(backendDir, 'backups');
  if (!fs.existsSync(backupRoot)) {
    console.error('No backups found in backend/backups');
    process.exit(1);
  }

  const latestBackup = fs.readdirSync(backupRoot)
    .filter((name) => fs.statSync(path.join(backupRoot, name)).isDirectory())
    .sort()
    .pop();

  if (!latestBackup) {
    console.error('No backup directory found');
    process.exit(1);
  }

  const backupDir = path.join(backupRoot, latestBackup);
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('Backup manifest not found');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const sourceDb = path.join(backupDir, 'billing.db');
  const sourceInvoices = path.join(backupDir, 'storage', 'invoices');

  copyIfExists(sourceDb, dbPath);
  copyDirIfExists(sourceInvoices, invoicesDir);

  console.log(`Restored backup from ${manifest.backupDir}`);
}

main();
