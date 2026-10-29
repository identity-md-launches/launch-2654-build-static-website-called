import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createStaticServer } from './server.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const catalog = JSON.parse(await readFile(new URL('../src/data/guides.json', import.meta.url), 'utf8'));
const results = { contrast: [], firstScreen: [], roadmap: [] };
const folder = 'test/scratch/review';
await mkdir(folder, { recursive: true });
const server = createStaticServer('dist', '/preview/');
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/preview/`;
let browser;
const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
const luminance = (values) => values.map((n) => n / 255).map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const guide of catalog.guides) {
    await page.goto(`${base}guides/${guide.id}/index.html`);
    const box = await page.locator('#copy-agent-prompt').boundingBox();
    const bottom = box.y + box.height;
    assert.ok(box.y >= 0 && bottom <= 844, `${guide.id}: copy action on first phone screen`);
    results.firstScreen.push({ guide: guide.id, width: 390, height: 844, copyButtonBottom: bottom });
  }
  const selectors = ['#page-title', '.setup-note', '.safety-banner p', '#copy-agent-prompt', '#agent-prompt', '.guide-mode input:checked + span', '.risk-label'];
  for (const selector of selectors) {
    const pair = await page.locator(selector).first().evaluate((node) => {
      const style = getComputedStyle(node);
      let parent = node;
      let background = '';
      while (parent) {
        const candidate = getComputedStyle(parent).backgroundColor;
        if (candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') { background = candidate; break; }
        parent = parent.parentElement;
      }
      return { foreground: style.color, background, fontSize: style.fontSize, fontWeight: style.fontWeight };
    });
    const a = luminance(rgb(pair.foreground));
    const b = luminance(rgb(pair.background));
    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    assert.ok(ratio >= 4.5, `${selector}: contrast ${ratio}`);
    results.contrast.push({ selector, ...pair, ratio: Number(ratio.toFixed(2)) });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}guides/coinbase-agentic-wallet/index.html`);
  await page.screenshot({ path: `${folder}/guide-agent-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('radio', { name: 'Let your agent do it', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  assert.ok(await page.locator('#setup-step-0').isChecked());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${folder}/guide-checklist-390.png`, fullPage: true });
  await page.goto(`${base}#/roadmap`);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(scrollWidth <= width);
    results.roadmap.push({ width, scrollWidth });
  }
  await page.screenshot({ path: `${folder}/roadmap-1440.png`, fullPage: true });
  await writeFile(`${folder}/results.json`, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
