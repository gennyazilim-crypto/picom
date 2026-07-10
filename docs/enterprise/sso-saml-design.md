# Enterprise SSO and SAML Design

## Status and scope

**Status: architecture proposal only.** Enterprise SSO is not included in Picom's consumer MVP and no SAML/OIDC runtime, admin UI, provisioning endpoint, or enterprise entitlement is enabled by this document.

Picom is an Electron desktop application for Windows, Linux, and macOS. Any future enterprise authentication flow must preserve PKCE/deep-link safety, Supabase Row Level Security (RLS), organization isolation, and the existing consumer sign-in path.

## Goals

- Allow an approved organization to authenticate Picom users through its identity provider (IdP).
- Bind authentication to a verified organization/workspace tenant without trusting email text alone.
- Support controlled onboarding/offboarding, session policy, auditability, and recovery.
- Keep enterprise configuration and secrets out of Electron renderer code.
- Preserve server-side/RLS authorization after authentication.

## Non-goals

- No enterprise SSO in the consumer MVP.
- No SSO toggle or fake provider UI before backend and entitlement controls exist.
- No SCIM implementation, just-in-time role elevation, billing, or enterprise admin console in this phase.
- No automatic account linking or tenant assignment based only on an unverified email domain.
- No IdP metadata, certificates, client secrets, access tokens, or service-role keys stored in local settings.

## Protocol options

### Option A: SAML 2.0 through Supabase Auth (recommended first path)

Supabase Auth documents project-level enterprise SSO with SAML 2.0 and supports multiple SAML connections. Each connection receives an `sso_provider_id` that can participate in tenant-aware RLS. Picom would initiate SSO using the provider ID or a verified/routable domain, complete the browser flow, and return through the existing allowlisted desktop auth callback.

Advantages:

- Broad compatibility with Microsoft Entra, Okta, Google Workspace, PingIdentity, OneLogin, and other SAML IdPs.
- Supabase manages assertion validation and exposes SSO authentication/provider evidence in JWT claims.
- Multiple organizations can have separate IdP connections.

Constraints:

- SAML must be enabled/configured for the selected Supabase plan/project and managed by trusted operators.
- IdP metadata/certificate rotation, EntityID changes, attribute mappings, and session limits need an operational runbook.
- Supabase documents that SAML SSO users are not eligible for automatic/manual identity linking; the same email can therefore represent separate Auth users. Picom must reference users by UUID, not email.
- A domain can help route sign-in but cannot by itself prove organization membership.

### Option B: external enterprise OIDC provider

Use Supabase custom OAuth/OIDC provider support when an enterprise IdP is standards-compatible and the product requirements favor OIDC. Electron remains a public client and uses authorization code with PKCE; no client secret belongs in the app. Provider issuer, audience, nonce/state, redirect URI, and claim mappings must be reviewed per tenant.

Advantages include modern JSON/JWT interoperability and a simpler claim model. Risks include provider-specific logout/session behavior, claim drift, account collision, issuer confusion, and configuration inconsistency. OIDC is not a shortcut around tenant/RLS enforcement.

### Not the same: Supabase as an OIDC provider

Supabase can also act as an OAuth 2.1/OIDC identity provider for other applications. That outbound use case is distinct from allowing a company's IdP to sign users into Picom and is not required for Picom enterprise SSO.

## Required organization/workspace model

SSO must not launch before Picom has an authoritative multi-tenant organization model separate from community roles:

- `organizations`: immutable ID, display name, lifecycle state, enterprise entitlement, policy configuration.
- `organization_members`: organization ID, user UUID, status, source, joined/disabled timestamps.
- `organization_domains`: normalized domain, verification state/method, verified timestamp, unique routing rules.
- `organization_identity_providers`: organization ID, Supabase SSO provider ID or OIDC issuer reference, protocol, state, non-secret metadata fingerprint, timestamps.
- `organization_roles`: organization-scoped administrative permissions separate from community Owner/Admin/Moderator roles.
- append-only SSO/security audit events.

Communities may optionally belong to an organization, but community membership never grants organization administration. Every organization-owned row and RLS policy must carry/check the immutable organization ID.

## Domain verification and discovery

1. An authenticated, authorized organization administrator requests a domain.
2. Picom creates a one-time DNS TXT challenge with bounded expiry.
3. A trusted backend verifies DNS and records evidence; the renderer never marks a domain verified.
4. Conflicting claims, consumer email domains, wildcard domains, and subdomain ownership receive manual review.
5. Domain-based SSO discovery may begin only after verification and IdP assignment.
6. Domain removal/provider changes require step-up authentication, audit logging, and a safe transition period.

Email suffix matching may choose which login option to offer, but final tenant access comes from the configured SSO provider plus organization membership/RLS checks.

## Authentication flow

1. User selects organization SSO and enters a work email or organization slug.
2. A trusted service resolves the verified organization/IdP without exposing administrative metadata.
3. Picom starts Supabase SSO using provider ID/domain and an allowlisted `picom://auth/callback` redirect with PKCE/state protections.
4. The system browser handles IdP authentication; the Electron renderer never reads IdP credentials or assertions.
5. Deep-link handling validates scheme, host/path, state, and expected flow before session exchange.
6. Backend/RLS validates user UUID, `sso_provider_id`/issuer evidence, organization membership status, and entitlement.
7. Denied, disabled, or mismatched users receive a generic safe error and a redacted security event.

IdP-initiated SAML requires an equally strict RelayState/deep-link mapping and must not accept arbitrary post-login URLs.

## Provisioning lifecycle

### Phase 1: controlled just-in-time provisioning

- Allow JIT creation only for an active verified IdP and organization policy that explicitly enables it.
- Create a pending/default organization member with least privilege.
- Map display name/avatar fields conservatively; never map IdP group text directly to Picom owner/admin permissions.
- Require an existing organization admin approval when policy demands it.

### Phase 2: managed provisioning

Future SCIM 2.0 or provider lifecycle events may create, suspend, reactivate, and update users/groups. This requires a separate authenticated API, idempotency, rate limiting, tenant-scoped tokens, audit logs, replay protection, and destructive-action safeguards.

### Deprovisioning

- Disable organization access and revoke relevant sessions promptly.
- Disconnect active realtime and LiveKit sessions tied to the revoked organization/session where supported.
- Preserve append-only audit integrity and apply retention/deletion policies separately.
- Do not delete a consumer account merely because one enterprise membership is disabled.
- Define ownership transfer for organization-owned communities before final removal.

## Authorization and RLS

Authentication proves identity; it does not grant access. RLS must enforce:

- active organization membership for organization-owned data;
- immutable organization ID and configured provider evidence where policy requires SSO;
- explicit permission checks for organization administration;
- community/channel/private-content rules in addition to organization membership;
- no cross-tenant access via email, domain, mutable metadata, client-supplied role, or renderer feature flag.

JWT SSO claims are inputs to policy, not the sole source of mutable authorization. Database membership and policy state remain authoritative. Test multiple IdPs, same-email separate UUIDs, disabled membership, wrong tenant, forged metadata, and consumer-to-enterprise transitions.

## Session and account policy

- Support IdP-enforced maximum session duration and reauthentication.
- Decide whether enterprise organizations require SSO-only login and how emergency recovery works.
- Revoke sessions after deprovisioning, provider removal, security incident, or organization policy change.
- Keep local session tokens in the centralized secure auth/session path; never duplicate them in SSO settings.
- Show the active organization and sign-in method in account activity without exposing assertions or tokens.

## Administration and audit

Enterprise configuration requires an app-admin/organization-admin backend surface with step-up authentication. Audit events include domain verification, IdP add/update/remove, attribute mapping changes, JIT/provisioning policy, user suspend/reactivate, session revoke, failed tenant match, and break-glass use. Logs exclude SAML assertions, certificates/private keys, OAuth secrets, tokens, and unnecessary profile attributes.

## Security risks and controls

| Risk | Required control |
| --- | --- |
| Tenant confusion/account takeover | Immutable organization/provider IDs; never authorize by email suffix alone. |
| SAML assertion or metadata abuse | Delegate validation to configured Supabase Auth; restrict operator access; pin/review metadata source and rotation. |
| OIDC issuer/audience confusion | Exact issuer/audience/redirect allowlists, PKCE, state, nonce, and JWKS validation. |
| Account collision | UUID identity; explicit migration/reconciliation flow; no SSO identity linking assumption. |
| Role escalation through attributes/groups | Least-privilege mapping and server-side approved role policy; no direct owner/admin mapping. |
| Open redirect/deep-link injection | Fixed callback routes, strict URL parser, one-time state, bounded flow lifetime. |
| Stale access after offboarding | Prompt session revocation, realtime disconnect, membership disable, and periodic reconciliation. |
| Certificate/secret leakage | Secret manager and trusted backend/CLI only; redacted logs and diagnostics. |
| Lockout/misconfiguration | Test connection, canary users, two-admin approval, rollback configuration, and audited break-glass account. |

## Delivery phases

1. Build and test organization/workspace tenancy and RLS independently of SSO.
2. Add verified domains and audited IdP configuration in staging.
3. Implement one SAML provider with controlled JIT and desktop PKCE/deep-link flow.
4. Add lifecycle/session revocation and enterprise admin controls.
5. Run cross-tenant RLS, security, IdP compatibility, and Windows/Linux/macOS callback tests.
6. Pilot one organization; only then consider multiple IdPs, OIDC, or SCIM.

## Consumer MVP boundary

Consumer email/social login remains unchanged. No enterprise SSO button, domain discovery, organization policy, or provisioning claim should appear as available until the full backend, RLS, entitlement, audit, support, and legal gates pass.

## Official compatibility references

- [Supabase Enterprise SSO overview](https://supabase.com/docs/guides/auth/enterprise-sso)
- [Supabase SAML 2.0 for projects](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml)
- [Supabase custom OAuth/OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)
- [Supabase Auth identities](https://supabase.com/docs/guides/auth/identities)
- [Supabase identity linking limitations](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase Auth and RLS overview](https://supabase.com/docs/guides/auth)

Provider capabilities, plan requirements, and CLI workflows must be reverified against official documentation before implementation.

