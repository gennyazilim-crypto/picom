# Task 416 Checkpoint: GitHub Actions QA Reliability

## Scope

CI/CD reliability only. No Picom product, UI, Electron runtime, or Supabase
schema behavior was changed.

## Changes

- Converted `qa.yml` from a duplicated Windows/Linux matrix into one required,
  deterministic Ubuntu job.
- Added minimal permissions, lockfile npm caching, timeout, and superseded-run
  cancellation.
- Preserved typecheck, mock smoke, build, security, license, API, dependency,
  QA, and static Supabase checks as blocking.
- Separated protected hosted staging validation.
- Separated native Windows/Linux/macOS package candidates.
- Separated performance and release evidence behind a fail-closed Go/No-Go
  guard.
- Added local workflow contract validation and regenerated license evidence.

## Evidence basis

- GitHub baseline: 522 QA runs, with 60% containing failures.
- Latest 100 inspected QA runs: 100 failures; no same-SHA/event duplicate pair.
- Latest 30 failed runs: 30 Windows license-report failures, 28 Ubuntu stale
  env-contract failures, and 2 Ubuntu performance hard-cap failures.
- Dependabot remained isolated and healthy.

## Required check

Configure `Picom QA / Required QA` on `main` after its first successful run.
Do not require hosted, package, signed, notarized, or release-gate workflows for
ordinary pull requests.

## Release truth

Stable release remains No-Go. The release workflow does not publish artifacts
and fails while `docs/stable-go-no-go.md` records a non-Go decision.

## Validation

Completed locally:

- YAML parse validation for all six workflow files: passed.
- `npm run ci:workflow:smoke`: passed.
- `npm run secrets:smoke`: passed.
- `npm run licenses:check`: passed with 395 entries.
- `npm run typecheck`: passed.
- `npm run mock:smoke`: passed.
- `npm run build`: passed with existing bundle-size warnings.
- `npm run qa:smoke`: passed.
- `npm run qa:supabase`: passed structurally; optional real pgTAP execution was
  skipped because the Supabase CLI is not installed.

Release-only fail-closed evidence:

- `npm run release:go-no-go:guard`: blocked as expected because stable is No-Go.
- `npm run performance:budget:ci`: blocked as expected because initial
  JavaScript and CSS exceed hard caps.
- `actionlint` was unavailable. The installed YAML parser and the repository
  workflow contract validated the changed workflows instead.

Hosted and native workflows require GitHub runners and protected environments;
local validation does not claim those executions passed.
