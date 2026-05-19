import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const exportDir = join(projectRoot, 'exports', 'html');
const manifestPath = join(exportDir, 'EXPORT_MANIFEST.json');

function assert(condition, message) {
  if (!condition) {
    console.error(`UI smoke failed: ${message}`);
    process.exit(1);
  }
}

assert(existsSync(manifestPath), 'EXPORT_MANIFEST.json is missing; run npm run export:html first');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const indexHtml = readFileSync(join(exportDir, 'index.html'), 'utf8');
const expectedPages = [
  ['首页工作台', 'home-workbench.html'],
  ['患者队列管理', 'patient-cohort-management.html'],
  ['知情同意', 'informed-consent.html'],
  ['临床数据采集', 'clinical-data-capture.html'],
  ['样本及检测', 'sample-testing.html'],
  ['患者旅程', 'patient-journey.html'],
  ['数据分析', 'data-analysis.html'],
  ['系统管理', 'system-management.html'],
];

assert(Array.isArray(manifest.pages), 'manifest pages must be an array');
assert(manifest.pages.length === expectedPages.length, `manifest should contain ${expectedPages.length} pages`);

for (const [module, file] of expectedPages) {
  const entry = manifest.pages.find((page) => page.module === module && page.file === file);
  assert(entry, `manifest missing ${module} -> ${file}`);

  const htmlPath = join(exportDir, file);
  assert(existsSync(htmlPath), `${file} is missing`);
  assert(statSync(htmlPath).size > 100_000, `${file} is unexpectedly small`);

  const html = readFileSync(htmlPath, 'utf8');
  assert(html.includes(`window.__LINZIGHT_INITIAL_MODULE__ = ${JSON.stringify(module)}`), `${file} missing initial module bootstrap`);
  assert(html.includes('<style>'), `${file} missing inline CSS`);
  assert(html.includes('<script type="module">'), `${file} missing inline JS`);
  assert(!html.includes('src="/assets/') && !html.includes('href="/assets/'), `${file} references root assets`);
}

const systemHtml = readFileSync(join(exportDir, 'system-management.html'), 'utf8');
for (const text of ['Real-world study workspace', 'Study entry', 'LZ System Admin', 'Role account']) {
  assert(indexHtml.includes(text), `index export missing login string "${text}"`);
}

const requiredSystemStrings = [
  'Request Approval',
  'Apply Approved',
  'CRF Migration Approval',
  'No active migration request',
  'Separate reviewer required',
  'Execution Logs',
  'Conditional Logic',
  'Change Details',
  'LZXK-01',
  'Study member, CRF version, export, and permission policy changes are checked against the current Study.',
];

for (const text of requiredSystemStrings) {
  assert(systemHtml.includes(text), `system-management export missing "${text}"`);
}

const clinicalHtml = readFileSync(join(exportDir, 'clinical-data-capture.html'), 'utf8');
for (const text of ['Save draft', 'Submit', 'Add', 'Edit', 'Cancel']) {
  assert(clinicalHtml.includes(text), `clinical-data-capture export missing "${text}"`);
}

const consentHtml = readFileSync(join(exportDir, 'informed-consent.html'), 'utf8');
for (const text of ['Study overview', 'Consent workflow', 'Patient consent list', 'Upload', 'Re-sign']) {
  assert(consentHtml.includes(text), `informed-consent export missing "${text}"`);
}

const analyticsHtml = readFileSync(join(exportDir, 'data-analysis.html'), 'utf8');
for (const text of ['Export', 'Download', 'Data completeness']) {
  assert(analyticsHtml.includes(text), `data-analysis export missing "${text}"`);
}

console.log(`UI smoke passed: ${expectedPages.length} exported pages and key workflow strings verified.`);
