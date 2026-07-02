const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const desktopRoot = process.cwd();
const outDir = path.resolve(desktopRoot, 'out');
const buildDir = path.join(outDir, 'build');
const winUnpackedDir = path.join(buildDir, 'win-unpacked');
const appExeName = 'SparQPlug.exe';
const localAppData = process.env.LOCALAPPDATA;
const appData = process.env.APPDATA;
const userProfile = process.env.USERPROFILE;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureWindowsEnv(name, value) {
  if (!value) {
    fail(`Required Windows environment variable is missing: ${name}`);
  }

  return value;
}

function runPowerShell(command) {
  return spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function waitMs(durationMs) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, durationMs);
}

function stopRunningInstalledProcesses(installDirectory) {
  const escapedInstallDir = installDirectory.replace(/'/g, "''");
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$targetDir = '${escapedInstallDir}'`,
    'Get-CimInstance Win32_Process | ForEach-Object {',
    '  if ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($targetDir, [System.StringComparison]::OrdinalIgnoreCase)) {',
    '    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue',
    '  }',
    '}',
  ].join('; ');

  runPowerShell(script);
}

function forceRemoveDirectory(targetDir) {
  const escapedTargetDir = targetDir.replace(/'/g, "''");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$targetDir = '${escapedTargetDir}'`,
    'if (Test-Path $targetDir) {',
    '  Get-ChildItem -LiteralPath $targetDir -Force -Recurse -ErrorAction SilentlyContinue | ForEach-Object {',
    '    try { $_.Attributes = "Normal" } catch {}',
    '  }',
    '  try { (Get-Item -LiteralPath $targetDir -Force).Attributes = "Directory" } catch {}',
    '  Remove-Item -LiteralPath $targetDir -Force -Recurse -ErrorAction Stop',
    '}',
  ].join('; ');

  return runPowerShell(script);
}

function removeDirectoryWithRetries(targetDir) {
  if (!fs.existsSync(targetDir)) {
    return;
  }

  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      return;
    } catch (error) {
      lastError = error;
      forceRemoveDirectory(targetDir);

      if (!fs.existsSync(targetDir)) {
        return;
      }

      waitMs(300 * attempt);
    }
  }

  throw lastError;
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  removeDirectoryWithRetries(targetDir);
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

function createShortcut(shortcutPath, targetPath, workingDirectory) {
  const escapedShortcut = shortcutPath.replace(/'/g, "''");
  const escapedTarget = targetPath.replace(/'/g, "''");
  const escapedWorkingDir = workingDirectory.replace(/'/g, "''");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$shortcutPath = '${escapedShortcut}'`,
    `$targetPath = '${escapedTarget}'`,
    `$workingDirectory = '${escapedWorkingDir}'`,
    '$shortcutDir = Split-Path -Parent $shortcutPath',
    'New-Item -ItemType Directory -Force -Path $shortcutDir | Out-Null',
    '$shell = New-Object -ComObject WScript.Shell',
    '$shortcut = $shell.CreateShortcut($shortcutPath)',
    '$shortcut.TargetPath = $targetPath',
    '$shortcut.WorkingDirectory = $workingDirectory',
    '$shortcut.IconLocation = $targetPath',
    '$shortcut.Save()',
  ].join('; ');

  const result = runPowerShell(script);
  if (result.status !== 0) {
    fail(`Failed to create shortcut ${shortcutPath}: ${result.stderr.trim() || 'unknown error'}`);
  }
}

function launchInstalledApp(executablePath) {
  const child = spawn(executablePath, [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: false,
  });

  child.on('error', (error) => {
    fail(`Installed app could not be launched: ${error.message}`);
  });

  child.unref();
}

if (process.platform !== 'win32') {
  fail('Desktop install script is currently supported on Windows only.');
}

ensureWindowsEnv('LOCALAPPDATA', localAppData);
ensureWindowsEnv('APPDATA', appData);
ensureWindowsEnv('USERPROFILE', userProfile);

if (!fs.existsSync(winUnpackedDir)) {
  fail(`Build output folder not found: ${winUnpackedDir}\nRun the desktop build first.`);
}

const sourceExe = path.join(winUnpackedDir, appExeName);
if (!fs.existsSync(sourceExe)) {
  fail(`Built desktop executable not found: ${sourceExe}`);
}

const installRoot = path.join(localAppData, 'Programs', 'SparQPlug');
const installExe = path.join(installRoot, appExeName);
const desktopShortcut = path.join(userProfile, 'Desktop', 'SparQPlug.lnk');
const startMenuShortcut = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'SparQPlug.lnk');

stopRunningInstalledProcesses(installRoot);
copyDirectory(winUnpackedDir, installRoot);
createShortcut(desktopShortcut, installExe, installRoot);
createShortcut(startMenuShortcut, installExe, installRoot);
launchInstalledApp(installExe);

console.log(`Installed SparQPlug to: ${installRoot}`);
console.log(`Desktop shortcut: ${desktopShortcut}`);
console.log(`Start menu shortcut: ${startMenuShortcut}`);
process.exit(0);
