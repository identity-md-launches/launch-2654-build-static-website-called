import { mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateCatalog } from './catalog.mjs';

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const project = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(await readFile(resolve(project, 'src/data/playbooks.json'), 'utf8'));
validateCatalog(catalog);
const dist = resolve(project, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'assets'), { recursive: true });
for (const asset of ['favicon.svg', 'social.png']) await cp(resolve(project, 'public', asset), resolve(dist, 'assets', asset));
await build({ entryPoints: [resolve(project, 'src/app.js')], outfile: resolve(dist, 'assets/app.js'), bundle: true, minify: true, format: 'esm', target: ['es2022'], legalComments: 'none' });
await build({ entryPoints: [resolve(project, 'src/styles.css')], outfile: resolve(dist, 'assets/styles.css'), minify: true, target: ['safari16.4', 'chrome110'], legalComments: 'none' });

const escape = (text) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const homeTitle = 'Nuntio — Tell your bot what to do.';
const homeDescription = 'A playbook generator for Grok Bot. Choose a goal, answer a few questions, and copy your setup prompt, recommended schedule, and guardrails.';
function page(playbook) {
  const base = playbook ? '../../' : './';
  const title = playbook ? `${playbook.title} | Nuntio` : homeTitle;
  const description = playbook ? `${playbook.description} Build a ${playbook.title.toLowerCase()} playbook for ${catalog.agents.find((agent) => agent.id === playbook.agentId).name} with Nuntio.` : homeDescription;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#111310">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="icon" type="image/svg+xml" href="${base}assets/favicon.svg">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Nuntio">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:image" content="${base}assets/social.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Nuntio. Tell your bot what to do. Playbooks for a clearer starting point.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="${base}assets/social.png">
  <meta name="twitter:image:alt" content="Nuntio. Tell your bot what to do.">
  <link rel="stylesheet" href="${base}assets/styles.css">
  <script type="module" src="${base}assets/app.js"></script>
</head>
<body data-root="${base}" data-playbook="${playbook ? escape(playbook.id) : ''}">
  <a class="skip-link" id="skip-link" href="#app">Skip to content</a>
  <header class="site-header" id="site-header"></header>
  <main id="app" tabindex="-1"><noscript><div class="noscript"><h1>${escape(playbook ? playbook.title : 'Nuntio')}</h1><p>Tell your bot what to do. Enable JavaScript to personalize a playbook in your browser. No account or API key is needed here.</p>${playbook ? `<h2>Prompt template</h2><p>${escape(playbook.prompt)}</p><h2>Recommended schedule</h2><p>${escape(playbook.schedule)}</p><h2>Guardrails</h2><p>${escape(playbook.guardrails)}</p>${playbook.riskWarning ? `<p>${escape(playbook.riskWarning)}</p>` : ''}` : `<ul>${catalog.playbooks.map((item) => `<li><a href="./playbooks/${item.id}/index.html">${escape(item.title)}</a></li>`).join('')}</ul>`}</div></noscript></main>
  <footer class="site-footer" id="site-footer"></footer>
  <div id="status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
</body>
</html>
`;
}
await writeFile(resolve(dist, 'index.html'), page());
for (const playbook of catalog.playbooks) {
  const folder = resolve(dist, 'playbooks', playbook.id);
  await mkdir(folder, { recursive: true });
  await writeFile(resolve(folder, 'index.html'), page(playbook));
}
console.log(`Built dist/index.html, ${catalog.playbooks.length} static playbook pages, and local assets.`);
