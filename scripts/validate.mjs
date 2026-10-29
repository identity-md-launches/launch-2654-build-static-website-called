import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createStaticServer } from './server.mjs';
import { createOutputs, defaultsFor, fillTemplate } from '../src/model.js';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const catalog = JSON.parse(await readFile(new URL('../src/data/playbooks.json', import.meta.url), 'utf8'));
const report = { passed: [], limitations: [], browsers: [], errors: [], views: [], accessibility: [] };
await mkdir('test/scratch/validation', { recursive: true });
const prefix = '/ipfs/nuntio-validation/';
const server = createStaticServer('dist', prefix);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${prefix}`;
const pass = (description) => { report.passed.push(description); console.log(`PASS ${description}`); };

async function assertNoOverflow(page, label) {
  const box = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(box.scroll <= box.width, `${label}: ${box.scroll}px exceeds ${box.width}px`);
  report.views.push({ label, ...box });
}

async function audit(page, label) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const failures = result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target }) => target) }));
  report.accessibility.push({ label, violations: failures, incomplete: result.incomplete.map(({ id }) => id) });
  assert.deepEqual(failures, [], `Accessibility: ${label}`);
}

try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    let browser;
    try { browser = await engine.launch(); }
    catch (error) { report.limitations.push(`${name} could not start: ${String(error)}`); if (name === 'chromium') throw error; continue; }
    report.browsers.push({ name, version: browser.version() });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      if (name === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      else await context.addInitScript(() => {
        window.__copied = '';
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__copied = text; } } });
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => report.errors.push(`${name}: ${error.message}`));
      page.on('console', (message) => { if (message.type() === 'error') report.errors.push(`${name} console: ${message.text()}`); });
      const unexpectedRequests = [];
      const badResponses = [];
      await context.route('**/*', (route) => {
        if (!route.request().url().startsWith(base)) { unexpectedRequests.push(route.request().url()); return route.abort(); }
        return route.continue();
      });
      page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
      await page.goto(base);
      await page.locator('.playbook-card').first().waitFor();
      assert.equal(await page.locator('.playbook-card').count(), 3);
      assert.ok(await page.getByRole('link', { name: 'Meme coin research digest', exact: true }).isVisible());
      const mainAction = await page.getByRole('button', { name: 'Find a playbook', exact: true }).boundingBox();
      assert.ok(mainAction.y >= 0 && mainAction.y + mainAction.height < 844);
      await page.screenshot({ path: `test/scratch/validation/${name}-home-390.png`, fullPage: false });
      pass(`${name}: product and primary action visible on first screen at 390`);

      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await assertNoOverflow(page, `${name} home ${width}`);
      }
      await page.screenshot({ path: `test/scratch/validation/${name}-home-1440.png`, fullPage: true });
      if (name === 'chromium') await audit(page, 'home 1440');
      await page.setViewportSize({ width: 390, height: 844 });
      if (name === 'chromium') await audit(page, 'home 390');
      // Keyboard-only route: search, open a playbook, choose an experience, answer, generate.
      await page.goto(base);
      for (let step = 0; step < 4; step++) await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'goal');
      await page.keyboard.type('find a job');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.locator('#playbook-form').waitFor();
      for (let step = 0; step < 5; step++) await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.name), 'experience');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('input[name="experience"]:checked').inputValue(), 'intermediate');
      await page.screenshot({ path: `test/scratch/validation/${name}-focus-390.png` });
      for (let step = 0; step < 4; step++) await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'role');
      await page.keyboard.type('Junior designer');
      await page.keyboard.press('Tab');
      await page.keyboard.type('Remote in Europe');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.locator('#prompt-text').waitFor();
      assert.ok((await page.locator('#prompt-text').textContent()).includes('My experience level is intermediate.'));
      pass(`${name}: primary search-to-output flow completed with only the keyboard`);
      await page.goto(base);
      const search = page.getByRole('searchbox');
      await search.fill('I need remote design jobs');
      assert.equal(await page.locator('.playbook-card').count(), 1);
      assert.ok(await page.getByRole('link', { name: 'Job hunt radar', exact: true }).isVisible());
      await page.getByRole('button', { name: 'Find a playbook', exact: true }).click();
      assert.equal(await page.evaluate(() => document.activeElement.id), 'results-heading');
      await search.fill('bake sourdough bread');
      await page.getByRole('button', { name: 'Show all playbooks' }).click();
      assert.equal(await page.locator('.playbook-card').count(), 3);
      await page.getByRole('button', { name: 'Write posts', exact: true }).click();
      assert.equal(await page.locator('.playbook-card').count(), 1);
      await search.fill('write content posts for crypto jobs');
      assert.equal(await page.locator('.playbook-card').count(), 3);
      assert.ok((await page.locator('.playbook-card').first().textContent()).includes('Content and reply drafts'));
      pass(`${name}: keyword ranking, goal examples, empty state, reset, and search focus`);

      for (const playbook of catalog.playbooks) {
        await page.goto(`${base}playbooks/${playbook.id}/index.html#/configure`);
        await page.getByRole('button', { name: 'Generate playbook' }).click();
        assert.equal(await page.evaluate(() => document.activeElement.id), playbook.questions[0].key);
        assert.equal(await page.locator('[aria-invalid="true"]').count(), playbook.questions.length);
        const answers = { ...defaultsFor(playbook, catalog), experience: 'advanced', frequency: 'week', channel: 'Slack' };
        await page.getByLabel('Experienced', { exact: true }).check();
        await page.locator('#frequency').selectOption('week');
        await page.locator('#channel').selectOption('Slack');
        assert.ok((await page.locator('#channel-hint').textContent()).includes('Connect Slack'));
        for (const question of playbook.questions) {
          answers[question.key] = ({ chains: 'Solana & Base', niche: 'Sustainable design', voice: 'Warm, clear & practical', role: 'Junior designer', location: 'Berlin / remote in Europe' })[question.key];
          await page.locator(`#${question.key}`).fill(answers[question.key]);
        }
        const configuredUrl = page.url();
        await page.reload();
        for (const question of playbook.questions) assert.equal(await page.locator(`#${question.key}`).inputValue(), answers[question.key]);
        if (name === 'chromium') await audit(page, `${playbook.id} configure`);
        for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await assertNoOverflow(page, `${name} ${playbook.id} configure ${width}`); }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        await assertNoOverflow(page, `${name} ${playbook.id} configure 200% text size`);
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
        if (playbook.id === 'job-hunt-radar') await page.screenshot({ path: `test/scratch/validation/${name}-configure-390.png`, fullPage: true });
        await page.getByRole('button', { name: 'Generate playbook' }).click();
        await page.locator('#prompt-text').waitFor();
        assert.equal(await page.locator('#prompt-text').textContent(), fillTemplate(playbook.prompt, answers));
        assert.equal(await page.locator('#schedule-text').textContent(), playbook.schedule);
        assert.ok((await page.locator('.schedule-context').textContent()).includes('differs from the recommendation'));
        const outputs = createOutputs(playbook, answers);
        for (const key of ['prompt', 'schedule', 'guardrails']) {
          await page.locator(`[data-copy="${key}"]`).click();
          await page.waitForFunction(() => document.querySelector('#status').textContent.includes('copied.'));
          const copied = await page.evaluate(() => window.__copied !== undefined ? window.__copied : navigator.clipboard.readText());
          assert.equal(copied, outputs[key], `${name} ${playbook.id} ${key} clipboard`);
        }
        if (playbook.riskWarning) assert.equal(await page.locator('.output-risk').count(), 3);
        if (playbook.id === 'job-hunt-radar') {
          await page.locator('[data-copy="guardrails"]').click();
          await page.locator('[data-copy="guardrails"]').click();
          await page.waitForFunction(() => document.querySelector('[data-copy="guardrails"]').textContent.trim() === 'Copy');
        }
        await page.locator('.guardrails input').first().check();
        assert.ok(await page.locator('.guardrails input').first().isChecked());
        await page.locator('#share-link').click();
        const sharedUrl = await page.evaluate(() => window.__copied !== undefined ? window.__copied : navigator.clipboard.readText());
        assert.ok(sharedUrl.startsWith(`${base}playbooks/${playbook.id}/index.html#/output?`));
        await page.goto(sharedUrl);
        await page.reload();
        assert.equal(await page.locator('#prompt-text').textContent(), fillTemplate(playbook.prompt, answers));
        if (name === 'chromium') await audit(page, `${playbook.id} output`);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        await assertNoOverflow(page, `${name} ${playbook.id} output 200% text size`);
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
        for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await assertNoOverflow(page, `${name} ${playbook.id} output ${width}`); }
        if (playbook.id === 'job-hunt-radar') await page.screenshot({ path: `test/scratch/validation/${name}-output-1440.png`, fullPage: true });
        await page.getByRole('link', { name: 'Edit answers' }).click();
        assert.equal(await page.locator(`#${playbook.questions[0].key}`).inputValue(), answers[playbook.questions[0].key]);
        await page.goBack();
        await page.locator('#prompt-text').waitFor();
        await page.goto(configuredUrl);
        await page.getByRole('button', { name: 'Reset answers' }).click();
        for (const question of playbook.questions) assert.equal(await page.locator(`#${question.key}`).inputValue(), '');
        assert.equal(await page.locator('#frequency').inputValue(), playbook.defaultFrequency);
        pass(`${name}: ${playbook.id} validation, selections, hash reload, exact output, three copy actions, checklist, sharing, edit, back, reset`);
      }

      const jobUrl = `${base}playbooks/job-hunt-radar/index.html`;
      await page.goto(`${jobUrl}#/output?role=%zz`);
      assert.ok(await page.getByRole('alert').isVisible());
      await page.goto(`${jobUrl}#/output?role=designer&location=Berlin&channel=unknown`);
      assert.ok(await page.getByRole('alert').isVisible());
      const malicious = '<img src=x onerror=alert(1)> {frequency} $&';
      const params = new URLSearchParams({ ...defaultsFor(catalog.playbooks[2], catalog), role: malicious, location: '東京 & München #remote' });
      await page.goto(`${jobUrl}#/output?${params}`);
      assert.equal(await page.locator('#prompt-text img').count(), 0);
      assert.ok((await page.locator('#prompt-text').textContent()).includes(malicious));
      pass(`${name}: invalid links recover and untrusted answers remain literal text`);

      // Deliberately force both native copy methods to fail, then verify a recoverable state.
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
        document.execCommand = () => false;
      });
      await page.locator('[data-copy="prompt"]').click();
      await page.locator('#manual-copy').waitFor({ state: 'visible' });
      assert.ok((await page.locator('#manual-copy').inputValue()).includes(malicious));
      assert.equal(await page.evaluate(() => document.activeElement.id), 'manual-copy');
      pass(`${name}: clipboard denial reveals focused, selectable manual copy`);

      // Once the static document has loaded, form generation needs no network at all.
      await page.getByRole('link', { name: 'Edit answers' }).click();
      await context.setOffline(true);
      await page.locator('#role').fill('Offline designer');
      await page.getByRole('button', { name: 'Generate playbook' }).click();
      assert.ok((await page.locator('#prompt-text').textContent()).includes('Offline designer'));
      await context.setOffline(false);
      pass(`${name}: form and output work offline after page load`);

      await page.goto(`${base}#/guide`);
      assert.ok(await page.getByRole('heading', { name: 'Your answers, in your link' }).isVisible());
      if (name === 'chromium') await audit(page, 'guide');
      await page.goto(`${base}#/unknown`);
      assert.ok(await page.getByRole('link', { name: 'See all playbooks' }).isVisible());
      await page.getByRole('link', { name: 'See all playbooks' }).click();
      await page.locator('#goal').waitFor();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.playbook-card').first().evaluate((node) => getComputedStyle(node).transitionDuration), '0s');
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await page.setViewportSize({ width: 390, height: 844 });
      await assertNoOverflow(page, `${name} home 200% text size`);
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      assert.deepEqual(unexpectedRequests, []);
      assert.deepEqual(badResponses, []);
      pass(`${name}: guide, missing route recovery, reduced motion, 200% text resizing, no external requests or failed assets`);

      const plain = await context.newPage();
      for (const path of ['', ...catalog.playbooks.map((playbook) => `playbooks/${playbook.id}/index.html`)]) {
        const response = await plain.request.get(base + path);
        const html = await response.text();
        assert.equal(response.status(), 200);
        for (const tag of ['<title>', 'name="description"', 'rel="icon"', 'property="og:title"', 'property="og:image"', 'name="twitter:card"']) assert.ok(html.includes(tag));
        assert.ok(!/(?:src|href)="\//.test(html), 'No root-relative assets');
        if (path) assert.ok(html.includes(catalog.playbooks.find((playbook) => path.includes(playbook.id)).title));
      }
      const previewImage = await plain.request.get(`${base}assets/social.png`);
      assert.equal(previewImage.status(), 200);
      const png = await previewImage.body();
      assert.equal(png.readUInt32BE(16), 1200);
      assert.equal(png.readUInt32BE(20), 630);
      pass(`${name}: static per-playbook social metadata and 1200×630 PNG at an IPFS-like subpath`);
      await context.close();
    } finally { await browser.close(); }
  }
  assert.deepEqual(report.errors, []);
  report.limitations.push('No physical iOS device, screen reader session, native browser zoom, live Grok Bot execution, or live X card crawler was tested. Chromium used the native clipboard. Text resizing is separate from native zoom.');
  if (report.browsers.some(({ name }) => name === 'webkit')) report.limitations.push('WebKit clipboard success was stubbed; its failure and manual-copy states were exercised in the browser.');
} catch (error) {
  report.errors.push(String(error.stack || error));
  process.exitCode = 1;
} finally {
  await writeFile('test/scratch/validation/results.json', JSON.stringify(report, null, 2) + '\n');
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  console.log(JSON.stringify({ passed: report.passed.length, browsers: report.browsers, errors: report.errors, limitations: report.limitations }, null, 2));
}
