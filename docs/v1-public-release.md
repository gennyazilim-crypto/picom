# Picom V1 Public Release Record

Status date: 2026-07-12
Publication state: **NOT PUBLISHED - FINAL DECISION NO_GO**

## Public artifact state

| Public item | State |
| --- | --- |
| Windows `1.0.0` download | NOT AVAILABLE |
| Signed installer | NOT AVAILABLE |
| SHA-256 manifest | NOT AVAILABLE |
| Provenance summary | NOT AVAILABLE |
| V1 release notes | NOT PUBLISHED |
| System requirements/install/uninstall page | NOT PUBLISHED AS V1 |
| Approved support/security/legal links | NOT FROZEN |
| Git tag/GitHub Release | NOT CREATED |

No beta/unsigned file may be renamed or linked as Picom V1. No placeholder URL, checksum, publisher, version, telemetry result or user count may appear in public release copy.

## Claim boundary

If a later decision becomes GO, the public release is Windows-first only. It must not claim Linux/macOS stable support. Task 668 includes Voice Rooms and Screen Share for active community members. Radio, Podcasts, Meetings, enhanced Noise Shield/Voice Focus, AI, bots, product webhooks, plugins, enterprise/SSO/billing, discovery marketplace, recording, and captions remain outside V1.

## Controlled publication sequence after GO

1. Verify the final decision references the exact frozen source and signed artifact hash.
2. Create annotated `v1.0.0` tag from that source only.
3. Create a draft GitHub Release and attach the signed Windows artifact, SHA-256 manifest and provenance.
4. Independently verify download hash, Authenticode publisher and timestamp from the draft asset.
5. Publish final release notes, supported Windows requirements, install/uninstall instructions, known non-blockers and approved support/security/legal links.
6. Publish the GitHub Release, then update the website Download page and changelog to that live immutable asset.
7. Start the approved rollout ring; do not fabricate post-launch monitoring before traffic exists.

## Rollback instructions

Use `docs/rollback-runbook.md` and `docs/safe-rollout.md`. For a bad release:

1. Pause rollout/download promotion and record an incident.
2. Disable risky features through approved server enforcement/kill switches where possible.
3. Preserve the failed artifact, logs, hashes and provenance; do not silently replace an asset under the same version.
4. Restore the previous signed known-good installer/manifest only after client/server/database compatibility review.
5. Prefer backend forward-fix or feature rollback over unsafe database down migration.
6. Verify backup/recovery and data-loss window before any database restore.
7. Smoke the rollback on clean Windows, then communicate impact and recovery through approved support/status channels.

There is currently no signed V1 or previous signed V1 artifact, so this rollback plan is not operationally activatable and remains a release blocker.

## Controlled hotfix branch policy

- Branch from the exact signed release tag as `hotfix/v1.0.x-<short-scope>`.
- Permit only the incident-scoped fix, tests, release notes and necessary version change.
- Require code review plus Security/Operations review when data, Auth, RLS, IPC, signing or updater behavior changes.
- Use a new patch version; never mutate or overwrite an existing tag/artifact.
- Rerun required QA, hosted/provider checks, signing, checksums, provenance and clean-machine smoke.
- Promote through internal/small beta rings before stable unless emergency leadership documents a narrower safe path.
- Merge the verified fix back to the maintained main line without rewriting release history.

No hotfix branch or release is created by this No-Go record.

## Website and changelog

The website Download page and public changelog must remain unchanged until a signed asset is live. This task intentionally made no external publication change.
