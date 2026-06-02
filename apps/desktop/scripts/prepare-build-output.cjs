const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const outDir = path.resolve(process.cwd(), 'out');
const buildOutputDir = path.join(outDir, 'build');
const activeWinUnpackedDir = path.join(buildOutputDir, 'win-unpacked');
const legacyWinUnpackedDir = path.join(outDir, 'win-unpacked');

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
    '  $commandLine = $_.CommandLine',
    "  $usesOutDir = ($exePath -and $exePath.StartsWith($outDir, [System.StringComparison]::OrdinalIgnoreCase)) -or ($commandLine -and $commandLine.IndexOf($outDir, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)",
    '  if ($usesOutDir) {',
    '    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue',
    '    $pathInfo = if ($exePath) { $exePath } else { $commandLine }',
    '    Write-Output ("Stopped process " + $_.ProcessId + ": " + $pathInfo)',
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

async function removeDirWithRetry(dirPath, { required }) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const retries = 20;
  const escapedDir = dirPath.replace(/'/g, "''");

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      fs.rmSync(dirPath, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 250,
      });
      console.log(`Cleaned stale directory: ${dirPath}`);
      return;
    } catch (_error) {
      if (process.platform === 'win32' && attempt === 8) {
        // Fallback path for stubborn Windows file locks.
        runPowerShell(`Remove-Item -LiteralPath '${escapedDir}' -Recurse -Force -ErrorAction SilentlyContinue`);
      }

      await wait(350 * attempt);
    }
  }

  if (required) {
    throw new Error(`Could not remove stale directory before build: ${dirPath}`);
  }

  console.warn(`Could not remove stale legacy directory: ${dirPath}`);
}

async function removeWinUnpackedWithRetry() {
  await removeDirWithRetry(activeWinUnpackedDir, { required: true });
  await removeDirWithRetry(legacyWinUnpackedDir, { required: false });
}

async function removePortableExesWithRetry() {
  if (!fs.existsSync(outDir)) {
    return;
  }

  const exeFiles = [];
  const stack = [outDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.toLowerCase() === 'win-unpacked') {
          continue;
        }
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
        exeFiles.push(fullPath);
      }
    }
  }

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
