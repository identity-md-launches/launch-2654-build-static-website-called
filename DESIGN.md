# Nuntio design system

## Overview

Nuntio helps beginners give Grok Bot a clear first job and follow wallet setup with their own agent. The implemented visual idea is a quiet, dark workspace with one lime action and readable instructions. The requested tagline, **“Tell your bot what to do.”**, is kept verbatim. Its seven words intentionally take precedence over the guide’s six-word marketing-headline preference.

The home page presents the goal control and playbook library; detail pages prioritize the form or generated text. Setup guides prioritize the shared safety banner, mode choice, prerequisites and copy action. Native controls, normal sentence casing, generous targets, and flat surfaces keep the task approachable. No wallet connector, marketing illustration, animation sequence, or external font is used.

Source of truth: [`src/styles.css`](src/styles.css), rendering patterns in [`src/app.js`](src/app.js), content in [`src/data/playbooks.json`](src/data/playbooks.json) and [`src/data/guides.json`](src/data/guides.json), and static metadata in [`scripts/build.mjs`](scripts/build.mjs). This update reuses the existing palette, scale, brand mark and playbook layouts.

## Colors

Hex primitives and semantic aliases are declared in `:root` in `src/styles.css`. Components use the semantic aliases. The site is deliberately dark-only.

| Semantic token | Value | Use |
| --- | --- | --- |
| `--color-page` | `#111310` | Page canvas |
| `--color-surface` | `#191c17` | Cards, fields, output blocks |
| `--color-hover` | `#20241c` | Hover and selected surfaces |
| `--color-border` | `#2c3128` | Decorative card edges and section separators |
| `--color-input-border` | `#717a68` | Discoverable control boundaries |
| `--color-text` | `#f1f3ec` | Primary copy |
| `--color-muted` | `#a7afa0` | Secondary copy, descriptions, hints |
| `--color-accent` | `#d4f77d` | Primary action, selected radio border, brand signature |
| `--color-accent-hover` | `#e0ffa0` | Primary action hover |
| `--color-on-accent` | `#111310` | Primary button text |
| `--color-focus` | `#d4f77d` | Focus perimeter |
| `--color-warning` | `#e9c48b` | Risk notice, shared setup safety banner, risk labels and repaired-link notice |
| `--color-error` | `#ffada3` | Field errors |

The accent is also a deliberate brand detail in the logo and tagline, not an indication that those words are interactive. A warning includes an icon and text; field errors include a repair instruction; copy success includes a checkmark and label. There is no separate success color ramp.

Computed text/background pairs were measured on the final setup guide: title and prompt on page **16.69:1**, muted note on page **8.26:1**, amber banner text on its surface **10.44:1**, primary copy button **15.47:1**, selected mode text **14.11:1**, and risk text on page **11.32:1**. These are measurements of those solid pairs, not a claim of complete accessibility conformance. Exact computed colors are in [`docs/design-metrics.json`](docs/design-metrics.json). The pinned probe and 16 axe scans also passed their measured checks.

## Typography

The prose system stack is `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Checklist commands alone use `ui-monospace, SFMono-Regular, Consolas, monospace` at the existing small size. No font files or remote requests are required. Font substitution is expected across operating systems; the physical font used on every platform has not been certified.

| Token | Default size | Role |
| --- | --- | --- |
| `--text-small` | 14px / `.875rem` | Buttons, metadata, actor labels, commands, hints, secondary copy |
| `--text-body` | 16px / `1rem` | Inputs, labels, long prompt text |
| `--text-title` | 20px / `1.25rem` | Card headings, fieldset legends, output headings |
| `--text-section` | 24px / `1.5rem` | Section and setup-card headings, brand wordmark |
| `--text-heading` | 36px / `2.25rem` | Page titles and mobile home title |
| `--text-display` | 64px / `4rem` | Expanded home title only |

Weights are 400, 500, and 600. Body line-height is 1.6; prompt text is 1.75 for longer reading. Titles use 1.15, the desktop home title 1.05, h2 1.3, and h3/output headings 1.4. Large home tracking is −.055em on desktop and −.045em on mobile; detail titles use −.04em, ordinary h2 −.025em, and h3 −.015em. Small copy has natural tracking. No small uppercase kicker labels or monospace prose are used.

Headings balance their wrapping, descriptions use `text-wrap: pretty`, and critical user-supplied output uses `overflow-wrap: anywhere` without clipping or ellipsis. Prompt measure is capped at 72ch. Counts and step numbers use tabular numerals. Controls remain 16px on mobile to avoid input-triggered zoom. Text stays selectable.

## Layout

`.wrap` caps content at 1120px, centered, with 20px side margins at the default root size. The underlying spacing rhythm is mostly a 4px grid: 8/12px inside small control groups, 16/20/24px between related elements, and 32/40/48/64px between larger groups. These are implemented as CSS values, not a separate spacing-token API.

| Breakpoint | Actual behavior |
| --- | --- |
| Below `36rem` (576px) | Single-column cards and form fields; goal button below its input; stacked footer; compact title; docs link and desktop step summary hidden |
| At `36rem` | 32px side margins; two-column setup guide grid; goal field and action share a row; frequency/channel fields share a row; footer becomes a row; header docs link appears |
| At `55rem` (880px) | Three-column playbook and setup guide grids; home title grows to 64px; explanatory steps appear beside the title; builder/output and setup guides gain a secondary side column |

Builder and setup-guide columns use a 2.2:1 ratio with 64px gap; output uses 2.35:1 with 40px gap. On narrower screens, the summary, handoff and Stay safe section follow the main content in DOM order. The setup mode group stays above the panels, caps at 600px, and uses a 1.25:1 column ratio with a 12px gap to fit its longer first label. Setup cards use a 20px grid gap and 24px content inset. Cards have separate source/report links outside their main navigation link. There is no sticky or fixed action obscuring text. Header, section headings, actions, and page toplines can wrap. Grid children can shrink; long output, commands and labels wrap without loss.

The production home and guide library were checked at 320, 390, 768, 1024, and 1440px. Forms, outputs and both guide modes were checked at 320, 390, 768, and 1440px, and at 200% root text size at 390px. Roadmap reflow was measured at 320, 390, 768 and 1440px. The opening 390 × 844 home screen includes the product, goal box, main action, and first playbook card. All three setup copy buttons also fit on the first 390 × 844 screen (bottom edges approximately 830, 833 and 788px). Text resizing was tested separately from native browser zoom, which was not performed.

## Elevation & depth

The interface is flat: no shadows, gradients, floating panels, or cards inside cards. Surface color and a 1px border distinguish cards and output blocks. Inputs have a stronger border than decorative surfaces. The setup banner has a 2px amber start border; command text has a 2px neutral start border. The desktop summary and Stay safe section use one vertical separator; it becomes a top separator when stacked. The only fixed element is the keyboard-only skip link while focused.

## Shapes

`--radius-control` is `.5rem` (8px) for fields and buttons; `--radius-surface` is `.75rem` (12px) for cards and outputs. The SVG brand mark is drawn with rounded joins. Inline icons have a consistent 1.6px stroke and inherit `currentColor`; typical sizes are 20px, with 28px playbook icons and 18px small cues. Decorative SVGs are hidden from assistive technology.

## Components

These are application rendering patterns, not an exported component library:

| Pattern | Source | Behavior and states |
| --- | --- | --- |
| Header/footer | `shell()` in `src/app.js` | Real links, left brand, right utilities, useful footer links; route-safe paths |
| Section tabs | `shell()`, `.site-tabs` | Native navigation links to Playbooks, Setup guides and Roadmap; `aria-current="page"`, 2px active underline, 48px minimum height, wrapping at enlarged text sizes |
| Goal search | `renderHome()` | Labeled native search field, keyword suggestions, live result count, submit-to-results focus, resettable empty state |
| Playbook card | `card()` | One full-surface native link, title-derived accessible name, hover border/surface, keyboard outline |
| Buttons | `.button` in CSS | Lime `.primary`, outlined `.secondary`, neutral `.text-button`, outlined `.copy-button`; minimum 48px, or 44px for copy |
| Configuration form | `renderConfigure()`, `selectField()` | Native radio group, selects and text fields; required extra answers; inline errors, first-invalid focus, hash persistence, reset |
| Radio choices | `.segmented` | Equal columns, native radio keyboard behavior, selected border/surface, visible focus around the label |
| Output block | `renderOutput()` | Numbered heading and copy control, selectable content, exact source text, attached research warning |
| Guardrails | `.guardrails` | Native checkboxes with full labels, checked mark and strike-through; checks are temporary, copied text is complete |
| Copy feedback | `copy()` | Native clipboard first, selection fallback second, persistent manual-copy field on failure; stable live region; repeated success timers reset correctly |
| Setup card | `renderGuides()`, `.setup-card` | Main guide link, provider note, supplied risk only, date, distinct official-source and report links |
| Setup safety | `safetyBanner()`, `.setup-safety` | Same warning and shared rules on every provider guide, plus provider-specific guidance; never implies enforced permissions |
| Guide modes | `renderSetupGuide()`, `.guide-mode` | Native radio group, 52px minimum labels, arrow-key switching; agent prompt is the default, inactive panel is `hidden` |
| Setup checklist | `.setup-steps` | Numbered items, full checkbox labels, explicit human/agent actor, selectable wrapping commands, checked cue and live count; temporary state survives mode switches |
| Guide prompt | `createGuidePrompt()`, `#agent-panel` | One literal prompt using all six data fields; one primary copy action and the existing manual fallback; no command execution or account entry |
| Roadmap | `renderRoadmap()`, `.roadmap-list` | Flat list of available functions and working section links; no invented future dates |
| Guide/empty/not-found | `renderGuide()`, `renderNotFound()` | Plain explanation, official links, and a direct recovery action |

Focus uses a 2px outline offset 4px. Native radios show the ring on their visible label. Forced-colors mode retains system `Highlight` focus and explicit button boundaries. A skip link reaches the main landmark. Hash transitions move focus to the page title; search submission focuses its result heading. Error text is connected with `aria-describedby`. Non-urgent updates use the permanent polite live region.

Only background, border, and text colors transition, over 130ms, and only when `prefers-reduced-motion: no-preference` applies. Hover styles are gated by hover capability. Pressed buttons darken slightly. There are no indefinite animations, network loading spinners, or invented pending states because generation is synchronous and local.

## Do’s and don’ts

- Start new pages with `.wrap`, a single h1, the existing button variants, and the existing scale. Keep the useful action near the top.
- Add content and assistant behavior through the catalog; preserve the supplied template text and guardrails. Put explanatory notes outside those strings.
- Use neutral peer actions and one lime primary action per task surface. Brand use of lime is intentional.
- Reuse solid surfaces and subtle separators. Do not add shadow layers, remote fonts, animated backgrounds, nested cards, or alternate color encodings without a product need.
- Keep user text literal, selectable, and fully visible. A template is text, never HTML.
- A new playbook needs only a valid JSON entry and a rebuild. A genuinely new view should reuse the header/footer, `.detail` or `.guide`, existing fields, and the hash router; check its mobile and keyboard behavior.

## Guidance attribution

The six-domain design review uses Jakub Krehel’s [Better Interface](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface), pinned at `267330e1adfc66a718fb65fa6918c1f06d0a689e` (MIT, copyright 2026 Jakub Krehel). This implementation-specific document adapts the documentation method from Paul Bakaus’s [Impeccable](https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md), pinned at `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (Apache-2.0, copyright 2025 Paul Bakaus). Both license texts are retained in [`docs/third-party/design-guidance-LICENSE.txt`](docs/third-party/design-guidance-LICENSE.txt). The review coverage and limits are in [`docs/validation.md`](docs/validation.md).
