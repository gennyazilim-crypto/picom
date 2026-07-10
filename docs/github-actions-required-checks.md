# GitHub Actions Required Checks

## Recommendation

Require this check on `main` after the first successful run:

- `Picom QA / Required QA`

Require pull requests to be current with `main` according to the repository's
merge policy. Do not require hosted, package, release, Windows signing, or macOS
notarization workflows for ordinary pull requests.

The branch-protection API did not report an active protection rule during Task
416. A repository administrator must configure the required check in GitHub.

## Why QA always starts

The required workflow deliberately has no workflow-level `paths-ignore`.
GitHub can leave a required check Pending when an entire workflow is skipped by
path filtering. Picom instead uses a single deterministic required job for all
changes, including documentation-only changes.

This is the selected Model B:

- A lightweight required QA job always completes.
- Hosted, native package, signing, and release evidence are optional or
  protected workflows with their own triggers.
- Expensive release-only checks never determine ordinary pull-request status.

## Required gate contents

The required check blocks on:

- Secret exposure smoke test.
- Third-party license inventory.
- Dependency update policy.
- API versioning enforcement.
- TypeScript typecheck.
- Mock smoke tests.
- Production build.
- Deterministic QA smoke gate.
- Static Supabase contract gate.
- GitHub Actions workflow contract.

## Checks that must not be required for ordinary pull requests

- Hosted Supabase RLS/storage evidence.
- Hosted Realtime or LiveKit evidence.
- Native Windows/Linux/macOS packages.
- Windows trusted signing.
- macOS signing, notarization, and staple verification.
- Performance/release evidence gate.
- Backup/restore or clean-machine installation evidence.
- Legal approval and final stable distribution.

These remain real release requirements where applicable. Keeping them outside
ordinary branch protection does not certify or waive them.

## Administration checklist

1. Push Task 416 and let `Picom QA / Required QA` complete successfully once.
2. Open repository branch protection or rulesets for `main`.
3. Add `Picom QA / Required QA` as required.
4. Do not add optional workflows as required checks.
5. Verify a documentation-only pull request receives a completed QA result.
6. Verify a superseded pull-request run is canceled and the newest run reports.
