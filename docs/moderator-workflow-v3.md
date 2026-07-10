# Moderator workflow v3 plan

Status: workflow plan only; no new moderation capability is enabled  
Reviewed: 2026-07-10  
Platform: Picom Electron desktop for Windows, Linux and macOS

## Objective

Unify report triage, bounded evidence review, member/message actions, timeouts, appeals and audit history into a predictable desktop moderator workflow. Moderators receive only the minimum information and authority needed for the selected community and case.

## Current foundation and gaps

Available foundations:

- Community-scoped report submission and a permission-gated report queue.
- Report state machine with immutable reporter/target/reason fields after submission.
- Typed action ledger contract for ban, kick, timeout, message delete and other actions.
- Appeals with bounded/redacted user reason and reviewer decision note.
- Role-aware moderator panel separate from owner/admin settings.
- Append-only audit policy and redacted audit metadata rules.

Important gaps:

- `action_taken` on a report records workflow status but does not perform a timeout/delete/kick/ban.
- Production moderation actions do not yet consistently write the trusted action ledger in the same transaction.
- Evidence access and context-window policy need a single approved contract.
- Timeout creation/expiry/revocation, notification and reconnect behavior need production implementation/evidence.
- Hosted RLS/negative-role tests and moderator staffing/SLA evidence remain required.
- Accepted appeals do not automatically reverse the underlying action, by design.

The UI must label unavailable operations honestly until these gaps are closed.

## Roles and permission boundaries

| Capability | Owner | Admin | Moderator | Member/visitor |
| --- | --- | --- | --- | --- |
| Open moderation workspace | Yes | With moderation permission | With moderation permission | No |
| List community reports | Yes | `moderateMessages`/approved review permission | Same | No |
| View bounded target evidence | Explicit target/channel permission plus moderation permission | Same | Same | Own report receipt only |
| Delete another user's message | `deleteAnyMessage` | `deleteAnyMessage` | `deleteAnyMessage` | No |
| Timeout member | Explicit `timeoutMembers`/member-moderation permission | Same | Same | No |
| Kick/ban | `kickMembers`/`banMembers` | Granted permission and hierarchy | Granted permission and hierarchy | No |
| Review appeal | Approved review permission and independence rule | Same | Same | Own appeal only |
| Manage roles/community settings | Owner | Separate admin permissions | No by moderation status alone | No |
| View audit log | `viewAuditLog` | `viewAuditLog` | Only moderation subset if explicitly granted | No |

Role level alone must not silently grant private-channel browsing. The backend validates community scope, current actor membership, explicit action permission, target hierarchy and channel visibility at action time.

## Moderator desktop workspace

Use the existing Community Moderator Panel, not a mobile sheet or app-level enterprise console.

Sections:

1. **Queue:** assigned/unassigned reports with safe filters.
2. **Case:** report details and bounded evidence links.
3. **Action:** allowed message/member actions and required reason.
4. **Appeals:** open/under-review appeals the moderator may review.
5. **Moderation history:** immutable action/audit timeline for the case.

Owner/admin-only community settings, role creation, ownership transfer, billing and unrelated member data never appear merely because the user is a moderator.

## Report queue

### Queue fields

- Report ID.
- Target type: community, member or message.
- Reason enum and bounded description preview.
- Status: open, reviewed, dismissed or action taken.
- Created/age bucket and assigned reviewer state.
- Priority band determined by approved policy, never a secret ML guilt score.
- Evidence availability state, not message body.

Do not show reporter identity in the list unless policy proves it necessary. Never show raw message/attachment content, channel history, tokens, IPs, account credentials or internal risk score in queue rows.

### Filters and ordering

- Default open, oldest/high-priority first.
- Status, target type, reason category, assignment and age filters.
- Stable cursor pagination and bounded page size.
- Server-side community scope and permission on every page.
- Empty/loading/error/permission-denied states without cached cross-community flashes.

### Claiming and concurrency

- Optional Claim assigns a reviewer through a versioned/idempotent RPC.
- Two moderators cannot silently overwrite each other's transition.
- Case response includes version/updated timestamp; stale updates return `MODERATION_CASE_CONFLICT` and require refresh.
- Assignment does not grant broader evidence access.

## Case triage workflow

1. Open report from the authorized queue.
2. Load report facts; no target content is copied into the report row.
3. Request the exact evidence link if needed; backend re-authorizes current channel/target context.
4. Choose: dismiss, mark reviewed/no action, or open a specific action form.
5. For action, select allowed action type, bounded duration where applicable and required reason code/text.
6. Show confirmation with target, scope, duration, visible consequences and appealability.
7. Submit one idempotent action RPC.
8. After transaction success, update case state, append audit/action ledger and send approved notification/realtime event.
9. If action fails, report remains open/reviewed and no partial `action_taken` state is recorded.

## Evidence links and minimum context

An evidence link is an opaque reference to an authorized target, not a copied payload or public URL.

Suggested shape:

```ts
type ModerationEvidenceLink = Readonly<{
  evidenceId: string;
  reportId: string;
  targetType: "message" | "member" | "community" | "attachment";
  targetId: string;
  contextPolicy: "target_only" | "bounded_thread" | "bounded_channel_window";
  expiresAt: string;
}>;
```

Rules:

- Generate server-side only after report/community/action permission checks.
- Short-lived, single-purpose and non-transferable to another account/community.
- Default `target_only`; bounded surrounding messages require explicit policy and current channel access.
- Never reveal private channels the moderator cannot otherwise moderate.
- Attachment evidence uses authorized signed access and quarantine/scan controls.
- Do not persist copied message bodies in report, audit, analytics or support logs.
- Audit sensitive evidence open events using IDs and policy, not content.
- Deleted/unavailable targets show immutable metadata and a safe unavailable state; no storage-path fallback.

## Action reasons

Every punitive/destructive action requires:

- Normalized reason code from an approved enum.
- Bounded moderator note, optional only where policy allows.
- Target and scope.
- Duration for timeout.
- Appealability and deadline decision from policy, not arbitrary renderer input.

Example reason codes:

- `spam`
- `harassment`
- `unsafe_content`
- `rule_violation`
- `impersonation`
- `privacy_violation`
- `other_reviewed`

Notes strip control characters and redact password/token/authorization/cookie/API-key patterns. Audit/action ledgers store the reason code and a redacted bounded summary, not raw evidence.

## Timeout workflow

Timeout is a reversible participation restriction, not membership deletion.

Required fields:

- Community and affected user.
- Actor and reason code.
- Start/end timestamps from server time.
- Scope: default community send/reaction/upload/voice-join restrictions; narrower scopes require separate policy.
- Active/revoked/expired state.
- Appealability/deadline.

Rules:

- Duration choices are bounded by actor permission; custom duration has server maximum.
- Actor cannot timeout owner, self or equal/higher hierarchy unless an explicitly approved owner path exists.
- Backend enforces timeout on message/reaction/upload/voice operations; disabled UI is not enforcement.
- Expiry is calculated server-side and checked at request time even if a cleanup job is delayed.
- Realtime event updates connected clients after transaction success.
- Revoke early is a separate audited action; original action remains immutable.
- Current user receives clear duration/reason-category/appeal information without private moderator notes.

## Other action transactions

### Message delete

- Re-authorize target message/channel and `deleteAnyMessage` at submission.
- Apply configured soft-delete/tombstone policy.
- Preserve reply fallback and audit/action reference without copying body.

### Kick

- Remove membership atomically, preserve audit/action ledger and invalidate community room access.
- Does not create a ban unless explicitly selected as a separate action.

### Ban

- Create/activate ban, remove membership, revoke relevant access and disconnect realtime session rooms atomically.
- Preserve ownership/hierarchy restrictions and invite rejection.

No action grants the moderator access to unrelated DMs, private channels, device/activity history or other communities.

## Appeals

### User flow

- Appeal starts only from a trusted `moderation_action_id` affecting the current user.
- User submits one bounded/redacted reason before the policy deadline.
- No evidence attachment until scanning/access/retention rules are approved.
- Submission never exposes moderator identity/notes or internal detection evidence.

### Reviewer flow

- Queue lists only appeals in the selected authorized community.
- Reviewer opens action facts, user reason and permitted evidence reference.
- State: `open -> under_review -> accepted | denied | closed`.
- Require bounded decision category/note and reviewer identity.
- Recommended independence: the original action actor does not decide the appeal except emergency fallback under audited policy.

### Accepted appeal

Acceptance records a decision, not an automatic reversal. A separate permission-checked transaction must revalidate current state, perform the exact reversible operation, append audit/action facts and notify the user. Failed reversal leaves an explicit `accepted_reversal_pending/failed` operational state rather than claiming success.

## Audit and moderation history

Required append-only facts:

- Report submitted/status transitioned/assigned.
- Evidence link opened where policy requires.
- Action attempted/succeeded/failed with request ID and safe error code.
- Timeout expired/revoked.
- Appeal submitted/reviewed/decided.
- Reversal attempted/succeeded/failed.

Normal clients cannot update/delete audit or action ledger rows. Corrections are compensating entries. Message bodies, report descriptions, appeal text, attachment paths, stack traces and secrets remain out of audit metadata.

The moderator history view shows only community-scoped rows allowed by `viewAuditLog` or a narrower moderation-history permission. Export remains separately approved and redacted.

## Privacy boundaries

- Minimum necessary case context, requested intentionally and time-bounded.
- No private message access unless the reported target and moderator policy explicitly authorize it.
- No broad member browsing through report identity.
- Reporter identity restricted to roles/purposes that require it.
- No moderator/user performance leaderboard or individual risk profile.
- No automated guilt inference from report volume.
- No evidence in analytics; operational aggregates use safe status/error bands.
- Retention follows approved report/action/appeal/legal-hold policy and preserves audit integrity.

## Error and recovery states

- `PERMISSION_DENIED`: close protected case data and explain access changed.
- `REPORT_NOT_FOUND`: neutral unavailable state.
- `TARGET_UNAVAILABLE`: retain case facts; evidence unavailable.
- `MODERATION_CASE_CONFLICT`: reload before retry.
- `ACTION_NOT_ALLOWED`: hierarchy/policy changed; no partial state.
- `RATE_LIMITED`: show retry-after without duplicate submission.
- `NETWORK_ERROR`: stable idempotency key allows safe retry.
- `REVERSAL_FAILED`: escalate operationally; do not rewrite history.

Raw backend messages/stacks remain in redacted diagnostics only.

## Staging validation

1. Test owner, limited admin, moderator, member, visitor and cross-community accounts.
2. Prove queue rows never flash from cache before authorization.
3. Prove private/unrelated targets cannot be opened through crafted evidence IDs.
4. Exercise valid/invalid report and appeal transitions plus stale-version conflicts.
5. Test timeout enforcement on messages, reactions, uploads and voice; verify expiry/revoke.
6. Test owner/equal-hierarchy and self-action rejection.
7. Test atomic action failure: no `action_taken`, audit success or notification before commit.
8. Test ban/kick realtime room removal and invite rejection.
9. Verify logs/audit/exports exclude message bodies, secrets and raw evidence.
10. Run appeal acceptance and separate reversal success/failure paths.

## Rollout gates

- Hosted RLS/RPC negative tests pass.
- Action ledger and audit immutability are enforced in database grants/policies.
- Evidence access policy, retention and moderator training are approved.
- Report/appeal queues have staffing, SLA and escalation ownership.
- Rate limits, idempotency and conflict handling pass staging.
- Kill switches can disable risky actions without hiding existing case evidence.
- Incident response covers suspected private-channel evidence leakage.

## Non-goals

- Automated moderation decisions, AI guilt scoring or sentiment surveillance.
- Enterprise/app-admin console, legal evidence export or law-enforcement portal.
- Cross-community moderator power.
- Full private conversation access.
- Implementing report, timeout, appeal, audit or evidence code in this task.
- Mobile/web moderator UI.
