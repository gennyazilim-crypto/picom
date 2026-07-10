# Secrets rotation drill: 2026-07-10

## Exercise status

- Type: tabletop / documentation-only
- Environment: synthetic staging placeholders
- Production rotation: not approved and not executed
- Real secrets/keys/certificates/tokens: none used, displayed, logged or committed
- Runbook: `docs/secrets-management.md` and `docs/incident-response.md`

## Roles

- Rotation commander: Operations placeholder
- Supabase owner: Backend/Database placeholder
- LiveKit owner: Voice placeholder
- Release signing owner: Release Engineering placeholder
- Security observer/approver: Security placeholder
- Application verifier: QA placeholder
- Scribe/communications: Support placeholder

Real execution requires named primary/backup people, provider access, step-up authentication and a private operations record.

## Inventory practiced

| Credential class | Renderer allowed? | Rotation owner/store | Exercise result |
| --- | --- | --- | --- |
| Supabase URL and publishable/anon key | Public client configuration, not authorization; RLS required | Supabase config/release owner | Rollover/desktop compatibility documented only |
| Supabase service-role key | Never | Trusted backend/Function secret store | Revoke-first emergency and overlap-if-provider-supported paths documented |
| Database password/connection credential | Never | DB operations secret manager | Pool/redeploy/connection-drain path documented |
| LiveKit API key/secret | Never | Token Function/voice secret store | Dual-key overlap if provider supports, otherwise bounded downtime path |
| Session/Auth signing secret | Never | Auth trusted service/secret manager | Multi-key validation/grace or forced session invalidation decision required |
| Bot/webhook/SCIM provider secrets | Never | Scoped backend secret store | Per-credential revoke/rotate/audit; enterprise SCIM remains disabled |
| Windows/macOS release signing credentials | Never | Protected release CI/HSM/keychain | Certificate renewal/compromise path; signed artifacts immutable |
| Updater signing key | Never | Protected release CI | Auto-update production disabled; no key exists/rotated in this drill |

## Normal rollover sequence

1. Open approved change record; identify secret ID/prefix/fingerprint only, dependencies, owner, expiry and rollback.
2. Confirm backup/recovery, provider access, monitoring, maintenance window and no active incident.
3. Generate replacement in provider/secret manager; never workstation clipboard/docs/chat.
4. Configure staging consumer with new credential while old remains valid if safe/provider-supported.
5. Run health plus exact staging flows and redaction/secret scan.
6. Deploy trusted production consumers in controlled order; renderer receives no private secret.
7. Verify new credential usage through safe provider metadata/health, not raw logs.
8. Drain old connections/caches; revoke old credential.
9. Verify old credential is rejected without printing it; monitor errors/abuse.
10. Record actor/time/provider reference/result privately and close change.

Do not create indefinite dual-key overlap. Define maximum overlap before generation.

## Emergency compromise sequence

1. Declare security incident and stop copying/testing suspected value.
2. Preserve access/audit evidence with fingerprints/request IDs only.
3. Disable affected feature or revoke suspected credential immediately when risk outweighs downtime.
4. Generate replacement in secret manager/provider.
5. Redeploy/restart minimal trusted consumers; invalidate sessions/derived tokens where needed.
6. Search for misuse and secondary exposure using redacted logs/secret scanning.
7. Verify service and old-key rejection; keep rollout frozen.
8. Communicate impact without secret/provider internals; complete postmortem and scope expansion review.

## Supabase practice

### Public/anon key

- It is bundled public configuration, not a private credential; RLS/backend authorization must remain safe if copied.
- Rotation can require desktop public config/release compatibility. Backend accepts planned overlap where provider supports it; old desktop versions must not be silently locked out without minimum-version/update plan.
- Verify login/register/session restore, communities/channels/messages, Storage and Realtime on Windows/Linux/macOS staging.
- Do not call public key rotation a response to weak RLS; fix policies independently.

### Service-role key

- Inventory Edge Functions/backend jobs only; renderer/desktop artifacts must contain none.
- Update trusted secret store and deploy consumers before old-key revocation if safe overlap exists.
- If suspected compromise, revoke first, accept bounded backend downtime, pause workers/exports/admin jobs and redeploy.
- Verify service-role operations are least-privilege in design, RLS client flows still work, logs/build artifacts/diagnostics remain clean.

### Database credential

- Rotate in DB/provider, update pool/worker secrets, restart/drain connections and verify readiness/query/background jobs.
- Plan no-overlap downtime if provider cannot support dual passwords/users.
- Never put credentialed `DATABASE_URL` in renderer, command examples or incident notes.

## LiveKit practice

- Create replacement API key/secret in LiveKit provider if supported.
- Update only trusted token Function secrets and deploy canary.
- Verify valid member voice/screen token request, join/mute/deafen/reconnect/leave; token value never logged.
- Revoke old key after TTL/overlap window; already issued tokens may remain valid until expiry, so emergency response may require room/session termination.
- If no dual key, schedule short voice-only outage; text chat remains available and degraded state is communicated.

## Signing credential practice

- Private code-signing/notarization/updater keys remain in protected CI/HSM/keychain, never `.pfx`/`.p12`/key file in repo.
- Normal renewal: enroll new cert/key, update protected signing identity, sign/notarize test artifact, verify trust on Windows/macOS, then retire old credential according to timestamp/certificate policy.
- Compromise: stop release pipeline, revoke certificate/key with issuer/provider, withdraw affected artifacts/feed, identify signed versions/provenance, generate approved replacement and publish signed hotfix only after incident review.
- Existing signed artifacts are immutable; never re-sign in place.
- Linux repository signing is handled separately if repository distribution is approved.

## Downtime and rollback

| Area | Expected normal rollover | Emergency/no overlap | Rollback limitation |
| --- | --- | --- | --- |
| Supabase public key | Potential desktop compatibility window | Login/API outage for old clients if revoked | Cannot restore a revoked key unless provider supports re-enable; release/config compatibility required |
| Service-role/DB | Zero/low with overlap and drain | Backend/admin/job/readiness outage | Suspected key must not be restored; roll forward with new key |
| LiveKit | Zero/low with dual keys | Voice join outage; text chat unaffected | Old compromised key cannot be re-enabled; issued token TTL considered |
| Signing | No user downtime during controlled renewal | Release/update publication paused | Revoked signing key cannot be rollback target; publish new signed artifact |

Rollback means roll forward to corrected new secret/config or known-good consumer deployment, not reactivating a suspected credential.

## Verification checklist

- health/live/ready and dependency status;
- Auth/session, message, Realtime, Storage/upload and voice staging smoke as applicable;
- old credential rejected after revoke without exposing value;
- no auth/reconnect/retry storm;
- current/previous desktop compatibility decision recorded;
- CI, provider, Function/backend, logs, diagnostics, release artifact and support export secret scans pass;
- audit/change record contains identifiers/fingerprints only;
- emergency access removed and provider sessions closed.

## Tabletop timeline and result

- 10:00 UTC: roles/inventory/change scope reviewed.
- 10:10: normal Supabase/LiveKit overlap and consumer deploy order walked through.
- 10:25: emergency service-role compromise injected; team selected revoke-first, pause trusted jobs, roll-forward replacement.
- 10:35: signing compromise injected; release pipeline pause/revocation/provenance/hotfix sequence selected.
- 10:50: verification, old-key rejection, compatibility and communications reviewed.
- 11:00: exercise closed.

Result: **Pass as tabletop, blocked for live rotation.** Missing evidence includes named owners/on-call, selected production secret manager, provider-specific dual-key behavior, automated staging core-flow E2E, signing infrastructure and approved rotation schedule.

## Follow-ups

- Assign named owners/backups and private inventory identifiers.
- Select/approve production secret manager and protected release-signing design.
- Verify Supabase/LiveKit key rollover behavior in isolated staging.
- Automate redacted post-rotation smoke and old-key rejection checks.
- Define rotation cadence/expiry alerts and emergency contact tree.
