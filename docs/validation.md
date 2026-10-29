# nuntio revision: implementation and validation

The latest revision, **30 Oct 2026**, fixes malformed Solana mint/freeze authorities being reported as “None.” See [Solana authority revision validation](solana-authority-validation.md) for reproduction, current checks, all six design-review domains, screenshots and limitations. The current `.imd-responses.json` answers that finding. The results below are preserved history from the earlier revision.

Worker review on **29 Oct 2026**, against the rebuilt production export. These are worker-run results, not independent certification.

| Area | Result |
| --- | --- |
| Reported findings | All 8 reproduced; all 8 fixed; individual verdicts in `.imd-responses.json` |
| Production build / strict typecheck | Passed |
| Unit tests | 55 passed, 0 failed |
| Chromium interactions | 18 existing flow groups + 8 focused revision groups passed |
| Reflow | 86 existing-flow + 7 revision measurements; 4 additional roadmap widths |
| Automated accessibility | 23 axe scans, 0 reported violations |
| Pinned taste@1 | Before: 15/16, four slogan lines. After: 16/16, three slogan lines |
| First screen at 390 × 844 | Home product/search action and Scan form/action visible; Scan button bottom measured at 564.75px |
| Share metadata | Title, favicon, description, OG and Twitter metadata on 8 static HTML pages; local 1200 × 630 social PNG |
| Browser limitation | Chromium 141.0.7390.37 tested; WebKit launch failed because required host libraries are unavailable |

## Scope and preservation

This is a targeted revision of the supplied accepted site. It retains all four playbooks, all three setup guides and their two modes, Scan, URL-based sharing, roadmap and disclaimer footer. The existing logo, dark/lime tokens, typography and layout are preserved. Brand text now reads exactly `nuntio`, including accessible names, titles, metadata and regenerated social artwork. No package manifest, lockfile, dependency, ignore file or protected path was changed.

The original three playbook templates, schedules and guardrails stay unchanged and remain covered by acceptance fixtures. The perps template and requested token/wallet research templates are also retained. A generated trader playbook is a prompt for a visitor's own agent, not completed research. The site never connects a wallet or signs anything.

One visual idea: **a quiet dark workspace where a lime action leads to readable research facts or instructions.** The pinned Better Interface guide was applied across all six domains; the wallet-connector reference is inapplicable because this brief explicitly prohibits wallet connection.

## Reproduction, fixes and rechecks

All browser reproductions used the existing `dist/` at an IPFS-like subpath, Chromium at 390 × 844 and intercepted JSON-RPC replies. Documentation was also checked directly. Baseline evidence is in `docs/revision-reproduction.json`; reproducible post-fix browser checks are in `scripts/validate-revision.mjs` and `docs/revision-checks.json`.

| Finding | Evidence before the change | Fix and final-source location | Recheck |
| --- | --- | --- | --- |
| High: malformed RPC replies complete token facts | Object-valued owner and null name completed Token facts after six primary calls and zero fallback calls | `src/scan-rpc.js:18`, `src/scan-rpc.js:33`, `src/scan-rpc.js:42`; malformed envelopes/types/hex and decoder failures throw ReadError. `src/scan-model.js:64` validates string offset, length, padding and UTF-8; uint/address decoding requires full valid ABI words | 17 malformed-field cases tested with a good fallback and with both endpoints bad in unit tests. Browser tests repeat 7 cases, assert 6 reads on each endpoint and no completed facts/research actions when both fail. Genuine reverts and empty returns remain unavailable fields |
| High: Robinhood repeats primary | Two eth_getCode requests to the same URL after HTTP 503 | `src/data/chains.json:45` adds the distinct PublicNode fallback and its official source. `scripts/scan-data.mjs:13` requires two distinct normalized URLs | Unit/browser checks verify primary failure then fallback success, both-down behavior and generated CSP. Duplicate and missing fallback catalogs are rejected |
| High: chain-extension documentation missing | README had no chain catalog, Scan route or Add a chain instructions; claimed no API calls | `README.md:7` explains runtime RPC requests; route table includes Scan, saved profile and perps; Add a chain describes required fields, official sources, explorer templates and rebuilding CSP | README read in full and cross-checked against chain types, validator and build implementation. Existing playbook instructions retained |
| Medium: stale result after editing | Old wallet balance/profile remained under the changed input, both pending and completed | `src/scan-view.js:191` invalidates pending tokens, clears output/errors and restores submit on address/chain edits | Held old success/failure responses for both fields, edited the form and released them: output stayed empty. New scans and generated prompts used the changed form values; completed profiles cleared on edits |
| Medium: inaccurate privacy text | About/privacy said no API despite address-bearing RPC calls | `src/app.js:319` explains URL answers and disclosure of a scanned address to primary/fallback RPC providers | Updated production paragraph checked by regression assertions and the assigned browser tool |
| Medium: Solana programs omit wallet-branch actions | Executable non-token account fixture displayed Program without balance/profile | `src/scan-rpc.js:129` retains Program and supplies native balance; `src/scan-view.js:159` reuses the balance/profile flow | Unit fixture plus browser Program result, SOL balance, keyboard action, exact requested analyst prompt, Save as playbook, hash reload and reflow all pass |
| Medium: name remains Nuntio. | Header, titles, metadata and social source retained the old spelling | `src/app.js:66`, route titles, `scripts/build.mjs:29`, `public/social.svg:5`; lowercase brand and no wordmark dot, social PNG regenerated | Eight route states checked; 390/1440 screenshots and final social PNG visually inspected. Existing mark/layout retained |
| Medium: slogan stack | Four two-beat lines in home content and pinned probe | `src/data/playbooks.json:104` now describes the perps output in one plain sentence | Final probe passes slogans with three lines and 16/16 checks overall; card layout retained |

The Robinhood fallback was verified on [PublicNode's own Robinhood page](https://robinhood.publicnode.com/), which publishes `https://robinhood-rpc.publicnode.com`. This records the source of the URL, not a guarantee of provider availability. No unrelated provider claims or runtime integrations were added.

## Better Interface review

| Domain | Coverage and evidence | Limitations / not applicable |
| --- | --- | --- |
| Accessibility | **Checked.** Existing native labeled fields, real navigation, row headers, status/error semantics and focus tokens retained. Browser keyboard playbook flow and guide checklist pass. Program profile action tested with Enter and focus handoff. Assigned browser snapshot confirms Scan label, invalid state, repair text, button and accessible nuntio name. 23 axe scans report no violations | No screen-reader session or physical-device test. No modal, drag control or media player exists |
| Layout | **Checked.** Existing responsive layouts retained. Home and Scan main actions are visible at 390. Existing validation measures 320/390/768/1024/1440 widths as applicable, including forms/outputs/guides at 200% root text size. Revision checks add program saved-prompt reflow at 320/390/1440 and 200% text. Mobile/desktop screenshots inspected | Native browser zoom, translated text and RTL mirroring not tested. English-only product; text enlargement is separate from native zoom |
| Writing | **Checked.** Privacy accurately describes Scan. Completed/failed scan states reflect available evidence, absent fields are explicit, and changed form values cannot retain old facts. Perps description explains its output; lowercase brand consistent. Required prompt/safety language retained | Generated prompts do not enforce an agent's behavior. Requested seven-word tagline remains under the task's preservation direction |
| Typography | **Checked.** Existing six-size scale and three weights retained; system prose font, monospace commands/address field. Long facts/prompts remain selectable and wrap. Screenshots at 390/1440 inspected; pinned scale/tracking checks pass | Physical iOS input behavior and font substitution across platforms not tested |
| Colors | **Checked.** Existing semantic tokens reused, no palette edits. Pinned rendered contrast check and axe checks pass. Guide foreground/background pairs remeasured: 8.26–16.69:1; focus and warning states use explicit text/boundaries | No light theme requested. No manual forced-colors session or complete OS-native-control palette check |
| UI | **Checked.** Existing flat surfaces and action hierarchy retained. Scan pending, success, missing-field, invalid reply, fallback and failure states exercised. Address/chain edits restore the action and discard late replies. Save/share/reload work; native clipboard and failure fallback tested by existing flows. Reduced-motion transitions tested at 0s | No animation-panel replay; existing color transitions only. WebKit could not launch |

## Commands and actual results

Tool dependencies were installed outside the repository from the unchanged manifest/lockfile. PATH/NODE_PATH resolve that tooling as described in README. The scripts serve `dist/` under a gateway-style subpath. RPC scenarios are fixtures, not live reads.

| Command | Actual result |
| --- | --- |
| `npm run typecheck` | Exit 0; strict checkJs / tsc --noEmit |
| `npm test` | Exit 0; 55 passed, 0 failed |
| `node scripts/social.mjs` | Exit 0; regenerated 1200 × 630 public/social.png from existing SVG with lowercase brand |
| `npm run build` | Exit 0; home + 4 playbook pages + 3 guides + app JS/CSS, favicon, social PNG; CSP regenerated with distinct Robinhood fallback |
| `npm run validate` | Exit 0; 18 Chromium groups, 86 reflow records, 20 axe scans, no captured errors, failed static assets or unexpected requests |
| `node scripts/validate-revision.mjs` | Exit 0; 8 Chromium groups, 7 reflow records, 3 axe scans, no page errors; deliberate RPC failures handled as expected |
| `node scripts/review.mjs` | Exit 0; all three guide copy actions fit 390 × 844; seven contrast pairs pass 4.5:1; roadmap fits four widths |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste --offline` | Exit 0 using explicit external Playwright/browser paths; 16/16 final checks pass (baseline 15/16) |
| `node scripts/check-export.mjs` | Final file/byte inventory retained in docs/bundle-check.json; budget is 8 MiB |

The assigned browser tool separately opened home, Scan and About/privacy. At 390 × 844 it measured the Scan button bottom at 564.75px and no horizontal overflow, submitted a malformed address and inspected its labeled invalid field/repair text. Its console reported zero messages. Screenshot inspection confirmed the first phone screen, desktop cards, Program balance/profile and updated social image. The default preview port was occupied, so the successful manual preview used port 4174.

## Evidence and limits

- `docs/revision-reproduction.json`: before-fix browser observations, README omissions and failed slogan probe.
- `docs/interaction-checks.json`, `docs/revision-checks.json`: final flow, reflow, accessibility and limitation records.
- `docs/taste-checks.json`, `docs/design-metrics.json`: final pinned check results, measured guide contrast and first-screen bounds.
- `docs/screenshots/`: refreshed existing screenshots plus scan form, token, program and malformed-reply error states. Screenshots using RPC fixtures show test data, not live results.
- `DESIGN.md`: implemented tokens, type, components and responsive behavior.
- `.imd-responses.json`: one fixed verdict and concrete evidence for every report.

**Complete for the requested revision scope, with the verification limits above.** No requested fix was left out. WebKit/Safari verification remains unperformed: launch failed with missing host libraries. RPC behavior was tested with intercepted replies; live provider uptime, public browser CORS access and every possible nonstandard token ABI were not certified. Malformed/nonstandard ABI returns produce a full fallback attempt and an error if neither endpoint supplies valid data.

No physical-device, screen-reader, native zoom, manual forced-colors, live assistant execution, provider login/install/funding, or social crawler test was performed. There is no assistant execution, server, backend, key, wallet connection, signing, trading or custody flow. A saved URL carries the prompt and the captured balance, not an executed trader analysis. Publication and eventual gateway unfurling are handled after submission.
