# GitHub Actions Post-Performance Validation

## Scope

This report records validation after Task 416 corrected renderer performance measurement and startup asset loading. Task 417 adds the remaining safe, cross-platform release contracts to CI without moving hosted services, native certification, signing, or deployment into ordinary push QA.

## Task 416 performance baseline

| Metric | Result | Hard cap | Status |
| --- | ---: | ---: | --- |
| Initial JavaScript | 1415.6 KiB | 1650.0 KiB | Pass |
| Initial CSS | 216.3 KiB | 240.0 KiB | Pass |
| Largest JavaScript chunk | 1396.0 KiB | Reported | Pass |
| Largest CSS chunk | 216.3 KiB | Reported | Pass |
| Lazy JavaScript total | 322.9 KiB | Reported | Pass |
| Lazy CSS total | 65.2 KiB | Reported | Pass |
| Total assets | 2754.5 KiB | 2800.0 KiB | Pass |
| Generated assets | 29 | Reported | Pass |

`npm run performance:budget:ci` exits with code 0. Preferred warning targets remain below the hard caps and continue to provide optimization pressure without misclassifying lazy assets as startup assets.

## Existing GitHub evidence

| Evidence | Run ID | Result |
| --- | ---: | --- |
| Last pre-fix Picom QA failure | 29124714084 | Failed before the Task 416 correction |
| Picom QA after Task 416 | 29126509913 | Passed |
| Windows/Ubuntu renderer matrix | 29126570030 | Both platforms passed the performance gate |
| Release-gate contract evidence | 29126570026 | Visual, E2E, checksum, and provenance contracts passed; final release correctly stopped at the existing No-Go guard |

Task 417 post-push run IDs are recorded in the task completion report after GitHub executes the committed workflow.

## Remaining gate results

| Gate | Local result | Contract meaning |
| --- | --- | --- |
| Visual regression coverage | Pass | 18 deterministic desktop scenarios cover eight release surfaces in light/dark mode plus minimum-width community-chat checks |
| E2E core-flow coverage | Pass | 15 release flows map to existing entry files and safe preflight commands; UI automation remains truthfully marked planned |
| Release checksum generator | Pass | Temporary fixture artifacts receive SHA-256 checksums without requiring or publishing production artifacts |
| Release provenance generator | Pass | Safe fixture metadata includes version, commit, platform, architecture, channel, and build date without claiming signing/notarization |

## Cross-platform corrections

- Visual and E2E manifests use repository-relative forward-slash paths.
- Contract scripts reject absolute paths, backslashes, missing files, and mobile scenarios.
- Checksum and provenance smoke tests use temporary fixtures and clean them after execution.
- Provenance records `process.platform` and `process.arch` explicitly.
- The Windows/Ubuntu renderer matrix executes all four contracts after the performance budget.
- Ordinary required QA executes the same contracts on Ubuntu after build and performance validation.

## Workflow reliability changes

- `Picom QA` remains the required fast gate for pull requests, pushes to `main`, and manual runs.
- Concurrency cancellation remains enabled per workflow and ref.
- Minimal `contents: read` permissions, npm cache, `npm ci`, and job timeouts remain enforced.
- GitHub JavaScript actions were upgraded from Node 20 action runtimes to official Node 24 action runtimes.
- Hosted Supabase/LiveKit evidence, platform packaging, trusted signing, notarization, clean-machine testing, and final release approval remain outside normal push QA.

## Remaining risks

- Visual regression and E2E checks validate coverage contracts, not pixel comparison or browser-driven UI execution. Their manifests deliberately do not claim otherwise.
- The main renderer chunk remains above the preferred warning target, although it is below the approved hard cap.
- Vite reports a mixed static/dynamic import warning for `voiceService` and a chunk-size advisory. These are optimization opportunities, not current gate failures.
- Final release remains No-Go until separate release evidence requirements are satisfied.

