import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

// Inputs/tool scratch are not submission content. Never traverse repository metadata or configuration.
const excluded = new Set(['.git', '.github', '.imd', '.agents', '.codex']);
const forbidden = new Set(['node_modules', '.npm', '.cache', '.parcel-cache', '.vite', '.playwright-mcp']);
const files = [];
async function walk(directory = '.') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name === '.env' || entry.name.startsWith('.env.')) continue;
    const path = join(directory, entry.name);
    if (path === join('test', 'scratch')) continue;
    assert.ok(!forbidden.has(entry.name), `Generated/cache directory must not be submitted: ${path}`);
    assert.ok(!entry.isSymbolicLink(), `No symlinks or submodules in the export: ${path}`);
    if (entry.isDirectory()) await walk(path);
    else {
      assert.ok(!/\.(tgz|tar|zip)$/.test(entry.name), `Unnecessary archive: ${path}`);
      const bytes = (await readFile(path)).length;
      files.push({ path: relative('.', path), bytes });
    }
  }
}
await walk();
const total = files.reduce((sum, file) => sum + file.bytes, 0);
const exported = files.filter(({ path }) => path.startsWith('dist/'));
assert.ok(total <= 8388608, `${total} bytes exceeds the 8 MiB submission budget`);
assert.ok(exported.some(({ path }) => path === 'dist/index.html'));
assert.ok(files.some(({ path }) => path === 'package-lock.json'));
console.log(JSON.stringify({ files: files.length, totalBytes: total, budgetBytes: 8388608, exportFiles: exported.length, exportBytes: exported.reduce((sum, file) => sum + file.bytes, 0), exported }, null, 2));
