# Optional Email Notification Digest

Status: Architecture plan; no real email provider or scheduler enabled

## Purpose

Email digest is an optional catch-up channel for users who explicitly opt in. It must reduce notification pressure and help a user return to Picom without copying private conversations into email.

The in-app notification inbox remains authoritative. Email is best-effort, delay-tolerant and never required for authentication, moderation, account recovery or access to messages.

## Current foundation

- Backend-only email abstraction: `supabase/functions/_shared/email-service.ts`.
- Existing safe intent type: `notification_digest_placeholder`.
- Development provider logs only intent type, recipient domain, subject and bounded metadata.
- `smtp_placeholder` returns `SMTP_PROVIDER_NOT_CONFIGURED` and sends nothing.
- No provider secret exists in renderer, repository or current runtime.

No digest sender method, schedule, queue, database preference or provider integration was added in this task.

## User control

- Default: off.
- Separate explicit opt-in from desktop notification digest mode.
- Proposed frequencies: daily or weekly; hourly email is intentionally excluded to prevent fatigue.
- Require authenticated user, verified email and current accepted Terms/Privacy version as applicable.
- Allow pause/disable in Settings and one-click unsubscribe in every digest.
- Disabling must stop future scheduling promptly and invalidate queued unsent work where practical.
- Changing account email requires re-verification before digest resumes.

Community/channel mute, DND and notification preferences should reduce digest content. Email preference must never silently re-enable native notifications.

## Safe digest contents

Recommended default body is aggregate and content-free:

- date/window and Picom account-safe greeting without exposing username publicly;
- total unread notification count;
- count of direct mentions/replies, grouped into generic accessible community/channel buckets only when safe;
- count of followed-user/community updates;
- upcoming-event count/time summary for currently accessible events;
- a single `Open Picom` link to the desktop app/site placeholder;
- privacy/settings/unsubscribe links.

By default do not include message/reply text, attachment previews, profile bios, voice activity details, member names or private channel names. A future preview option requires separate explicit consent, lock-screen/email exposure review and access revalidation; it is not approved here.

## Private and inaccessible content

At digest generation time, the backend must revalidate:

- active non-revoked session/account state as appropriate;
- current community membership/public access;
- private channel role/permission;
- block relationships and privacy preferences;
- deleted/anonymized message/notification state;
- mute, Quiet Hours/DND interaction and digest preference;
- event/message/attachment access under RLS.

If access changed, omit the item entirely. Do not reveal that a hidden/private community, channel, message, attachment or user exists. A stale queued digest must be regenerated or revalidated immediately before provider submission.

## Proposed backend flow

1. A protected scheduler selects users with verified email and active opt-in whose next window is due.
2. Selection returns only user ID and schedule state; provider credentials remain server-side.
3. A worker claims a bounded batch with lease/idempotency key `user + window + digest_version`.
4. RLS/security-definer service logic retrieves only currently accessible notification aggregates.
5. Content builder applies mute/DND/privacy rules, low-count suppression and hard size/item limits.
6. A final access/preference check runs immediately before send.
7. Backend email service submits to a reviewed provider.
8. Store safe delivery status, provider message ID hash/prefix if needed, window, attempt count and error class; never store rendered private body in general logs.
9. Retry transient failures with bounded exponential backoff; permanent/unsubscribe/bounce suppresses future sends.

No desktop client scheduler should send digest email. Closing Picom must not affect an opted-in server schedule.

## Preference shape placeholder

```ts
type EmailDigestPreference = Readonly<{
  enabled: boolean;
  frequency: "daily" | "weekly";
  timezone: string;
  nextEligibleAt: string | null;
  consentedAt: string | null;
  policyVersion: string | null;
}>;
```

Timezone must be validated against an approved IANA list server-side. Preference writes require the authenticated user's own row and audit-safe metadata.

## Unsubscribe and abuse protection

- Every email has a clear unsubscribe action and settings link.
- Unsubscribe token is high-entropy, short-lived/scope-limited as appropriate, stored hashed and never logged.
- The endpoint returns a generic result and is rate limited to prevent address/account enumeration.
- Authenticated disable is also available inside Picom.
- Process provider complaints, hard bounces and suppressions; never retry them indefinitely.
- Per-user/per-domain/global send caps and queue depth alerts prevent loops.
- Test addresses/domains and staging provider data must not mix with production.

## Privacy and security rules

Never include or log:

- passwords, MFA/recovery/reset values, auth/session/refresh tokens, cookies or authorization headers;
- Supabase service-role/anon values, LiveKit tokens/secrets, bot/webhook/API/provider/signing keys;
- message/reply/draft/search text, private channel content, attachment bytes/URLs/paths or screen/voice content;
- raw IP, user/community/channel/message IDs as provider-visible tracking parameters;
- open/click tracking tied to an identified user unless separately justified, disclosed and approved.

Use provider secrets only in Supabase function secret storage or an approved production secret manager. Do not use `VITE_` values, preload, renderer, local storage or diagnostics.

## Deliverability and operations

- Configure and verify sender domain, SPF, DKIM and DMARC before production.
- Use a dedicated reviewed sender/from/reply-to and accurate product identity.
- Provide text and accessible HTML versions; no remote tracking pixel by default.
- Bound subject/body; escape all user-derived strings and never render unsafe HTML.
- Monitor aggregate enqueue/send/deliver/bounce/complaint/unsubscribe rates with no content.
- Link alerts to support/incident runbooks and a kill switch that stops digest sends without affecting auth/security emails.
- Define retention, region, provider DPA/subprocessors and deletion handling before enablement.

## Testing gates

- Opt-in/off/default-off and verified-email requirements.
- Daily/weekly timezone and daylight-saving boundaries.
- Duplicate scheduler/worker idempotency and retry/dead-letter behavior.
- Membership/role/block/mute/deletion changes between enqueue and send.
- Private-channel and cross-tenant RLS adversarial tests.
- Unsubscribe, bounce, complaint, rate-limit and kill-switch behavior.
- Plain text/HTML escaping, accessibility and no-content payload inspection.
- Synthetic-secret redaction tests; never use real credentials.

## Decision

The email digest remains optional and disabled. Current provider placeholders are safe to retain. Production implementation requires a separate backend migration/worker/provider/privacy/security task and formal release approval.
