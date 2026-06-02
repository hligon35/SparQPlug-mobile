const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const outDir = path.resolve(process.cwd(), 'out');
const winUnpackedDir = path.join(outDir, 'win-unpacked');

function runPowerShell(command) {
  return spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
}

function stopProcessesUsingOutDir() {
  if (process.platform !== 'win32') {
    return;
  }

  const escapedOutDir = outDir.replace(/'/g, "''");
  const psScript = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$outDir = '${escapedOutDir}'`,
    'Get-CimInstance Win32_Process | ForEach-Object {',
    '  $exePath = $_.ExecutablePath',
    "  if ($exePath -and $exePath.StartsWith($outDir, [System.StringComparison]::OrdinalIgnoreCase)) {",
    '    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue',
    '    Write-Output ("Stopped process " + $_.ProcessId + ": " + $exePath)',
    '  }',
    '}',
  ].join('; ');

  const result = runPowerShell(psScript);

  if (result.stdout && result.stdout.trim()) {
    console.log(result.stdout.trim());
  }

  if (result.status !== 0 && result.stderr && result.stderr.trim()) {
    console.warn(`Process cleanup warning: ${result.stderr.trim()}`);
  }
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeWinUnpackedWithRetry() {
  if (!fs.existsSync(winUnpackedDir)) {
    return;
  }

  const retries = 20;
  const escapedWinUnpackedDir = winUnpackedDir.replace(/'/g, "''");

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      fs.rmSync(winUnpackedDir, { recursive: true, force: true });
      console.log(`Cleaned stale directory: ${winUnpackedDir}`);
      return;
    } catch (_error) {
      if (process.platform === 'win32' && attempt === 8) {
        // Fallback path for stubborn Windows file locks.
        runPowerShell(`Remove-Item -LiteralPath '${escapedWinUnpackedDir}' -Recurse -Force -ErrorAction SilentlyContinue`);
      }

      await wait(350 * attempt);
    }
  }

  console.warn(`Could not remove stale directory before build: ${winUnpackedDir}`);
}

async function removePortableExesWithRetry() {
  if (!fs.existsSync(outDir)) {
    return;
  }

  const exeFiles = fs
    .readdirSync(outDir)
    .filter((name) => name.toLowerCase().endsWith('.exe'))
    .map((name) => path.join(outDir, name));

  for (const exeFile of exeFiles) {
    const retries = 6;
    let removed = false;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        fs.rmSync(exeFile, { force: true });
        removed = true;
        console.log(`Removed stale portable artifact: ${exeFile}`);
        break;
      } catch (_error) {
        await wait(300 * attempt);
      }
    }

    if (!removed) {
      console.warn(`Could not remove stale portable artifact before build: ${exeFile}`);
    }
  }
}

async function main() {
  stopProcessesUsingOutDir();
  await wait(500);
  await removePortableExesWithRetry();
  await removeWinUnpackedWithRetry();
}

main().catch((error) => {
  console.error(`Failed to prepare desktop build output: ${error.message}`);
  process.exit(1);
});
