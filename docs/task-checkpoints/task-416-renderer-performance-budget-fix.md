# Task 416 Checkpoint: Renderer Performance Budget Fix

## Result

The renderer budget now measures the real Vite startup graph and passes without
raising limits or removing product functionality.

## Root causes

- Every generated JS chunk was incorrectly counted as initial JS.
- Every generated CSS chunk was counted as startup CSS.
- Vite manifest output was disabled, preventing dependency-graph measurement.
- Profile, Direct Messages, Mention Feed, and story styles were globally eager
  despite their root views being lazy.

## Fix

- Enabled Vite manifest and explicit CSS code splitting.
- Replaced directory-wide JS/CSS sums with manifest entry/static traversal.
- Excluded dynamic imports and source maps from startup metrics.
- Added raw and gzip asset inventory reporting.
- Split feature-scoped CSS into three lazy view stylesheets.
- Added a manual/release-only Windows and Ubuntu performance workflow.

## Before and after

| Metric | Before | After |
| --- | ---: | ---: |
| Initial JS | 1742.7 KiB | 1415.6 KiB |
| Initial CSS | 281.4 KiB | 216.3 KiB |
| Largest JS chunk | About 1396.0 KiB | 1396.0 KiB |
| Largest CSS chunk | About 279.0 KiB | 216.3 KiB |
| Total assets | 2758.7 KiB | 2754.5 KiB |
| Asset count | 26 | 29 |

## Local validation

- `npm ci`: passed earlier in the task with zero vulnerabilities.
- `npm run typecheck`: passed.
- `npm run mock:smoke`: passed.
- `npm run build`: passed.
- `npm run performance:budget:ci`: passed with exit code 0.
- `npm run qa:smoke`: passed.
- `npm run ci:workflow:smoke`: passed.
- Seven workflow YAML files parsed successfully.

## Safety

- Hard caps were not changed.
- No performance step was disabled.
- No `continue-on-error` was introduced.
- No product feature, route, service behavior, design token, or Electron security
  setting changed.
- Shared and mixed CSS selectors remain in global CSS.
