# Reports moderation workflow production

## Scope and privacy boundary

Picom supports reports for a community, community member, or message. A report stores the reporter, typed target reference, reason, reporter-authored description, status, reviewer, and timestamps. It does **not** copy the target message body, attachment bytes/path, unrelated channel history, account credentials, IP address, or private member profile into the report row.

Moderators may follow the target reference only inside their permitted community moderation context. Message/channel RLS remains authoritative; report visibility alone is not permission to browse unrelated private content.

## Submission

1. Authenticated user opens the existing desktop Report modal from an accessible target.
2. Client validates a community context, target reference, reason enum, and a 1,000-character bounded description.
3. Description strips control characters and redacts password/token/secret/authorization/cookie/API-key patterns.
4. Supabase insert RLS requires `reporter_id = auth.uid()` and verifies the community target, visible message/channel, or visible community member relation.
5. Status always begins `open`; clients cannot submit a reviewed/terminal report.
6. UI returns concise success/failure copy without raw database/RLS errors.

Rate limits, duplicate suppression, emergency abuse controls, and reporter receipts should be implemented at a trusted server/Edge Function boundary before public scale; they must not weaken RLS.

## Queue access

- The moderator panel begins with an empty list and loads only through `listCommunityReports(communityId, canReview)`.
- Local/mock mode rejects the list when `canReview` is false; it never briefly renders cached reports first.
- Supabase SELECT policy requires `can_moderate_community_reports(community_id)` for every row.
- Queries are community-scoped, newest-first, and bounded to 100 rows. Production pagination should use a stable cursor.
- Normal users/reporters do not receive the moderator queue through this service.
- App-level aggregate report counts must not include descriptions, target IDs, reporter IDs, or private message context.

## Status state machine

```text
open -> reviewed | dismissed | action_taken
reviewed -> dismissed | action_taken
dismissed -> terminal
action_taken -> terminal
```

The service enforces this in mock mode and the database trigger enforces it in Supabase. A non-open transition requires a reviewer; the first trusted transition sets `reviewed_at`. Terminal reports cannot be reopened or silently rewritten. A correction must be a new append-only administrative event.

RLS restricts update to community moderators and the hardened column grant permits only status/reviewer/timestamp fields. Reporter, target, reason, description, and community cannot be changed during review.

## Audit and moderator UI

- Audit is appended only after a successful local/Supabase transition.
- Audit metadata contains report ID and resulting status, not reporter description, message content, attachment data, tokens, or private paths.
- UI shows reason enum, target type, status, bounded reporter description, and aggregate counts.
- UI enables only valid transitions and does not show message body or surrounding private conversation by default.
- Any future context action must revalidate current access server-side and return minimum bounded context.
- Selecting `action_taken` records workflow status; it does not itself perform a timeout/delete/ban.

## Operations, appeal, retention

- Monitor aggregate submit failures, queue age, transition failures, and backlog without exposing report content.
- Retain reports under a separately approved evidence policy, legal holds, and appeal windows; do not cascade them accidentally.
- Restrict reporter identity/description to roles that need it and audit sensitive context access where required.
- Escalate imminent harm/security/legal reports through the approved incident path, not routine public tickets.

## Manual checklist

1. Submit community, user, and visible-message reports from an authenticated member.
2. Attempt a report for another community/private invisible message; verify RLS rejection and generic UI error.
3. Open queue as a permitted moderator and verify only the selected community appears.
4. Open queue as member/unrelated moderator; verify no rows render, including first frame.
5. Test every allowed transition and verify reviewer/reviewed timestamp plus audit event.
6. Attempt terminal-to-open/reviewed and cross-community update; verify rejection.
7. Include secret-like text/control characters in description; verify redaction and length bound.
8. Confirm queue/network/log/diagnostics do not contain target message body, attachments, authorization values, or unrelated context.

## Automated checks

- `npm run reports:production:test`
- `npm run audit-logs:immutability:smoke`
- `npm run typecheck`
- Supabase RLS/trigger behavior tests in an isolated project when CLI is available.
