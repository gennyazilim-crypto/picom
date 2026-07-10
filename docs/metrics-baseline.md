# Picom Metrics Baseline and Privacy-Safe Telemetry Review

Status: Baseline specification; no external telemetry enabled  
Applies to: Windows, Linux and macOS Electron desktop app

## Current implementation

Picom's `analyticsService` is opt-in, provider-free and local-only:

- disabled by default;
- no network endpoint, SDK or provider credential;
- event names are a TypeScript union;
- metadata keys are allowlisted per event;
- sensitive-looking metadata keys are rejected;
- strings are bounded and counts are clamped;
- feature names use a fixed allowlist;
- at most 100 events are retained in local storage;
- disabling the setting clears the local queue;
- the user is intentionally not identified.

This local queue is a settings/architecture placeholder, not authoritative production telemetry and not a basis for SLO or public product claims.

## Baseline questions

The minimum useful, privacy-safe product baseline answers only aggregate questions:

- Does Picom start and reach a usable desktop state?
- Can valid users authenticate?
- Can users create a community and send messages successfully?
- Are valid attachment uploads succeeding or failing?
- Can users join voice and start screen share when supported?
- Which broad, approved product areas are used, in count-only form?
- Are settings being opened, so privacy and support controls are discoverable?

The baseline does not measure individual productivity, social graphs, message topics, private-community activity, detailed presence, employee behavior or content engagement by identity.

## Allowed current events

| Event | Purpose | Allowed metadata | Explicitly forbidden examples |
| --- | --- | --- | --- |
| `app_started` | Count opted-in launches | `runtime` from fixed runtime class; `releaseChannel` from fixed channel class | device ID, user ID, path, hostname, arbitrary launch arguments |
| `login_success` | Count successful auth completions | `mode` from fixed mock/supabase class | email, username, provider subject, session/token, IP, failure detail |
| `community_created` | Count successful creates | `mode` only | community ID/name/description/icon, owner/member IDs |
| `message_sent_count_only` | Aggregate successful/attempted message count according to caller contract | bounded `count`; fixed `mode` | body, reply text, message/channel/community/user IDs, mentions, reaction labels |
| `upload_success` | Count valid completed upload flow | fixed `kind`; coarse `sizeBucket` | file bytes/name/path/hash, URL, attachment/message/channel/user ID, MIME parameters |
| `upload_failure` | Count safe upload failure class when wired | fixed `kind` only in current contract | error message, provider payload, filename/path, signed URL, content |
| `voice_joined` | Count successful voice joins | fixed `mode` | room/community/channel/user identity, participant list, audio/device data, token |
| `voice_join_failure` | Count safe voice join failure when wired | fixed `mode` only in current contract | raw error, room name/ID, permission details tied to identity, LiveKit token |
| `screen_share_started` | Count successful starts | fixed `mode` | window/screen title, source thumbnail, app name, captured content, room/user ID |
| `settings_opened` | Measure settings discoverability | fixed approved `section` | search query, profile/account value, arbitrary label |
| `feature_usage_count_only` | Aggregate broad feature-family usage | allowlisted `feature`; bounded `count` | object IDs, user-generated feature labels, action timeline, content |

Existing event names should remain stable. New names require a typed schema, purpose/retention review, tests, documentation and explicit approval; free-form event names or payloads are prohibited.

## Required fixed value dictionaries

Production ingestion must reject values outside bounded dictionaries even when a metadata key is allowed:

- `runtime`: `electron` only for the desktop product;
- `releaseChannel`: `internal`, `beta`, `stable`;
- `mode`: `mock`, `supabase`, `desktop` only where meaningful;
- `kind`: reviewed broad classes such as `image`, never MIME strings or filenames;
- `sizeBucket`: coarse approved buckets such as `under_1mb`, `1mb_to_5mb`, `over_5mb_rejected`;
- `section`: approved settings section IDs, not titles or search text;
- `feature`: the existing typed `AnalyticsFeatureName` allowlist.

The current local implementation bounds strings and feature names but does not enforce a fixed dictionary for every string property. Call sites currently use constants; a future network ingestion service must validate all values independently before accepting production events.

## Baseline metric definitions

| Metric | Formula | Minimum segmentation | Caveat |
| --- | --- | --- | --- |
| Opted-in app starts | count of accepted `app_started` | platform, version, release channel from authoritative build/server context | Current local event does not prove app reached ready state |
| Auth success count | count of `login_success` | platform/version/mode | A success-only count cannot produce an auth success rate without an eligible-attempt denominator |
| Communities created | count of `community_created` | version/channel/mode | No community identity or creator cohort |
| Messages sent | sum of bounded `message_sent_count_only.count` | version/channel/mode | Caller contract must distinguish confirmed vs attempted before SLO use |
| Upload success/failure | success and failure counts; future ratio requires eligible-attempt denominator | version/platform/kind/size bucket | Intentional validation/quarantine rejection must be separated from service failure |
| Voice joins/failures | success and failure counts; future ratio requires valid-attempt denominator | version/platform | User cancel and OS permission denial require bounded non-identifying classes before inclusion/exclusion |
| Screen-share starts | count of `screen_share_started` | version/platform | No captured-source metadata |
| Feature use | sum by allowlisted feature | version/channel/platform | Aggregate discovery signal only; never rank users or communities |
| Settings opens | count by approved section | version/platform | Does not measure settings contents or changes |

Stable SLO metrics require server/provider confirmations and denominators defined in `docs/ops/stable-slo.md`. Desktop-local analytics must not be used to claim startup, auth, message, upload, voice or crash reliability.

## Forbidden payloads

No analytics, operational metric label or telemetry payload may include:

- message/reply/thread/poll body, draft, search query or clipboard content;
- private channel/community text, names, topics, rules or invite information;
- attachment bytes, image/audio/video/screenshare content, filename, local path, object path, URL or signed URL;
- password, passcode, MFA/recovery value, auth/session/refresh token, cookie or authorization header;
- Supabase service-role/anon credential values, LiveKit secrets/tokens, bot/webhook/API keys, signing/updater/storage/email credentials;
- email, username, display name, phone, avatar URL, raw user/community/channel/message/member/role/session/device identifiers;
- raw IP, precise location, hardware fingerprint, window title, process list, filesystem path or hostname;
- arbitrary error messages, stack traces, request/response bodies or provider payloads;
- detailed presence, friend/follow graph, profile activity, moderation evidence or per-user timeline;
- high-cardinality/user-generated values disguised as labels.

Hashing a direct identifier does not automatically make it anonymous. Persistent pseudonymous IDs require separate approval and are not part of this baseline.

## Privacy and security controls

- Default remains off; enabling is an explicit local user choice with clear copy.
- Disabling clears queued local analytics immediately.
- No event leaves the device in the current implementation.
- A future backend endpoint must authenticate/attest as appropriate, validate exact schemas, rate limit, sample, deduplicate and reject unknown fields/values.
- Provider credentials stay server-side; the desktop never receives a metrics write secret.
- Separate development/staging/mock/stable data and never mix them in production decisions.
- Set a short documented retention period, aggregate early and delete raw events; no indefinite offline queue.
- Restrict dashboard access and audit exports; aggregate metrics must not become a user-surveillance tool.
- Provide user disclosure/control/export/deletion behavior consistent with approved privacy policy and legal basis.
- A remote kill switch must be able to stop external emission without affecting core chat.

## Quality gates before network telemetry

1. Finalize purpose, owner, legal basis/consent, policy copy, retention, region and provider review.
2. Create typed event-to-payload schemas with fixed value dictionaries and unknown-field rejection.
3. Add tests for disabled-by-default, opt-out queue deletion, max queue/age, count bounds and malformed/corrupted storage.
4. Add synthetic-secret/content tests covering every forbidden class; never use real secrets in fixtures.
5. Implement a protected backend ingestion path with server-side validation, rate limits, sampling and no renderer credential.
6. Prove events contain no private content/IDs through manual capture inspection and automated schema tests.
7. Add aggregate dashboards, freshness, missing-data state, SLO formula ownership and alert/runbook links.
8. Run privacy/security review and staged internal/beta rollout before stable enablement.

## Current decision

- Existing local opt-in analytics abstraction: safe to keep.
- Adding more runtime events in this task: not necessary.
- External provider/ingestion: not approved and remains disabled.
- Product baseline: defined as aggregate, count-only, content-free and non-identifying.
