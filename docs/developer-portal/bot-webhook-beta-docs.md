# Bot and webhook developer docs - restricted beta draft

> Not public and not an API launch. Access is limited to approved internal/beta developers after backend, RLS, security and support gates. No production API base URL or credential is provided.

## Bot authentication and permissions

A future trusted backend issues a high-entropy token once to an authorized bot owner/app admin, stores only hash plus non-secret prefix, and audits issue/revoke. Present token as `Authorization: Bot <one-time-token>` only to the approved HTTPS v1 gateway. Never put it in query/body/source/repo/desktop settings/logs.

Effective permission is intersection of reviewed app scopes, community installation/role, channel visibility, current resource authorization and user/community policy. No self-install, impersonation, admin grant, private-channel bypass or service-role access.

Candidate scopes: `commands:invoke`, `messages:send`, `reactions:write`, safe visible metadata/events. Exact scopes remain unlaunched. Bot API endpoint does not exist publicly.

## Bot request example (non-runnable)

```http
POST https://<approved-api-host>/v1/channels/<authorized-channel-id>/messages
Authorization: Bot <one-time-token>
Idempotency-Key: <stable-random-key>
Content-Type: application/json

{"content":"Synthetic beta test message"}
```

Expected safe response uses bot-marked message DTO and no internal/RLS/token fields. Errors use `{ code, message, details?, requestId? }`; clients handle unknown codes safely. `429 RATE_LIMITED` includes bounded `Retry-After`; unsafe POST is retried only with the same idempotency key.

## Webhook authentication and delivery

Incoming webhook is a community/channel-scoped posting credential, not Bot API. Authorized manager creates it through trusted backend; raw token appears once and only hash is retained. Send token only in `X-Picom-Webhook-Token`, never URL query.

```http
POST https://<approved-function-host>/webhook-message?id=<webhook-id>
X-Picom-Webhook-Token: <one-time-token>
Idempotency-Key: <stable-random-key>
Content-Type: application/json

{"content":"Synthetic plain-text webhook message"}
```

Current contract: POST JSON only, at most 16 KiB, exact content field, 1-2000 trimmed characters, plain text only, no attachments/embeds/HTML/profile override, 30 requests/60 seconds per webhook foundation. Generic invalid response avoids credential/resource enumeration. Delivery remains server-disabled unless protected enablement is explicitly approved.

## Events and compatibility

No public bot event stream exists. Future event envelope uses opaque event ID/type/schema version/timestamp and permission-filtered DTO, with dedupe/backpressure/retry. API major/header/deprecation/error/rate/idempotency rules follow `docs/api/public-api-versioning.md`; private Supabase tables/RPCs are not developer API.

## Abuse and safety rules

No spam, scraping, unsolicited mass messaging, credential sharing, malware, harassment, private-channel probing, rate-limit bypass, token enumeration, hidden tracking or arbitrary plugin execution. Maintain revoke/rotation, least privilege, user-visible BOT/WEBHOOK origin and report/support path. Logs/audit/metrics exclude token/header/hash/message body/private content.

## Beta limitations and publication gate

- no public host, SLA, SDK, app registration, OAuth/API key, marketplace or plugin runtime;
- no certified live RLS/load/security/cross-tenant test evidence;
- no public credential issuance/rotation recovery or developer support program;
- scopes/events/version windows may change before approved beta contract.

Publication requires approved API ownership/terms, deployed versioned gateway, live auth/RLS/rate/idempotency/audit/abuse tests, docs security review, support/incident/kill switches and restricted cohort go/no-go. Until then examples are non-runnable architecture guidance.
