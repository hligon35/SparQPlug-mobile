const fs = require('fs');
const path = require('path');

const root = process.cwd();
const desktopPackagePath = path.join(root, 'apps', 'desktop', 'package.json');
const lockfilePath = path.join(root, 'pnpm-lock.yaml');

function fail(message) {
  console.error(`[verify-runtime-deps] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(desktopPackagePath)) {
  fail(`Missing desktop package manifest: ${desktopPackagePath}`);
}

const desktopPackage = JSON.parse(fs.readFileSync(desktopPackagePath, 'utf8'));
const deps = desktopPackage.dependencies || {};
const devDeps = desktopPackage.devDependencies || {};

const requiredRuntimeDeps = ['electron-updater', 'fs-extra', 'jsonfile', 'universalify'];
for (const dep of requiredRuntimeDeps) {
  if (!deps[dep]) {
    fail(`Runtime dependency '${dep}' must be in apps/desktop/package.json dependencies.`);
  }
  if (devDeps[dep]) {
    fail(`Runtime dependency '${dep}' must not be in devDependencies.`);
  }
}

if (!fs.existsSync(lockfilePath)) {
  fail(`Missing lockfile: ${lockfilePath}`);
}

const lockfile = fs.readFileSync(lockfilePath, 'utf8');
for (const dep of requiredRuntimeDeps) {
  if (!lockfile.includes(`${dep}@`)) {
    fail(`Lockfile does not include expected dependency entry for '${dep}'.`);
  }
}

console.log('[verify-runtime-deps] Desktop runtime dependency classification and lockfile checks passed.');
