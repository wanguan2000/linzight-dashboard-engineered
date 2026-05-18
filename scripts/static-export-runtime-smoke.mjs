import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const exportDir = join(repoRoot, 'exports', 'html');
const reportPath = join(repoRoot, 'reports', 'static-export-runtime-smoke.json');
const port = Number(process.env.STATIC_EXPORT_SMOKE_PORT || 23100 + Math.floor(Math.random() * 1000));
const baseUrl = `http://127.0.0.1:${port}`;

const forbiddenLungVisibleText = [
  'SLEDAI',
  'C3 (g/L)',
  'C4 (g/L)',
  'IgG Index',
  '免疫抑制剂',
  'NPSLE',
  '免疫相关性神经系统疾病多组学解析及机制探索',
];

const requiredLungVisibleText = [
  'LZXK-01',
  'ECOG评分',
  'TNM分期',
  'ctDNA突变丰度',
  '真实世界肺癌耐药研究',
];

function writeReport(status, details) {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ status, baseUrl, details, generatedAt: new Date().toISOString() }, null, 2));
}

function contentType(path) {
  const ext = extname(path);
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    writeReport('skipped', {
      reason: 'Playwright package is not installed.',
      install: 'npm install --save-dev playwright && npx playwright install chromium',
    });
    console.log(`Static export runtime smoke skipped: Playwright package missing. Report: ${reportPath}`);
    return null;
  }
}

async function installStaticAuthRoutes(page) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };
  const demoUser = {
    id: 'USR-011',
    username: 'lung-crc@demo.linzight',
    display_name: '肺癌 CRC',
    role: 'STUDY_CRC',
    status: 'active',
    study_scope: { scopeType: 'own_studies', studyIds: ['LZXK-01'] },
    study_memberships: [
      {
        id: 'SM-USR-011-LZXK-01',
        user_id: 'USR-011',
        study_id: 'LZXK-01',
        study_role: 'STUDY_CRC',
        status: 'active',
      },
    ],
  };

  async function fulfillDemoApi(route) {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
      return;
    }
    if (url.pathname === '/auth/login' && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: 'static-export-smoke-token', token_type: 'bearer', user: demoUser }),
      });
      return;
    }
    if (url.pathname === '/auth/me' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(demoUser),
      });
      return;
    }
    await route.fulfill({
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ detail: 'Static export smoke only mocks auth endpoints.' }),
    });
  }

  await page.route('http://127.0.0.1:8000/**', fulfillDemoApi);
  await page.route('http://127.0.0.1:8001/**', fulfillDemoApi);
}

function startStaticServer() {
  const server = createServer((request, response) => {
    const url = new URL(request.url || '/', baseUrl);
    const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = resolve(exportDir, `.${decodeURIComponent(requestedPath)}`);
    if (!filePath.startsWith(resolve(exportDir)) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType(filePath) });
    response.end(readFileSync(filePath));
  });
  return new Promise((resolveServer) => {
    server.listen(port, '127.0.0.1', () => resolveServer(server));
  });
}

async function loginLungCrc(page) {
  await page.goto(`${baseUrl}/clinical-data-capture.html?locale=zh-CN`, { waitUntil: 'networkidle' });
  await page.getByLabel(/角色账号|Role account/i).selectOption('lung-crc@demo.linzight');
  await page.getByLabel(/密码|password/i).fill('Demo1234!');
  await page.getByRole('button', { name: /进入系统|Enter system/i }).click();
  await page.waitForFunction(() => globalThis.localStorage.getItem('linzight-demo-user'), null, { timeout: 10000 });
  const studySelector = page.getByLabel(/选择 Study Workspace|Select Study Workspace/i);
  if (await studySelector.isVisible({ timeout: 1000 }).catch(() => false)) {
    await studySelector.selectOption('LZXK-01');
    await page.getByRole('button', { name: /进入 Study Workspace|Enter Study Workspace/i }).click();
  }
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.goto(`${baseUrl}/clinical-data-capture.html?locale=zh-CN`, { waitUntil: 'networkidle' });
  await page.getByText('LZXK-01', { exact: false }).first().waitFor({ timeout: 10000 });
}

async function run() {
  if (!existsSync(join(exportDir, 'clinical-data-capture.html'))) {
    throw new Error('exports/html/clinical-data-capture.html is missing; run npm run export:html first');
  }
  const playwright = await loadPlaywright();
  if (!playwright) return;

  const server = await startStaticServer();
  let browser;
  try {
	    browser = await playwright.chromium.launch();
	    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	    const page = await context.newPage();
	    await installStaticAuthRoutes(page);
	    await loginLungCrc(page);
    await page.getByText('LZXK-01', { exact: false }).first().waitFor({ timeout: 10000 });
    await page.getByText('ECOG评分', { exact: false }).first().waitFor({ timeout: 15000 });
    const visibleText = await page.locator('body').innerText({ timeout: 10000 });
    const missing = requiredLungVisibleText.filter((text) => !visibleText.includes(text));
    if (missing.length) {
      throw new Error(`LZXK-01 static runtime view missing lung text: ${missing.join(', ')}`);
    }
    const leaked = forbiddenLungVisibleText.filter((text) => visibleText.includes(text));
    if (leaked.length) {
      throw new Error(`LZXK-01 static runtime view leaked SLE/immune text: ${leaked.join(', ')}`);
    }
    await context.close();
    writeReport('passed', { checkedPage: 'clinical-data-capture.html', role: 'lung-crc@demo.linzight', viewport: '390x844' });
    console.log(`Static export runtime smoke passed: LZXK-01 clinical capture visible text is lung-specific. Report: ${reportPath}`);
  } catch (error) {
    const visibleText = await browser?.contexts()[0]?.pages()[0]?.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    writeReport('failed', {
      message: error instanceof Error ? error.message : String(error),
      visibleText: visibleText?.slice(0, 2000),
    });
    throw error;
  } finally {
    await browser?.close().catch(() => undefined);
    server.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
