# SSO/SAML enterprise placeholder

Picom may support enterprise single sign-on in a future post-MVP enterprise track. This document defines the safe placeholder architecture only. It does not enable SSO, does not accept SAML assertions, and does not add production identity-provider configuration.

## Status

Placeholder only. The current MVP remains Supabase Auth based and keeps normal login/register/session restore behavior unchanged.

## Goals

- Prepare a future enterprise SSO/SAML design without adding unsafe authentication code.
- Keep Windows, Linux, and macOS desktop clients compatible with a browser-based auth redirect flow.
- Preserve Supabase Postgres RLS as the source of authorization truth after identity is established.
- Document how enterprise identities map to Picom profiles, organizations, communities, and roles.
- Make secret handling, certificate rotation, and audit requirements explicit before implementation.

## Non-goals

- No production SAML service provider is implemented in this task.
- No IdP metadata, private keys, certificates, or signing secrets are committed.
- No enterprise SSO UI is exposed to normal users.
- No bypass is added around Supabase Auth, RLS, community membership, or channel permissions.
- No SCIM provisioning is implemented here; that is tracked separately.

## Future architecture

1. Enterprise administrator registers an organization SSO configuration in a restricted admin surface.
2. Backend stores only non-secret metadata in the normal database and stores secrets/certificates in a production secret manager.
3. Desktop client starts an SSO login flow through a safe external browser or controlled auth window.
4. Backend validates SAML responses, creates or links a user identity, and establishes a normal Picom session.
5. Community access still comes from memberships, roles, permissions, and RLS checks.

## SAML configuration placeholder

Future organization-level configuration may include:

- organizationId
- providerName
- entityId
- ssoUrl
- x509CertificateReference, never the raw certificate in client config
- allowedDomains
- nameIdFormat
- attributeMapping
- enabled
- createdById
- createdAt
- updatedAt
- rotatedAt

Raw certificates, private keys, client secrets, and signing material must stay out of the renderer, docs, logs, diagnostics, repository, and release artifacts.

## Attribute mapping placeholder

Expected enterprise attributes:

- subject identifier
- email
- display name
- avatar URL placeholder
- department placeholder
- group names placeholder

Picom profile fields should be updated conservatively. User-generated profile data should not be overwritten unexpectedly without an enterprise policy.

## Role and permission mapping

SAML group claims may map to Picom organization or community roles later, but role grants must be explicit, auditable, and bounded.

Rules:

- SAML group mapping cannot bypass owner/admin permission checks.
- Lower-trust IdP claims cannot grant app-level admin by default.
- Role changes must create audit entries.
- Revoked or missing claims should not automatically delete data; they should remove access according to policy.

## Desktop flow considerations

- Use the existing safe external link/auth service path when available.
- Do not expose raw SAML XML to the renderer.
- Deep-link return URLs must be validated by the deep link service.
- Unknown or malformed auth callback URLs must fail closed.
- Failed SSO should return a clean error without stack traces.

## Security requirements before implementation

- Signed response and assertion validation.
- Audience, issuer, recipient, destination, and time-window validation.
- Replay protection.
- Certificate rotation plan.
- Per-organization domain ownership verification.
- Redacted authentication logs.
- Rate limits for SSO attempts.
- Safe account linking rules.
- Session revocation handling.

## Audit logging

Future SSO events should log:

- sso_login_started
- sso_login_succeeded
- sso_login_failed
- sso_config_created
- sso_config_updated
- sso_config_disabled
- sso_certificate_rotated

Logs must exclude raw assertions, passwords, tokens, certificates, and private keys.

## Rollout plan

1. Internal design review.
2. Threat model for SAML handling and account linking.
3. Add database schema behind a disabled feature flag.
4. Implement backend validation with test fixtures only.
5. Add RLS and audit tests.
6. Add desktop auth redirect smoke tests.
7. Pilot with a non-production IdP.
8. Enable per organization only after security review.

## Verification checklist

- Normal email/password auth still works.
- Supabase session restore still works.
- RLS still blocks unauthorized community/channel data.
- SSO failures show user-safe errors.
- Logs and diagnostics contain no assertions, certificates, or tokens.
- Disabling SSO does not lock out existing non-enterprise users.

## Risks and open questions

- IdP misconfiguration can lock users out.
- Group-to-role mapping can overgrant access if not reviewed carefully.
- Desktop deep-link handling must not accept arbitrary commands.
- Certificate rotation and clock skew handling require production runbooks.
- Enterprise data residency requirements may affect where auth metadata is stored.
