import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, 'dist');
const exportDir = join(projectRoot, 'exports', 'html');
const sourceHtmlPath = join(distDir, 'index.html');

const pages = [
  { label: '首页工作台', slug: 'home-workbench', title: 'LinZight - 首页工作台' },
  { label: '患者队列管理', slug: 'patient-cohort-management', title: 'LinZight - 患者队列管理' },
  { label: '知情同意', slug: 'informed-consent', title: 'LinZight - 知情同意' },
  { label: '临床数据采集', slug: 'clinical-data-capture', title: 'LinZight - 临床数据采集' },
  { label: '样本及检测', slug: 'sample-testing', title: 'LinZight - 样本及检测' },
  { label: '患者旅程', slug: 'patient-journey', title: 'LinZight - 患者旅程' },
  { label: '数据分析', slug: 'data-analysis', title: 'LinZight - 数据分析' },
  { label: '系统管理', slug: 'system-management', title: 'LinZight - 系统管理' }
];

if (!existsSync(sourceHtmlPath)) {
  throw new Error('dist/index.html not found. Run npm run build before exporting static HTML pages.');
}

rmSync(exportDir, { force: true, recursive: true });
mkdirSync(exportDir, { recursive: true });
cpSync(distDir, exportDir, { recursive: true });

const sourceHtml = readFileSync(sourceHtmlPath, 'utf8');

function readDistAsset(relativePath) {
  return readFileSync(join(distDir, relativePath.replace(/^\.\//, '')), 'utf8');
}

function inlineBuiltAssets(html) {
  const scriptMatch = html.match(/[ ]{4}<script type="module" crossorigin src="(.+?)"><\/script>/);
  const styleMatch = html.match(/[ ]{4}<link rel="stylesheet" crossorigin href="(.+?)">/);

  if (!scriptMatch || !styleMatch) {
    throw new Error('Unable to locate built JS/CSS assets in dist/index.html.');
  }

  const js = readDistAsset(scriptMatch[1]).replaceAll('</script', '<\\/script');
  const css = readDistAsset(styleMatch[1]);

  return html
    .replace(styleMatch[0], () => `    <style>\n${css}\n    </style>`)
    .replace(scriptMatch[0], () => `    <script type="module">\n${js}\n    </script>`);
}

const inlineHtml = inlineBuiltAssets(sourceHtml);

function renderPageHtml(page) {
  const bootScript = `    <script>window.__LINZIGHT_INITIAL_MODULE__ = ${JSON.stringify(page.label)};</script>`;
  return inlineHtml
    .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
    .replace('    <script type="module"', `${bootScript}\n    <script type="module"`);
}

writeFileSync(join(exportDir, 'index.html'), renderPageHtml(pages[0]));

for (const page of pages) {
  writeFileSync(join(exportDir, `${page.slug}.html`), renderPageHtml(page));
}

writeFileSync(
  join(exportDir, 'EXPORT_MANIFEST.json'),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      entry: 'index.html',
      pages: pages.map((page) => ({
        module: page.label,
        file: `${page.slug}.html`
      }))
    },
    null,
    2
  )}\n`
);

writeFileSync(
  join(exportDir, 'README.md'),
  `# LinZight 静态 HTML 导出\n\n这些页面由 \`npm run export:html\` 生成，可直接打开，也可以放到任意静态文件服务器中浏览。\n\n## 页面\n\n${pages
    .map((page) => `- ${page.label}: \`${page.slug}.html\``)
    .join('\n')}\n\n## 说明\n\n- \`index.html\` 默认进入首页工作台。\n- 各模块 HTML 已内联前端 CSS 与 JS；Logo 和知情同意 PDF 仍作为相邻静态资源保留。\n- 未连接后端时，前端自动使用本地 Demo 数据，交互仍可浏览。\n`
);

console.log(`Exported ${pages.length} interactive HTML pages to ${exportDir}`);
