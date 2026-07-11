# Full MVP Staging End-to-End Matrix

## Status

Task 519 prepared and locally validated the executable matrix contract. Real staging execution is **BLOCKED**, not passed: this workstation did not have the protected staging environment, complete synthetic actor fixtures, two desktop clients, hosted LiveKit, or the native Windows/Linux/macOS evidence set.

The redacted current record is `docs/evidence/task-519-full-mvp-staging-e2e.json`. A structural contract pass must never be reported as hosted certification.

## Safety boundary

- Production targeting is forbidden.
- The default runner performs no network requests and no writes.
- Hosted execution requires both `PICOM_STAGING_E2E_CONFIRM=STAGING_ONLY` and `PICOM_STAGING_E2E_ALLOW_WRITES=ALLOW_SYNTHETIC_WRITES`.
- Only synthetic staging identities and content may be used.
- The runner rejects missing targets and hostnames that resemble production.
- Passwords, tokens, keys, private URLs, user content, and private identifiers must not be written to evidence or logs.
- Cleanup must remove only records carrying the unique synthetic run marker; broad delete operations are forbidden.

## Matrix coverage

The machine-readable source is `tests/e2e/full-mvp-staging-matrix.json`. It covers:

1. First launch, registration, profile creation, onboarding, theme, and follows.
2. Text, Radio, and Podcast community creation.
3. Invite, visitor public-read, join, leave, and private-content denial.
4. Owner/admin/moderator/member/visitor roles and permission boundaries.
5. Text send, optimistic reconciliation, reply, reaction, edit, delete, and moderation.
6. Image upload validation, private delivery, preview, and visitor denial.
7. Friends, Direct Messages, realtime, read state, block, and non-participant denial.
8. Profile editing, privacy projection, verification display, and blocked visibility.
9. Text/Radio/Podcast Feed mentions, stories, deep links, and private filtering.
10. Radio schedule, listener, host, moderation, and audit paths.
11. Podcast draft, media, publish, playback, save, reactions, comments, and moderation.
12. Settings coverage and restart persistence.
13. Hosted two-client voice and native screen-share paths where providers/platforms exist.
14. Admin moderation, immutable audit, logout, restore, revoke, reconnect, ordering, and deduplication.
15. Private channel, attachment, blocked Feed, DM metadata, and audit isolation.

## Commands

Safe local contract and preflight:

```powershell
node scripts/full-mvp-staging-e2e-contract.mjs
node scripts/hosted-full-mvp-staging-e2e.mjs
```

Protected hosted execution, only from the approved staging environment:

```powershell
$env:PICOM_STAGING_E2E_CONFIRM='STAGING_ONLY'
$env:PICOM_STAGING_E2E_ALLOW_WRITES='ALLOW_SYNTHETIC_WRITES'
node scripts/hosted-full-mvp-staging-e2e.mjs --run --evidence <redacted-evidence.json>
```

The existing protected workflow runs RLS/Storage, Realtime two-client, and Edge JWT suites. UI and native evidence must still be captured against the same immutable candidate and supplied as redacted all-PASS evidence before the final command can pass.

## Evidence rules

Allowed evidence contains only flow IDs, PASS/FAIL/BLOCKED, reason codes, platform/version, source commit, timestamps, defect IDs, and bounded workflow references. Never attach raw database rows, message bodies, screenshots containing private content, local absolute paths, tokens, credentials, signed URLs, or provider room identifiers.

Any unavailable external provider or native platform remains `BLOCKED`. A release cannot convert `BLOCKED` to `PASS` through documentation alone.

## Completion rule

Task 519 is operationally complete only when the protected runner exits zero with every flow and required provider marked `PASS`, cleanup is confirmed, evidence is redaction-reviewed, and the exact candidate commit matches the native clients. Until then this is a prepared matrix with an explicit release blocker.
