const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const backendDevVarsPath = path.join(repoRoot, 'backend', '.dev.vars');
const backendUrl = 'http://localhost:8787';

function parseEnvFile(content) {
  const values = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

async function main() {
  if (!fs.existsSync(backendDevVarsPath)) {
    throw new Error(`Missing backend/.dev.vars at ${backendDevVarsPath}`);
  }

  const env = parseEnvFile(fs.readFileSync(backendDevVarsPath, 'utf8'));
  const bootstrapSecret = env.BOOTSTRAP_SECRET;

  if (!bootstrapSecret) {
    throw new Error('Missing BOOTSTRAP_SECRET in backend/.dev.vars');
  }

  let healthResponse;
  try {
    healthResponse = await fetch(`${backendUrl}/health`);
  } catch {
    throw new Error('Local backend is not running on http://localhost:8787. Start it with pnpm dev:backend, then rerun pnpm bootstrap.');
  }

  if (!healthResponse.ok) {
    throw new Error(`Local backend health check failed with status ${healthResponse.status}.`);
  }

  const response = await fetch(`${backendUrl}/api/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: bootstrapSecret }),
  });

  const payload = await response.json().catch(() => ({ success: false, error: 'Invalid JSON response' }));

  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : `Bootstrap failed with status ${response.status}`);
  }

  console.log(payload);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});