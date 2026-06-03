const fs = require('fs');
const path = require('path');

const desktopRoot = process.cwd();
const buildRoot = path.join(desktopRoot, 'out', 'build');
const winUnpacked = path.join(buildRoot, 'win-unpacked');
const asarPath = path.join(winUnpacked, 'resources', 'app.asar');
const portableExePath = path.join(buildRoot, 'SparQPlug 1.0.0.exe');

function fail(message) {
  console.error(`[verify-desktop-package] ${message}`);
  process.exit(1);
}

function checkPath(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    fail(`Missing ${label}: ${targetPath}`);
  }
}

checkPath(buildRoot, 'build output directory');
checkPath(winUnpacked, 'win-unpacked directory');
checkPath(asarPath, 'app.asar');
checkPath(portableExePath, 'portable executable');

const desktopMain = path.join(desktopRoot, 'dist', 'electron', 'main.js');
const desktopWebIndex = path.join(desktopRoot, 'dist', 'web', 'index.html');
const fsExtraPkg = path.join(desktopRoot, 'node_modules', 'fs-extra', 'package.json');
const universalifyPkg = path.join(desktopRoot, 'node_modules', 'universalify', 'package.json');

checkPath(desktopMain, 'compiled desktop main entrypoint');
checkPath(desktopWebIndex, 'desktop renderer entrypoint');
checkPath(fsExtraPkg, 'fs-extra runtime package');
checkPath(universalifyPkg, 'universalify runtime package');

const mainContents = fs.readFileSync(desktopMain, 'utf8');
if (!mainContents.includes("require('electron-updater')") && !mainContents.includes('require("electron-updater")')) {
  fail('Desktop main bundle does not contain electron-updater require as expected.');
}

console.log('[verify-desktop-package] Desktop build artifacts and runtime module prerequisites verified.');
