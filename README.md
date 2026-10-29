# Nuntio

**Tell your bot what to do.**

A small, static playbook generator for beginners using Grok Bot. Choose a goal, customize a playbook, then copy its setup prompt, recommended schedule, and guardrails. Nothing runs or connects to an assistant from this site.

The complete production site is in [`dist/`](dist/). Source is in [`src/`](src/); all playbooks and assistant configuration live in [`src/data/playbooks.json`](src/data/playbooks.json). There are no external runtime dependencies, API calls, keys, cookies, analytics, wallets, or database.

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

`npm run build` validates the JSON, bundles the vanilla JavaScript and CSS with esbuild, copies the favicon and social PNG, and generates the home page and one HTML page per playbook. The build does not fetch data or require a browser. It replaces `dist/`; rebuild after source or JSON edits. Keep the complete `dist/` directory in the submitted repository alongside the source, manifest, and lockfile.

## Static routes and sharing

| Page | Exported path | Hash route |
| --- | --- | --- |
| Home | `dist/index.html` | `#/` |
| How it works and privacy | `dist/index.html` | `#/guide` |
| Meme coin research digest | `dist/playbooks/meme-coin-research-digest/index.html` | `#/configure` or `#/output` |
| Content and reply drafts | `dist/playbooks/content-and-reply-drafts/index.html` | `#/configure` or `#/output` |
| Job hunt radar | `dist/playbooks/job-hunt-radar/index.html` | `#/configure` or `#/output` |

Forms serialize their answers after the hash, for example `#/configure?experience=beginner&frequency=weekday&channel=Grok+Bot+chat&role=Designer&location=Remote`. Generation changes the hash to `/output`; edit, reload, and browser back retain the answers. **Copy share link** includes the actual gateway prefix, the playbook’s static filename, and the configured hash. It never invents a hostname or content ID.

The fragment is not sent in an HTTP request, but it is readable by anyone with the link and can remain in browser history. Avoid private information. Nuntio stores nothing in local storage or cookies. Review checkboxes are intentionally temporary and are not included in shared links.

All asset paths are relative (`./assets/` or `../../assets/`). There are no route rewrites, root-relative assets, CDNs, or external fonts. Static playbook HTML contains distinct titles, descriptions, Open Graph and X/Twitter tags, and a no-JavaScript template fallback. The locally bundled 1200 × 630 social image works without JavaScript. Preview tags describe the playbook; crawlers cannot see hash answers. An unknown hash shows a recovery link; an incomplete or malformed output link returns to the form with a notice.

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

Publication is handled by the contributor platform after submission. No publishing command was run. The repository snapshot and finished export are provided here; a GitHub repository URL and `.imd.site` URL were not issued in this workspace. Those addresses cannot be filled in before the platform assigns them. Social unfurling on the eventual gateway was not tested; some crawlers may require an absolute image URL after a stable address is known.

## Validation

To run the browser checks with the external tooling above:

```sh
export PLAYWRIGHT_BROWSERS_PATH=/tmp/nuntio-browsers
playwright install chromium webkit
npm run validate
```

The validation command manages its own temporary static server under an IPFS-like subpath, runs the real production export, and writes disposable evidence to `test/scratch/validation/`. It closes the server and browser when finished. WebKit launch failures are reported as limitations, not passing tests. To regenerate the social image after editing its SVG, run `node scripts/social.mjs`, then rebuild.

Actual results from this run:

| Check | Result |
| --- | --- |
| `npm run build` | Passed; home + 3 static playbook pages and 4 local assets |
| `npm run typecheck` | Passed; strict TypeScript checking of the JavaScript and data types |
| `npm test` | 16 passed, 0 failed |
| `npm run validate` | Chromium primary flows passed; detailed coverage in the report |
| Automated accessibility | 9 axe scans, 0 reported violations |
| Responsive reflow | 320, 390, 768, 1024, 1440 widths; 200% text sizing on home and every form/output |
| Pinned `taste@1` | 16/16 passed, including the 390-wide first screen |
| WebKit | Unperformed: browser launch reported missing host libraries |

The pinned probe was run as:

```sh
IMD_PLAYWRIGHT=/tmp/nuntio-tools/node_modules/playwright/index.mjs \
  node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste --offline
```

The `.imd/reads/` inputs are removed before delivery; the recorded probe results remain in [`docs/taste-checks.json`](docs/taste-checks.json). Source-based tests and `npm run validate` remain reproducible without those inputs. After removing temporary tool output, `node scripts/check-export.mjs` checks the complete deliverable against the **8 MiB** budget and rejects dependency/cache directories and archives at every nesting level.

See [`docs/validation.md`](docs/validation.md) for the six-domain review, fixes, evidence, and unperformed checks, and [`DESIGN.md`](DESIGN.md) for the implemented design system. These are worker-run checks, not independent certification. No screen-reader session, physical-device test, native browser zoom, live assistant execution, or live X crawler test was performed.
