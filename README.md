# Nuntio

**Tell your bot what to do.**

A small, static playbook generator for beginners using Grok Bot, with setup guides for Binance, Coinbase and OKX Agentic Wallets. Choose a goal and customize a playbook, or copy one guide prompt to work through setup with your own agent. Each wallet guide also has a numbered checklist. Nothing runs or connects to an assistant or wallet from this site.

The complete production site is in [`dist/`](dist/). Source is in [`src/`](src/); playbooks and assistant configuration live in [`src/data/playbooks.json`](src/data/playbooks.json), and setup guides live in [`src/data/guides.json`](src/data/guides.json). There are no external runtime dependencies, API calls, keys, cookies, analytics, wallet connectors, or database. The export is prepared for the existing Nuntio project with the requested publication label **nuntio**; publication is handled after submission.

## Install, build, and preview

Requires Node.js 22 or later and npm. Tooling is installed outside the repository so dependency and cache directories cannot enter the submission. No ignore file was added or changed.

```sh
mkdir -p /tmp/nuntio-tools
cp package.json package-lock.json /tmp/nuntio-tools/
npm ci --prefix /tmp/nuntio-tools --cache /tmp/nuntio-npm-cache
export PATH="/tmp/nuntio-tools/node_modules/.bin:$PATH"
export NODE_PATH="/tmp/nuntio-tools/node_modules"

npm run typecheck
npm test
npm run build
npm run preview
```

Preview opens a local static server at `http://localhost:4173`; visit that address in a browser. Stop with Ctrl+C. To use another port, run `npm run preview -- 4174`. This preview utility is development tooling, not a production server. Opening an ES-module website directly with `file://` is not supported; use HTTP or an IPFS gateway.

For ordinary local development outside the submission environment, `npm ci` in the repository also works; never include the resulting `node_modules/` or caches in a commit or upload.

`npm run build` validates both JSON catalogs, bundles the vanilla JavaScript and CSS with esbuild, copies the favicon and social PNG, and generates the home page, three playbook pages and three setup guide pages. The build does not fetch data or require a browser. It replaces `dist/`; rebuild after source or JSON edits. Keep the complete `dist/` directory in the submitted repository alongside the source, manifest, and lockfile. The existing package manifest, lockfile and dependencies are unchanged by this update.

## Static routes and sharing

| Page | Exported path | Hash route |
| --- | --- | --- |
| Home | `dist/index.html` | `#/` |
| How it works and privacy | `dist/index.html` | `#/guide` |
| Setup guide library | `dist/index.html` | `#/guides` |
| Roadmap | `dist/index.html` | `#/roadmap` |
| Binance Agentic Wallet | `dist/guides/binance-agentic-wallet/index.html` | No hash required |
| Coinbase Agentic Wallet | `dist/guides/coinbase-agentic-wallet/index.html` | No hash required |
| OKX Agentic Wallet | `dist/guides/okx-agentic-wallet/index.html` | No hash required |
| Meme coin research digest | `dist/playbooks/meme-coin-research-digest/index.html` | `#/configure` or `#/output` |
| Content and reply drafts | `dist/playbooks/content-and-reply-drafts/index.html` | `#/configure` or `#/output` |
| Job hunt radar | `dist/playbooks/job-hunt-radar/index.html` | `#/configure` or `#/output` |

Forms serialize their answers after the hash, for example `#/configure?experience=beginner&frequency=weekday&channel=Grok+Bot+chat&role=Designer&location=Remote`. Generation changes the hash to `/output`; edit, reload, and browser back retain the answers. **Copy share link** includes the actual gateway prefix, the playbook’s static filename, and the configured hash. It never invents a hostname or content ID.

The fragment is not sent in an HTTP request, but it is readable by anyone with the link and can remain in browser history. Avoid private information. Nuntio stores nothing in local storage or cookies. Review checkboxes are intentionally temporary and are not included in shared links.

All asset paths are relative (`./assets/` or `../../assets/`). There are no route rewrites, root-relative assets, CDNs, or external fonts. Every static playbook and setup guide page contains its own title, description, Open Graph and X/Twitter tags, and a no-JavaScript text fallback. The locally bundled 1200 × 630 social image works without JavaScript. Preview tags describe the page; crawlers cannot see hash answers. An unknown hash shows a recovery link; an incomplete or malformed playbook output link returns to the form with a notice. Setup guides also support `#/guides/<id>` from the home document.

## Add a setup guide

1. Copy an entry in `guides` in [`src/data/guides.json`](src/data/guides.json). Give it a unique lowercase, hyphenated `id`; the build uses that ID as its static folder name.
2. Set `title`, `description`, `note`, `risk`, `verifiedAt` (ISO date), and the HTTPS `sourceUrl`. Use only documented provider claims. Do not invent a risk rating: the Binance entry uses `null` because the assignment did not supply one; Coinbase and OKX use `medium`.
3. List the prerequisites in `beforeYouStart`. Add numbered `steps` in order, with `actor: "you"` or `actor: "agent"`, plain `text`, and a `commands` array (empty when no command is needed). Actors render as “You do this” and “Your agent does this.” Commands are selectable text, never executed. Angle-bracket arguments in the Coinbase checklist describe values from the visitor’s own login flow; the site does not collect them.
4. Add provider-specific `staySafe` rules. The shared `banner`, `safetyRules`, and `reportUrl` apply to every guide. Keep the VPN, unofficial-source, unknown-Telegram-bot, secret-protection and approval rules.
5. Fill the guide’s `prompt` object with all six strings: `provider`, `install`, `node`, `human_steps`, `signin`, and `verify`. The `provider` must match `title`.
6. Keep `promptTemplate` as the requested shared template. [`src/guide-model.js`](src/guide-model.js) substitutes the values literally in one pass, including the underscore in `{human_steps}`. Agent mode is the default on every visit; it shows one complete prompt and one copy button. Clipboard denial opens a selectable manual-copy field. “Do it yourself” reveals the checklist. Checks survive switching modes and reset when the page is left or reloaded.
7. Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run validate` with the tooling above. Run `node scripts/review.mjs` for the guide first-screen, contrast and roadmap checks. Cards, static guide HTML, source/report links, dates and both modes are generated from the catalog; no route or render changes are needed for another guide. Extend the acceptance fixtures when intentionally extending the catalog.

The build rejects incomplete catalogs, duplicate IDs, missing prompt values, missing steps and unknown step actors. Never store account emails, codes, funds, addresses or secrets in this JSON. A guide is an instruction for a visitor’s own agent; it is not a wallet integration. No wallet CLI or provider skill is installed by the website or its build.

Official sources linked by the guides, checked on 29 Oct 2026:

- [Binance Skills Hub](https://www.binance.com/en/skills/detail/binance-web3/binance-agentic-wallet).
- [Coinbase quickstart](https://docs.cdp.coinbase.com/agentic-wallet/quickstart) (currently redirects to its CLI quickstart).
- [OKX installation guide](https://web3.okx.com/onchainos/dev-docs/home/install-your-agentic-wallet).

Provider text and commands follow the assignment. The current OKX page recommends a different installer; this delivery retains the assignment’s explicit `npx skills add okx/onchainos-skills` command rather than broadening installation. No live account setup was performed. Each card says “Last verified 29 Oct 2026” as requested; this does not certify a provider’s future availability.

## Add a playbook

1. Copy an object in `playbooks` in `src/data/playbooks.json`.
2. Give it a unique lowercase, hyphenated `id`, a `title`, short `description`, `category`, and an existing `agentId`. The ID becomes the exported folder name.
3. Add `keywords`. Matching is case-insensitive, normalizes accents and punctuation, and matches complete words or phrases. A matched phrase scores its word count; results are sorted by total score with catalog order breaking ties. The top three positive matches are shown. No match means an honest empty state with a clear-all action, not an invented playbook.
4. Set `deliverables`, `icon`, and `defaultFrequency`. The existing icons are `radar`, `pen`, `briefcase`, `shield`, and `clock`; an unknown name uses `radar`. The default frequency must occur in the catalog’s `frequencies` choices.
5. Define additional text `questions`, each with a lowercase alphabetic `key`, visible `label`, example `placeholder`, `hint`, and integer `maxLength` from 1 to 500. The three standard keys are `experience`, `frequency`, and `channel`; do not duplicate them.
6. Write a `prompt` with `{experience}`, `{frequency}`, `{channel}`, and the question keys as placeholders. Every question must have a matching placeholder, and every placeholder must have a question. Repeated placeholders are allowed. Substitution is literal and single-pass; answers cannot execute HTML or recursively expand other placeholders.
7. Set `schedule` and `guardrails`. Use `checklistSeparator: ", "` only if commas separate distinct checklist items, otherwise `null` for a single item. Copying always preserves the original guardrails string, including punctuation.
8. Set `riskWarning` to `null` for unrelated topics, or to an appropriate plain warning ending in `Not financial advice.` for financial research. Warnings are displayed and appended, after a blank line, to **each** copied research block. The supplied template and guardrails bodies remain unchanged.
9. Run the typecheck, build, tests, and interaction validation. The new card, form, output, and static metadata page are generated automatically.

The original three prompt texts, schedules, and guardrails are preserved verbatim. Unit fixtures lock their content. When deliberately adding a fourth playbook, update the test’s catalog count and add appropriate tests without changing the original three content fixtures. UI descriptions and help text are separate from those fixed templates.

The chosen frequency fills `{frequency}`. The supplied recommended schedule stays verbatim. If they differ, the output explicitly asks the user to reconcile the cadence in Grok Bot; the recommendation is not silently rewritten.

## Add another assistant

Add an object to `agents` in the same JSON file, with a unique `id`, `name`, verified documentation URLs, `verifiedAt`, `channels`, `setupSteps`, and `capabilities`. Point a new playbook’s `agentId` at it. Forms and the output handoff use that assistant’s configuration. The generator and URL model do not import an assistant SDK or require a provider-specific backend. `defaultAgentId` selects the assistant described in the general guide. The current home prompt and branded social artwork deliberately use the requested Grok Bot wording.

## What was verified about Grok Bot

Official xAI documentation was checked on **2026-10-29**. The UI links to those sources rather than promising an integration:

- Bot creation and setup in a conversation: [Get started](https://docs.x.ai/grok-bot/get-started).
- Scheduled routines, testing, and time-zone confirmation: [Skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations).
- Public X research, connected apps, Slack permissions, and email limits: [Use the computer and apps](https://docs.x.ai/grok-bot/computer-and-apps).

Grok Bot chat is the default delivery choice. Email and Slack are requests to configure inside Grok Bot, not connections made by Nuntio. In particular, emails from the Bot’s own address during a routine wait as drafts for a person to send. Availability, account access, app permissions, and usage limits can change. The generated instructions are not a technical enforcement boundary.

## Deliberately left out

Static hosting provides no assistant execution, live X or web search, email/Slack delivery, schedule creation, background jobs, account authentication, shared database, cloud saves, private links, URL shortening, or dynamic social cards containing answers. Nuntio can generate a prompt after its page has loaded offline, but it does not install an offline cache or service worker for uncached page loads.

Wallet connections, signing, trade execution, custody, automated posts/replies, job applications, and unsolicited outreach are excluded by product scope, independently of hosting. Nothing in the site suggests those actions have been performed. Copying works through the Clipboard API, then a native selection fallback; if both are denied, a focused textarea allows manual copying.

Publication is handled by the contributor platform after submission, under the requested **nuntio** label. No publishing command was run and no new hostname is invented. Social unfurling on the eventual gateway was not tested; some crawlers may require an absolute image URL after a stable address is known.

No requested guide feature was left out. The provided checkout contained the three playbooks and How it works, but no Binance guide, section tabs, roadmap or guides catalog. This update adds those surfaces while keeping all existing playbook data, forms, outputs and links. No earlier roadmap text was supplied, so the roadmap lists available functionality without inventing future providers or release dates.

## Validation

To run the browser checks with the external tooling above:

```sh
export PLAYWRIGHT_BROWSERS_PATH=/tmp/nuntio-browsers
playwright install chromium webkit
npm run validate
node scripts/review.mjs
```

The validation command manages its own temporary static server under an IPFS-like subpath, runs the real production export, and writes disposable evidence to `test/scratch/validation/`. It closes the server and browser when finished. WebKit launch failures are reported as limitations, not passing tests. To regenerate the social image after editing its SVG, run `node scripts/social.mjs`, then rebuild.

Actual results from this run:

| Check | Result |
| --- | --- |
| `npm run build` | Passed; home + 3 static playbook pages + 3 static setup guides and 4 local assets |
| `npm run typecheck` | Passed; strict TypeScript checking of the JavaScript and data types |
| `npm test` | 21 passed, 0 failed, including independent fixtures for the exact template and provider prompt values |
| `npm run validate` | 16 Chromium flow groups passed; 71 reflow measurements; no captured console errors, failed assets or external requests |
| Automated accessibility | 16 axe scans, 0 reported violations |
| Responsive reflow | 320, 390, 768, 1024, 1440 widths; 200% text sizing on home, every form/output and both modes of every setup guide |
| `node scripts/review.mjs` | Guide copy actions fit the 390 × 844 first screen; measured guide contrast and roadmap reflow pass |
| Pinned `taste@1` | 16/16 passed, including the 390-wide first screen |
| WebKit | Unperformed: browser launch reported missing host libraries |

The pinned probe was run as:

```sh
IMD_PLAYWRIGHT=/tmp/nuntio-tools/node_modules/playwright/index.mjs \
  node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste --offline
```

The `.imd/reads/` inputs are removed before delivery; the recorded probe results remain in [`docs/taste-checks.json`](docs/taste-checks.json). Source-based tests and `npm run validate` remain reproducible without those inputs. After removing temporary tool output, `node scripts/check-export.mjs` checks the complete deliverable against the **8 MiB** budget and rejects dependency/cache directories and archives at every nesting level.

See [`docs/validation.md`](docs/validation.md) for the six-domain review, fixes, evidence, and unperformed checks, and [`DESIGN.md`](DESIGN.md) for the implemented design system. These are worker-run checks, not independent certification. No screen-reader session, physical-device test, native browser zoom, live assistant execution, or live X crawler test was performed.
