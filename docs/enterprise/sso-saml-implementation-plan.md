# SSO/SAML implementation plan

## Decision

**Planning only; implementation is not approved.** Task 199 left the enterprise tenant model proposed and dormant. Enabling SSO before organizations, active tenant membership, entitlement, RLS, lifecycle, audit, support, and recovery are authoritative could create cross-tenant access and account lockout risk.

No SSO button, Supabase SSO connection, SAML metadata, certificate, secret, domain-discovery endpoint, JIT behavior, or Electron callback behavior is enabled by this plan.

## Recommended first implementation path

Use Supabase Auth enterprise SAML as the first evaluated path after procurement/plan/capability verification. Picom remains a public Electron client:

- authentication occurs in the system browser;
- the desktop app uses an allowlisted `picom://auth/callback` route with one-time state and PKCE where applicable;
- the renderer never receives IdP administrative credentials, private keys, metadata signing secrets, service-role keys, or raw assertions;
- Supabase session handling remains centralized in the existing auth service;
- database organization membership and RLS authorize resources after authentication.

A custom trusted auth gateway is a fallback only when approved requirements cannot be met by Supabase. It would own assertion validation, metadata/certificate rotation, issuer/audience checks, replay prevention, tenant binding, session exchange, rate limits, audit, monitoring, and incident runbooks. None of that logic belongs in Electron or a public Edge Function without an independent security review.

## Provider configuration

### Stored as non-secret tenant metadata

- immutable organization ID
- provider protocol and status
- Supabase `sso_provider_id` or approved issuer reference
- verified domain bindings
- display label and login hint policy
- non-secret configuration fingerprint/version
- created, tested, activated, rotated, disabled timestamps

### Stored only in trusted provider/operator systems

- SAML private keys and signing/decryption certificates where secret
- IdP/API credentials
- OAuth/OIDC client secrets
- Supabase service-role keys
- metadata-fetch credentials
- break-glass credentials

Secrets must use an approved secret manager and never appear in Git, `.env.example`, renderer bundles, local settings, diagnostics, crash payloads, or audit metadata.

### Configuration lifecycle

1. Organization SecurityAdmin begins a draft after step-up authentication.
2. Trusted backend verifies organization entitlement and domain ownership.
3. Operator/configuration service creates or updates the provider.
4. Canary users complete SP-initiated tests on Windows, Linux, and macOS.
5. Two authorized administrators approve activation where policy requires.
6. Existing login remains available until rollback and break-glass behavior are tested.
7. Rotation, disable, removal, and rollback create append-only audit events.

## Domain mapping

- Normalize domains server-side and enforce one active organization claim after conflict review.
- Verify ownership through a bounded DNS challenge; renderer state cannot mark a domain verified.
- Reject free-email domains, malformed internationalized domains, wildcards, and unsafe suffix matching.
- Domain lookup returns only a generic login route/provider choice, not organization configuration.
- Domain proves routing only. Successful provider authentication plus active organization membership and policy evidence authorize tenant access.
- Domain removal/provider reassignment uses a grace window, canary test, notifications, step-up authentication, and rollback.

## JIT provisioning

JIT is optional and default-off per organization.

- Permit JIT only for an active organization, verified domain, configured provider, valid provider evidence, and explicit policy.
- Create a pending or least-privileged `organization_members` record in one transaction.
- Never grant OrganizationOwner, SecurityAdmin, community Owner/Admin, private-channel access, or billing authority directly from SAML group/attribute text.
- Use an allowlisted attribute mapping for display name and other approved profile fields; ignore unknown attributes.
- Same email is not an identity key. Use the stable Supabase Auth UUID and provider evidence; do not auto-link separate identities.
- JIT does not create community membership unless a separately reviewed workspace/community policy does so.
- Failed tenant/provider/domain matches return a generic error and a redacted security event.

SCIM provisioning, deprovisioning, and group mapping remain a separate server-to-server project. JIT is not a substitute for authoritative offboarding.

## Supabase constraints to verify before implementation

- Enterprise SSO/SAML availability and project/plan requirements.
- Supported provider creation, update, domain association, metadata, and certificate rotation workflows.
- Exact redirect/callback and PKCE behavior for desktop system-browser authentication.
- Claim/provider evidence available to RLS and token refresh behavior.
- Identity-linking behavior for SAML users and same-email identities.
- Session revocation and provider-disable propagation.
- Local/staging test support and audit/observability capabilities.

These capabilities must be rechecked against current official Supabase documentation and a disposable staging project at implementation time. Do not encode plan assumptions as production behavior.

## Custom-auth constraints

If a custom gateway is approved, it must:

- terminate SAML/OIDC on a trusted HTTPS backend, never the desktop renderer;
- validate signatures, issuer, audience, recipient, destination, timestamps, nonce/state, and replay controls;
- bind provider to exactly one organization and active configuration version;
- exchange identity for a centrally managed session without exposing service credentials;
- preserve Supabase RLS-compatible stable user/tenant evidence;
- support metadata/certificate rotation, IdP initiated flow policy, logout/session revocation, rate limits, alerts, and incident rollback;
- pass third-party security testing before pilot.

Building a custom SAML parser or cryptography in Picom is forbidden.

## Authorization and RLS

SSO authenticates identity; it does not grant Picom access. Every enterprise query requires:

1. valid current Supabase session;
2. active organization lifecycle and entitlement;
3. active organization/workspace membership;
4. required organization permission;
5. existing community/channel/private-content permission where content is involved.

Do not authorize by email suffix, renderer flags, organization slug, IdP display name, mutable profile metadata, or unverified JWT group strings.

## Deprovisioning and sessions

- Suspension blocks tenant access and revokes relevant sessions promptly.
- Realtime and LiveKit connections tied to revoked access are disconnected.
- Consumer identity and unrelated organization/community memberships are not deleted.
- Owned resources follow explicit transfer/archive policy.
- Audit evidence is preserved under retention policy.
- Provider disable/rotation and organization suspension have tested rollback and communication paths.

## Required implementation phases

1. Approve and implement organization/workspace tenancy and cross-tenant RLS tests.
2. Approve enterprise entitlement, admin separation, audit, secret manager, support, and legal handling.
3. Build domain/provider configuration in trusted backend and staging only.
4. Implement SP-initiated system-browser sign-in for one provider and controlled JIT.
5. Implement session revocation, deprovisioning hooks, break-glass recovery, and audit.
6. Test wrong tenant, forged state, replay, expired assertion, domain conflict, same-email separate UUIDs, disabled user/provider, and rollback.
7. Test callback/install behavior on signed Windows, Linux, and macOS packages.
8. Pilot one organization behind entitlement and kill switch before broader rollout.

## Release blockers

- Tenant model/RLS is not accepted and live-tested.
- Any secret or assertion reaches renderer/local settings/logs.
- Domain alone grants membership or access.
- JIT can grant privileged organization/community roles.
- Disabled users retain sessions/realtime/voice access.
- Callback accepts arbitrary redirects or fails state validation.
- Break-glass and rollback are untested.
- Consumer login regression exists.

## References

- [`sso-saml-design.md`](sso-saml-design.md)
- [`../enterprise-tenant-model.md`](../enterprise-tenant-model.md)
- [`scim-provisioning-design.md`](scim-provisioning-design.md)

Provider behavior and plan requirements are intentionally treated as verification items, not permanent assumptions.
