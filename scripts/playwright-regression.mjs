import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = resolve(repoRoot, 'reports');
mkdirSync(reportDir, { recursive: true });
const reportPath = resolve(reportDir, 'playwright-regression.json');
const frontendUrl = process.env.PLAYWRIGHT_FRONTEND_URL || 'http://localhost:5173';

function writeReport(status, details) {
  writeFileSync(reportPath, JSON.stringify({ status, frontendUrl, details, generatedAt: new Date().toISOString() }, null, 2));
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
  return spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function run() {
  const playwright = await loadPlaywright();
  if (!playwright) return;

  const server = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === '1' ? null : startFrontend();
  try {
    await waitForFrontend();
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    await page.goto(`${frontendUrl}/?locale=en-US`, { waitUntil: 'networkidle' });
    await page.getByLabel(/password/i).fill('Demo1234!');
    await page.getByRole('button', { name: /enter system/i }).click();
    await page.getByText(/home/i).waitFor({ timeout: 10000 });
    await page.getByText(/Patient Cohort|患者队列/i).click();
    await page.getByText(/New Patient|新建患者/i).waitFor({ timeout: 10000 });
    await page.getByText(/System Management|系统管理/i).click();
    await page.getByText(/Approval Center/i).waitFor({ timeout: 10000 });
    await browser.close();
    writeReport('passed', { covered: ['login', 'module navigation', 'patient cohort page', 'approval center'] });
    console.log(`Playwright regression passed. Report: ${reportPath}`);
  } catch (error) {
    writeReport('failed', { message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    if (server) server.kill('SIGTERM');
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
