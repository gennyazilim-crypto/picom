# Experimentation and A/B Governance

## Status

Picom does not run production A/B experiments today. This policy defines the approval boundary for future Windows, Linux, and macOS desktop experiments. Experiments are never a substitute for product quality, accessibility, security review, or user research.

## Feature flags versus experiments

- A **feature flag** controls availability, staged rollout, incident disablement, or release compatibility. It may have no control group or hypothesis.
- An **experiment** deliberately assigns eligible users to variants to test a documented hypothesis against pre-registered metrics.

Every experiment may use a feature flag for delivery, but not every flag is an experiment. Flag evaluation must not silently begin analytics collection. Security, RLS, permissions, private-channel visibility, and backend controls cannot vary by experiment.

## Required proposal

Before implementation, record:

- owner and reviewers;
- hypothesis and user problem;
- eligible desktop release channels/platforms;
- control and variants;
- allocation and stable assignment method;
- start, maximum duration, sample/stop rule, and cleanup date;
- primary metric, guardrail metrics, and minimum detectable effect;
- privacy/data inventory and retention;
- accessibility, safety, support, and performance risks;
- rollback trigger and kill switch.

Product, engineering, privacy/legal when applicable, accessibility for UI changes, and security for trust-sensitive surfaces must approve before exposure.

## Privacy limits

Use aggregate, count-only, allowlisted events. Permitted examples are app starts, message-send success counts, upload success/failure counts, voice join failure counts, feature-use counts, crash-free session aggregates, and bounded performance timings.

Never use message/search/profile content, private community/channel/member data, filenames/media, contacts/social graph, emails/usernames, precise location, IP/device fingerprint, credentials, tokens, authorization headers, inferred sensitive traits, or raw diagnostics. Do not combine datasets to re-identify users.

User consent and clear disclosure are required when law, policy, or the collection purpose demands it. Analytics-disabled users are excluded from measurement experiments; essential reliability rollout may still use non-identifying operational metrics under the documented privacy policy. Provide opt-out where appropriate and honor deletion/retention requirements.

## Assignment

Assignment must be stable, bounded, and privacy-preserving. Prefer a server-generated opaque assignment unrelated to identity details. Do not put variant assignment in public profile fields, logs, URLs, message metadata, or analytics dimensions that enable identification. Cross-device consistency requires a reviewed backend; local-only assignment must be labeled device-specific.

Exclude children/sensitive cohorts, incident-affected users, unsupported client versions, and users for whom the variant violates accessibility or platform requirements. Do not experiment on authentication security, permissions, private data access, moderation enforcement, legal consent, account deletion, payment, or emergency messaging.

## No dark patterns

Experiments must not manipulate consent, obscure unsubscribe/delete/revoke actions, create artificial urgency/scarcity, shame users, disguise ads, increase notification pressure, make cancellation harder, or optimize compulsive engagement. Control and variants must preserve keyboard access, readable copy, reduced motion, and truthful status.

## Rollout and monitoring

1. Validate locally with stable mock data.
2. Verify typecheck, build, accessibility, privacy payload, and rollback.
3. Internal ring, then small beta allocation.
4. Monitor primary and guardrail metrics by release/platform only when privacy-approved.
5. Pause on crash, API error, message/upload/voice reliability, accessibility, support, abuse, or privacy threshold breach.
6. Expand only after a recorded review; never auto-promote solely on a positive metric.

Avoid simultaneous experiments that share surfaces or metrics unless interaction effects are designed and analyzed. Cap concurrent experiments and document contamination.

## Analysis and decision

Do not peek and stop opportunistically. Report exposure, duration, exclusions, missing data, confidence/uncertainty, practical effect, guardrail results, and platform differences. Negative and inconclusive results are retained to prevent repetition. A result does not justify bypassing design, safety, or accessibility standards.

Decision outcomes are ship, iterate with a new proposal, stop, or inconclusive. Shipping removes experiment-only code/assignment, updates the normal feature flag/default deliberately, and deletes expired assignment data according to retention policy.

## Rollback and incident response

The owner must be able to disable the variant through remote config and independently enforce backend safety. Roll back immediately for data exposure, permission bypass, destructive behavior, crash/error threshold breach, misleading consent, or material support impact. Preserve content-free audit evidence, notify incident response when required, and do not retain private payloads for analysis.

## Production gate

No experiment may launch until a reviewed assignment service, approved privacy-friendly measurement path, dashboard with aggregate guardrails, kill switch, support briefing, and cleanup owner exist. Picom currently has no external analytics provider, so production result measurement remains disabled.
