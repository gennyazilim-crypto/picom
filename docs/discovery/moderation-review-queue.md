# Discovery Moderation Review Queue

## Purpose

Picom's Discovery review queue gives app-level operators a controlled workflow for deciding whether an owner-submitted public community profile may appear in Discovery. It does not expose private community content and does not grant community moderation powers.

## States

- `pending`: awaiting an app-level listing decision; never public in production Discovery.
- `approved`: eligible only while community remains public, public-read enabled, and discovery-listed.
- `rejected`: not eligible; owner changes may require a new submission/review process.
- `hidden`: temporarily removed from Discovery without changing community membership/content.
- `suspended`: removed for a safety/policy concern pending operator resolution.

Only `approved` rows satisfy the production listing RPC. Changing community visibility to private or disabling listing/public-read removes eligibility regardless of review state.

## Access model

The desktop queue is inside guarded Admin Operations and requires development access or protected `is_app_admin()` access. Backend list/update RPCs independently call `is_app_admin()` and fail closed.

Community moderators do not receive the app-wide queue. They may report a public community through the existing Report action; future scoped escalation can forward safe signals to app operators. This prevents a moderator in one community from seeing another community's review data.

## Safe queue projection

The review RPC returns only owner-intended public listing metadata:

- Community ID.
- Public name, description, icon, and category.
- Review state.
- Aggregate community-report count.
- Owner-declared, allowlisted content flags.
- Submission/review timestamps.

It excludes:

- Private/unlisted communities.
- Member identities or profiles.
- Channels, messages, attachments, roles, invites, bans, and audit history.
- Report descriptions, reporter identities, targets, or private evidence.
- Tokens, IPs, sessions, service-role configuration, and provider secrets.

## Review action

`review_discovery_listing` validates app-admin access, target public/listed state, and bounded status/note. In one database transaction it:

1. Inserts or updates the review row.
2. Records reviewer ID and timestamp.
3. Appends a `discovery_review` audit event with bounded reason.

If audit insert fails, the review state change rolls back. Normal renderer roles have no direct table grants.

## Report community flow

Discovery cards open the existing `ReportModal` for `targetType: community`. Report submission uses the established report service/RLS. The review queue consumes only aggregate report count; operators needing case detail must use a separate authorized Trust & Safety/report workflow.

Reports do not automatically suspend or reject a listing. A future threshold may prioritize review but requires abuse-resistance and human decision policy.

## Operator workflow

1. Filter pending or escalated states.
2. Review the safe public profile and aggregate report count.
3. Use authorized report/safety tools if case evidence is required.
4. Select approved, rejected, hidden, suspended, or pending.
5. Add a bounded non-sensitive reason.
6. Apply; verify audit event and listing behavior.
7. Communicate decision through a future policy-approved owner notification channel.

## Anti-abuse and operational controls

- Rate-limit submission/resubmission and report actions.
- Material changes to name, description, icon, category, visibility, public-read state, listing state, or content flags automatically reset approval to `pending`.
- Report submission is limited to five attempts per authenticated user per hour using content-free counters.
- Re-review material profile changes.
- Prevent owners from directly setting approval status.
- Prioritize repeated reports without exposing reporter identity in the queue.
- Add a backend emergency Discovery kill switch.
- Monitor content-free state transitions and queue age.
- Require two-person review for high-impact suspensions if policy demands it.
- Retain review/audit records separately from normal community deletion where legally appropriate.

## Current limitations

- Mock review state is local and intended only for desktop workflow testing.
- Production queue requires migrations and an app-admin record.
- Owner submission/resubmission UI and notification are not implemented.
- Detailed report moderation remains in the separate report/safety flow.
- No automated classification or content scanning decides approval.
- Live RLS/RPC verification requires Supabase CLI or staging.

## Test matrix

- Normal user cannot call list/update RPCs.
- Community moderator cannot access another community's queue entry.
- App admin can list public/listed pending profiles.
- Private/unlisted profile is absent.
- Approve makes an otherwise eligible listing discoverable.
- Reject/hide/suspend removes it from Discovery.
- Status update writes exactly one audit event transactionally.
- Queue never returns report descriptions or member/channel/message data.
- Report action remains available on safe public Discovery cards.
