# Dependency and Bundle Size Audit

Picom is a Windows, Linux, and macOS Electron desktop app. Desktop quality matters, but the app should not become heavy from placeholder features, unused UI kits, or advanced post-MVP dependencies.

This document defines how we review bundle size and dependency weight without adding a heavy analyzer dependency yet.

## Current dependency posture

| Area | Current approach | Bundle risk | Policy |
| --- | --- | --- | --- |
| React UI | `react`, `react-dom`, Vite | Low/normal | Keep component code local and tokenized. |
| Electron runtime | `electron`, `electron-builder` | Packaging size, not renderer bundle | Track packaged artifact size separately from renderer assets. |
| Supabase | `@supabase/supabase-js` | Medium | Keep client centralized; avoid importing Supabase in leaf UI components. |
| LiveKit | `livekit-client` | High | Keep voice/screen-share code isolated and dynamically split where practical. |
| Icons | Coolicons/AppIcon local SVG mapping | Low | Do not add a second icon library. Do not add Coolicons PRO unless licensed. |
| Date/time | Native `Intl` utilities | Low | Do not add a date library unless timezone/calendar requirements exceed `Intl`. |
| Markdown/parser | Not part of MVP | High if added casually | Avoid until message rendering requires a reviewed parser/sanitizer. |
| Syntax highlighting | Not part of MVP | High | Avoid until code snippets are an explicit MVP task. |
| Charts | Placeholder only | High | Prefer lightweight CSS/cards until analytics dashboards are real. |
| Virtualization | Placeholder/future | Medium | Add only when large-list profiling proves it is needed. |
| UI kits | Design reference only | High if imported wholesale | Do not ship unused kit assets/components. Recreate needed styles with Picom tokens. |

## Bundle budgets

The detailed first-run targets live in `docs/performance-budget.md`. For dependency review, use these quick bundle guardrails:

- Initial renderer JavaScript target: <= 900 KB minified.
- Initial renderer JavaScript regression threshold: > 1.2 MB minified.
- CSS target: <= 180 KB minified.
- CSS regression threshold: > 240 KB minified.
- Individual lazy chunk warning: > 500 KB minified.
- Image/logo assets should be optimized before release packaging.

These values are placeholders until we collect release-candidate data from Windows, Linux, and macOS builds.

## Audit command

Use:

```bash
npm run build
npm run bundle:size:audit
```

The audit reads `dist/assets` and reports the largest generated files. CI additionally runs `npm run performance:budget:ci`: desired target overruns warn with a named exception, while hard caps fail the job.

Use the output during release-candidate dry runs and compare it against `docs/performance-budget.md`.

## Review checklist

Before adding a dependency, answer:

1. Is the feature inside the locked MVP scope?
2. Can native browser/Electron APIs solve it safely?
3. Can we implement the MVP slice with local code and design tokens?
4. Does the dependency ship unused themes, icons, locales, parsers, or assets?
5. Does it work in Electron with context isolation and no direct renderer Node access?
6. Can it be lazy-loaded outside the first render path?
7. Is the license compatible with Picom distribution?
8. Does the dependency introduce native build tooling that affects Windows/Linux/macOS packaging?

## Heavy dependency watchlist

- `livekit-client`: keep imports out of default chat screens where possible.
- `electron`: packaging size is expected; do not bundle Electron into renderer code.
- UI/image/chart/markdown/syntax libraries: avoid until they are real MVP requirements.
- Avatar/image assets: optimize local assets and prefer generated placeholders where practical.

## CI enforcement

CI now:

1. Run `npm run build`.
2. Run `npm run performance:budget:ci`.
3. Fail on the explicit hard caps in `docs/performance-budget.md`.
4. Warn and print owner/remediation for target overruns.
5. Keep startup/render/memory timings in the release-candidate dry run until deterministic runners exist.

## Current known risk

Vite currently reports a chunk-size warning after production builds. This is tracked as a release-hardening item, not a blocker for placeholder MVP tasks. The likely remediation path is to keep LiveKit/voice and other optional surfaces split away from the initial community chat shell.
