import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createStaticServer } from './server.mjs';

// Deterministic production-export checks. RPC replies are intercepted, never live balances.
const require = createRequire(import.meta.url);
const { chromium, webkit } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const catalog = JSON.parse(await readFile(new URL('../src/data/chains.json', import.meta.url), 'utf8'));
const scan = JSON.parse(await readFile(new URL('../src/data/scan.json', import.meta.url), 'utf8'));
const playbooks = JSON.parse(await readFile(new URL('../src/data/playbooks.json', import.meta.url), 'utf8'));
const rpcOrigins = new Set(catalog.chains.flatMap((chain) => chain.rpc.map((url) => new URL(url).origin)));
const out = 'test/scratch/revision';
await mkdir(out, { recursive: true });
const report = { passed: [], browsers: [], accessibility: [], reflow: [], limitations: [], errors: [] };
const pass = (label) => { report.passed.push(label); console.log(`PASS ${label}`); };
const server = createStaticServer('dist', '/ipfs/revision/');
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/ipfs/revision/`;
const address = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
const solana = '11111111111111111111111111111111';
const word = (v) => BigInt(v).toString(16).padStart(64, '0');
const abi = (s) => `0x${word(32)}${word(s.length)}${Buffer.from(s).toString('hex').padEnd(64, '0')}`;
const values = { '0x06fdde03': abi('Checked Token'), '0x95d89b41': abi('CHK'), '0x313ce567': `0x${word(18)}`, '0x18160ddd': `0x${word(10n ** 24n)}`, '0x8da5cb5b': `0x${word(0)}` };

try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    let browser;
    try { browser = await engine.launch(); }
    catch (error) {
      report.limitations.push(`${name} launch failed: ${String(error)}`);
      if (name === 'chromium') throw error;
      continue;
    }
    report.browsers.push({ name, version: browser.version() });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      page.on('pageerror', (error) => report.errors.push(`${name}: ${error.message}`));
      const unexpected = [];
      let mode = 'wallet';
      let badSelector = '';
      let badResult;
      let calls = [];
      let pending = null;
      const eth = catalog.chains.find(({ id }) => id === 'ethereum');
      const rh = catalog.chains.find(({ id }) => id === 'robinhood');
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (route.request().url().startsWith(base)) return route.continue();
        if (!rpcOrigins.has(url.origin)) { unexpected.push(url.href); return route.abort(); }
        const body = route.request().postDataJSON();
        calls.push({ url: url.href, method: body.method, selector: body.params[0]?.data });
        const thisMode = mode;
        if (pending) {
          const held = pending;
          pending = null;
          held.started();
          await held.gate;
          if (held.fail) return route.fulfill({ status: 503, body: 'unavailable' });
        }
        if (thisMode === 'down' || (thisMode === 'robinhood' && url.origin === new URL(rh.rpc[0]).origin)) return route.fulfill({ status: 503, body: 'unavailable' });
        let result;
        let error;
        if (body.method === 'eth_getCode') result = ['wallet', 'robinhood'].includes(thisMode) ? '0x' : '0x6001600055';
        else if (body.method === 'eth_getBalance') result = '0x112210f4768db400';
        else if (body.method === 'getAccountInfo') result = { value: { owner: 'NativeLoader1111111111111111111111111111111', executable: true, lamports: 1000000000, data: ['', 'base64'] } };
        else {
          const selector = body.params[0].data;
          result = values[selector];
          if ((thisMode === 'malformed-both' || (thisMode === 'malformed-primary' && url.origin === new URL(eth.rpc[0]).origin)) && selector === badSelector) result = badResult;
          if (thisMode === 'absent' && ['0x06fdde03', '0x8da5cb5b'].includes(selector)) result = '0x';
          if (thisMode === 'reverted' && ['0x06fdde03', '0x8da5cb5b'].includes(selector)) error = { code: 3, message: 'execution reverted' };
        }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...(error ? { error } : { result }) }) });
      });
      const openScan = async (chain = 'ethereum', value = address) => {
        await page.goto(`${base}#/scan`);
        await page.locator('#scan-chain').selectOption(chain);
        await page.locator('#scan-address').fill(value);
      };
      const submit = () => page.locator('#scan-submit').click();
      const ready = (label) => page.getByRole('heading', { name: label, exact: true }).waitFor();
      const noResult = async () => {
        assert.equal(await page.locator('.scan-result, .facts-table, [data-check], #build-profile, #profile-prompt').count(), 0);
      };
      const reflow = async (label) => {
        const box = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(box.scroll <= box.width, `${label}: overflow`);
        report.reflow.push({ browser: name, label, ...box });
      };
      const audit = async (label) => {
        if (name !== 'chromium') return;
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        const violations = result.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) }));
        report.accessibility.push({ label, violations, incomplete: result.incomplete.map(({ id }) => id) });
        assert.deepEqual(violations, [], label);
      };
      await openScan();
      const button = await page.locator('#scan-submit').boundingBox();
      assert.ok(button.y >= 0 && button.y + button.height < 844, 'scan action on first phone screen');
      await page.screenshot({ path: `${out}/${name}-scan-390.png` });
      await audit('scan form 390');
      pass(`${name}: Scan input, chain and submit fit first screen at 390`);

      const malformed = [
        ['0x8da5cb5b', { invalid: true }], ['0x06fdde03', null],
        ['0x06fdde03', '0x12'], ['0x95d89b41', `0x${word(0)}${word(0)}`],
        ['0x313ce567', `0x${word(256)}`], ['0x18160ddd', '0x1234'],
        ['0x8da5cb5b', `0x${'1'.repeat(64)}`],
      ];
      for (const [selector, invalid] of malformed) {
        badSelector = selector; badResult = invalid;
        for (mode of ['malformed-primary', 'malformed-both']) {
          calls = [];
          await submit();
          if (mode === 'malformed-primary') {
            await ready('Token facts');
            assert.ok((await page.locator('.read-from').innerText()).includes(new URL(eth.rpc[1]).host));
            assert.equal(await page.locator('[data-check]').count(), 5);
          } else {
            await page.getByRole('alert').waitFor();
            assert.ok((await page.getByRole('alert').innerText()).includes('Could not read the chain right now'));
            await noResult();
          }
          assert.equal(calls.filter((call) => call.url === new URL(eth.rpc[0]).href).length, 6);
          assert.equal(calls.filter((call) => call.url === new URL(eth.rpc[1]).href).length, 6);
          assert.equal(calls.length, 12, 'one complete retry, no third endpoint');
        }
      }
      await page.screenshot({ path: `${out}/${name}-malformed-error-390.png` });
      await audit('malformed RPC error 390');
      pass(`${name}: 7 malformed field cases each retry the entire scan; two bad endpoints expose no facts or prompts`);
      for (mode of ['absent', 'reverted']) {
        calls = [];
        await submit();
        await ready('Token facts');
        const facts = await page.locator('.facts-table').innerText();
        assert.match(facts, /Not provided by the contract/);
        assert.match(facts, /No owner\(\) answer from the contract/);
        assert.equal(calls.length, 6, 'valid absence needs no fallback');
      }
      pass(`${name}: valid empty fields and genuine reverts still complete without a fallback`);

      mode = 'robinhood'; calls = [];
      await openScan('robinhood');
      await submit();
      await ready('Wallet');
      assert.deepEqual(calls.map(({ url }) => url), [new URL(rh.rpc[0]).href, new URL(rh.rpc[1]).href, new URL(rh.rpc[1]).href]);
      assert.ok((await page.locator('.read-from').innerText()).includes(new URL(rh.rpc[1]).host));
      assert.ok((await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).includes(new URL(rh.rpc[1]).origin));
      mode = 'down'; calls = [];
      await submit();
      await page.getByRole('alert').waitFor();
      await noResult();
      assert.deepEqual(calls.map(({ url }) => url), rh.rpc.map((url) => new URL(url).href));
      pass(`${name}: Robinhood uses one distinct fallback permitted by generated CSP; both-down state is incomplete`);

      // Hold a primary request until the form changes, then release success or failure.
      for (const field of ['address', 'chain']) {
        for (const fail of [false, true]) {
          mode = 'wallet';
          await openScan();
          let signalStart, release;
          const begun = new Promise((resolve) => { signalStart = resolve; });
          const gate = new Promise((resolve) => { release = resolve; });
          pending = { started: signalStart, gate, fail };
          await submit();
          await begun;
          if (field === 'address') await page.locator('#scan-address').fill(other);
          else await page.locator('#scan-chain').selectOption('base');
          assert.equal(await page.locator('#scan-submit').isEnabled(), true);
          assert.equal(await page.locator('#scan-output').innerText(), '');
          const settled = page.waitForResponse((response) => response.url() === new URL(eth.rpc[fail ? 1 : 0]).href && response.request().postDataJSON().method === 'eth_getBalance');
          release();
          await (await settled).finished();
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await noResult();
          assert.equal(await page.locator('#scan-output').innerText(), '', 'late replies must not repopulate the edited form');
          // A subsequent scan must win even if the old scan continues onto a fallback.
          await submit();
          await ready('Wallet');
          const expectedAddress = field === 'address' ? other : address;
          const expectedExplorer = field === 'address' ? 'etherscan.io' : 'basescan.org';
          const href = await page.locator('.read-from a').getAttribute('href');
          assert.ok(href.includes(expectedAddress) && href.includes(expectedExplorer));
          await page.locator('#build-profile').click();
          const prompt = await page.locator('#profile-prompt').innerText();
          assert.ok(prompt.includes(expectedAddress));
          if (field === 'address') await page.locator('#scan-address').fill(address);
          else await page.locator('#scan-chain').selectOption('ethereum');
          await noResult();
          assert.equal(await page.locator('#scan-output').innerText(), '');
        }
      }
      pass(`${name}: address/chain edits invalidate pending success/failure and completed profiles, restore submit, and allow a new scan`);

      mode = 'program';
      await openScan('solana', solana);
      await page.locator('#scan-address').press('Enter');
      await ready('Program');
      assert.match(await page.locator('.wallet-facts').innerText(), /Balance\s+1 SOL/);
      assert.match(await page.locator('#scan-output').innerText(), /executable Solana program/);
      await audit('Solana program with balance and profile action');
      await page.screenshot({ path: `${out}/${name}-program-390.png`, fullPage: true });
      await page.locator('#build-profile').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'profile-heading');
      const prompt = await page.locator('#profile-prompt').innerText();
      assert.equal(prompt, scan.walletPromptTemplate.replace('{address}', solana).replace('{chain}', 'Solana'));
      await page.locator('#save-playbook').click();
      assert.equal(await page.locator('#profile-prompt').isVisible(), true);
      assert.match(await page.evaluate(() => location.hash), /^#\/scan\/output\?chain=solana&address=11111111111111111111111111111111&balance=1\+SOL$/);
      await page.reload();
      await ready('Trader profile');
      assert.equal(await page.locator('#profile-prompt').innerText(), prompt);
      assert.ok((await page.locator('.wallet-facts').innerText()).includes('1 SOL'));
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await reflow(`saved program prompt ${width}`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await reflow('saved program prompt 200% text');
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      pass(`${name}: Solana Program balance, keyboard profile action, exact analyst prompt, URL save, reload and reflow`);

      await page.goto(`${base}#/guide`);
      const privacy = await page.locator('section[aria-labelledby="privacy-heading"]').innerText();
      assert.ok(privacy.includes('Scanning sends the address you enter'));
      assert.ok(privacy.includes('fallback'));
      assert.ok(!privacy.includes('or API'));
      await page.screenshot({ path: `${out}/${name}-privacy-390.png`, fullPage: true });
      pass(`${name}: privacy explains address disclosure to primary and fallback RPC providers`);

      for (const route of ['', '#/scan', '#/guide', '#/guides', '#/roadmap', '#/guides/coinbase-agentic-wallet', 'playbooks/perps-funding-digest/index.html', 'playbooks/perps-funding-digest/index.html#/output?markets=BTC']) {
        await page.goto(base + route);
        assert.equal(await page.locator('.brand').innerText(), 'nuntio');
        assert.equal(await page.locator('.brand').getAttribute('aria-label'), 'nuntio home');
        assert.ok((await page.title()).includes('nuntio'));
        assert.ok(!(await page.title()).includes('Nuntio'));
        assert.equal(await page.locator('meta[property="og:site_name"]').getAttribute('content'), 'nuntio');
      }
      await page.goto(base);
      assert.equal(await page.locator('.playbook-card').count(), playbooks.playbooks.length);
      assert.ok((await page.locator('main').innerText()).includes('A morning summary of funding rates, open interest and liquidations.'));
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await reflow(`home ${width}`);
        if (width !== 320) await page.screenshot({ path: `${out}/${name}-home-${width}.png`, fullPage: width === 1440 });
      }
      assert.deepEqual(unexpected, []);
      pass(`${name}: lowercase brand across routes, metadata, descriptive perps card, retained library and responsive home`);
      await context.close();
    } finally { await browser.close(); }
  }
  assert.deepEqual(report.errors, []);
  report.limitations.push('All RPC scenarios were intercepted fixtures. This checks browser behavior, not live provider availability or CORS. No physical device, screen-reader session or native browser zoom was tested.');
} catch (error) {
  report.errors.push(String(error));
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await new Promise((resolve) => server.close(resolve));
}
console.log(JSON.stringify({ passed: report.passed.length, browsers: report.browsers, audits: report.accessibility.length, errors: report.errors, limitations: report.limitations }, null, 2));
