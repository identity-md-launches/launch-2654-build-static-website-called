import { METADATA_PROGRAM, SELECTORS, TOKEN_PROGRAMS, ZERO_ADDRESS, base58Decode, base64Bytes, decodeAddress, decodeString, decodeUint, findProgramAddress, formatUnits, parseMetadata } from './scan-model.js';

/** @typedef {import('./types').ChainConfig} ChainConfig */
/** @typedef {import('./types').ScanResult} ScanResult */

/** The endpoint could not answer. A contract revert is a different, valid answer. */
export class ReadError extends Error {}
const REVERTED = Symbol('reverted');

/** @param {string} url @param {string} method @param {unknown[]} params @param {typeof fetch} fetcher */
async function call(url, method, params, fetcher) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new ReadError(`HTTP ${response.status}`);
    const body = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.jsonrpc !== '2.0' || body.id !== 1 || Object.hasOwn(body, 'result') === Object.hasOwn(body, 'error')) throw new ReadError('Malformed RPC answer');
    if (Object.hasOwn(body, 'error')) {
      if (!body.error || typeof body.error.code !== 'number' || typeof body.error.message !== 'string') throw new ReadError('Malformed RPC error');
      const message = body.error.message;
      if (method === 'eth_call' && (body.error.code === 3 || /revert/i.test(message))) return REVERTED;
      throw new ReadError(message || 'RPC error');
    }
    return body.result;
  } catch (error) {
    if (error instanceof ReadError) throw error;
    throw new ReadError(String(error));
  } finally { clearTimeout(timer); }
}

/** @param {string} url @param {string} to @param {string} data @param {typeof fetch} fetcher */
async function ethCall(url, to, data, fetcher) {
  const result = await call(url, 'eth_call', [{ to, data }, 'latest'], fetcher);
  if (result === REVERTED || result === '0x') return null;
  if (typeof result !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(result)) throw new ReadError('Malformed eth_call answer');
  return result;
}

/** Only an empty return or revert means unavailable; a failed decoder means the read failed.
 * @template T @param {string | null} payload @param {(hex: string) => T | null} decode @returns {T | null} */
function decodeField(payload, decode) {
  if (payload === null) return null;
  const value = decode(payload);
  if (value === null) throw new ReadError('Invalid ABI answer');
  return value;
}

/** @param {ChainConfig} chain @param {string} url @param {string} address @param {typeof fetch} fetcher @returns {Promise<ScanResult>} */
async function scanEvm(chain, url, address, fetcher) {
  const code = await call(url, 'eth_getCode', [address, 'latest'], fetcher);
  if (typeof code !== 'string' || (code !== '0x0' && !/^0x(?:[0-9a-fA-F]{2})*$/.test(code))) throw new ReadError('Bad getCode answer');
  if (code === '0x' || code === '0x0') {
    const balance = await call(url, 'eth_getBalance', [address, 'latest'], fetcher);
    if (typeof balance !== 'string' || !/^0x[0-9a-f]+$/i.test(balance)) throw new ReadError('Bad balance answer');
    return { type: 'wallet', balance: `${formatUnits(BigInt(balance), chain.nativeDecimals)} ${chain.nativeSymbol}` };
  }
  const [name, symbol, decimals, supply, owner] = await Promise.all(['name', 'symbol', 'decimals', 'totalSupply', 'owner'].map((key) => ethCall(url, address, SELECTORS[/** @type {keyof typeof SELECTORS} */ (key)], fetcher)));
  const nameValue = decodeField(name, decodeString);
  const symbolValue = decodeField(symbol, decodeString);
  const decimalValue = decodeField(decimals, decodeUint);
  const supplyValue = decodeField(supply, decodeUint);
  const ownerAddress = decodeField(owner, decodeAddress);
  if (decimalValue !== null && decimalValue > 255n) throw new ReadError('Invalid decimals answer');
  if (supplyValue === null || decimalValue === null) return { type: 'contract' };
  /** @type {import('./types').ScanFact[]} */
  const facts = [
    { label: 'Name', value: nameValue || 'Not provided by the contract' },
    { label: 'Symbol', value: symbolValue || 'Not provided by the contract' },
    { label: 'Decimals', value: decimalValue.toString() },
    { label: 'Supply', value: formatUnits(supplyValue, Number(decimalValue), 4) },
  ];
  /** @type {import('./types').ScanFlag[]} */
  const flags = [];
  if (ownerAddress === null) facts.push({ label: 'Owner', value: 'No owner() answer from the contract' });
  else if (ownerAddress === ZERO_ADDRESS) facts.push({ label: 'Owner', value: 'Renounced (zero address)' });
  else { facts.push({ label: 'Owner', value: ownerAddress, flag: true }); flags.push({ label: 'Owner', text: 'An owner is set. Check what the owner can still change.' }); }
  return { type: 'token', facts, flags };
}

/** @param {Uint8Array} data */
async function sha256(data) { return new Uint8Array(await crypto.subtle.digest('SHA-256', /** @type {BufferSource} */ (data))); }

/** @param {ChainConfig} chain @param {string} url @param {string} address @param {typeof fetch} fetcher @returns {Promise<ScanResult>} */
async function scanSolana(chain, url, address, fetcher) {
  const answer = await call(url, 'getAccountInfo', [address, { encoding: 'jsonParsed', commitment: 'confirmed' }], fetcher);
  if (!answer || typeof answer !== 'object' || !('value' in answer)) throw new ReadError('Bad account answer');
  const account = answer.value;
  if (account === null) return { type: 'wallet', balance: `0 ${chain.nativeSymbol}`, note: 'No account exists at this address yet.' };
  const lamports = BigInt(account.lamports ?? 0);
  const parsed = account.data && typeof account.data === 'object' && !Array.isArray(account.data) ? account.data.parsed : null;
  if (TOKEN_PROGRAMS.includes(account.owner)) {
    if (!parsed || parsed.type !== 'mint') return { type: 'token-account' };
    const info = parsed.info || {};
    const decimals = Number(info.decimals);
    if (!Number.isInteger(decimals) || typeof info.supply !== 'string' || !/^\d+$/.test(info.supply)) throw new ReadError('Bad mint answer');
    let name = '';
    let symbol = '';
    const extension = Array.isArray(info.extensions) ? info.extensions
      .find((/** @type {any} */ item) => item && item.extension === 'tokenMetadata') : null;
    if (extension && extension.state) { name = String(extension.state.name || ''); symbol = String(extension.state.symbol || ''); }
    if (!name && !symbol) {
      const program = /** @type {Uint8Array} */ (base58Decode(METADATA_PROGRAM));
      const pda = await findProgramAddress([new TextEncoder().encode('metadata'), program, /** @type {Uint8Array} */ (base58Decode(address))], program, sha256);
      const metadata = await call(url, 'getAccountInfo', [pda, { encoding: 'base64', commitment: 'confirmed' }], fetcher);
      if (!metadata || typeof metadata !== 'object' || !('value' in metadata)) throw new ReadError('Bad metadata answer');
      if (metadata.value && Array.isArray(metadata.value.data) && metadata.value.owner === METADATA_PROGRAM) {
        const parsedMetadata = parseMetadata(base64Bytes(String(metadata.value.data[0])));
        if (parsedMetadata) ({ name, symbol } = parsedMetadata);
      }
    }
    /** @type {import('./types').ScanFlag[]} */
    const flags = [];
    /** @param {string} label @param {unknown} value */
    const authority = (label, value) => {
      if (value === null) return { label, value: 'None' };
      if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value) || base58Decode(value)?.length !== 32) throw new ReadError(`Bad ${label} answer`);
      flags.push({ label, text: `${label} is set. That address can still use this power.` });
      return { label, value, flag: true };
    };
    const facts = [
      { label: 'Name', value: name.trim() || 'Not found on-chain' },
      { label: 'Symbol', value: symbol.trim() || 'Not found on-chain' },
      { label: 'Decimals', value: String(decimals) },
      { label: 'Supply', value: formatUnits(BigInt(info.supply), decimals, 4) },
      authority('Mint authority', info.mintAuthority),
      authority('Freeze authority', info.freezeAuthority),
    ];
    return { type: 'token', facts, flags };
  }
  if (account.executable) return { type: 'program', balance: `${formatUnits(lamports, chain.nativeDecimals)} ${chain.nativeSymbol}`, note: 'This is an executable Solana program. The balance belongs to the program address.' };
  return { type: 'wallet', balance: `${formatUnits(lamports, chain.nativeDecimals)} ${chain.nativeSymbol}` };
}

/** Read the whole result from one endpoint. If any read fails, start again on the fallback,
 * so a result is never stitched together from two sources or shown half complete.
 * @param {ChainConfig} chain @param {string} address @param {typeof fetch} [fetcher] */
export async function scanAddress(chain, address, fetcher = fetch.bind(globalThis)) {
  let lastError = new ReadError('No endpoint');
  for (const url of chain.rpc.slice(0, 2)) {
    try {
      const result = chain.kind === 'evm' ? await scanEvm(chain, url, address, fetcher) : await scanSolana(chain, url, address, fetcher);
      return { ...result, endpoint: url };
    } catch (error) {
      lastError = error instanceof ReadError ? error : new ReadError(String(error));
    }
  }
  throw lastError;
}
