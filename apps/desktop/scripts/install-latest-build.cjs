const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const outDir = path.resolve(process.cwd(), 'out');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function scoreCandidate(filePath) {
  const fileName = path.basename(filePath).toLowerCase();
  let score = 0;

  if (/^sparqplug( \d+\.\d+\.\d+)?( portable)?\.exe$/.test(fileName)) score += 500;
  if (fileName.includes('portable')) score += 300;
  if (fileName.includes('sparqplug')) score += 120;
  if (fileName.includes('setup')) score -= 250;
  if (fileName.includes('installer')) score -= 250;

  return score;
}

function pickBestExecutable(files) {
  const toCandidates = (allowInstallers) => files
    .filter((f) => f.toLowerCase().endsWith('.exe'))
    .filter((f) => !f.toLowerCase().includes(`${path.sep}win-unpacked${path.sep}`))
    .filter((f) => !path.basename(f).toLowerCase().includes('unins'))
    .filter((f) => {
      if (allowInstallers) return true;
      const fileName = path.basename(f).toLowerCase();
      return !fileName.includes('setup') && !fileName.includes('installer');
    })
    .map((f) => {
      const stat = fs.statSync(f);
      return {
        path: f,
        mtimeMs: stat.mtimeMs,
        score: scoreCandidate(f),
      };
    });

  const exes = toCandidates(false);
  const candidates = exes.length > 0 ? exes : toCandidates(true);

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.mtimeMs - a.mtimeMs;
  });

  return candidates[0] || null;
}

if (process.platform !== 'win32') {
  console.error('Desktop install script is currently supported on Windows only.');
  process.exit(1);
}

if (!fs.existsSync(outDir)) {
  console.error(`Build output folder not found: ${outDir}`);
  console.error('Run the desktop build first.');
  process.exit(1);
}

const best = pickBestExecutable(walk(outDir));

if (!best) {
  console.error(`No packaged .exe artifact found under: ${outDir}`);
  console.error('The win-unpacked executable is intentionally ignored to prevent build-output file locks.');
  console.error('Run the desktop build first.');
  process.exit(1);
}

console.log(`Launching desktop artifact: ${best.path}`);

const child = spawn(best.path, [], {
  detached: true,
  stdio: 'ignore',
  shell: false,
});

child.on('error', (err) => {
  console.error('Failed to launch desktop artifact:', err.message);
  process.exit(1);
});

child.unref();
process.exit(0);
