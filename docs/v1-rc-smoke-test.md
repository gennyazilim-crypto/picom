# Picom V1 Release Candidate Smoke Test

Status date: 2026-07-12
Local deterministic quality result: **PASS**
Packaged release-candidate result: **BLOCKED / NOT RUN**

## Evaluated source

- Base full SHA: `fec56816516dd50ece073428aef126cbae14025d`.
- Package version: `0.1.1-beta.1`.
- QA runtime: Node 24 workflow contract; clean `npm ci` installed 365 packages with zero reported vulnerabilities.
- Task 625 changes only update hosted workflow action runtimes and release evidence documents; no product feature was changed.

## Complete local gate

| Check | Result | Notes |
| --- | --- | --- |
| Secret exposure | PASS | Runtime/server/signing boundaries remain protected |
| Third-party licenses | PASS | 395 dependency entries match committed report |
| Dependency update and API version policies | PASS | Deterministic contracts |
| Typecheck | PASS | `tsc --noEmit` |
| Mock contract | PASS | Explicit development fixture mode; no production fallback |
| Production renderer/Electron build | PASS | 580 Vite modules transformed |
| QA smoke | PASS | Environment, hooks, logs, diagnostics, errors, security, branding, desktop and package contracts |
| Supabase QA | PASS | 188 migrations, static RLS/schema/API contracts |
| Visual regression contract | PASS | 35 desktop scenarios; pixel execution is not claimed |
| E2E coverage contract | PASS | 17 mapped flows; UI runner execution is not claimed |
| Checksum generator contract | PASS | Fixture/contract only |
| Provenance generator contract | PASS | Fixture/contract only |
| GitHub Actions contract | PASS after fix | Hosted workflow now uses `checkout@v7` and `setup-node@v6` |
| Electron package configuration | PASS | No installer was produced |
| V1 scope/data-source/Edge contracts | PASS | Supabase-only production and hidden feature boundaries |
| V1 Voice/Screen decision | PASS | Included by Task 668; public release gates remain separate |
| Legal/ownership guard | PASS as guard, release BLOCKED | It correctly refuses to claim approval |
| Windows signing guard | PASS as guard, release BLOCKED | It correctly detects beta version/no signing evidence |

## Renderer budget

| Metric | Measured raw size | Result |
| --- | ---: | --- |
| Initial JavaScript | 1,213.5 KiB | Below 1,650 KiB hard cap; above preferred target |
| Initial CSS | 239.9 KiB | Below 240 KiB hard cap by 0.1 KiB; above preferred target |
| Largest JavaScript chunk | 944.9 KiB | Informational |
| Largest CSS chunk | 239.9 KiB | Informational |
| Lazy JavaScript total | 1,269.2 KiB | Informational |
| Lazy CSS total | 244.5 KiB | Informational |
| Largest image | 507.2 KiB | PASS |
| Total assets | 3,474.5 KiB | Below 3,500 KiB hard cap; above preferred target |
| Generated assets | 79 | Informational |

The budget passes but CSS and total-assets headroom are critically small. This is a release risk, not permission to raise caps.

## Packaged smoke blocked

The following required checks were not run because no valid signed RC exists:

- install/upgrade/reinstall/uninstall on clean Windows 10 and 11;
- Auth login/register/session restore against approved production Supabase;
- Feed, profile upload, text community/channel/message, attachment, reaction/reply/read-state flows;
- Friends and DM two-client Realtime behavior;
- Settings, diagnostics and Help/Support links;
- signature/publisher/timestamp verification;
- signed artifact checksum/provenance verification;
- crash/relaunch and data/cache preservation on installed candidate.

Running these against an unsigned beta and calling them V1 RC evidence would be false. Task 625 remains blocked despite the passing local matrix.

## Commands run

- `npm ci`
- `npm run secrets:smoke`
- `npm run licenses:check`
- `npm run dependency:update:train:smoke`
- `npm run api:versioning:enforcement:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run qa:supabase`
- `npm run visual:regression:contract`
- `npm run e2e:coverage:contract`
- `npm run release:checksums:smoke`
- `npm run release:provenance:smoke`
- `npm run ci:workflow:smoke`
- `npm run performance:budget:ci`
- `npm run package:verify`
- V1 scope, data-source, hosted-contract, Voice/Screen decision, legal/ownership, signing and Edge allowlist contracts

Result: local deterministic gate passes; immutable packaged RC does not exist.
