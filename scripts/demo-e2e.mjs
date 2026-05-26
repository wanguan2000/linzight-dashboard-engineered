import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = resolve(repoRoot, 'reports');
mkdirSync(reportDir, { recursive: true });
const reportPath = resolve(reportDir, 'demo-e2e.json');
const frontendPort = process.env.DEMO_E2E_FRONTEND_PORT || String(18100 + Math.floor(Math.random() * 1000));
const frontendUrl = process.env.DEMO_E2E_FRONTEND_URL || `http://127.0.0.1:${frontendPort}`;
const backendPort = process.env.DEMO_E2E_BACKEND_PORT || String(21100 + Math.floor(Math.random() * 1000));
const backendUrl = process.env.DEMO_E2E_API_BASE_URL || `http://127.0.0.1:${backendPort}`;
const tempDir = process.env.DEMO_E2E_API_BASE_URL ? null : mkdtempSync(join(tmpdir(), 'linzight-demo-e2e-'));
const pythonFromVenv = join(repoRoot, 'backend', '.venv', 'bin', 'python');
const python = existsSync(pythonFromVenv) ? pythonFromVenv : 'python3';

const roleScenarios = [
  {
    username: 'admin@demo.linzight',
    entry: 'admin',
    studyId: null,
    canOpenSystemManagement: true,
    homeChecks: ['Study 系统管理'],
    patientChecks: ['Study ID', 'LGL-1111', 'LZXK-01'],
    lungChecks: false,
  },
  {
    username: 'lung-crc@demo.linzight',
    entry: 'study',
    studyId: 'LZXK-01',
    canOpenSystemManagement: false,
    homeChecks: ['LZXK-01', '20'],
    patientChecks: ['Study ID', 'LZXK-01'],
    lungChecks: true,
  },
  {
    username: 'lung-dm@demo.linzight',
    entry: 'study',
    studyId: 'LZXK-01',
    canOpenSystemManagement: true,
    homeChecks: ['LZXK-01'],
    patientChecks: ['Study ID', 'LZXK-01'],
    lungChecks: true,
  },
];

function writeReport(status, details) {
  writeFileSync(reportPath, JSON.stringify({ status, frontendUrl, backendUrl, details, generatedAt: new Date().toISOString() }, null, 2));
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    writeReport('skipped', { reason: 'Playwright package is not installed.' });
    console.log(`Demo E2E skipped: Playwright package missing. Report: ${reportPath}`);
    return null;
  }
}

function startBackend() {
  if (process.env.DEMO_E2E_API_BASE_URL) return null;
  const url = new URL(backendUrl);
  return spawn(python, ['-m', 'uvicorn', 'backend.main:app', '--host', url.hostname, '--port', url.port], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: `sqlite:///${join(tempDir, 'linzight-demo-e2e.db')}`,
      LINZIGHT_DATABASE_URL: `sqlite:///${join(tempDir, 'linzight-demo-e2e.db')}`,
      LINZIGHT_ALLOW_SQLITE_RUNTIME: '1',
      LINZIGHT_UPLOADS_DIR: join(tempDir, 'uploads'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function startFrontend() {
  if (process.env.DEMO_E2E_USE_EXISTING_SERVER === '1') return null;
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
      // Retry until the local server is ready.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 350));
  }
  throw new Error(`${label} did not become reachable at ${url}`);
}

async function visibleText(page) {
  return page.locator('body').innerText({ timeout: 10000 });
}

async function expectVisible(page, text, label = text) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 10000 });
  return { check: label, status: 'passed' };
}

async function assertVisibleTextIncludes(page, snippets, label) {
  const text = await visibleText(page);
  const missing = snippets.filter((snippet) => !text.includes(snippet));
  if (missing.length) throw new Error(`${label} missing visible text: ${missing.join(', ')}`);
}

async function assertVisibleTextExcludes(page, snippets, label) {
  const text = await visibleText(page);
  const leaked = snippets.filter((snippet) => text.includes(snippet));
  if (leaked.length) throw new Error(`${label} leaked visible text: ${leaked.join(', ')}`);
}

async function clickNav(page, label) {
  const nav = page.locator('nav button').filter({ hasText: label });
  const count = await nav.count();
  if (count !== 1) throw new Error(`Navigation "${label}" resolved to ${count} buttons`);
  await nav.click();
  await page.waitForLoadState('networkidle');
}

async function clickAnyNav(page, labels) {
  for (const label of labels) {
    const nav = page.locator('nav button').filter({ hasText: label });
    if (await nav.count()) {
      await nav.first().click();
      await page.waitForLoadState('networkidle');
      return label;
    }
  }
  throw new Error(`Navigation not found: ${labels.join(' / ')}`);
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
  if (role.studyId && await studySelector.isVisible({ timeout: 1000 }).catch(() => false)) {
    await studySelector.selectOption(role.studyId);
    await page.getByRole('button', { name: /进入 Study Workspace|Enter Study Workspace/i }).click();
  }
  if (role.entry === 'admin') {
    await page.getByText('Study 系统管理', { exact: false }).first().waitFor({ timeout: 10000 });
  } else {
    await page.getByRole('button', { name: /首页工作台|Home/i }).waitFor({ timeout: 10000 });
  }
  await page.waitForLoadState('networkidle');
}

async function runQualityAndCreateQuery(page, role) {
  await clickNav(page, '数据分析');
  await expectVisible(page, '数据导出流水线', 'analytics pipeline');
  await expectVisible(page, '运行校验', 'quality run button');
  if (role.studyId) {
    await assertVisibleTextIncludes(page, [role.studyId], 'analytics study scope');
  }
  const runButton = page.getByRole('button', { name: /运行校验/ });
  if (await runButton.isEnabled()) {
    await runButton.click();
    await page.getByText('校验完成', { exact: false }).first().waitFor({ timeout: 15000 });
    const createButtons = page.getByRole('button', { name: /创建 Query/ });
    if ((await createButtons.count()) > 0) {
      await createButtons.first().click();
      await page.getByText('Query 已创建', { exact: false }).first().waitFor({ timeout: 10000 });
    }
  }
}

async function verifySystemLoop(page, role) {
  const systemNav = page.locator('nav button').filter({ hasText: role.entry === 'admin' ? 'Study 系统管理' : '系统管理' });
  const systemNavCount = await systemNav.count();
  if (!role.canOpenSystemManagement) {
    if (systemNavCount !== 0) throw new Error(`${role.username} should not see System Management nav`);
    return { restricted: true, reason: 'Study CRC cannot open System Management; Query is handled from Data Analysis.' };
  }
  if (systemNavCount !== 1) throw new Error(`${role.username} should see exactly one System Management nav`);
  await systemNav.click();
  await page.waitForLoadState('networkidle');
  if (role.entry === 'admin') {
    await assertVisibleTextIncludes(page, ['Study Registry', 'User Accounts', '填写 Study 信息'], 'global system management');
    return { restricted: false, global: true };
  }
  await assertVisibleTextIncludes(page, ['Query Management', 'Approval Center', 'CRF Migration Approval'], 'system management closed loop');
  if (role.studyId) {
    await assertVisibleTextIncludes(page, [role.studyId], 'system management study scope');
    await assertVisibleTextExcludes(page, ['LGL-1111 全队列', '免疫相关性神经系统疾病多组学解析'], 'lung system management');
  }
  return { restricted: false };
}

async function runScenario(browser, role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const page = await context.newPage();
  const checks = [];
  try {
    await login(page, role);
    for (const text of role.homeChecks) checks.push(await expectVisible(page, text, `home ${text}`));

    if (role.entry === 'admin') {
      await clickAnyNav(page, ['患者队列管理']);
      await assertVisibleTextIncludes(page, role.patientChecks, 'platform patient queue study id');
      const systemLoop = await verifySystemLoop(page, role);
      await context.close();
      return { role: role.username, status: 'passed', checks, systemLoop };
    }

    await clickNav(page, '患者队列管理');
    await expectVisible(page, '患者搜索', 'patient queue search');
    await assertVisibleTextIncludes(page, role.patientChecks, 'patient queue study id');

    await clickNav(page, '临床数据采集');
    await expectVisible(page, '患者数据录入', 'CRF page');
    if (role.lungChecks) {
      await expectVisible(page, 'LZXK-01 肺癌耐药 CRF', 'lung CRF title');
      await assertVisibleTextIncludes(page, ['LZXK-01', 'ECOG评分', 'RECIST评估', 'ctDNA突变丰度'], 'lung CRF');
      await assertVisibleTextExcludes(page, ['SLEDAI评分', '免疫抑制剂1', 'C3 (g/L)', 'IgG Index'], 'lung CRF');
    }

    await clickNav(page, '知情同意');
    await expectVisible(page, '知情同意', 'consent page');
    if (role.lungChecks) {
      await assertVisibleTextIncludes(page, ['真实世界肺癌耐药研究知情同意', 'ctDNA/NGS', '患者知情同意列表'], 'lung consent');
      await assertVisibleTextExcludes(page, ['免疫相关性神经系统疾病多组学解析及机制探索'], 'lung consent');
    }

    await clickNav(page, '样本及检测');
    await assertVisibleTextIncludes(page, ['新增样本', '新增检测'], 'sample testing actions');
    if (role.lungChecks) {
      await assertVisibleTextIncludes(page, ['LZXK-01', '样本台账', '多组学检测列表'], 'lung sample testing');
    }

    await clickNav(page, '患者旅程');
    await expectVisible(page, '临床 Patient Journey', 'journey page');
    if (role.lungChecks) {
      await assertVisibleTextIncludes(page, ['LZXK-01'], 'lung journey');
      await assertVisibleTextExcludes(page, ['基线 SLEDAI', 'C3', 'IgG Index'], 'lung journey');
    }

    await runQualityAndCreateQuery(page, role);
    const systemLoop = await verifySystemLoop(page, role);
    await context.close();
    return { role: role.username, status: 'passed', checks, systemLoop };
  } catch (error) {
    await context.close();
    throw new Error(`${role.username}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
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
    for (const role of roleScenarios) {
      results.push(await runScenario(browser, role));
    }
    await browser.close();
    writeReport('passed', results);
    console.log(`Demo E2E passed: ${results.length} role chains. Report: ${reportPath}`);
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
