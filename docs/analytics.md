# Privacy-Friendly Analytics Placeholder

Picom may need privacy-friendly product health signals after the MVP stabilizes, but analytics is not part of the current launch-critical desktop chat flow. This document defines a safe placeholder policy without enabling any real analytics provider.

## Status

- Phase: post-MVP advanced product foundation
- Runtime tracking: disabled
- External provider: none
- Default user setting: privacy-safe and opt-out capable before any provider is enabled
- Desktop scope: Windows, Linux, and macOS only

## Goals

- Measure app health without collecting sensitive content.
- Detect feature-level reliability issues such as failed uploads or failed message sends.
- Avoid collecting message text, private community data, passwords, tokens, or personal secrets.
- Keep analytics optional, transparent, and easy to disable.

## Non-goals

- No advertising tracking.
- No cross-app tracking.
- No behavioral profiling.
- No sale of analytics data.
- No public discovery ranking based on private behavior.
- No analytics provider integration in this placeholder task.

## Safe event examples

The following future event names are acceptable only if payloads remain aggregate and non-sensitive:

- `app_started`
- `login_success`
- `community_created`
- `channel_created`
- `message_sent_count_only`
- `attachment_upload_success`
- `attachment_upload_failed`
- `settings_opened`
- `theme_changed`
- `crash_screen_shown`
- `voice_join_attempted_placeholder`
- `screen_share_started_placeholder`

## Prohibited data

Analytics events must never include:

- message content
- file contents
- image pixels or thumbnails
- passwords
- auth tokens
- refresh tokens
- Supabase service role keys
- LiveKit tokens
- invite secrets
- webhook URLs or tokens
- raw IP addresses
- authorization headers
- private channel names unless explicitly public and reviewed
- user email addresses unless a future privacy review approves a hashed/pseudonymous form

## Future event shape

A future local analytics abstraction can use this safe shape:

```ts
export type AnalyticsEvent = {
  name: string;
  timestamp: string;
  appVersion: string;
  releaseChannel: 'dev' | 'beta' | 'stable';
  platform: 'windows' | 'linux' | 'macos' | 'unknown';
  properties?: Record<string, string | number | boolean | null>;
};
```

Event properties must be allowlisted per event. Free-form payloads are not allowed.

## Future service contract

If implementation starts later, create an `analyticsService` facade with no provider-specific API in React components:

```ts
initializeAnalyticsPlaceholder(): void;
trackEvent(name, properties): void;
setAnalyticsEnabled(enabled): void;
isAnalyticsEnabled(): boolean;
flushAnalyticsPlaceholder(): Promise<void>;
```

The service must default to disabled or local-only until the user-facing setting and privacy copy are ready.

## User controls

Future Settings > Privacy & Safety should include:

- Share anonymous usage diagnostics placeholder
- View what may be collected
- Disable analytics
- Clear queued local analytics placeholder

This must be separate from crash reporting and support diagnostics exports.

## Feature flag and kill switch

Analytics must be controlled by both:

- local user preference
- future `enableAnalyticsPlaceholder` feature flag or remote config value

If either is disabled, no analytics event should be sent externally.

## Staging assumptions

- Use local logging or console-safe provider stub only.
- Do not send real events to production providers.
- Verify redaction and allowlist behavior with test events.
- Confirm event payloads do not include message text or tokens.

## Beta assumptions

- Analytics remains opt-in or clearly disclosed.
- Only aggregate reliability events are enabled.
- Event payload review is required before beta release.
- Support team must be able to explain what is collected.

## Production assumptions

- Provider decision is completed and documented.
- Data retention policy is reviewed.
- Privacy/legal placeholder is replaced by final reviewed text.
- Users can disable diagnostics/analytics where required.
- No analytics provider secret is bundled into the renderer.

## Verification checklist

- No message text appears in analytics payloads.
- No token-like value appears in analytics payloads.
- Event names and properties are allowlisted.
- Renderer code does not import provider SDKs directly.
- Analytics disabled state prevents external sends.
- Settings copy is clear before any provider is enabled.

## Rollback plan

If analytics causes privacy or stability concerns:

1. Disable `enableAnalyticsPlaceholder` through config.
2. Keep local app usage functional.
3. Stop any provider delivery queue.
4. Preserve redacted diagnostic logs for investigation.
5. Publish a release note if user-facing collection behavior changed.

## Known risks

- Free-form event properties can accidentally include private content.
- Provider SDKs can increase bundle size.
- Analytics can be confused with crash reporting if copy is unclear.
- Desktop offline queues can retain events longer than intended.
- Misconfigured provider keys can leak environment details.

## Implementation TODOs

- Add typed allowlisted event definitions before runtime tracking.
- Add local user preference only after Settings copy is ready.
- Add redaction tests for all event payloads.
- Add provider only after privacy review and dependency-size review.

## MVP+ implementation status

Picom now includes an opt-in, provider-free `analyticsService` abstraction. It is disabled by default, uses an event-specific metadata whitelist, keeps at most 100 count-only events locally, and clears that queue when the user disables the setting. `identifyUserPlaceholder()` intentionally does not identify or persist a user.

Implemented event names are `app_started`, `login_success`, `community_created`, `message_sent_count_only`, `upload_success`, `voice_joined`, `screen_share_started`, and `settings_opened`. No analytics network provider is configured.

