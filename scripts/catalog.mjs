import assert from 'node:assert/strict';

/** Fail the build on an incomplete data-only extension. */
export function validateCatalog(catalog) {
  assert.equal(catalog.version, 1, 'Unsupported catalog version');
  assert.ok(catalog.agents.length && catalog.playbooks.length, 'Add assistants and playbooks');
  for (const key of ['experiences', 'frequencies']) {
    assert.ok(catalog[key].length, `${key} must not be empty`);
    assert.equal(new Set(catalog[key].map((option) => option.value)).size, catalog[key].length, `Duplicate ${key}`);
    for (const option of catalog[key]) assert.ok(option.value && option.label);
  }
  const agents = new Set();
  for (const agent of catalog.agents) {
    assert.match(agent.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(!agents.has(agent.id), 'Duplicate assistant');
    agents.add(agent.id);
    assert.ok(agent.name && agent.channels.length && agent.setupSteps.length && agent.capabilities.length);
    for (const key of ['docsUrl', 'setupUrl', 'routinesUrl', 'appsUrl']) assert.equal(new URL(agent[key]).protocol, 'https:');
    for (const capability of agent.capabilities) assert.equal(new URL(capability.url).protocol, 'https:');
  }
  assert.ok(agents.has(catalog.defaultAgentId), 'Unknown default assistant');
  const ids = new Set();
  for (const playbook of catalog.playbooks) {
    assert.match(playbook.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(!ids.has(playbook.id), 'Duplicate playbook');
    ids.add(playbook.id);
    assert.ok(agents.has(playbook.agentId), 'Unknown assistant');
    assert.ok(playbook.title && playbook.description && playbook.category && playbook.icon && playbook.deliverables.length);
    assert.ok(playbook.keywords.length && playbook.schedule && playbook.guardrails);
    assert.ok(catalog.frequencies.some((option) => option.value === playbook.defaultFrequency));
    const fields = new Set(['experience', 'frequency', 'channel']);
    for (const question of playbook.questions) {
      assert.match(question.key, /^[a-z]+$/);
      assert.ok(!fields.has(question.key), 'Duplicate question');
      fields.add(question.key);
      assert.ok(question.label && question.placeholder && question.hint);
      assert.ok(Number.isInteger(question.maxLength) && question.maxLength > 0 && question.maxLength <= 500);
    }
    const placeholders = [...playbook.prompt.matchAll(/\{([a-z]+)\}/g)].map((match) => match[1]);
    assert.deepEqual(new Set(placeholders), fields, `Questions and template placeholders differ: ${playbook.id}`);
    assert.ok(playbook.checklistSeparator === null || typeof playbook.checklistSeparator === 'string');
    if (playbook.riskWarning) assert.ok(playbook.riskWarning.includes('Not financial advice.'));
  }
}
