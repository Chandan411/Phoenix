const fs = require('fs');
const path = require('path');

const backendDir = path.resolve(__dirname, '..');
const dbPath = path.join(backendDir, 'billing.db');
const invoicesDir = path.join(backendDir, 'storage', 'invoices');
const backupRoot = path.join(backendDir, 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(backupRoot, `backup-${timestamp}`);

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
  ensureDir(backupDir);
  copyIfExists(dbPath, path.join(backupDir, 'billing.db'));
  copyDirIfExists(invoicesDir, path.join(backupDir, 'storage', 'invoices'));

  const manifest = {
    createdAt: new Date().toISOString(),
    dbPath: path.relative(backendDir, dbPath),
    invoicesPath: path.relative(backendDir, invoicesDir),
    backupDir: path.relative(backendDir, backupDir)
  };

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Backup created at: ${backupDir}`);
}

main();
