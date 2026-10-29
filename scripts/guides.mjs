import assert from 'node:assert/strict';
import { createGuidePrompt } from '../src/guide-model.js';

export function validateGuides(catalog) {
  assert.equal(catalog.version, 1, 'Unsupported guide catalog version');
  assert.equal(new URL(catalog.reportUrl).protocol, 'https:');
  assert.ok(catalog.banner && catalog.safetyRules.length && catalog.guides.length);
  const keys = ['provider', 'install', 'node', 'human_steps', 'signin', 'verify'];
  assert.deepEqual(new Set([...catalog.promptTemplate.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1])), new Set(keys));
  const ids = new Set();
  for (const guide of catalog.guides) {
    assert.match(guide.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(!ids.has(guide.id), 'Duplicate guide ID');
    ids.add(guide.id);
    assert.ok(guide.title && guide.description && guide.note && guide.beforeYouStart.length && guide.staySafe.length);
    assert.equal(new URL(guide.sourceUrl).protocol, 'https:');
    assert.match(guide.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(guide.verifiedAt)), 'Invalid guide date');
    assert.equal(guide.prompt.provider, guide.title);
    assert.match(guide.prompt.node, /^\d+$/);
    assert.match(guide.prompt.install, /^npx skills add [a-z0-9/-]+$/);
    for (const key of keys) assert.ok(typeof guide.prompt[key] === 'string' && guide.prompt[key].trim(), `Missing ${key}`);
    assert.ok(!/\{[a-z_]+\}/.test(createGuidePrompt(catalog.promptTemplate, guide.prompt)), 'Unfilled guide prompt');
    assert.ok(guide.steps.length);
    for (const step of guide.steps) {
      assert.ok(['you', 'agent'].includes(step.actor) && step.text);
      assert.ok(Array.isArray(step.commands) && step.commands.every((command) => typeof command === 'string' && command.trim()));
    }
  }
}
