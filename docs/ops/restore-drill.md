# Picom staging restore drill

## Drill status

This is the executable procedure and evidence template for a Picom restore drill. **No restore was executed for this task** because no approved staging project, backup artifact, production-safe test identities, or Supabase CLI session was provided. No production data, credentials, project references, URLs, row counts, or private content appear in this document.

A drill is complete only when an operator fills the evidence record from an isolated staging/test restore and accountable reviewers sign it.

## Objectives

- Prove a selected database backup is readable and restorable.
- Measure recovery point (RPO) and recovery time (RTO), not just provider job success.
- Reconcile migrations and runtime configuration without mutating production.
- Verify Auth/profile/community/channel/message relationships and private access.
- Reconcile Storage metadata with private object bytes and URLs.
- Prove the exact Windows, Linux, and macOS desktop candidate can connect safely.
- Identify gaps before an incident or destructive migration.

## Required roles and approvals

| Role | Responsibility | Approval |
|---|---|---|
| Drill lead | Coordinates timeline, stop decisions, evidence | Required |
| Database operator | Creates isolated target and restores backup | Required |
| Storage operator | Restores/reconciles private objects | Required |
| Security/privacy reviewer | Confirms isolation, redaction, and access | Required |
| Desktop QA | Runs Picom candidate against restored staging | Required |
| Incident/operations owner | Accepts result and follow-up | Required |

Use individual MFA-protected provider accounts and approved secret injection. Never paste credentials into commands, tickets, chat, screenshots, or this report.

## Hard safety gates

Stop before any command unless all are true:

- Target is a dedicated staging/test Supabase project with a recorded project ref allowlist.
- Source backup identity/timestamp is approved; production remains read-only/unmodified.
- Restored environment has outbound email, webhook, native notification, analytics, update, and external integration delivery disabled.
- Storage restore target is private and separate from production buckets.
- Supabase service-role/database credentials are supplied from the staging secret store only.
- The selected desktop build is explicitly configured for restored staging.
- A deletion/retention/session-revocation reconciliation source is available.
- Cleanup owner and target verification are recorded.

Never run reset, restore, drop, or cleanup against a URL/project containing the production project ref.

## Evidence record

Complete before starting:

```text
Drill ID:
Date/time UTC:
Approved source backup ID (redacted alias):
Backup timestamp UTC:
Target staging alias:
Candidate commit/version/channel:
Migration head expected:
Storage inventory version:
Drill lead:
Approvers:
Target RPO:
Target RTO:
```

Record only aliases and safe counts. Attach provider details in the restricted operations system.

## Timed procedure

Start a monotonic timer at T0. Record actual start/end/duration and result for each phase.

### Phase 1: Isolate and preflight (target: 15 minutes)

1. Verify target allowlist and display a redacted target fingerprint.
2. Confirm production fingerprint differs.
3. Disable outbound integrations and scheduled/destructive jobs.
4. Capture target's empty/baseline migration list and storage configuration.
5. Confirm enough database/storage capacity and no real users can authenticate.
6. Confirm logs/diagnostics are restricted and redact content/tokens.

Stop if any identity, isolation, or capacity check is uncertain.

### Phase 2: Restore database (target: 30-60 minutes)

Use the approved Supabase/provider restore path appropriate to the artifact. Do not invent a generic `psql` command that bypasses managed Auth/platform requirements.

Record:

- restore start/end
- provider job result
- backup and target region (approved aliases)
- schema objects restored
- warnings/errors (redacted)
- backup timestamp versus T0 for achieved RPO

Do not open desktop traffic yet.

### Phase 3: Migration reconciliation (target: 15 minutes)

1. Compare restored migration history with the candidate commit.
2. Run `supabase migration list` against the staging target through approved operator configuration.
3. If the backup predates reviewed additive migrations, apply only the signed-off forward migration set.
4. Do not apply destructive, rewrite, or unknown migrations during the drill without a separate change approval.
5. Re-run schema smoke and generated-type comparison.

Expected repository checks:

```powershell
npm run supabase:smoke
npm run typecheck
```

Record every migration applied after restore. A migration mismatch without an approved path makes the drill fail/blocked.

### Phase 4: Post-restore reconciliation (target: 20 minutes)

Before users/clients can connect:

1. Reapply completed account anonymization/deletion records after the backup timestamp.
2. Reapply session/token revocations and security restrictions after the backup timestamp.
3. Reapply retention tombstones/finalization without touching legal holds.
4. Preserve append-only audit/account security events and detect missing ranges.
5. Restore current legal policy versions and acceptance state consistently.
6. Keep expired/quarantined attachment objects inaccessible.
7. Recheck disabled integrations, feature flags, and kill switches.

If the reconciliation ledger is unavailable or incomplete, do not promote the restored environment.

### Phase 5: Database integrity and application data (target: 20 minutes)

Use synthetic, approved test accounts. Run read-only checks first:

- `auth.users` and `public.profiles` correspond for test users.
- Profile username constraints and current legal/onboarding fields load.
- Communities have valid owners.
- Community members reference valid profiles, communities, and roles.
- Categories/channels reference valid communities.
- Messages reference valid channels/communities/authors; deleted rows remain tombstoned.
- Reactions, replies/threads, saved messages, reads, invites, reports, and notifications do not have unexpected orphans.
- Audit/account security logs remain append-only and are not missing due to cascade.
- Export/deletion request metadata is internally consistent.

Use `npm run data:integrity:check` only against the explicitly configured restored staging target and in its default read-only mode.

### Phase 6: RLS and authorization (target: 30 minutes)

Run distinct staging identities for:

- owner
- admin
- moderator
- member
- visitor/non-member
- blocked relationship
- app admin where applicable

Verify:

- Private community/channel/message/attachment denial.
- Visitor public-read rules and no write/reaction/upload access.
- Member role boundaries and no self-escalation.
- Message edit/delete ownership and moderator permissions.
- Direct conversation participants only.
- Report/audit/admin/trust-and-safety lists restricted.
- Export/deletion/legal-acceptance rows are own-user or trusted-only.
- Realtime subscriptions cannot bypass row visibility.

Run production-safe RLS checks in staging; do not use the service role as an end user:

```powershell
npm run supabase:rls:production-safe
```

If CLI/test credentials are unavailable, mark this phase blocked, not passed.

### Phase 7: Storage recovery (target: 30 minutes)

1. Restore a representative approved object set into private staging buckets.
2. Compare metadata inventory to object inventory by normalized key, checksum/ETag, size, and state.
3. Verify profile avatars, community icons, original attachments, and thumbnails where included.
4. Generate URLs only through the authenticated staging path; do not publish raw paths or long-lived signed URLs.
5. Verify private-channel objects return denial to non-members and after permission loss.
6. Verify suspicious/quarantined/failed scan states do not render or download.
7. Verify missing object metadata produces a safe unavailable state instead of leaking paths.

Record aggregate counts and mismatches only; do not include filenames or content.

### Phase 8: Desktop connectivity and smoke (target: 30-45 minutes)

Build/use the exact candidate and inject only restored staging public renderer values. Verify separately on Windows, Linux, and macOS where those platforms are release scope:

1. Electron starts with custom titlebar and no native menu duplication.
2. Login and session restore use staging Auth.
3. Profile, Mention Feed, community switching, channels, member list, and search load.
4. Send/edit/delete a staging-only message and confirm realtime in a second client.
5. Upload/view a staging-safe image; private access remains enforced.
6. Roles/permissions and visitor mode behave correctly.
7. Voice token/room smoke uses staging-only configuration or explicitly reports degraded/not configured.
8. Data export and account deletion test identities use safe non-production records.
9. No production URL, project ref, storage host, or user content appears in diagnostics.

Run local candidate checks as supporting evidence:

```powershell
npm run typecheck
npm run mock:smoke
npm run build
```

### Phase 9: Cleanup and close (target: 15 minutes)

1. Stop test clients and revoke temporary sessions/credentials.
2. Preserve redacted drill evidence and failure logs.
3. Delete temporary restored resources only after target fingerprint and approval are rechecked.
4. Never delete the source backup during drill cleanup.
5. Record final duration, achieved RPO/RTO, result, and action owners.

## Result criteria

### Pass

All required phases pass; restore, reconciliation, RLS, Storage, and desktop smoke are evidenced; achieved RPO/RTO are measured.

### Pass with non-blockers

Core recovery passes and only documented non-critical observations remain with owners/dates. Security, private access, integrity, backup completeness, or production-target ambiguity can never be non-blocking.

### Fail

Restore/integrity/RLS/Storage/private access/desktop connection fails, unexpected data appears, checksum differs, or measured recovery exceeds the approved critical threshold.

### Blocked

Required project, artifact, identity, CLI, approval, or platform is unavailable. Do not relabel blocked as passed.

## Timing and issues table

| Phase | Start UTC | End UTC | Duration | Result | Redacted issue/action |
|---|---|---|---:|---|---|
| Preflight | | | | | |
| Database restore | | | | | |
| Migrations | | | | | |
| Reconciliation | | | | | |
| Integrity | | | | | |
| RLS | | | | | |
| Storage | | | | | |
| Desktop smoke | | | | | |
| Cleanup | | | | | |

Final result: `PASS | PASS WITH NON-BLOCKERS | FAIL | BLOCKED`

Achieved RPO:  
Achieved RTO:  
Release impact:  
Next drill date:  
Approver sign-off:  

## Current task result

`BLOCKED / PROCEDURE PREPARED`: live execution requires an approved staging target, backup, storage inventory, test identities, provider/CLI access, and platform QA capacity. This is an honest environment limitation, not a product test failure.
