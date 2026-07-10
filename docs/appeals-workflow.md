# Appeals workflow

## Scope and status

Picom prepares community moderation appeals without rewriting moderation actions or enabling automatic reversals. The foundation includes typed states, a renderer service boundary, a trusted moderation-action ledger contract, Supabase RLS, transition guards, bounded/redacted text, and decision audit events. No final legal policy, SLA, email provider, attachment upload, or public support route is claimed.

## Why an action ledger is required

Checking only `affected_user_id = auth.uid()` is insufficient because a client could invent an action ID. `moderation_action_records` is a minimal, append-oriented source ledger written only by a trusted backend/service identity. Authenticated clients have SELECT only when they are the affected user or a permitted community reviewer; they have no insert/update/delete privilege.

Each record binds:

- community;
- affected user;
- trusted moderator actor where retained;
- action type (`ban`, `kick`, `timeout`, `message_delete`, `other`);
- optional target reference;
- bounded reason code;
- appealable flag/deadline;
- creation timestamp.

Existing moderation UI does not write this ledger yet. Until a trusted action transaction writes it, production appeal submission correctly fails closed.

## Submission

1. User enters from a notice/state tied to a real `moderation_action_id`.
2. Service requires `affectedUserId === currentUserId`, community/action IDs, and a 10–2,000 character reason.
3. Text strips controls and redacts credential-like patterns.
4. Supabase verifies the authenticated user equals `affected_user_id` and the action belongs to the same community/user, is appealable, and is within deadline.
5. A unique action/user constraint prevents duplicate appeals.
6. Initial state is always `open`; reviewer and decision fields are null.

Users can list only their own appeals. Submission does not expose moderator notes, unrelated member data, private messages, attachments, tokens, storage paths, or internal detection evidence.

## Reviewer access

- Community queue requires the existing `can_moderate_community_reports(community_id)` permission boundary.
- Mock/service calls additionally require `canReview` for UX/fail-closed behavior.
- Supabase SELECT/UPDATE independently scope every row to that community and reviewer permission.
- Normal users cannot change status, decision note, reviewer, or timestamps.
- Reviewers cannot change submitter, action, community, or original reason through allowed column grants.
- A future independence rule may prevent the original action actor from deciding the appeal; it requires approved policy and action/reviewer evidence.

## State machine

```text
open -> under_review | accepted | denied | closed
under_review -> accepted | denied | closed
accepted -> closed
denied -> closed
closed -> terminal
```

Service/mock behavior and the database trigger enforce the same transitions. First review sets reviewer and `reviewed_at`; terminal state cannot reopen silently. Corrections are append-only administrative events or a new explicitly linked workflow, not history mutation.

## Decision and reversal

An accepted appeal records a decision only. It does not automatically unban, restore a message, restore membership, remove a timeout, or alter audit history. Reversal must be a separate permission-checked transaction that:

1. reloads action and current community state;
2. confirms reviewer authority and any independence requirement;
3. applies the exact reversible operation atomically;
4. appends moderation/audit events;
5. updates appeal outcome only after success or records partial failure safely;
6. notifies the affected user through an approved channel.

## Privacy, abuse, and retention

- Store only the user's appeal reason and a bounded decision note; no raw message copy by default.
- Do not allow appeal attachments until upload scanning/access/retention policy is approved.
- Add server-side rate limits and duplicate/idempotency handling without revealing whether another person's action exists.
- Logs/analytics use aggregate status/error codes, not reason/decision content or identifiers.
- Retention must cover appeal windows, legal holds, audit integrity, account deletion/anonymization, and action evidence.
- Emergency/safety/legal cases follow incident escalation and may restrict evidence disclosure.

## Manual verification

1. Create an appealable action as trusted backend for user A/community A.
2. User A submits once; verify status `open` and self-list access.
3. User B attempts the same action; verify insert rejection without action details.
4. User A tries fabricated/expired/non-appealable action and duplicate appeal; verify rejection.
5. Moderator of community A lists/reviews; unrelated moderator/member cannot.
6. Exercise allowed and invalid terminal/reopen transitions.
7. Verify accepted decision does not automatically reverse the original action.
8. Verify audit contains appeal ID/status only and no reason/private message/token.
9. Verify secret-like/control-character reason/decision text is redacted and bounded.

## Automated checks

- `npm run appeals:production:test`
- `npm run audit-logs:immutability:smoke`
- `npm run typecheck`
- Supabase RLS/trigger behavior tests in an isolated project when CLI is available.
