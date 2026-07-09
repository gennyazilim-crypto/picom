# Picom MVP+ Exclusions

The following are explicitly outside the locked MVP+ implementation scope unless a later dated approval replaces this decision.

## Excluded product/platform scope

- Enterprise SSO/SAML and SCIM provisioning.
- Enterprise admin console, legal hold, dedicated support/SLA, compliance certification, or customer-managed deployment.
- Billing, subscriptions, payments, usage metering, or paid plan enforcement.
- Arbitrary desktop plugin runtime or dynamic code loading.
- Public bot/plugin/application marketplace.
- Production end-to-end encryption.
- Production auto-update/update feed while signing/rollout/rollback is not ready.
- Mobile application, mobile UI, bottom navigation, touch-first redesign, or browser-first product.
- Public discovery marketplace until separately approved with moderation/safety operations.
- Advanced analytics/user behavior tracking or message/content analytics.
- Advertising, creator monetization, crypto/token/NFT features.

## Security boundaries that cannot be weakened

- No plugin/bot/webhook executes shell or unrestricted filesystem code in the desktop app.
- No frontend-only permission or feature flag replaces backend/RLS enforcement.
- No service-role, LiveKit API secret, OAuth client secret, signing credential, or password enters renderer code/config/logs.
- No public bucket/link workaround exposes private attachments.
- No DM/discovery/bot feature ships without report/block/rate-limit/abuse and privacy boundaries.
- No claim of E2EE, malware scanning, stable auto-update, cross-platform native pass, or production readiness without implementation/evidence.

## Foundations are not shipped features

The repository contains many placeholders, services, documents, and smoke scripts from architecture preparation. Their presence does not mean:

- The entry point should be visible to users.
- The backend/deployed service exists.
- A permission/security boundary is complete.
- The feature is part of MVP+.
- The feature may bypass the scope/release gate.

Disabled/placeholder code should remain hidden or clearly marked and must not break Full MVP flows.

## Deferred candidates requiring separate approval

- rpm/Linux arm64/macOS arm64-universal packaging.
- Cloud provider expansion beyond Supabase + LiveKit.
- Self-hosted Supabase/LiveKit or multi-region architecture.
- Production monitoring/analytics providers.
- Public API/developer portal publishing.
- Group DMs, calls outside community voice channels, recording/transcription, streaming/broadcasting.
- Full forum/events/polls/stickers/custom emoji marketplace/community discovery expansion.

## Change process

To move an exclusion into scope:

1. Provide measured user/business need and why current MVP+ cannot satisfy it.
2. Define goals/non-goals and desktop UX.
3. Produce architecture/ADR, schema/API/RLS, threat/privacy/abuse, operational cost, support, migration, rollback, and release plans.
4. Identify dependencies/owners and what existing work is displaced.
5. Obtain product, engineering, security/privacy, operations, and legal approval where applicable.
6. Update `docs/mvp-plus-scope.md` and roadmap in a dedicated scope-lock commit before implementation.

Until then the item remains excluded even if an older roadmap or placeholder mentions it.
