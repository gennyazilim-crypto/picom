# GitHub Actions Workflow Architecture

## Design principles

- Ordinary changes receive a fast deterministic quality decision.
- Hosted staging checks never pretend to pass without a real environment.
- Native packaging runs on the matching operating system.
- Signing, notarization, and publication remain protected release operations.
- Release evidence cannot override a documented No-Go decision.
- Every workflow uses minimal permissions, a timeout, and explicit concurrency.

## Workflow responsibilities

| Workflow | Classification | Triggers | Runners | Secrets or environment | Responsibility |
| --- | --- | --- | --- | --- | --- |
| `qa.yml` | Required | Pull request, push to main, manual | Ubuntu | None | Typecheck, mock/static smoke, build, secret/license/policy contracts |
| `hosted-validation.yml` | Manual, protected; optional nightly later | Manual | Ubuntu | `hosted-staging` | Hosted Supabase RLS/storage, Realtime two-client, Edge JWT validation |
| `package-matrix.yml` | Optional PR, manual, RC evidence | Manual and packaging-path PR | Windows, Ubuntu, macOS | None for unsigned candidates | Native NSIS, AppImage/DEB, DMG/ZIP candidates |
| `release-gate.yml` | Release-only | Manual, `release/**`, `v*` | Ubuntu | None | Performance, visual/E2E contracts, checksums, provenance, Go/No-Go guard |
| `windows-signed-release.yml` | Protected release-only | Manual | Windows | Windows signing environment | Trusted Windows signing and verification |
| `macos-signed-notarized-release.yml` | Protected release-only | Manual | macOS | Apple signing/notarization environment | Signing, notarization, staple verification |
| Dependabot | Automated dependency maintenance | Monthly | GitHub-managed | None | Grouped dependency update pull requests |

## Fast required QA

`qa.yml` is the only ordinary branch-protection candidate. It always starts,
including for documentation changes, so GitHub never leaves the required check
Pending because of path filters. It contains only deterministic checks that do
not need hosted services or protected release credentials.

The required job is `Required QA`. Its checks remain blocking; Task 416 does not
use `continue-on-error`.

## Hosted staging validation

`hosted-validation.yml` is manually invoked with `STAGING_ONLY` confirmation
and the protected `hosted-staging` environment. The existing scripts validate
that every required value exists. Missing credentials fail the job clearly;
they do not produce a certification pass.

The workflow uses scoped user test accounts and anon keys. It does not request
or expose the Supabase service-role key. A protected nightly schedule can be
added only after environment ownership and alert routing are assigned.

## Native package matrix

`package-matrix.yml` creates unsigned internal candidates on native runners.
It is optional for ordinary pull requests and should never be a required check
for documentation or renderer-only changes. Signing remains in the dedicated
protected workflows.

Uploaded paths are explicit release outputs. The workflow does not upload
`.env`, credentials, `node_modules`, `.tmp`, `tmp`, release-task folders, or raw
Electron logs.

## Release gate

`release-gate.yml` runs release-readiness contracts that are valid blockers but
too broad for normal pull requests. Performance budgets are not relaxed. The
final guard parses the explicit decision in `docs/stable-go-no-go.md` and fails
unless it is `Go` or `Go with known non-blockers`.

This workflow generates no release and publishes no artifact. Native packaging,
trusted signing, notarization, clean-machine installation, hosted LiveKit media
evidence, backup/restore drills, legal approval, and final distribution remain
separate evidence.

## Trigger policy

- `pull_request`: fast QA; optional package matrix only for packaging paths.
- `push` to `main`: post-merge fast QA.
- `workflow_dispatch`: hosted, package, release, and signed workflows.
- `release/**` or `v*`: release evidence gate, not automatic publication.
- `schedule`: Dependabot only. Hosted nightly validation is deferred until the
  protected environment is operational.

## Node and dependency policy

The repository has no engines or version-manager declaration. Existing Picom
workflows use Node.js 24, which remains the CI runtime. All workflows use
`actions/setup-node` npm caching with `package-lock.json`, followed by `npm ci`.
