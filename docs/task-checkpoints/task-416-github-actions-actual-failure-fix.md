# Task 416 Checkpoint: Actual GitHub Actions Failure Fix

## Result

The actual first failed step in the latest failed Picom QA run was identified
from GitHub logs and corrected without changing product code or removing a
quality gate.

## Failure evidence

- Run: `29124714084` (`#523`).
- Job: `QA smoke, typecheck, and build (windows-latest)`.
- Step: `Verify third-party license inventory`.
- Error: generated license report reported as missing or stale.
- Root cause: exact LF/CRLF string comparison in the license generator.

Runs `#516` through `#521` first failed a stale env smoke assertion. Run `#522`
first failed real renderer performance hard caps. Those causes were already
handled by the current env contract and the fast-QA/release-gate separation.

## Fix

The license report comparison now normalizes line endings before comparing
content. License metadata and generated inventory differences remain blocking.

## Validation completed

- `npm ci`: passed after releasing a local Vite native-module file lock.
- `npm run licenses:check`: passed with 395 entries.
- CRLF-equivalence regression using the real generator: passed.
- `npm run typecheck`: passed.
- `npm run mock:smoke`: passed.
- `npm run build`: passed with existing bundle-size warnings.
- `npm run qa:smoke`: passed.
- `npm run ci:workflow:smoke`: passed.
- `npm run env:smoke`: passed.
- GitHub Actions YAML parse validation: all six workflows passed.
- `npm run performance:budget:ci`: failed as expected and remains a truthful
  release-only blocker.

The performance budget command must remain blocked while the documented hard
caps are exceeded. That expected release failure is not an ordinary QA failure.

## Safety

- No Picom feature or UI file changed.
- No secret or environment file was added.
- No check uses `continue-on-error`.
- Typecheck, build, mock smoke, QA smoke, secret scan, and license checks remain
  blocking in fast QA.
