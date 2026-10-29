/** Literal, single-pass substitution. No commands or provider requests run here.
 * @param {string} template
 * @param {import('./types').SetupGuide['prompt']} values
 */
export function createGuidePrompt(template, values) {
  return template.replace(/\{([a-z_]+)\}/g, (_, key) => {
    const value = /** @type {Record<string, string>} */ (values)[key];
    if (!Object.hasOwn(values, key) || !value.trim()) throw new Error(`Missing guide value: ${key}`);
    return value;
  });
}

/** @param {string} iso */
export function guideDate(iso) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}
