# Renderer Performance Budget Audit

## Scope

This audit covers the Picom Vite renderer build. It does not change product
behavior, feature availability, UI layout, Electron security, or budget limits.

## Root cause

The previous `performance:budget:ci` implementation did not measure initial
load. It scanned `dist/assets` and summed every generated `.js` file into
`initialJs` and every generated `.css` file into `css`.

Consequences:

- Lazy Settings, Mention Feed, Profile, Direct Messages, Voice, Radio, Podcast,
  Discovery, Friends, and other dynamic chunks were counted as synchronous JS.
- Lazy Settings CSS was counted as startup CSS.
- There was no Vite manifest, so entry, static, and dynamic dependency graphs
  could not be distinguished.
- Raw bytes were used but the output did not provide per-asset gzip evidence.

The reported `1742.7 KiB initialJs` was therefore total generated JS, not the
renderer entry graph. The CSS failure was partly measurement scope and partly a
real issue: most feature-specific CSS lived in global `src/styles.css` and was
loaded at startup.

## Correct measurement model

Vite now emits `dist/.vite/manifest.json`. The budget script:

1. Finds each manifest record with `isEntry: true`.
2. Recursively follows only `imports`, which are synchronous static imports.
3. Excludes `dynamicImports` from initial load.
4. Collects CSS attached to the entry and recursive static import records.
5. Excludes source maps.
6. Measures budgets in raw bytes.
7. Reports gzip bytes as informational evidence.
8. Reports lazy JS, lazy CSS, largest JS chunk, largest CSS chunk, total assets,
   and a per-asset owner/source mapping.

The generated machine-readable report is `dist/renderer-asset-report.json`.
It is a build artifact and is not committed.

## Before and after

| Metric | Before | After | Hard cap | Result |
| --- | ---: | ---: | ---: | --- |
| Initial JS | 1742.7 KiB, incorrectly all JS | 1415.6 KiB | 1650.0 KiB | Pass |
| Initial CSS | 281.4 KiB, all CSS | 216.3 KiB | 240.0 KiB | Pass |
| Lazy JS total | Not separated | 322.9 KiB | Informational | Reported |
| Lazy CSS total | Not separated | 65.2 KiB | Informational | Reported |
| Largest JS chunk | About 1396.0 KiB raw | 1396.0 KiB | Informational | Reported |
| Largest CSS chunk | About 279.0 KiB raw | 216.3 KiB | Informational | Improved |
| Largest image | 734.6 KiB | 734.6 KiB | 1024.0 KiB hard, 768.0 KiB target | Pass |
| Total assets | 2758.7 KiB | 2754.5 KiB | 3500.0 KiB hard, 2800.0 KiB target | Pass |
| Generated asset files | 26 | 29 | Informational | Three intentional lazy CSS chunks added |

The result also meets the requested preferred headroom: initial JS is below
1600 KiB and initial CSS is below 225 KiB.

## Largest contributors

| Contributor | Raw size | Classification | Finding |
| --- | ---: | --- | --- |
| Renderer entry `index-BiYysTRA.js` | 1396.0 KiB | Entry | Largest remaining startup contributor |
| Global `index-COgmG6Xn.css` | 216.3 KiB | Initial CSS | Below hard cap after scoped split |
| Settings modal JS | 134.1 KiB | Lazy | Correctly excluded from initial graph |
| Community admin deferred JS | 40.7 KiB | Lazy | Correctly excluded |
| Podcast detail JS | 29.2 KiB | Lazy | Correctly excluded |
| Mention Feed JS | 25.2 KiB | Lazy | Correctly excluded |
| Direct Messages CSS | 24.1 KiB | Lazy CSS | Removed from startup CSS |
| Mention Feed CSS | 20.4 KiB | Lazy CSS | Removed from startup CSS |
| Profile CSS | 18.3 KiB | Lazy CSS | Removed from startup CSS |
| Static mock communities chunk | 7.8 KiB | Static | Mock support still contributes to startup |
| Shared React chunk | 7.3 KiB | Static | Expected framework dependency |
| AppIcon chunk | 2.3 KiB | Static | Icon system is not a large contributor |

## Optimization applied

Only selectors fully scoped to lazy feature anchors were moved:

- Direct Messages selectors moved to `DirectMessagesView.css`.
- Profile selectors moved to `ProfileView.css`.
- Mention Feed and story selectors moved to `MentionFeedMain.css`.

Rules with shared selectors or mixed selector lists stayed in global CSS. The
three CSS files are imported by components already loaded with `React.lazy`, so
Vite loads each stylesheet with its corresponding view.

CSS code splitting is now explicit in Vite configuration. No CSS declaration
was deleted to reach the budget.

## Findings not changed in this task

- `App.tsx` still statically imports multiple mock datasets. The measured static
  mock chunk is small enough that changing data behavior was not justified.
- Vite reports that `voiceService` is both dynamically and statically imported.
  Settings, admin operations, and diagnostics need it. The corrected initial JS
  already meets preferred headroom, so unrelated service refactoring was not
  performed.
- The entry chunk remains larger than Vite's generic 500 kB warning. This is a
  future optimization opportunity, not a hard budget failure.
- No evidence showed a large full icon package import; AppIcon is 2.3 KiB raw.

## Cross-platform governance

`.github/workflows/renderer-performance.yml` provides manual and release-only
Windows/Ubuntu evidence. It runs `npm ci`, production build, and the unchanged
hard budget gate on both operating systems. It does not duplicate normal fast
QA on every main-branch commit.

The hard caps were not raised. `continue-on-error` was not added.
