import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createStaticServer } from './server.mjs';
import { createOutputs, defaultsFor, fillTemplate } from '../src/model.js';
import { createGuidePrompt } from '../src/guide-model.js';

const require = createRequire(import.meta.url);
const { chromium, webkit } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const catalog = JSON.parse(await readFile(new URL('../src/data/playbooks.json', import.meta.url), 'utf8'));
const guides = JSON.parse(await readFile(new URL('../src/data/guides.json', import.meta.url), 'utf8'));
const report = { passed: [], limitations: [], browsers: [], errors: [], views: [], accessibility: [] };
await mkdir('test/scratch/validation', { recursive: true });
const prefix = '/ipfs/nuntio-validation/';
const server = createStaticServer('dist', prefix);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}${prefix}`;
const pass = (description) => { report.passed.push(description); console.log(`PASS ${description}`); };

async function tabTo(page, selector) {
  for (let step = 0; step < 40; step++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((selector) => document.activeElement.matches(selector), selector)) return;
  }
  assert.fail(`Keyboard cannot reach ${selector}`);
}

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
      await tabTo(page, '#goal');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'goal');
      await page.keyboard.type('find a job');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await page.locator('#playbook-form').waitFor();
      await tabTo(page, 'input[name="experience"]');
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

      await page.goto(`${base}#/guides`);
      assert.equal(await page.locator('.setup-card').count(), guides.guides.length);
      assert.equal(await page.locator('[data-section="guides"][aria-current="page"]').count(), 1);
      assert.equal(await page.getByRole('link', { name: /Official source for/ }).count(), guides.guides.length);
      assert.equal(await page.getByRole('link', { name: /Report a broken step for/ }).count(), guides.guides.length);
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await assertNoOverflow(page, `${name} setup library ${width}`);
      }
      if (name === 'chromium') await audit(page, 'setup library');
      await page.screenshot({ path: `test/scratch/validation/${name}-guides-1440.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `test/scratch/validation/${name}-guides-390.png` });
      await page.getByRole('link', { name: 'Coinbase Agentic Wallet', exact: true }).click();
      assert.ok(page.url().endsWith('guides/coinbase-agentic-wallet/index.html'));
      await page.getByRole('link', { name: 'All setup guides' }).click();
      assert.ok(page.url().endsWith('index.html#/guides'));
      pass(`${name}: setup cards, dates, official sources, reports, and subpath navigation`);

      for (const guide of guides.guides) {
        const prompt = createGuidePrompt(guides.promptTemplate, guide.prompt);
        await page.goto(`${base}guides/${guide.id}/index.html`);
        assert.ok(await page.getByRole('radio', { name: 'Let your agent do it', exact: true }).isChecked());
        assert.ok(await page.locator('#self-panel').isHidden());
        assert.equal(await page.locator('#agent-prompt').textContent(), prompt);
        const copyAction = await page.locator('#copy-agent-prompt').boundingBox();
        assert.ok(copyAction.y >= 0 && copyAction.y + copyAction.height <= 844, `${guide.id}: copy action fits first screen at 390`);
        await page.screenshot({ path: `test/scratch/validation/${name}-${guide.id}-agent-390.png` });
        await page.locator('#copy-agent-prompt').click();
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('agent prompt copied.'));
        const copied = await page.evaluate(() => window.__copied !== undefined ? window.__copied : navigator.clipboard.readText());
        assert.equal(copied, prompt, `${guide.id} exact agent prompt clipboard`);
        assert.ok(!copied.match(/\{[a-z_]+\}/));
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 844 });
          await assertNoOverflow(page, `${name} ${guide.id} agent ${width}`);
        }
        if (name === 'chromium') await audit(page, `${guide.id} agent`);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('radio', { name: 'Let your agent do it', exact: true }).focus();
        await page.keyboard.press('ArrowRight');
        assert.ok(await page.getByRole('radio', { name: 'Do it yourself', exact: true }).isChecked());
        assert.ok(await page.locator('#agent-panel').isHidden());
        assert.equal(await page.locator('[data-setup-step]').count(), guide.steps.length);
        assert.equal(await page.locator('.step-actor').allTextContents().then((labels) => labels.join('|')), guide.steps.map((step) => step.actor === 'you' ? 'You do this' : 'Your agent does this').join('|'));
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'setup-step-0');
        await page.keyboard.press('Space');
        assert.ok(await page.locator('#setup-step-0').isChecked());
        assert.equal(await page.locator('#setup-progress').textContent(), `1 of ${guide.steps.length} steps checked`);
        await page.screenshot({ path: `test/scratch/validation/${name}-${guide.id}-self-390.png`, fullPage: true });
        await page.getByRole('radio', { name: 'Let your agent do it', exact: true }).check();
        await page.getByRole('radio', { name: 'Do it yourself', exact: true }).check();
        assert.ok(await page.locator('#setup-step-0').isChecked(), 'Switching modes retains current checklist');
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 844 });
          await assertNoOverflow(page, `${name} ${guide.id} checklist ${width}`);
        }
        if (name === 'chromium') await audit(page, `${guide.id} checklist`);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        await assertNoOverflow(page, `${name} ${guide.id} checklist 200% text size`);
        await page.getByRole('radio', { name: 'Let your agent do it', exact: true }).check();
        await assertNoOverflow(page, `${name} ${guide.id} agent 200% text size`);
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
        await page.reload();
        assert.ok(await page.getByRole('radio', { name: 'Let your agent do it', exact: true }).isChecked());
        assert.equal(await page.locator('[data-setup-step]:checked').count(), 0);
        await page.evaluate(() => {
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
          document.execCommand = () => false;
        });
        await page.locator('#copy-agent-prompt').click();
        assert.equal(await page.locator('#manual-copy').inputValue(), prompt);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'manual-copy');
        await context.setOffline(true);
        await page.getByRole('radio', { name: 'Do it yourself', exact: true }).check();
        await page.locator('#setup-step-0').check();
        assert.ok(await page.locator('#setup-step-0').isChecked());
        await context.setOffline(false);
        pass(`${name}: ${guide.title} exact copy, both modes, keyboard checklist, temporary checks, manual fallback, offline use and responsive reflow`);
      }
      await page.goto(`${base}#/guides/okx-agentic-wallet`);
      assert.ok(await page.getByRole('heading', { name: 'OKX Agentic Wallet', exact: true }).isVisible());
      await page.goto(`${base}#/guides/not-a-provider`);
      assert.ok(await page.getByRole('link', { name: 'See all playbooks' }).isVisible());
      await page.goto(`${base}#/roadmap`);
      assert.ok(await page.getByRole('heading', { name: 'Available now' }).isVisible());
      await page.getByRole('link', { name: 'Browse setup guides' }).click();
      await page.locator('.setup-card').first().waitFor();
      pass(`${name}: guide hash routes, missing guide recovery, roadmap and section tabs`);

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
      for (const path of ['', ...catalog.playbooks.map((playbook) => `playbooks/${playbook.id}/index.html`), ...guides.guides.map((guide) => `guides/${guide.id}/index.html`)]) {
        const response = await plain.request.get(base + path);
        const html = await response.text();
        assert.equal(response.status(), 200);
        for (const tag of ['<title>', 'name="description"', 'rel="icon"', 'property="og:title"', 'property="og:image"', 'name="twitter:card"']) assert.ok(html.includes(tag));
        assert.ok(!/(?:src|href)="\//.test(html), 'No root-relative assets');
        if (path) assert.ok(html.includes([...catalog.playbooks, ...guides.guides].find((item) => path.includes(item.id)).title));
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
