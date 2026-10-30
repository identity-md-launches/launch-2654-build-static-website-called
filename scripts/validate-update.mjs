import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createStaticServer } from './server.mjs';
import { answerHash, defaultsFor } from '../src/model.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { build } = require('esbuild');
const AxeBuilder = require('@axe-core/playwright').default;
const catalog = JSON.parse(await readFile('src/data/playbooks.json', 'utf8'));
const productionJS = await readFile('dist/assets/app.js', 'utf8');
const out = 'test/scratch/update';
await mkdir(out, { recursive: true });
const report = { passed: [], errors: [], reflow: [], accessibility: [], contrast: [], firstScreen: [], limitations: [] };
const pass = (text) => { report.passed.push(text); console.log(`PASS ${text}`); };
const prefix = '/ipfs/nuntio-update/';
const server = createStaticServer('dist', prefix);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${prefix}`;
let browser;
try {
  browser = await chromium.launch();
  report.browser = { name: 'Chromium', version: browser.version() };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  let fixtureMode = false;
  let fixtureJS = '';
  const requests = [];
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (!url.startsWith(base)) { requests.push(url); return route.abort(); }
    if (fixtureMode && url === `${base}assets/app.js`) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fixtureJS });
    return route.continue();
  });
  async function reflow(label) {
    const box = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    report.reflow.push({ label, ...box });
    assert.ok(box.scrollWidth <= box.width, `${label}: overflow`);
  }
  async function audit(label) {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const violations = result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
    report.accessibility.push({ label, violations, incomplete: result.incomplete.map(({ id }) => id) });
    assert.deepEqual(violations, [], label);
  }
  await page.goto(base);
  await page.locator('.playbook-card').first().waitFor();
  assert.equal(await page.locator('.playbook-card').count(), 9);
  assert.equal(await page.locator('.creator-info, [data-copy-tip]').count(), 0);
  const action = await page.getByRole('button', { name: 'Find a playbook', exact: true }).boundingBox();
  assert.ok(action.y >= 0 && action.y + action.height <= 844);
  report.firstScreen.push({ page: 'Home', width: 390, height: 844, actionBottom: action.y + action.height });
  await page.screenshot({ path: `${out}/home-390.png` });
  for (const width of [320, 390, 576, 768, 880, 1120, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await reflow(`nine-playbook home ${width}`);
  }
  await page.screenshot({ path: `${out}/home-1440.png`, fullPage: true });
  pass('Production catalog shows nine playbooks, no invented creator or recipient, and the home action fits the first 390px screen');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const playbook of catalog.playbooks.slice(4)) {
    await page.goto(base);
    await page.getByRole('searchbox').fill(playbook.title);
    const match = page.locator('.playbook-card-link').first();
    assert.equal(await match.getAttribute('aria-labelledby'), `card-title-${playbook.id}`);
    await match.click();
    await page.locator('#playbook-form').waitFor();
    assert.ok(page.url().startsWith(`${base}playbooks/${playbook.id}/index.html`));
    assert.equal(await page.locator('input[name="experience"]').count(), 3);
    assert.ok(await page.locator('#frequency').isVisible());
    assert.ok(await page.locator('#channel').isVisible());
    for (const question of playbook.questions) assert.ok(await page.locator(`#${question.key}`).isVisible());
  }
  await page.goto(`${base}playbooks/new-launch-radar/index.html#/configure`);
  await page.locator('#frequency').selectOption('6 hours');
  await page.locator('#chains').fill('Ethereum and Base');
  await page.getByRole('button', { name: 'Generate playbook' }).click();
  await page.locator('#prompt-text').waitFor();
  assert.match(await page.locator('#prompt-text').innerText(), /Every 6 hours, find/);
  await page.screenshot({ path: `${out}/launch-output-390.png`, fullPage: true });
  pass('Each new playbook is the top match for its title and opens all standard and extra questions; six-hour launch cadence generates correctly');

  await page.goto(`${base}#/roadmap`);
  const live = page.locator('section[aria-labelledby="live-heading"]');
  const next = page.locator('section[aria-labelledby="next-heading"]');
  const exploring = page.locator('section[aria-labelledby="exploring-heading"]');
  assert.equal(await live.locator('li').count(), 8);
  for (const playbook of catalog.playbooks.slice(4)) {
    assert.ok(await live.getByRole('heading', { name: playbook.title, exact: true }).isVisible());
    assert.equal(await live.getByRole('link', { name: `Build ${playbook.title.toLowerCase()}`, exact: true }).getAttribute('href'), `./playbooks/${playbook.id}/index.html#/configure`);
  }
  assert.deepEqual(await next.locator('h3').allTextContents(), ['nuntio data engine', 'Creator submissions']);
  assert.deepEqual(await exploring.locator('h3').allTextContents(), ['nuntio token and paid playbooks']);
  assert.match(await page.locator('#site-footer').innerText(), /Not financial advice\./);
  await audit('Updated roadmap 390');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${out}/roadmap-1440.png`, fullPage: true });
  pass('Roadmap retains existing live features, links all five new playbooks in Live, lists the requested Next and Exploring items, and keeps the disclaimer');

  // Compile the same app with isolated metadata fixtures, served only by this test's route.
  // These strings are not recipients and never enter src/data or dist/.
  const fixture = structuredClone(catalog);
  const both = fixture.playbooks[4];
  both.author = 'Fixture creator <untrusted> & name';
  both.tipAddress = 'FIXTURE_ONLY_' + 'x'.repeat(64) + '_&<text>';
  fixture.playbooks[5].author = 'Fixture author only';
  fixture.playbooks[6].tipAddress = 'FIXTURE_ONLY_NOT_A_PAYMENT_ADDRESS';
  const compiled = await build({ entryPoints: ['src/app.js'], bundle: true, write: false, minify: true, format: 'esm', target: ['es2022'], plugins: [{ name: 'isolated-metadata-fixtures', setup(builder) {
    builder.onLoad({ filter: /[/\\]data[/\\]playbooks\.json$/ }, () => ({ contents: JSON.stringify(fixture), loader: 'json' }));
  } }] });
  fixtureJS = compiled.outputFiles[0].text;
  fixtureMode = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.locator('.creator-info').first().waitFor();
  assert.equal(await page.locator('.creator-info').count(), 3);
  assert.equal(await page.locator('.creator-author').count(), 2);
  assert.equal(await page.locator('[data-copy-tip]').count(), 2);
  assert.equal(await page.locator('.playbook-card-link button, .playbook-card untrusted, .playbook-card text').count(), 0);
  const card = page.locator('.playbook-card').filter({ has: page.locator(`#card-title-${both.id}`) });
  assert.equal(await card.locator('.creator-author').innerText(), `By ${both.author}`);
  assert.equal(await card.locator('.tip-address').innerText(), both.tipAddress);
  assert.equal(await card.locator('.tip-note').innerText(), 'Tip the creator. Send only on the right chain. Nuntio does not hold or process payments.');
  await page.getByRole('searchbox').fill(both.title);
  const link = page.getByRole('link', { name: both.title, exact: true });
  await link.focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.copyTip), both.id);
  const beforeCopy = page.url();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('address copied'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), both.tipAddress);
  assert.equal(page.url(), beforeCopy, 'Copy must not navigate');
  await page.waitForFunction(() => document.querySelector('[data-copy-tip]').textContent.includes('Copy address'));
  report.focus = await page.evaluate(() => {
    const active = document.activeElement;
    const box = active.getBoundingClientRect();
    const skip = document.querySelector('#skip-link').getBoundingClientRect();
    return { target: active.getAttribute('data-copy-tip'), top: box.top, bottom: box.bottom, skipLinkBottom: skip.bottom };
  });
  assert.ok(report.focus.top >= 0 && report.focus.bottom <= 844);
  assert.ok(report.focus.skipLinkBottom < 0, 'Unfocused skip link is outside the visible viewport');
  await page.screenshot({ path: `${out}/creator-fixture-focus-390.png` });
  await audit('Creator metadata fixture 390');
  pass('Optional author-only, address-only and combined metadata render as literal text; keyboard address copy succeeds without navigation or payment');

  const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
  const luminance = (channels) => channels.map((n) => n / 255).map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
  for (const selector of ['.creator-author', '.tip-address', '.tip-note', '[data-copy-tip]']) {
    const pair = await page.locator(selector).first().evaluate((node) => {
      const style = getComputedStyle(node);
      let parent = node;
      while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
      return { foreground: style.color, background: getComputedStyle(parent).backgroundColor, outlineColor: style.outlineColor, outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle };
    });
    const a = luminance(rgb(pair.foreground));
    const b = luminance(rgb(pair.background));
    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    assert.ok(ratio >= 4.5, `${selector}: ${ratio}`);
    report.contrast.push({ selector, ...pair, ratio: Number(ratio.toFixed(2)) });
    if (selector === '[data-copy-tip]') { assert.equal(pair.outlineWidth, '2px'); assert.equal(pair.outlineStyle, 'solid'); }
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await reflow(`creator metadata fixture ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await reflow('creator metadata fixture 200% text');
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await context.setOffline(true);
  await page.locator('[data-copy-tip]').click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), both.tipAddress);
  await context.setOffline(false);
  pass('Creator text contrast, visible focus styling, long-value reflow at four widths, 200% text and offline copy pass');

  async function denyClipboard() {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('fixture denial'); } } });
      document.execCommand = () => false;
    });
  }
  async function manualCopy(label) {
    await denyClipboard();
    await page.locator('[data-copy-tip]').click();
    assert.equal(await page.locator('#manual-copy').inputValue(), both.tipAddress);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'manual-copy');
    assert.ok(await page.locator('#copy-fallback').isVisible());
    await reflow(label);
  }
  await manualCopy('home manual address copy');
  await link.click();
  await page.locator('#playbook-form').waitFor();
  assert.equal(await page.locator('.creator-author').innerText(), `By ${both.author}`);
  await manualCopy('configure manual address copy');
  assert.ok(page.url().includes('#/configure'), 'Copy button must not submit the form');
  await page.locator('#chains').fill('Ethereum and Base');
  await page.getByRole('button', { name: 'Generate playbook' }).click();
  await page.locator('#prompt-text').waitFor();
  assert.equal(await page.locator('.tip-address').innerText(), both.tipAddress);
  await manualCopy('output manual address copy');
  await audit('Creator output and clipboard-denied fixture 390');
  pass('Creator details persist through configuration and output; clipboard denial offers focused, complete manual copy on all three surfaces');

  fixtureMode = false;
  await page.goto(`${base}playbooks/crypto-creator-thread-writer/index.html${answerHash('/output', { ...defaultsFor(catalog.playbooks[8], catalog), niche: 'Crypto security education', voice: 'Clear and practical' })}`);
  await page.locator('#prompt-text').waitFor();
  assert.equal(await page.locator('.creator-info').count(), 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${out}/thread-output-1440.png`, fullPage: true });
  // Existing wallet test fixture, a captured balance and no RPC read; never production seed data.
  await page.goto(`${base}#/scan/output?chain=ethereum&address=0x00000000000000000000000000000000000000aa&balance=2+ETH`);
  await page.locator('#profile-prompt').waitFor();
  assert.equal(await page.locator('#page-title').innerText(), 'Trader profile');
  assert.equal(await page.locator('#save-playbook').innerText(), 'Profile saved');
  assert.match(await page.locator('#profile-prompt').innerText(), /Use its last 10 swaps/);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await reflow(`ten-swap saved profile fixture ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/profile-fixture-390.png`, fullPage: true });
  assert.equal(await readFile('dist/assets/app.js', 'utf8'), productionJS, 'Fixture validation must not change the export');
  assert.deepEqual(requests, []);
  assert.deepEqual(report.errors, []);
  pass('Production export remains unchanged by metadata fixtures and no unexpected external request, script error or failed asset was observed');
  report.limitations.push('Creator checks use isolated non-recipient metadata fixtures, not a creator supplied by the requester. No payment, wallet connection or live agent execution is involved.');
  report.limitations.push('Chromium only in this focused script. Assigned browser tool could not launch because Chrome was unavailable; WebKit was attempted by the main suite and lacked host libraries. No screen reader, physical device, native zoom, RTL or forced-colors manual session was performed.');
  await context.close();
} catch (error) {
  report.errors.push(String(error.stack || error));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed.length, errors: report.errors, reflow: report.reflow.length, accessibility: report.accessibility.length }, null, 2));
}
