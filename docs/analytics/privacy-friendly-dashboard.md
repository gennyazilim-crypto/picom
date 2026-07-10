# Privacy-Friendly Analytics Dashboard

## Status

Picom provides a local, opt-in analytics abstraction and aggregate dashboard snapshot. It is disabled by default, has no external provider, sends no network traffic, does not identify users, and retains at most 100 allowlisted events in local storage. This is a reliability foundation, not advertising or behavioral profiling.

## Allowed dashboard metrics

- App start count.
- Message sent count only; never body, channel, recipient, author, or message ID.
- Upload success and failure counts plus coarse safe kind/size bucket where allowlisted; never file name, URL, content, thumbnail, or attachment ID.
- Voice join failure count and coarse runtime mode; never room, community, participant, device, or token.
- Feature usage count for a fixed category allowlist.

The dashboard snapshot exposes only totals, generation time, retained event count, and enabled state. It has no per-user, per-community, per-channel, per-message, geographic, demographic, cohort, or ranking view.

## Service contract

`analyticsService` owns all collection:

- `setEnabled()` persists explicit local consent and clears the queue when disabled.
- `trackEvent()` accepts typed event names and event-specific metadata allowlists.
- `trackFeatureUsage()` accepts only fixed non-sensitive feature categories.
- `getPrivacyDashboardSnapshot()` computes local count-only totals.
- `identifyUserPlaceholder()` always refuses identification.

Numeric values must be finite; count values are non-negative integers capped at 10,000 per event. Strings are length-bounded. Sensitive-looking metadata keys are rejected even if a caller supplies them. The queue is capped at 100 records.

## Prohibited data

Never collect message/reply content, searches, prompt text, filenames or bytes, image data, private channel/community/member details, names, usernames, email, user IDs, IP addresses, precise location, device fingerprint, passwords, auth/session/LiveKit/bot/webhook tokens, authorization headers, invite secrets, crash stack traces, or free-form errors.

Do not infer sensitive traits or use private behavior for discovery ranking. Analytics remains separate from crash diagnostics and support exports.

## Dashboard presentation rules

A future Settings or operations view may display the aggregate snapshot with Picom design tokens and accessible labels. It must:

- show that data is local-only and collection is off by default;
- provide disable-and-clear behavior;
- avoid charts with user or community drill-down;
- show no raw event payload by default;
- avoid implying delivery, uptime, or population-level metrics while no provider exists.

## Provider and remote configuration gate

No provider SDK, endpoint, DSN, or key is configured. Any future external delivery requires privacy/legal review, documented retention and deletion, regional processing review, a feature flag and kill switch, explicit user disclosure/consent where required, payload tests, dependency/bundle review, and a provider data-processing assessment. Client analytics can never override authorization or security controls.

## Verification

- Disabled mode creates no event.
- Disabling clears the local queue.
- Injected sensitive keys and unknown feature names are discarded.
- Count metadata is finite, bounded, and non-negative.
- Snapshot contains totals only.
- Storage and diagnostics contain no private content or credentials.
- Queue cannot exceed 100 events.

## Remaining work

The dashboard has no production population aggregation, retention backend, alerting, or provider. Upload/voice failure instrumentation should be added only at reviewed service boundaries. Any external analytics launch remains blocked on the provider gate above.
