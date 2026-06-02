const fs = require('fs');
const path = require('path');

const desktopRoot = process.cwd();
const webDistDir = path.resolve(desktopRoot, '..', 'web', 'dist');
const desktopWebDistDir = path.join(desktopRoot, 'dist', 'web');
const webIndexFile = path.join(webDistDir, 'index.html');

if (!fs.existsSync(webDistDir)) {
  console.error(`Web dist folder not found: ${webDistDir}`);
  console.error('Run the web build before syncing desktop web assets.');
  process.exit(1);
}

if (!fs.existsSync(webIndexFile)) {
  console.error(`Web dist is incomplete. Missing file: ${webIndexFile}`);
  console.error('Run `pnpm --filter @sparqplug/web run build:deploy` and retry the desktop build.');
  process.exit(1);
}

fs.rmSync(desktopWebDistDir, { recursive: true, force: true });
fs.mkdirSync(desktopWebDistDir, { recursive: true });

fs.cpSync(webDistDir, desktopWebDistDir, { recursive: true });

const desktopWebIndexFile = path.join(desktopWebDistDir, 'index.html');
if (!fs.existsSync(desktopWebIndexFile)) {
  console.error(`Desktop web sync failed. Missing file: ${desktopWebIndexFile}`);
  process.exit(1);
}

console.log(`Synced web dist to desktop bundle path: ${desktopWebDistDir}`);
