# GitHub Actions QA Reliability Audit

## Scope and baseline

This audit covers Picom CI workflows only. It does not certify hosted staging,
native signing, notarization, packaging quality, or stable release readiness.

GitHub Actions reported the following baseline before Task 416:

- Average job runtime: 39 seconds.
- Average queue time: 2 seconds.
- Overall job failure rate: 59%.
- Failed job usage: 651 minutes.
- `dependabot-updates`: 9 runs and 0% job failure.
- `qa.yml`: 522 runs and 60% of runs containing job failures.

The historical percentage will not reset after this change. Evaluate the fix by
the success rate of newly triggered runs.

## Workflow inventory before the change

| Workflow | Trigger | Runner | Purpose | Class | Secrets | Expected duration | Common failure | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `qa.yml` | PR, push to main | Windows and Ubuntu | Mixed cross-platform QA and release contracts | Required | None | About 39 seconds average job time | Stale licenses, stale env contract, performance hard caps | Make deterministic, single-run fast QA |
| `windows-signed-release.yml` | Manual | Windows | Trusted signed Windows release | Release-only | Windows signing credentials | Up to 45 minutes | Missing protected signing configuration | Keep isolated and fail closed |
| `macos-signed-notarized-release.yml` | Manual | macOS | Signed and notarized macOS release | Release-only | Apple signing and notarization credentials | Up to 60 minutes | Missing protected signing configuration | Keep isolated and fail closed |
| Dependabot configuration | Monthly | GitHub-managed | Dependency update PRs | Automated | None | GitHub-managed | No observed failures | Keep isolated |

There was no repository-local `.github/actions` directory.

## Evidence and root causes

The most recent 100 `qa.yml` runs inspected through GitHub CLI all failed. The
sample contained 92 push runs and 8 pull-request runs. No identical SHA/event
duplicate pair appeared in that sample.

The most recent 30 failed runs showed:

| Rank | Failure source | Sample frequency | Classification | Release blocker | Correct home |
| --- | --- | --- | --- | --- | --- |
| 1 | Generated third-party license report was stale | 30 of 30 Windows jobs | Missing generated dependency evidence | Yes, until regenerated | Fast required QA |
| 2 | `.env.example` variable was missing from the env smoke contract | 28 of 30 sampled Ubuntu jobs | Stale test/config contract | Yes at the time; fixed in current source | Fast required QA |
| 3 | Renderer JavaScript and CSS exceeded hard performance caps | 2 of 30 sampled Ubuntu jobs | Real release-readiness failure | Yes for release readiness | Release gate |

The 30-run sample is evidence of recent frequency, not a claim that each cause
explains all 522 historical runs. At the reported 60% rate, approximately 313
historical runs contained at least one failed job, but GitHub's aggregate page
does not attribute all of them to a specific step.

Other findings:

- The operating-system matrix ran platform-independent checks twice.
- The workflow had no concurrency cancellation, so superseded commits could
  continue consuming minutes.
- The workflow had no explicit job timeout or top-level minimal permissions.
- Documentation-only changes ran the complete matrix. This avoided Pending
  required checks but duplicated all work across two operating systems.
- Normal QA did not run hosted Supabase credentials, LiveKit media evidence,
  signing, notarization, backup/restore, or native packaging. The new split
  makes that boundary explicit and prevents future accidental coupling.
- QA uploaded no artifacts, so `.env`, temporary directories, and local
  Electron logs were not exposed.
- The repository did not declare an engines or version-manager Node version.
  Existing workflows consistently used Node.js 24, so Task 416 retains it.
- The GitHub branch-protection API returned no configured protection for
  `main`. Required checks therefore need to be configured after the new check
  has completed once.

## Trigger and duplicate-run findings

The safe trigger strategy is:

- Pull requests run `Picom QA` for review validation.
- Direct pushes run `Picom QA` only on `main`.
- Manual dispatch remains available for diagnosis.
- The same open-PR commit is not also run by the push trigger unless it reaches
  `main` as a distinct post-merge verification event.
- Concurrency cancels superseded runs on the same workflow and ref.

No workflow-level `paths-ignore` is used. This ensures a future required check
always reports a conclusion, including for documentation-only changes.

## Fixes applied

- Replaced the Windows/Linux matrix with one deterministic Ubuntu required job.
- Added `contents: read`, concurrency cancellation, a 20-minute timeout, Node
  cache configuration, and lockfile-based `npm ci`.
- Kept typecheck, mock smoke, build, QA smoke, static Supabase contracts,
  security scanning, license verification, dependency policy, and API
  versioning as blocking checks.
- Moved performance, visual/E2E contracts, checksum, and provenance evidence to
  the release gate without weakening their failure semantics.
- Added manual protected hosted staging validation for RLS/storage, Realtime,
  and Edge Function JWT boundaries.
- Added optional native Windows/Linux/macOS package workflows.
- Added a fail-closed stable Go/No-Go release guard.
- Added local workflow contract validation.
- Regenerated the third-party license inventory.

## Expected impact

- Platform-independent QA jobs per run fall from two to one, a 50% reduction in
  baseline QA job executions.
- Superseded same-ref runs cancel automatically, reducing burst waste. The exact
  reduction depends on commit frequency.
- Hosted, native package, signed release, and release-evidence failures no
  longer contaminate ordinary pull-request QA.
- The immediate target is below 10% failures on new `qa.yml` runs, followed by
  below 3% after sufficient evidence is collected.

## Remaining failures and risks

- Performance budgets remain exceeded until the application bundle is reduced.
  Task 416 measured initial JavaScript at 1738.3 KiB against a 1650.0 KiB hard
  cap and CSS at 281.4 KiB against a 240.0 KiB hard cap.
- Hosted validation remains blocked until the protected `hosted-staging`
  environment and its scoped test credentials are configured.
- Windows and macOS trusted releases still require protected signing secrets.
- macOS notarization and native screen-share evidence remain release-only.
- Package matrix behavior must be confirmed on all three hosted operating
  systems after this workflow is pushed.
- Branch protection must be configured to require the new exact check name.
