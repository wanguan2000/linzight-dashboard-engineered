import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = resolve(repoRoot, 'reports');
mkdirSync(reportDir, { recursive: true });
const reportPath = resolve(reportDir, 'browser-matrix.json');
const frontendPort = process.env.BROWSER_MATRIX_FRONTEND_PORT || String(19100 + Math.floor(Math.random() * 1000));
const frontendUrl = process.env.BROWSER_MATRIX_FRONTEND_URL || `http://127.0.0.1:${frontendPort}`;
const backendPort = process.env.BROWSER_MATRIX_BACKEND_PORT || String(20100 + Math.floor(Math.random() * 1000));
const backendUrl = process.env.BROWSER_MATRIX_API_BASE_URL || `http://127.0.0.1:${backendPort}`;
const tempDir = process.env.BROWSER_MATRIX_API_BASE_URL ? null : mkdtempSync(join(tmpdir(), 'linzight-browser-matrix-'));
const pythonFromVenv = join(repoRoot, 'backend', '.venv', 'bin', 'python');
const python = existsSync(pythonFromVenv) ? pythonFromVenv : 'python3';

const roles = [
  { username: 'admin@demo.linzight', entry: 'admin', expected: ['Study 系统管理', 'Study Registry'] },
  { username: 'lung-crc@demo.linzight', entry: 'study', study: 'LZXK-01', expected: ['LZXK-01', '20'] },
  { username: 'crc@demo.linzight', entry: 'study', study: 'LGL-1111', expected: ['LGL-1111', '36'] },
  { username: 'lung-dm@demo.linzight', entry: 'study', study: 'LZXK-01', expected: ['LZXK-01'] },
];

const pages = [
  { nav: '首页工作台', checks: ['已入组患者'] },
  { nav: '患者队列管理', checks: ['患者搜索'] },
  { nav: '知情同意', checks: ['知情同意'] },
  { nav: '临床数据采集', checks: ['患者数据录入'] },
  { nav: '样本及检测', checks: ['新增样本', '新增检测'] },
  { nav: '患者旅程', checks: ['临床 Patient Journey'] },
  { nav: '数据分析', checks: ['数据导出流水线'] },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 980 },
  { name: 'mobile', width: 390, height: 844 },
];

function writeReport(status, details) {
  writeFileSync(reportPath, JSON.stringify({ status, frontendUrl, backendUrl, details, generatedAt: new Date().toISOString() }, null, 2));
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    writeReport('skipped', { reason: 'Playwright package is not installed.', install: 'npm install --save-dev playwright && npx playwright install chromium' });
    console.log(`Browser matrix skipped: Playwright package missing. Report: ${reportPath}`);
    return null;
  }
}

function startBackend() {
  if (process.env.BROWSER_MATRIX_API_BASE_URL) return null;
  const url = new URL(backendUrl);
  return spawn(python, ['-m', 'uvicorn', 'backend.main:app', '--host', url.hostname, '--port', url.port], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: `sqlite:///${join(tempDir, 'linzight-browser-matrix.db')}`,
      LINZIGHT_DATABASE_URL: `sqlite:///${join(tempDir, 'linzight-browser-matrix.db')}`,
      LINZIGHT_ALLOW_SQLITE_RUNTIME: '1',
      LINZIGHT_UPLOADS_DIR: join(tempDir, 'uploads'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function startFrontend() {
  if (process.env.BROWSER_MATRIX_USE_EXISTING_SERVER === '1') return null;
  const url = new URL(frontendUrl);
  return spawn('npm', ['run', 'dev', '--', '--host', url.hostname || '127.0.0.1', '--port', url.port || '5174'], {
    cwd: repoRoot,
    env: { ...process.env, VITE_API_BASE_URL: backendUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitFor(url, label) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until ready.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 350));
  }
  throw new Error(`${label} did not become reachable at ${url}`);
}

async function login(page, role) {
  await page.goto(`${frontendUrl}/?locale=zh-CN`, { waitUntil: 'networkidle' });
  if (role.entry === 'admin') {
    await page.getByRole('button', { name: /LZ 系统管理|LZ System/i }).click();
  }
  await page.getByLabel(/账号邮箱|Account email|email/i).fill(role.username);
  await page.getByLabel(/密码|password/i).fill('Demo1234!');
  await page.getByRole('button', { name: /进入系统|Enter system/i }).click();
  const studySelector = page.getByLabel(/选择 Study Workspace|Select Study Workspace/i);
  if (role.study && await studySelector.isVisible({ timeout: 1000 }).catch(() => false)) {
    await studySelector.selectOption(role.study);
    await page.getByRole('button', { name: /进入 Study Workspace|Enter Study Workspace/i }).click();
  }
  if (role.entry === 'admin') {
    await page.getByText('Study 系统管理', { exact: false }).first().waitFor({ timeout: 10000 });
  } else {
    await page.getByRole('button', { name: /首页工作台|Home/i }).waitFor({ timeout: 10000 });
  }
}

async function run() {
  const playwright = await loadPlaywright();
  if (!playwright) return;
  const backend = startBackend();
  const frontend = startFrontend();
  const results = [];
  let browser;
  try {
    await waitFor(`${backendUrl}/health`, 'backend');
    if (backend) {
      const seed = await fetch(`${backendUrl}/seed`, { method: 'POST' });
      if (!seed.ok) throw new Error(`seed failed: ${seed.status} ${await seed.text()}`);
    }
    await waitFor(frontendUrl, 'frontend');
    browser = await playwright.chromium.launch();
    for (const viewport of viewports) {
      for (const role of roles) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        const page = await context.newPage();
        await login(page, role);
        if (role.entry === 'admin') {
          await page.locator('nav button').filter({ hasText: 'Study 系统管理' }).click();
          await page.waitForLoadState('networkidle');
        }
        for (const expected of role.expected) {
          await page.getByText(expected, { exact: false }).first().waitFor({ timeout: 10000 });
        }
        for (const target of pages) {
          const nav = page.locator('nav button').filter({ hasText: target.nav });
          if (await nav.count()) {
            await nav.click();
            for (const check of target.checks) {
              await page.getByText(check, { exact: false }).first().waitFor({ timeout: 10000 });
            }
            if (viewport.name === 'mobile' && target.nav === '患者队列管理') {
              await page.locator('.patient-table tbody tr').first().waitFor({ timeout: 10000 });
            }
          }
        }
        results.push({ viewport: viewport.name, role: role.username, status: 'passed' });
        await context.close();
      }
    }
    await browser.close();
    writeReport('passed', results);
    console.log(`Browser matrix passed: ${results.length} role/viewport runs. Report: ${reportPath}`);
  } catch (error) {
    writeReport('failed', { results, message: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    await browser?.close().catch(() => undefined);
    if (frontend) frontend.kill('SIGTERM');
    if (backend) backend.kill('SIGTERM');
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
