import rawChains from './data/chains.json';
import rawScan from './data/scan.json';
import { factsSentence, fillScanTemplate, linkFor, scanHash, validateAddress } from './scan-model.js';
import { scanAddress } from './scan-rpc.js';

/** @typedef {import('./types').ChainConfig} ChainConfig */
/** @typedef {import('./types').ScanResult} ScanResult */
/** @type {import('./types').ChainCatalog} */
export const chainCatalog = /** @type {any} */ (rawChains);
/** @type {import('./types').ScanCatalog} */
export const scanCatalog = rawScan;

/**
 * Build DOM from plain values. Strings always become text nodes, so chain data can never become HTML.
 * @param {string} tag @param {Record<string, string | boolean | undefined>} [attrs] @param {...(Node | string | null | undefined | false)} children
 */
function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') element.className = String(value);
    else element.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) element.append(child);
  return element;
}

/** Trusted, static icon markup from the app's own icon set.
 * @param {string} markup */
function trusted(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  return template.content;
}

/** @param {string} url */
function hostOf(url) { try { return new URL(url).host; } catch { return url; } }

/** @param {ChainConfig} chain @param {string | null} tool @param {string} address */
export function toolLink(chain, tool, address) {
  if (tool === 'explorer-address') return { name: chain.explorer.name, href: linkFor(chain.explorer.address, address), exact: true };
  if (tool === 'explorer-token') return { name: chain.explorer.name, href: linkFor(chain.explorer.token, address), exact: true };
  if (tool && chainCatalog.tools[tool]) return { name: chainCatalog.tools[tool].name, href: chainCatalog.tools[tool].url, exact: false };
  return null;
}

/** @param {ChainConfig} chain @param {string} address @param {import('./types').ScanFact[]} facts @param {import('./types').ScanItem} item */
export function tokenPrompt(chain, address, facts, item) {
  return fillScanTemplate(scanCatalog.tokenPromptTemplate, { item: item.item, address, chain: chain.label, facts: factsSentence(facts), method: item.method });
}

/** @param {ChainConfig} chain @param {string} address */
export function walletPrompt(chain, address) {
  return fillScanTemplate(scanCatalog.walletPromptTemplate, { address, chain: chain.label });
}

/**
 * @param {{ app: HTMLElement, icon: (name: string, className?: string) => string, copy: (text: string, button: HTMLButtonElement, message: string) => Promise<void>, announce: (text: string) => void, esc: (text: string) => string }} deps
 */
export function createScanView({ app, icon, copy, announce, esc }) {
  let scanToken = 0;

  /** @param {string} text @param {string} message @param {string} [label] */
  function copyButton(text, message, label = 'Copy prompt') {
    const button = /** @type {HTMLButtonElement} */ (h('button', { class: 'button secondary copy-button', type: 'button' }, trusted(icon('copy')), ` ${label}`));
    button.addEventListener('click', () => { void copy(text, button, message); });
    return button;
  }

  /** @param {string} text @param {string} id */
  function promptBox(text, id) { return h('div', { class: 'prompt-text scan-prompt', id }, text); }

  /** @param {string} href @param {string} label */
  function externalLink(href, label) {
    return h('a', { class: 'button secondary', href, target: '_blank', rel: 'noopener noreferrer' }, `${label} `, trusted(icon('external')), h('span', { class: 'sr-only' }, ' (opens in new tab)'));
  }

  /** @param {ChainConfig} chain @param {string} address @param {import('./types').ScanFact[]} facts */
  function tokenResult(chain, address, facts) {
    const rows = facts.map((fact) => h('tr', {}, h('th', { scope: 'row' }, fact.label), h('td', { class: fact.flag ? 'flagged' : '' }, h('span', { class: 'fact-value' }, fact.value), fact.flag ? h('span', { class: 'flag-label' }, trusted(icon('warning')), ' Flag: set') : null)));
    const table = h('table', { class: 'facts-table' }, h('caption', { class: 'sr-only' }, `Token facts for ${address} on ${chain.label}`), h('tbody', {}, ...rows));
    const panelHost = h('div', { class: 'check-panel-host' });
    const menu = h('ul', { class: 'check-menu', role: 'list' });
    scanCatalog.items.forEach((item, index) => {
      const panelId = `check-panel-${item.id}`;
      const button = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'check-item', 'aria-expanded': 'false', 'aria-controls': panelId, 'data-check': item.id }, h('span', { class: 'check-number', 'aria-hidden': 'true' }, String(index + 1)), h('span', {}, item.title), trusted(icon('arrow'))));
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') === 'true';
        menu.querySelectorAll('.check-item').forEach((other) => other.setAttribute('aria-expanded', 'false'));
        panelHost.replaceChildren();
        if (open) { announce(`${item.title} closed.`); return; }
        button.setAttribute('aria-expanded', 'true');
        const prompt = tokenPrompt(chain, address, facts, item);
        const link = toolLink(chain, item.tool, address);
        const panel = h('section', { class: 'check-panel', id: panelId, 'aria-labelledby': `${panelId}-title` },
          h('h3', { id: `${panelId}-title` }, `${index + 1}. ${item.title}`),
          h('p', { class: 'muted' }, `Method: ${item.method}.`),
          link ? h('div', { class: 'check-tool' }, externalLink(link.href, `Open ${link.name}`), h('p', { class: 'small muted' }, link.exact ? `Opens this address on ${link.name}.` : `Opens the ${link.name} home page. Paste the address there.`)) : h('p', { class: 'small muted' }, 'Prompt only. No tool link for this check.'),
          h('div', { class: 'block-heading' }, h('h4', {}, 'Agent prompt'), copyButton(prompt, `${item.title} prompt copied.`)),
          promptBox(prompt, `${panelId}-prompt`));
        panelHost.append(panel);
        announce(`${item.title} opened.`);
      });
      menu.append(h('li', {}, button));
    });
    return h('div', { class: 'scan-result' },
      h('h2', { id: 'result-heading', tabindex: '-1' }, 'Token facts'),
      table,
      h('section', { class: 'check-section', 'aria-labelledby': 'check-heading' }, h('h2', { id: 'check-heading' }, scanCatalog.menuHeading), menu, panelHost));
  }

  /** @param {ChainConfig} chain @param {string} address @param {string} balance @param {boolean} saved */
  function walletProfile(chain, address, balance, saved) {
    const prompt = walletPrompt(chain, address);
    const status = h('p', { class: 'small muted save-status', role: 'status' }, saved ? 'Saved. This link holds the playbook.' : '');
    const save = /** @type {HTMLButtonElement} */ (h('button', { class: 'button primary', type: 'button', id: 'save-playbook' }, trusted(icon('check')), saved ? ' Saved as playbook' : ' Save as playbook'));
    const share = /** @type {HTMLButtonElement} */ (h('button', { class: 'button secondary', type: 'button', id: 'share-playbook', hidden: !saved }, trusted(icon('link')), ' Copy share link'));
    const hashValues = { chain: chain.id, address, balance };
    save.addEventListener('click', () => {
      history.replaceState(null, '', scanHash('/scan/output', hashValues));
      save.replaceChildren(trusted(icon('check')), ' Saved as playbook');
      share.hidden = false;
      status.textContent = 'Saved. This link holds the playbook.';
      announce('Saved as playbook. The link now holds it.');
    });
    share.addEventListener('click', () => {
      const url = new URL(location.href);
      url.hash = scanHash('/scan/output', hashValues);
      void copy(url.href, share, 'Share link copied.');
    });
    return h('section', { class: 'profile-block', 'aria-labelledby': 'profile-heading' },
      h('div', { class: 'block-heading' }, h('h2', { id: 'profile-heading', tabindex: '-1' }, 'Trader profile prompt'), copyButton(prompt, 'Trader profile prompt copied.')),
      h('p', { class: 'block-instruction' }, 'Paste this into your own agent. It studies the wallet; nothing here trades.'),
      promptBox(prompt, 'profile-prompt'),
      h('div', { class: 'output-actions' }, save, share, status));
  }

  /** @param {ChainConfig} chain @param {string} address @param {string} balance @param {string} [note] @param {string} [title] */
  function walletResult(chain, address, balance, note, title = 'Wallet') {
    const holder = h('div', {});
    const build = /** @type {HTMLButtonElement} */ (h('button', { class: 'button primary', type: 'button', id: 'build-profile' }, 'Build a trader profile ', trusted(icon('arrow'))));
    build.addEventListener('click', () => {
      holder.replaceChildren(walletProfile(chain, address, balance, false));
      build.hidden = true;
      /** @type {HTMLElement} */ (holder.querySelector('#profile-heading')).focus();
    });
    return h('div', { class: 'scan-result' },
      h('h2', { id: 'result-heading', tabindex: '-1' }, title),
      h('dl', { class: 'wallet-facts' }, h('div', {}, h('dt', {}, 'Balance'), h('dd', {}, balance))),
      note ? h('p', { class: 'small muted' }, note) : null,
      build, holder);
  }

  /** @param {ChainConfig} chain @param {string} address @param {ScanResult} result */
  function resultView(chain, address, result) {
    const where = h('p', { class: 'small muted read-from' }, `Read from ${hostOf(result.endpoint || '')} on ${chain.label}. `, h('a', { href: linkFor(chain.explorer.address, address), target: '_blank', rel: 'noopener noreferrer' }, `View on ${chain.explorer.name}`, h('span', { class: 'sr-only' }, ' (opens in new tab)')));
    const notSafe = h('p', { class: 'not-safe' }, trusted(icon('shield')), h('span', {}, scanCatalog.notSafe));
    if (result.type === 'token') return [notSafe, where, tokenResult(chain, address, result.facts)];
    if (result.type === 'wallet' || result.type === 'program') return [notSafe, where, walletResult(chain, address, result.balance, result.note, result.type === 'program' ? 'Program' : 'Wallet')];
    const text = result.type === 'contract' ? 'This is a contract, but it did not answer the standard token reads. It may not be a token.'
      : 'This is a token holding account, not a token mint. Scan the token’s mint address instead.';
    return [notSafe, where, h('div', { class: 'scan-result' }, h('h2', { id: 'result-heading', tabindex: '-1' }, result.type === 'contract' ? 'Contract' : 'Token account'), h('p', {}, text))];
  }

  /** @param {URLSearchParams} params */
  function renderScan(params) {
    document.title = 'Scan an address | nuntio';
    const initialChain = chainCatalog.chains.find(({ id }) => id === params.get('chain')) || chainCatalog.chains[0];
    const initialAddress = (params.get('address') || '').slice(0, 64);
    app.innerHTML = `<div class="wrap scan"><div class="scan-heading"><h1 id="page-title" tabindex="-1">Scan any address.</h1><p>Read a token or wallet straight from the chain, then copy a research prompt for your agent.</p></div>
      <form id="scan-form" class="scan-form" novalidate><div class="field scan-chain"><label for="scan-chain">Chain</label><select id="scan-chain" name="chain">${chainCatalog.chains.map((chain) => `<option value="${esc(chain.id)}"${chain.id === initialChain.id ? ' selected' : ''}>${esc(chain.label)}</option>`).join('')}</select></div>
      <div class="field scan-address"><label for="scan-address">Address</label><input type="text" id="scan-address" name="address" maxlength="64" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text" aria-describedby="scan-hint scan-error" value="${esc(initialAddress)}"><p class="field-hint" id="scan-hint"></p><p class="field-error" id="scan-error" hidden></p></div>
      <button class="button primary scan-submit" type="submit" id="scan-submit">${icon('search')} Scan address</button></form>
      <p class="small muted scan-privacy">Public chain data only. No wallet connects and nothing is signed.</p>
      <div id="scan-output" class="scan-output"></div>
      <div class="manual-copy" id="copy-fallback" hidden><p>Automatic copying is unavailable. Select the text below and copy it manually.</p><label for="manual-copy">Text to copy</label><textarea id="manual-copy" rows="8" readonly></textarea></div></div>`;
    const form = /** @type {HTMLFormElement} */ (document.querySelector('#scan-form'));
    const select = /** @type {HTMLSelectElement} */ (document.querySelector('#scan-chain'));
    const input = /** @type {HTMLInputElement} */ (document.querySelector('#scan-address'));
    const hint = /** @type {HTMLElement} */ (document.querySelector('#scan-hint'));
    const error = /** @type {HTMLElement} */ (document.querySelector('#scan-error'));
    const submit = /** @type {HTMLButtonElement} */ (document.querySelector('#scan-submit'));
    const output = /** @type {HTMLElement} */ (document.querySelector('#scan-output'));
    const chain = () => chainCatalog.chains.find(({ id }) => id === select.value) || chainCatalog.chains[0];
    function updateHint() {
      const current = chain();
      hint.textContent = current.kind === 'evm' ? `A 0x address on ${current.label}, 42 characters.` : 'A Solana address, 32 to 44 letters and numbers.';
      input.placeholder = current.kind === 'evm' ? '0x…' : 'e.g. So11111111111111111111111111111111111111112';
    }
    function clearError() { error.hidden = true; error.textContent = ''; input.removeAttribute('aria-invalid'); }
    function invalidateScan() {
      scanToken++;
      clearError();
      output.replaceChildren();
      submit.disabled = false;
      submit.replaceChildren(trusted(icon('search')), ' Scan address');
    }
    select.addEventListener('change', () => { updateHint(); invalidateScan(); });
    input.addEventListener('input', invalidateScan);
    updateHint();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const current = chain();
      const checked = validateAddress(current.kind, input.value);
      if (!checked.ok) {
        invalidateScan();
        error.textContent = checked.error; error.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus();
        output.replaceChildren();
        announce(checked.error);
        return;
      }
      clearError();
      history.replaceState(null, '', scanHash('/scan', { chain: current.id, address: checked.address }));
      const token = ++scanToken;
      submit.disabled = true;
      submit.replaceChildren(trusted(icon('clock')), ' Reading the chain');
      output.replaceChildren(h('p', { class: 'muted scan-loading' }, `Reading ${current.label}. Results appear only when every read is complete.`));
      announce(`Reading ${current.label}.`);
      try {
        const result = await scanAddress(current, checked.address);
        if (token !== scanToken || !output.isConnected) return;
        output.replaceChildren(...resultView(current, checked.address, result));
        announce(`${result.type === 'token' ? 'Token' : result.type === 'wallet' ? 'Wallet' : 'Address'} result ready.`);
        /** @type {HTMLElement | null} */ (output.querySelector('#result-heading'))?.focus();
      } catch {
        if (token !== scanToken || !output.isConnected) return;
        const retry = h('button', { class: 'button secondary', type: 'submit', form: 'scan-form' }, 'Try again');
        output.replaceChildren(h('div', { class: 'scan-error', role: 'alert' }, trusted(icon('warning')), h('div', {}, h('p', {}, `${scanCatalog.readError}.`), h('p', { class: 'small muted' }, `The main and fallback ${current.label} endpoints did not answer. No partial result is shown.`), retry)));
      } finally {
        if (token === scanToken && submit.isConnected) { submit.disabled = false; submit.replaceChildren(trusted(icon('search')), ' Scan address'); }
      }
    });
  }

  /** @param {URLSearchParams} params @returns {boolean} */
  function renderSaved(params) {
    const chain = chainCatalog.chains.find(({ id }) => id === params.get('chain'));
    if (!chain) return false;
    const checked = validateAddress(chain.kind, params.get('address') || '');
    const balance = (params.get('balance') || '').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 60);
    if (!checked.ok || !/^(less than )?[\d,.]+ [A-Z]{2,5}$/.test(balance)) return false;
    document.title = 'Trader profile playbook | nuntio';
    app.innerHTML = `<div class="wrap scan saved-playbook"><a class="back-link" href="${esc(scanHash('/scan', { chain: chain.id, address: checked.address }))}">${icon('back')} Scan again</a><div class="scan-heading"><h1 id="page-title" tabindex="-1">Trader profile playbook</h1><p>Saved in this link. Copy the prompt into your own agent.</p></div><div id="saved-facts"></div><div id="saved-profile"></div><div class="manual-copy" id="copy-fallback" hidden><p>Automatic copying is unavailable. Select the text below and copy it manually.</p><label for="manual-copy">Text to copy</label><textarea id="manual-copy" rows="8" readonly></textarea></div></div>`;
    /** @type {HTMLElement} */ (document.querySelector('#saved-facts')).replaceChildren(
      h('dl', { class: 'wallet-facts' }, h('div', {}, h('dt', {}, 'Chain'), h('dd', {}, chain.label)), h('div', {}, h('dt', {}, 'Address'), h('dd', { class: 'address-value' }, checked.address)), h('div', {}, h('dt', {}, 'Balance when saved'), h('dd', {}, balance))),
      h('p', { class: 'not-safe' }, trusted(icon('shield')), h('span', {}, scanCatalog.notSafe)));
    /** @type {HTMLElement} */ (document.querySelector('#saved-profile')).replaceChildren(walletProfile(chain, checked.address, balance, true));
    return true;
  }

  return { renderScan, renderSaved };
}
