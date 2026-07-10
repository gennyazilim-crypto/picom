# Growth onboarding experiments

Status: experiment plan only; no experiment or analytics provider is enabled  
Reviewed: 2026-07-10  
Platform: Picom Electron desktop for Windows, Linux and macOS

## Objective

Improve first-session activation and early retention by helping a new user reach a meaningful community, useful Mention Feed and recognizable profile without coercion. Growth is subordinate to consent, safety, accessibility and product reliability.

## Current first-run review

The implemented onboarding is a five-step desktop wizard:

1. Profile basics: required display name plus optional username/status.
2. Theme: immediate light/dark selection.
3. Community entry: create later, save an invite, or continue to Mention Feed.
4. Follow suggestions: up to ten existing mock/safe candidate members.
5. Finish: summary and completion persistence.

Strengths:

- Desktop-native two-panel flow with progress, Back, Next and optional Skip actions.
- Display name is the only required profile field.
- Theme applies immediately and remains reversible in Settings.
- Community and follow steps are optional and non-destructive.
- Mock completion is local per user; Supabase mode updates only the user's profile onboarding fields.
- Experiment assignment is deterministic per user behind a feature flag, with a control fallback.

Known limits that experiments must not disguise:

- Create Community is a post-onboarding destination choice, not an inline completed creation.
- Invite input is prepared but not proof that membership was accepted.
- Follow selections remain local until the production follow table and RLS integration are available.
- Existing experiment results are device-local aggregate started/completed counts, not production analytics.
- The current `recordStarted` call can run again after remount; production measurement needs one exposure per experiment/session.
- System theme is a placeholder and must not be presented as available.

## Guardrails

- No preselected follows, communities, contacts, notifications or marketing consent.
- Skip remains equally visible for optional steps; no guilt, countdown, repeated blocking prompt or misleading button hierarchy.
- Do not require profile biography, avatar, status, contact import or demographic data.
- Do not rank suggestions using private messages, private-channel content or inferred sensitive traits.
- Do not send invitations without an explicit recipient review and confirmation step.
- Do not claim create/join/follow success until the authoritative operation succeeds.
- No dark patterns, streak pressure, artificial urgency, social-pressure copy or hidden defaults.
- A failed experiment must preserve the control flow and never block app access.

## Experiment governance

Every experiment requires:

- A written hypothesis, owner, start/end date and reviewed UI copy.
- One stable assignment per authenticated user for the experiment version.
- A feature flag with immediate rollback to control.
- Minimum exposure and observation windows defined before launch.
- Accessibility, localization and permission checks for every variant.
- A data dictionary proving that no content, token, invite secret or private identifier is captured.
- Decision record: adopt, iterate, reject or inconclusive.

Run only one structural onboarding experiment at a time. Do not combine step reordering, copy changes and recommendation algorithms in the same test.

## Privacy-safe measurement model

Allowed event shape:

```text
eventName
experimentId
variantId
anonymousInstallationBucket
sessionBucket
stepId
result (shown | completed | skipped | failed)
coarseDurationBucket
appVersion
platform (windows | linux | macos)
locale
occurredAt
```

Prohibited fields:

- User ID, email, username, display name, avatar URL or free-form status.
- Invite code/link, community/channel/message IDs or names.
- Selected/followed user IDs.
- Message content, search text, clipboard content, file names or attachment URLs.
- IP address, precise location, device fingerprint, auth/session token or provider response.

Until privacy/legal approval and a real provider decision exist, metrics remain local aggregate diagnostics only and are disabled by default. Local records must be bounded, schema-versioned and clearable with non-essential diagnostics data.

## Shared metrics

Primary metrics:

- **Onboarding completion rate:** unique completed exposures / unique started exposures.
- **Meaningful activation rate:** completed onboarding followed within 24 hours by at least one safe, coarse outcome: joined/created a community, followed one person, or opened a channel and sent a confirmed message.
- **Day-7 return rate:** anonymous cohort returned on a distinct day 2-7; requires explicit analytics approval before collection.

Secondary metrics:

- Per-step completion and skip rates.
- Coarse time-to-complete buckets: under 2, 2-5, 5-10, over 10 minutes.
- Safe failure categories: validation, network, permission, unavailable service.
- Post-onboarding destination reached: Mention Feed, community create entry, invite entry.

Guardrail metrics:

- Onboarding close/abandon rate.
- Back-navigation rate and repeated validation failures.
- Accessibility defects and support reports.
- Unfollow/leave reversal within 24 hours, measured only as a coarse count.
- Crash/error rate during onboarding.
- Report/block events are never attributed to an individual experiment subject; only aggregate safety review is allowed.

## Experiment 1: contextual follow suggestions

**Hypothesis:** Explaining why a suggestion is relevant and allowing an empty selection improves useful follow adoption without increasing immediate unfollows.

Variants:

- Control: current compact list with Follow/Following.
- Variant A: group suggestions by safe public context such as shared public community or selected interest, with a short explanation.
- Variant B: show six high-confidence suggestions first with an explicit `Show more` action.

Eligibility: authenticated users with no persisted follows. Exclude users whose relationship/privacy data is unavailable.

Success:

- Increase users choosing at least one follow.
- Improve followed-people Mention Feed open rate after onboarding.
- No material increase in 24-hour unfollow, block or report guardrails.

Dependencies: production follow persistence, RLS-filtered suggestions, profile privacy rules and deduplicated exposure events. Until then, run only as a local usability study.

## Experiment 2: community create/join choice

**Hypothesis:** A clearer value preview and explicit continue-without-community path helps users select the right entry path and reach a usable destination faster.

Variants:

- Control: current three equal choices.
- Variant A: choice cards include a one-line expected result and required effort.
- Variant B: ask whether the user has an invite first; answer selects join/create/continue but remains reversible.

Success:

- Increase confirmed join or confirmed community creation, not button clicks.
- Reduce invite validation failures and time to first visible channel.
- Preserve or improve onboarding completion and skip rate.

Dependencies: production invite acceptance, public join flow, idempotency, rate limiting and safe active-community fallback.

## Experiment 3: invite-flow guidance

**Hypothesis:** Validating invite format locally and previewing non-sensitive community metadata before confirmation reduces failed joins and increases informed acceptance.

Variants:

- Control: invite code/link field saved for later.
- Variant A: normalize supported Picom invite formats and show validation feedback without network lookup.
- Variant B: after an authenticated server lookup, show community name, icon, visibility, member-count band and rules-required state before explicit Join.

Success:

- Higher confirmed invite acceptance rate.
- Lower invalid/expired invite error rate.
- No increase in duplicate memberships, abuse events or private-community information exposure.

Safety:

- Never store invite secrets in analytics or logs.
- Preview only server-authorized fields and rate-limit lookup.
- Do not auto-join when the user pastes or opens a link.

Dependencies: invite service, hosted RLS tests, abuse controls and specific error codes.

## Experiment 4: profile completion framing

**Hypothesis:** Showing the practical purpose and optionality of each field improves display-name quality without collecting more personal data.

Variants:

- Control: current display name, optional username and optional status.
- Variant A: live desktop profile preview with explicit visibility labels.
- Variant B: display name only during onboarding; optional fields move to a post-onboarding checklist in Profile Settings.

Success:

- Maintain profile-step completion while reducing validation corrections.
- Increase later voluntary completion of optional profile fields.
- No increase in abandonment or privacy/support complaints.

Do not score users by profile completeness, gate chat behind optional fields or expose status text beyond existing visibility policy.

## Experiment 5: completion destination

**Hypothesis:** Sending users to the destination implied by their choices improves first-session comprehension over always opening Mention Feed.

Variants:

- Control: finish opens Mention Feed.
- Variant A: confirmed join opens the first permitted text channel; confirmed create opens the new community; otherwise Mention Feed.

Success:

- Reduce immediate navigation reversals.
- Improve safe first meaningful action without increasing permission-denied or empty-state errors.

Dependencies: authoritative create/join result, visible-channel selector and stable active-view restoration.

## Rollout and stop conditions

Rollout sequence:

1. Internal mock/usability sessions.
2. Development flag with deterministic assignment.
3. Small beta cohort only after privacy and event-schema review.
4. Wider beta only if guardrails remain healthy.
5. Adopt the winning experience only after accessibility/localization review.

Stop immediately if:

- Crash or startup error increases.
- A variant blocks completion or loses user choices.
- Private metadata, invite secrets or identifiers enter events/logs.
- Join/follow/create UI reports success without authoritative success.
- Block/report, permission-denied or reversal guardrails materially worsen.
- A user cannot skip an optional step or reach the app.

## Decision template

For each completed experiment record:

- Hypothesis and owner.
- Version, eligible cohort and exposure count.
- Primary, secondary and guardrail results.
- Data-quality limitations.
- Accessibility/localization findings.
- Decision: adopt, iterate, reject or inconclusive.
- Rollback confirmation and deleted/expired experiment data.

## Explicit exclusions

- No production analytics provider integration.
- No contact-book import, referral spam, paid acquisition or notification-permission prompt.
- No mobile or web onboarding variant.
- No automatic follows, joins, invites or profile publication.
- No personalization based on private content or sensitive inference.
