# Task 417 Checkpoint: Picom QA Remaining Gates

## Objective

Validate every QA gate previously skipped after the renderer performance failure, then improve workflow reliability without weakening required checks or moving protected release evidence into normal push QA.

## Completed work

- Confirmed the Task 416 renderer performance budget exits successfully.
- Added visual regression, E2E coverage, checksum, and provenance contracts to required QA.
- Added the same four contracts to the Windows/Ubuntu renderer matrix.
- Expanded visual coverage to 18 deterministic desktop scenarios across eight release surfaces.
- Expanded the E2E manifest to 15 current release flows while keeping execution status truthfully marked planned.
- Added repository-relative path, Linux case-sensitivity, file-existence, viewport, and desktop-only checks.
- Confirmed checksum smoke mode uses temporary SHA-256 fixtures and performs no publication.
- Added explicit platform and architecture fields to provenance output and smoke validation.
- Upgraded `actions/checkout` and `actions/setup-node` to official Node 24 action runtimes across Picom workflows.
- Extended the workflow contract so warned action majors and missing remaining gates fail CI.
- Kept hosted Supabase, hosted LiveKit, native packaging certification, signing, notarization, backup/restore, and final release decisions outside normal push QA.

## Local results

| Command | Result |
| --- | --- |
| `npm ci` | Pass, 0 vulnerabilities |
| `npm run typecheck` | Pass |
| `npm run mock:smoke` | Pass |
| `npm run build` | Pass |
| `npm run performance:budget:ci` | Pass |
| `npm run qa:smoke` | Pass |
| `npm run visual:regression:contract` | Pass |
| `npm run e2e:coverage:contract` | Pass |
| `npm run release:checksums:smoke` | Pass |
| `npm run release:provenance:smoke` | Pass |
| `npm run ci:workflow:smoke` | Pass |

All seven changed workflow YAML files parse successfully.

## Performance evidence

- Initial JavaScript: 1415.6 KiB
- Initial CSS: 216.3 KiB
- Largest JavaScript chunk: 1396.0 KiB
- Largest CSS chunk: 216.3 KiB
- Lazy JavaScript total: 322.9 KiB
- Lazy CSS total: 65.2 KiB
- Total assets: 2754.5 KiB
- Generated assets: 29

## GitHub evidence before Task 417

- Picom QA run `29126509913`: passed after Task 416.
- Renderer matrix run `29126570030`: Windows and Ubuntu passed the performance gate.
- Release gate run `29126570026`: all four remaining contracts passed; the workflow correctly stopped at the existing stable No-Go guard.

Post-push Task 417 run IDs and platform results are reported after GitHub executes the commit.

## Intentional limitations

- Visual regression coverage is a deterministic contract until approved baseline capture and pixel comparison are activated.
- E2E coverage is a truthful planned manifest until a browser/Electron automation runner is approved.
- Final hosted, native, signed, notarized, legal, and stable distribution evidence remains blocked or release-only rather than being reported green in ordinary QA.

## Remaining risks

- Renderer startup assets pass hard limits but remain above preferred warning targets.
- The production build reports a mixed static/dynamic `voiceService` import and a large-chunk advisory.
- Live cancellation is not manufactured with fake product commits; workflow contracts enforce `cancel-in-progress: true` and GitHub applies it naturally to superseded ref runs.

