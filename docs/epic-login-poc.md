# Epic Login Proof of Concept

## Decision

Epic login is **not approved for runtime implementation or user exposure** in the current Picom release. This document records a bounded Epic Account Services (EAS)/Epic Online Services (EOS) identity assessment for a later proof of concept.

Task 336 adds no provider button, EOS SDK, renderer credential handling, callback route, database mapping or production configuration. Email/password remains Picom's primary authentication method.

## Identity model assessment

Epic exposes related but distinct identity surfaces:

- **Epic Account Services Auth** authenticates an Epic account and yields an Epic account identity for account-oriented services.
- **EOS Connect** maps supported external identities into a product user identity for EOS game services. It must not be treated as an automatic Picom account-linking policy.
- **Account linking** is an explicit security-sensitive operation. A provider continuation/link token is not proof that two Picom profiles should be merged.

Picom is a desktop community application rather than an Unreal game client. A future implementation must first confirm with Epic which web/account-portal flow and product configuration are approved for this use case. It must not ship an EOS native SDK merely to bypass a reviewed server-side authentication design.

Official reference points:

- [Epic Online Services Auth Interface](https://dev.epicgames.com/docs/api-ref/interfaces/auth)
- [Epic account linking API reference](https://dev.epicgames.com/docs/en-US/api-ref/callbacks/eos-auth-on-link-account-callback)
- [Epic Online Services configuration overview](https://dev.epicgames.com/documentation/en-us/unreal-engine/enable-and-configure-online-services-eos-in-unreal-engine)

## Proposed server-side flow

1. An authenticated Picom client asks a Supabase Edge Function or dedicated backend for a short-lived Epic login attempt.
2. The backend creates a single-use state record bound to the current Picom user/session and an exact callback URL.
3. The renderer receives only a provider authorization URL and opens it through `externalLinkService`.
4. Epic returns to an HTTPS backend callback. Authorization codes, exchange codes, client credentials and refresh tokens never return through the custom Electron protocol.
5. The backend validates state, issuer/audience, callback URL and expiration before exchanging the code with Epic.
6. The backend validates the Epic identity and maps its stable provider subject to the current Picom profile only after recent reauthentication and explicit confirmation.
7. Picom receives a one-time, bounded completion result through a validated `picom://` deep link and refreshes its normal Supabase session/profile state.

Epic authentication must not create an independent long-lived renderer session. Supabase Auth remains Picom's session authority unless a separately reviewed custom-token bridge is designed.

## Proposed data model

A future private identity table may contain:

| Field | Purpose |
| --- | --- |
| `id` | Internal mapping identifier |
| `user_id` | Picom profile owner |
| `provider` | Fixed value `epic` |
| `provider_subject_hash` | Server-side keyed hash for collision-safe lookup |
| `provider_subject_encrypted` | Optional server-managed encrypted identifier if required |
| `identity_kind` | `epic_account` or reviewed `product_user` classification |
| `display_name_snapshot` | Non-authoritative provider metadata |
| `linked_at` | Audit timestamp |
| `last_verified_at` | Last successful provider verification |

The renderer must have no direct select access to this table. Unique constraints must prevent one Epic identity from being silently linked to multiple Picom users.

## Security boundaries

- Epic client secrets, exchange codes, refresh tokens and server credentials are server-only.
- No secret may use a `VITE_` variable or cross the preload bridge.
- Callback URLs use HTTPS and exact allowlists; wildcard callbacks are forbidden.
- State is random, single-use, session-bound and short-lived.
- Linking requires an authenticated Picom session, recent reauthentication and explicit confirmation.
- Unlinking must preserve at least one usable Picom sign-in method.
- Provider metadata is allowlisted and cannot bypass Picom profile validation or Terms/Privacy acceptance.
- Logs redact callback parameters, provider identifiers, tokens and authorization headers.
- Attempt creation, callbacks, linking and unlinking require rate limits and abuse events.
- Feature flags control exposure only; backend authorization and RLS remain mandatory.

## Risks

- EAS Auth and EOS Connect serve different identity purposes; choosing the wrong identity can create unstable or non-portable account mappings.
- Product, organization, client-policy and consent-screen configuration must be verified with Epic before implementation.
- Native SDK integration would increase desktop packaging, update and platform QA surface.
- Custom backend-to-Supabase session bridging can weaken session revocation if implemented incorrectly.
- Provider identity is personal data and may enable cross-service correlation.
- Account collisions, recovery and unlinking can lock users out without recent-auth requirements.
- Provider downtime must never block normal Picom email/password sign-in.

## Approval gates

Runtime implementation may start only after:

- Product approval and an Epic-supported use-case confirmation.
- Security review of the selected EAS/EOS flow, callback and Supabase session bridge.
- Privacy/legal review of provider identifier storage, deletion and consent.
- Hosted staging backend, exact HTTPS callback and provider-console ownership.
- Private identity migration/RLS review and collision/recovery design.
- Abuse controls, redacted observability and support ownership.
- Packaged Windows, Linux and macOS certification.

Until these gates pass, Picom must not display an Epic login button or claim Epic authentication support.

## Future verification checklist

1. Reject invalid state, callback, issuer, audience, code, expiration and replay.
2. Prove no Epic credential appears in renderer storage, deep links, logs or diagnostics.
3. Reject linking an Epic identity already mapped to another Picom profile.
4. Verify provider metadata cannot bypass profile allowlists or legal acceptance.
5. Verify unlinking and account deletion follow Picom identity-retention policy.
6. Verify provider cancellation/outage leaves email/password login usable.
7. Verify global Picom session revocation remains authoritative.
8. Verify packaged callback behavior on Windows, Linux and macOS.

