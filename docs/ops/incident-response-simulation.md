# Picom incident response tabletop simulation

## Simulation status

This document records a **tabletop simulation**, not a live production incident or chaos test. No Supabase, LiveKit, Storage, release channel, user account, or desktop installation was modified. All identifiers, counts, times, and communications below are synthetic. No credentials, tokens, private messages, filenames, user data, or production URLs are included.

## Exercise objectives

- Test severity classification and first-15-minute ownership.
- Practice provider outage versus Picom regression decisions.
- Prove core text chat can degrade safely when voice/uploads fail.
- Test release pause/rollback for Windows, Linux, and macOS.
- Treat suspected private-channel exposure as SEV0 without waiting for proof.
- Produce plain-language communication without speculation.
- Convert gaps into blameless, owned postmortem actions.

## Participants and assumed roles

| Role | Tabletop responsibility |
|---|---|
| Incident commander (IC) | Severity, cadence, decision log, stop/close authority |
| Engineering lead | Desktop/backend technical diagnosis and mitigation |
| Operations lead | Supabase/LiveKit/provider health, releases, feature controls |
| Security/privacy lead | SEV0 containment, evidence, disclosure assessment |
| Support/communications lead | Status updates, user instructions, report intake |
| Scribe | Redacted timeline, hypotheses versus confirmed facts, actions |

Actual on-call names, contacts, provider project references, and escalation channels belong in the restricted operations directory, not Git.

## Common response rules

1. Start a redacted incident timeline and assign IC within five minutes.
2. Classify user impact, affected release/platforms, data risk, and provider status.
3. Preserve evidence; never request passwords/tokens or copy private content into normal tickets.
4. Freeze related deployments and destructive jobs.
5. Prefer a kill switch/degraded mode for isolated optional features.
6. Check database/client compatibility before rollback.
7. Communicate confirmed symptoms and safe user actions; label data impact as under investigation until proven.
8. Verify recovery from an unauthorized and authorized user perspective where access control is involved.

## Scenario 1: Supabase outage

### Inject

At T+00, API/database/realtime errors rise across all desktop platforms. Supabase provider status reports regional degradation. Existing app shells remain open; communities/messages fail to refresh and new sends remain recoverable/failed.

### Detection

- Health/readiness and synthetic auth/community/message checks fail.
- API/network diagnostics show provider/service errors, not invalid credentials.
- Realtime disconnect/reconnect rate rises.
- Support reports match Windows, Linux, and macOS.

Severity decision: **SEV1** for broad core-service outage; escalate to SEV0 only if integrity/data loss or unauthorized access is suspected.

### Mitigation

- Pause backend/migration/release activity and all retention/cleanup jobs.
- Confirm provider incident and affected region; avoid speculative local changes.
- Keep desktop UI in backend-unavailable/degraded state; preserve queued/failed message text and avoid retry storms.
- Disable uploads/realtime-dependent optional actions if repeated calls worsen impact.
- Do not restore from backup during an availability-only provider incident.

### Communication

Initial: "Picom is experiencing a service-provider outage. Sign-in, communities, messages, and live updates may be unavailable. Your local failed message text should remain recoverable. We are monitoring recovery."

Do not say data is lost or safe beyond current evidence. Update at a fixed 30-minute cadence.

### Rollback/recovery

- If metrics began after Picom deployment and provider is healthy elsewhere, roll back the backend/Edge/realtime change after compatibility review.
- If provider-caused, use no destructive rollback; wait/degrade and verify recovery.
- After provider recovery, verify Auth, profile, communities, channels, messages, RLS, uploads, realtime, exports, and pending jobs before resuming rollout.

### Postmortem actions

- Add provider-independent synthetic checks and clearer dependency attribution.
- Define reconnect/backoff and offline queue capacity thresholds.
- Measure actual provider outage RTO against SLO.
- Review whether a read-only cached/degraded experience is safe and worthwhile.

Tabletop outcome: response path clear; live provider alert routing/owner remains an operational setup item.

## Scenario 2: LiveKit outage

### Inject

At T+00, voice token requests succeed but room joins time out; provider status confirms media-plane degradation. Text chat, Supabase realtime, and uploads remain healthy.

### Detection

- Voice join success falls below threshold; token success versus room-connect failure separates provider/media from auth.
- Connected rooms show reconnecting/quality failures.
- Core API/message SLO stays normal.

Severity decision: **SEV2**, raised if the voice path crashes/freezes the desktop or exposes rooms.

### Mitigation

- Activate `disableVoiceRooms`/voice availability control in remote config and enforce server token refusal where appropriate.
- Existing clients show voice unavailable and leave/cleanup safely.
- Do not restart Supabase/database or disable text messaging.
- Preserve no live audio/video; collect only room IDs/request IDs and aggregate connection errors.

### Communication

"Voice rooms and screen sharing are temporarily unavailable. Text chat and image messaging continue to work. Leave and rejoin only after the status update."

### Rollback/recovery

- If caused by token Function/config release, revert Function/provider configuration and rotate credentials if exposure is suspected.
- If provider-caused, keep voice disabled/degraded until two-user audio, mute/deafen, speaking indicator, screen share, and cleanup pass in staging/controlled production test.
- Re-enable through internal/beta ring first.

### Postmortem actions

- Dashboard token success separately from media connection success.
- Add tested voice kill-switch runbook and user-facing provider status.
- Define room reconnect ceiling preventing desktop resource growth.

Tabletop outcome: optional-feature isolation works conceptually; live remote-config and provider alert drills remain required.

## Scenario 3: Bad desktop build

### Inject

A beta Windows build opens to a white screen after install; Linux reports no regression and macOS was not in the ring. Crash diagnostics point to a renderer import/runtime mismatch. Backend remains compatible with the prior version.

### Detection

- Crash-free/startup success drops only for version/platform pair.
- Checksum/provenance matches the published artifact, indicating a bad build rather than download corruption.
- Safe mode may start but core UI is unavailable.

Severity decision: **SEV1** for a ring-wide startup blocker; SEV2 if limited to a small beta ring with immediate recovery.

### Mitigation

- Pause the affected release channel and remove recommendation/download promotion.
- Keep artifact, checksum, provenance, logs, and build environment evidence restricted for analysis.
- Publish safe manual rollback/reinstall instructions; do not ask users to delete settings/cache unless corruption is proven.
- Confirm previous known-good Windows artifact and server minimum-version compatibility.

### Communication

"Picom beta version X for Windows may fail to start. We paused the rollout. If affected, reinstall the previous verified version from the official release location; your account data remains server-side. Do not delete local data unless support instructs you."

### Rollback/recovery

- Roll the Windows channel back to the previous signed/checksummed artifact; Linux/macOS remain unchanged.
- If update service is not production-ready, use manual package withdrawal/replacement and release notes.
- Validate clean install, upgrade, existing settings migration, login, shell, chat, and uninstall/reinstall before resuming a small ring.

### Postmortem actions

- Add packaged-app startup smoke for each OS, not only Vite build.
- Verify dynamic imports/assets from installed paths.
- Require install-and-launch evidence for release candidate go/no-go.
- Record build machine/toolchain provenance.

Tabletop outcome: platform-specific ring pause limits blast radius; production update rollback remains intentionally manual/not fully implemented.

## Scenario 4: Private channel leak suspected

### Inject

A member reports seeing a search result title and attachment preview from a private channel after losing membership. The report includes safe IDs but no copied content. Cause is unknown: stale UI cache, search RPC, Storage URL, or RLS.

### Detection

- User report triggers immediate security/privacy escalation.
- Reproduce using dedicated authorized/unauthorized test identities.
- Compare database RLS, search RPC, realtime subscriptions, Storage object access, signed URL lifetime, local cache, and logs.

Severity decision: **SEV0 immediately on credible suspicion**. Do not wait for confirmed content exposure.

### Mitigation

- Freeze deploys and preserve audit/release/policy evidence.
- Disable advanced search, attachment delivery, realtime room joins, or affected private-content path with server enforcement, starting with narrowest safe containment.
- Revoke affected sessions/signed URLs where supported; rotate secrets only if compromise is plausible.
- Patch RLS/backend authorization before relying on frontend hiding.
- Avoid broad deletion that destroys evidence.

### Communication

Internal and external messaging requires security/privacy approval. Initial user-safe message: "We are investigating a report that private community content may have been shown outside its intended access. We have restricted the affected path while we verify scope."

Do not name users/communities, quote content, minimize impact, or claim breach/no breach prematurely.

### Rollback/recovery

- Revert the policy/RPC/release that opened access only after checking migration compatibility.
- Verify private community/channel/message/search/attachment/realtime denial with multiple non-member and removed-member identities.
- Review cached/signed content expiration before declaring containment.
- Security/privacy owner approves restoration and notification decision.

### Postmortem actions

- Mandatory blameless SEV0 postmortem and legal notification assessment.
- Add regression test for removed membership across list/search/realtime/storage/cache.
- Add access-denied telemetry without content.
- Review signed URL TTL and cache invalidation on permission loss.

Tabletop outcome: correct SEV0 classification and backend-first containment; actual breach notification owners/timelines require jurisdictional operations setup.

## Scenario 5: Auth login failures

### Inject

Valid-login success drops after a legal-acceptance/profile migration rollout. Existing sessions continue for some users; new login and registration fail. Error logs contain safe codes only.

### Detection

- Valid auth failure rate crosses threshold, separated from expected invalid-password errors.
- Supabase Auth provider is healthy.
- Correlation begins at migration/release timestamp.
- Profile trigger/RLS/acceptance RPC errors appear with request IDs.

Severity decision: **SEV1** when broad; SEV2 for a limited registration-only issue with working existing sessions.

### Mitigation

- Pause release/migrations and preserve failed transaction evidence.
- Do not disable password policy or expose raw provider errors.
- If existing sessions are safe, tell users not to sign out unnecessarily.
- Disable new registration temporarily if it creates partial accounts; keep login if independently safe.
- Use a reviewed forward fix when database down migration is unsafe.

### Communication

"Some users cannot sign in or create accounts. Existing signed-in sessions may continue to work. Do not share passwords or reset codes with support. We are preparing a safe fix."

### Rollback/recovery

- Roll back desktop/auth service only if compatible with current profile schema.
- Prefer additive/forward database repair over destructive rollback.
- Verify signup trigger, terms acceptance, profile creation, email/password login, session restore, logout, password reset, and revoked-session rejection.

### Postmortem actions

- Add staging migration test covering Auth trigger order and profile readiness.
- Alert separately on provider, credential, profile-trigger, and policy failures.
- Add canary registration/login identities with no real personal data.

Tabletop outcome: forward-fix decision avoids unsafe schema rollback; live canary alerting remains to implement.

## Scenario 6: Storage upload failures

### Inject

Valid PNG/JPEG uploads fail after a bucket policy change. Text messages work. Existing private attachments still load for authorized users; invalid MIME rejections remain expected.

### Detection

- Valid upload success drops while validation rejection rates stay normal.
- Supabase Storage errors correlate with policy deploy.
- Message insert without attachment remains healthy.
- Object inventory shows no unexpected public access or orphan spike.

Severity decision: **SEV2** for upload outage; SEV0 if private files become public or suspicious/quarantined files are served.

### Mitigation

- Activate `disableUploads` in UI and enforce backend/storage write disable; leave text chat available.
- Preserve pending composer files locally only as currently safe; do not automatically retry storms.
- Revert policy/config in staging first where possible.
- Keep suspicious/failed/quarantined objects blocked.

### Communication

"Image uploads are temporarily unavailable. Text chat continues to work. Keep your original file and retry after the service update; Picom will not ask you to upload it through another channel."

### Rollback/recovery

- Restore known-good bucket/RLS policy after verifying private read and member-only write.
- Reconcile metadata/object orphans and never expose raw paths.
- Test allowed/blocked MIME and size, cancel/retry, thumbnail/original, private access, permission loss, quarantine, and signed URL expiration.

### Postmortem actions

- Add staging policy diff and upload canary before promotion.
- Dashboard valid provider failures separately from expected validation blocks.
- Add automatic bounded kill-switch recommendation, not automatic policy mutation.

Tabletop outcome: graceful text-chat continuity and narrow disable path are clear; provider-side canary/alerts require deployment.

## Consolidated tabletop timeline

| Time | Expected action | Owner |
|---:|---|---|
| T+0 | Alert/report received; open redacted incident | First responder |
| T+5 | Assign IC/scribe/technical/comms; classify severity | IC |
| T+10 | Freeze relevant changes; confirm provider/release/data-risk scope | Operations + engineering |
| T+15 | Select containment, kill switch, degrade, or rollback hypothesis | IC + owners |
| T+30 | Publish first user update for active impact | Communications |
| T+45 | Verify mitigation with targeted authorized/unauthorized smoke | Engineering/security |
| T+60 | Decide rollback/forward fix/provider wait and next update | IC |
| Recovery | Verify SLO, data/access integrity, platforms, and resume criteria | All owners |
| +2 business days | Schedule mandatory SEV0/SEV1 or repeated-SEV2 review | IC |

## Gaps discovered

1. Real on-call names, escalation channels, and provider alert routing are not stored in an approved operations directory yet.
2. Production telemetry/alert thresholds remain partly planning targets.
3. Remote-config kill switches need a live, authenticated operator drill and backend enforcement verification.
4. Bad desktop build rollback remains manual while production auto-update is out of scope.
5. Private-channel incident notification deadlines/contacts require regional legal approval.
6. Supabase/LiveKit/storage canary identities and dashboards need deployment evidence.
7. No actual timing was measured; this tabletop validates decisions, not provider recovery performance.

## Post-exercise actions

| Action | Priority | Owner placeholder | Due placeholder |
|---|---|---|---|
| Create restricted on-call/provider escalation directory | Blocker | Operations | Before production |
| Run private-channel isolation incident drill in staging | Blocker | Security + backend | Before public beta expansion |
| Exercise voice/upload kill switches with backend enforcement | High | Realtime/storage | Before stable |
| Add auth and storage synthetic canaries | High | Operations | Before stable |
| Add installed-package startup signal by OS/release version | High | Desktop/release | Before broad beta |
| Approve privacy/security communication and notification workflow | Blocker | Legal + security | Before production |
| Repeat tabletop after monitoring/on-call setup | Medium | IC owner | Quarterly |

Use `docs/postmortem-template.md` for real incidents. The exercise itself is blameless: gaps identify system/process improvements, not individual fault.
