import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = resolve(repoRoot, 'reports');
mkdirSync(reportDir, { recursive: true });
const reportPath = resolve(reportDir, 'playwright-regression.json');
const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT || String(19000 + Math.floor(Math.random() * 1000));
const frontendUrl = process.env.PLAYWRIGHT_FRONTEND_URL || `http://127.0.0.1:${frontendPort}`;
const backendPort = process.env.PLAYWRIGHT_BACKEND_PORT || String(20000 + Math.floor(Math.random() * 1000));
const backendUrl = process.env.PLAYWRIGHT_API_BASE_URL || `http://127.0.0.1:${backendPort}`;
const tempDir = process.env.PLAYWRIGHT_API_BASE_URL ? null : mkdtempSync(join(tmpdir(), 'linzight-playwright-'));
const pythonFromVenv = join(repoRoot, 'backend', '.venv', 'bin', 'python');
const python = existsSync(pythonFromVenv) ? pythonFromVenv : 'python3';
let backendStderr = '';

function writeReport(status, details) {
  writeFileSync(reportPath, JSON.stringify({ status, frontendUrl, backendUrl, details, generatedAt: new Date().toISOString() }, null, 2));
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    writeReport('skipped', {
      reason: 'Playwright package is not installed in this checkout.',
      install: 'npm install --save-dev playwright && npx playwright install chromium',
    });
    console.log(`Playwright regression skipped: package missing. Report: ${reportPath}`);
    return null;
  }
}

async function waitForFrontend() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(frontendUrl);
      if (response.ok) return;
    } catch {
      // Retry until Vite is ready.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`Frontend did not become reachable at ${frontendUrl}`);
}

function startFrontend() {
  const url = new URL(frontendUrl);
  return spawn('npm', ['run', 'dev', '--', '--host', url.hostname || '127.0.0.1', '--port', url.port || '5174'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      VITE_API_BASE_URL: backendUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function startBackend() {
  if (process.env.PLAYWRIGHT_API_BASE_URL) return null;
  const url = new URL(backendUrl);
  const server = spawn(python, ['-m', 'uvicorn', 'backend.main:app', '--host', url.hostname, '--port', url.port], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: `sqlite:///${join(tempDir, 'linzight-playwright.db')}`,
      LINZIGHT_DATABASE_URL: `sqlite:///${join(tempDir, 'linzight-playwright.db')}`,
      LINZIGHT_ALLOW_SQLITE_RUNTIME: '1',
      LINZIGHT_UPLOADS_DIR: join(tempDir, 'uploads'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (chunk) => {
    backendStderr += chunk.toString();
  });
  server.stdout.on('data', () => {});
  return server;
}

async function waitForBackend(server) {
  if (!server) return;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Backend exited before health check passed.\n${backendStderr}`);
    }
    try {
      const response = await fetch(`${backendUrl}/health`);
      if (response.ok) {
        const seedResponse = await fetch(`${backendUrl}/seed`, { method: 'POST' });
        if (!seedResponse.ok) {
          throw new Error(`Backend seed failed ${seedResponse.status}: ${await seedResponse.text()}`);
        }
        return;
      }
    } catch {
      // Retry until FastAPI is ready.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Backend did not become reachable at ${backendUrl}.\n${backendStderr}`);
}

async function run() {
  const playwright = await loadPlaywright();
  if (!playwright) return;

  const backend = startBackend();
  const server = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === '1' ? null : startFrontend();
  let browser;
  try {
    await waitForBackend(backend);
    await waitForFrontend();
    browser = await playwright.chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    await page.goto(`${frontendUrl}/?locale=en-US`, { waitUntil: 'networkidle' });
    await page.getByLabel(/Account email|账号邮箱|email/i).fill('lung-dm@demo.linzight');
    await page.getByLabel(/password/i).fill('Demo1234!');
    await page.getByRole('button', { name: /enter system/i }).click();
    await page.getByRole('button', { name: /Home|首页工作台/i }).waitFor({ timeout: 10000 });
    await page.locator('.sidebar .nav-item').filter({ hasText: /Patient Cohort|患者队列/i }).click();
    await page.getByText(/Patient Search|患者搜索/i).waitFor({ timeout: 10000 });
    await page.locator('.sidebar .nav-item').filter({ hasText: /System Admin|System Management|系统管理/i }).click();
    await page.locator('strong').filter({ hasText: /^Approval Center$/ }).waitFor({ timeout: 10000 });
    await page.waitForFunction("document.body.innerText.includes('Query Management')", null, { timeout: 10000 });
    await page.waitForFunction("document.body.innerText.includes('Site Configuration')", null, { timeout: 10000 });
    await browser.close();
    writeReport('passed', { covered: ['login', 'module navigation', 'patient cohort page', 'approval center', 'query management panel', 'site configuration panel'] });
    console.log(`Playwright regression passed. Report: ${reportPath}`);
  } catch (error) {
    writeReport('failed', { message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    await browser?.close().catch(() => undefined);
    if (server) server.kill('SIGTERM');
    if (backend) backend.kill('SIGTERM');
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
