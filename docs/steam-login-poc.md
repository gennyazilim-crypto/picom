# Steam Login Proof of Concept

## Decision

Steam login is **not approved for runtime implementation or user exposure** in the current Picom release. This document defines a bounded proof-of-concept architecture for a later security review. Email/password remains the primary authentication method, and Google/Apple remain separately gated.

No Steam button, OpenID callback handler, account-linking mutation, renderer secret, or production endpoint is added by Task 335.

## Proposed architecture

Steam uses OpenID 2.0 rather than the OAuth/PKCE flow used by Picom's Google and Apple integrations. A future implementation must keep the full assertion exchange on a trusted server boundary:

1. The authenticated Picom client requests a short-lived Steam login attempt from a Supabase Edge Function or dedicated backend route.
2. The backend creates a single-use, expiring state record bound to the current Picom user/session and returns only the Steam authorization URL.
3. Picom opens that URL through `externalLinkService`; the renderer never constructs or validates Steam assertions.
4. Steam returns to an HTTPS backend callback, not directly to the Electron renderer.
5. The backend validates the exact return URL, claimed identity namespace, response nonce/state, timestamp and Steam OpenID assertion with Steam.
6. The backend extracts the numeric SteamID only from the validated claimed identity.
7. A server-owned mapping table links the SteamID to a Picom profile after recent authentication and explicit user confirmation.
8. The backend returns a bounded one-time result to the app through a validated `picom://` deep link. The deep link contains no Steam assertion, access token or secret.

## Proposed data model

A later migration may add a private mapping table similar to:

| Field | Purpose |
| --- | --- |
| `id` | Internal mapping identifier |
| `user_id` | Picom profile owner |
| `provider` | Fixed value `steam` |
| `provider_subject_hash` | Server-side keyed hash of SteamID for lookup/privacy |
| `provider_subject_encrypted` | Optional server-managed encrypted SteamID if API calls require the raw value |
| `display_name_snapshot` | Non-authoritative display metadata |
| `linked_at` | Audit timestamp |
| `last_verified_at` | Last successful provider verification |

The table must not be selectable from the renderer. A unique constraint must prevent one Steam identity from being silently linked to multiple Picom users. Profile creation must continue through Picom's normal allowlisted profile bootstrap and legal-acceptance gate.

## Security boundaries

- OpenID assertion validation, state storage and SteamID mapping are server-only.
- The renderer receives no Steam API key, OpenID assertion, service-role key or privileged database access.
- The callback must use HTTPS, an exact allowlist and a short expiration. Wildcard return URLs are forbidden.
- Linking requires an authenticated Picom session, recent reauthentication and explicit confirmation.
- Sign-in and linking are separate operations; Steam metadata must never silently merge existing Picom accounts.
- Unlinking must require recent reauthentication and must preserve at least one working Picom sign-in method.
- Logs and diagnostics must redact assertions, callback query values, SteamID and state tokens.
- Rate limits and abuse events must cover attempt creation, callback validation and repeated failed linking.
- Feature flags are availability controls only; server authorization and RLS remain mandatory.

## Risks

- OpenID 2.0 differs from Picom's existing PKCE flow and increases custom authentication code and review surface.
- Desktop protocol callbacks can be intercepted or replayed if they carry credentials; therefore only a single-use result identifier may return to Picom.
- Steam identifiers can be personal data and may enable cross-service correlation.
- Account linking can cause irreversible account confusion without recent authentication and collision handling.
- Steam availability, API terms, branding requirements and rate limits require product/legal review.
- Provider downtime must not block normal Picom email/password authentication.
- Packaged Windows, Linux and macOS callback behavior needs separate certification.

## Approval gates

Runtime work may start only after all of the following are approved:

- Product decision that Steam login is required and supported.
- Security review of OpenID validation, replay protection and account linking.
- Privacy/legal review of SteamID storage, retention and deletion.
- Hosted staging backend and HTTPS callback ownership.
- Database migration and RLS review for the private identity mapping.
- Abuse limits, redacted observability and support/recovery process.
- Packaged Windows, Linux and macOS tests.

Until those gates pass, Picom must not display a Steam login button or claim Steam authentication support.

## Future verification checklist

1. Reject an invalid provider endpoint, namespace, return URL, state, nonce and signature.
2. Reject expired and replayed callbacks.
3. Reject linking a Steam identity already owned by another Picom user.
4. Verify Steam metadata cannot bypass Terms/Privacy acceptance or profile field allowlists.
5. Verify logs, deep links and renderer storage contain no assertion or raw secret.
6. Verify cancel/provider outage returns to working email/password login.
7. Verify unlink and account deletion remove or anonymize the mapping according to policy.
8. Verify callback behavior in packaged Windows, Linux and macOS applications.

