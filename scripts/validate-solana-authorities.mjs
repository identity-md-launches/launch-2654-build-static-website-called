import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { base58Encode } from '../src/scan-model.js';
import { createStaticServer } from './server.mjs';

// Exercises the production export using intercepted RPC fixtures, never live token facts.
const require = createRequire(import.meta.url);
const { chromium, webkit } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const catalog = JSON.parse(await readFile(new URL('../src/data/chains.json', import.meta.url), 'utf8'));
const sol = catalog.chains.find(({ id }) => id === 'solana');
const address = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const authority = 'BJE5MMbqXjVwjAF7oxwPYXnTXDyspzZyt4vwenNw5ruG';
const out = 'test/scratch/solana-authority';
await mkdir(out, { recursive: true });
const report = { browsers: [], passed: [], scenarios: [], accessibility: [], reflow: [], errors: [], limitations: [], mockedRPC: true };
const server = createStaticServer('dist', '/ipfs/solana-authority/');
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/ipfs/solana-authority/`;
const pass = label => { report.passed.push(label); console.log(`PASS ${label}`); };
const validInfo = () => ({ decimals: 6, supply: '1000000000', mintAuthority: authority, freezeAuthority: authority });
const invalidCases = [
  ['object', { invalid: true }], ['missing', undefined], ['boolean', false],
  ['invalid base58', authority.replace('B', '0')],
  ['31-byte base58', base58Encode(new Uint8Array(31).fill(2))],
  ['33-byte base58', base58Encode(new Uint8Array(33).fill(2))],
];

try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    let browser;
    try { browser = await engine.launch(); }
    catch (error) {
      report.limitations.push(`${name}: browser could not launch${String(error).includes('missing dependencies') ? ' (missing host libraries)' : ''}; no checks performed in this engine.`);
      if (name === 'chromium') throw error;
      continue;
    }
    report.browsers.push({ name, version: browser.version() });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push(`${name}: ${error.message}`));
      page.on('console', message => { if (message.type() === 'error') report.errors.push(`${name}: ${message.text()}`); });
      page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) report.errors.push(`Static response ${response.status()}`); });
      let primaryInfo = validInfo(), fallbackInfo = validInfo(), calls = [], heldFallback, reachFallback;
      await page.route('**/*', async route => {
        const request = route.request();
        if (request.url().startsWith(base)) return route.continue();
        const endpoint = sol.rpc.find(url => new URL(url).href === request.url());
        if (!endpoint) { report.errors.push(`Unexpected request: ${request.url()}`); return route.abort(); }
        const { method, params } = request.postDataJSON();
        assert.equal(method, 'getAccountInfo');
        calls.push({ endpoint, encoding: params[1].encoding });
        if (endpoint === sol.rpc[1] && heldFallback) { reachFallback(); await heldFallback; }
        const info = endpoint === sol.rpc[0] ? primaryInfo : fallbackInfo;
        const value = params[1].encoding === 'base64' ? null : {
          owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', executable: false,
          lamports: 1, rentEpoch: 0, space: 82,
          data: { program: 'spl-token', space: 82, parsed: { type: 'mint', info } },
        };
        await route.fulfill({ json: { jsonrpc: '2.0', id: 1, result: { context: { slot: 1 }, value } } });
      });
      const noResult = async () => assert.equal(await page.locator('.facts-table, .scan-result, .check-item, .scan-prompt, .read-from, #profile-prompt').count(), 0);
      const submit = async () => { calls = []; await page.locator('#scan-submit').click(); };
      const ready = () => page.getByRole('heading', { name: 'Token facts', exact: true }).waitFor();
      const counts = () => sol.rpc.map(endpoint => calls.filter(call => call.endpoint === endpoint).length);
      const reflow = async label => {
        const box = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(box.scroll <= box.width, `${label}: horizontal overflow`);
        report.reflow.push({ browser: name, label, ...box });
      };
      const audit = async label => {
        if (name !== 'chromium') return;
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        const violations = result.violations.map(({ id, impact }) => ({ id, impact }));
        report.accessibility.push({ label, violations, incomplete: result.incomplete.map(({ id }) => id) });
        assert.deepEqual(violations, []);
      };
      await page.goto(`${base}#/scan`);
      await page.locator('#scan-chain').selectOption('solana');
      await page.locator('#scan-address').fill(address);
      await page.locator('#scan-address').press('Tab');
      assert.equal(await page.locator('#scan-submit').evaluate(el => el === document.activeElement), true);
      const button = await page.locator('#scan-submit').boundingBox();
      assert.ok(button.y >= 0 && button.y + button.height <= 844);
      await page.screenshot({ path: `${out}/${name}-form-focus-390.png` });
      await audit('Solana form and keyboard focus at 390');
      await page.keyboard.press('Enter');
      await ready();
      pass(`${name}: Scan action is visible at 390 and keyboard submission works`);

      for (const field of ['mintAuthority', 'freezeAuthority']) {
        for (const [label, value] of invalidCases) {
          primaryInfo = { ...validInfo(), supply: '9000000000', [field]: value };
          if (value === undefined) delete primaryInfo[field];
          for (const badFallback of [false, true]) {
            fallbackInfo = badFallback ? primaryInfo : validInfo();
            await submit();
            if (badFallback) {
              await page.getByRole('alert').waitFor();
              assert.ok((await page.getByRole('alert').innerText()).includes('Could not read the chain right now'));
              await noResult();
              assert.equal(await page.getByRole('button', { name: 'Try again', exact: true }).isEnabled(), true);
            } else {
              await ready();
              assert.ok((await page.locator('.read-from').textContent()).includes(new URL(sol.rpc[1]).host));
              assert.equal(await page.locator('.facts-table tr').filter({ hasText: 'Supply' }).locator('.fact-value').textContent(), '1,000');
              for (const title of ['Mint authority', 'Freeze authority']) {
                const row = page.locator('.facts-table tr').filter({ hasText: title });
                assert.equal(await row.locator('.fact-value').textContent(), authority);
                assert.equal((await row.locator('.flag-label').textContent()).trim(), 'Flag: set');
              }
              assert.equal(await page.locator('.check-item:enabled').count(), 5);
              await page.getByRole('button', { name: 'Scam red flags' }).click();
              const prompt = await page.locator('.scan-prompt').textContent();
              assert.ok(prompt.includes(`Mint authority: ${authority}; Freeze authority: ${authority}`));
              assert.ok(!prompt.includes('authority: None'));
            }
            assert.deepEqual(counts(), [2, 2], 'exactly one complete read on each endpoint');
            assert.deepEqual(calls.filter(call => call.endpoint === sol.rpc[1]).map(call => call.encoding), ['jsonParsed', 'base64']);
            report.scenarios.push({ browser: name, field, malformed: label, fallback: badFallback ? 'malformed' : 'valid', primaryRequests: 2, fallbackRequests: 2, outcome: badFallback ? 'error; no facts or prompts' : 'fallback facts and authority flags; correct prompt' });
          }
        }
      }
      pass(`${name}: 24 malformed-authority scenarios reject unsupported facts, retry the whole read, and hide all prompts when both endpoints fail`);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await reflow(`error ${width}`);
        if ([390, 1440].includes(width)) await page.screenshot({ path: `${out}/${name}-error-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await audit('Solana malformed authority error at 390');
      // Recover from the error using its keyboard-accessible retry action.
      primaryInfo = validInfo(); calls = [];
      await page.getByRole('button', { name: 'Try again', exact: true }).focus();
      await page.keyboard.press('Enter'); await ready();
      assert.deepEqual(counts(), [2, 0]);
      pass(`${name}: Try again recovers from the error by keyboard`);

      primaryInfo = { ...validInfo(), mintAuthority: { invalid: true } };
      fallbackInfo = validInfo();
      let release;
      const fallbackStarted = new Promise(resolve => { reachFallback = resolve; });
      heldFallback = new Promise(resolve => { release = resolve; });
      await submit();
      try {
        await fallbackStarted;
        await page.locator('.scan-loading').waitFor();
        await noResult();
        assert.equal(await page.locator('#scan-submit').isDisabled(), true);
        await page.screenshot({ path: `${out}/${name}-pending-390.png` });
      } finally { release(); }
      await ready(); heldFallback = undefined;
      assert.deepEqual(counts(), [2, 2]);
      await page.getByRole('button', { name: 'Scam red flags' }).click();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await reflow(`fallback facts and prompt ${width}`);
        if ([390, 1440].includes(width)) await page.screenshot({ path: `${out}/${name}-fallback-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await reflow('fallback facts and prompt at 200% text size');
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await audit('Solana fallback facts, flags and research prompt at 390');
      pass(`${name}: pending scan exposes no facts; fallback result and error reflow at 320, 390, 768, 1440; 200% text reflows`);

      primaryInfo = { ...validInfo(), mintAuthority: null, freezeAuthority: null };
      await submit(); await ready();
      assert.deepEqual(await page.locator('.facts-table tr').filter({ hasText: /authority/ }).locator('.fact-value').allTextContents(), ['None', 'None']);
      assert.equal(await page.locator('.flag-label').count(), 0);
      assert.deepEqual(counts(), [2, 0]);
      pass(`${name}: explicit null authorities remain None without flags or a fallback`);
      assert.deepEqual(report.errors, []);
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  await writeFile(`${out}/checks.json`, JSON.stringify(report, null, 2) + '\n');
}
