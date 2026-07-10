# Task 117 Checkpoint: Enterprise SSO/SAML Design

## Result

Created a documentation-only enterprise SSO architecture for future Picom organizations. No consumer authentication, UI, Supabase configuration, or runtime behavior changed.

## Decisions

- SAML 2.0 through Supabase Auth is the recommended first enterprise federation path.
- External enterprise OIDC is a secondary provider-dependent option.
- Organization/workspace tenancy and RLS must exist before SSO.
- Domain verification supports discovery only; it is not an authorization boundary.
- Users are referenced by UUID because SAML identities are not assumed to link to existing accounts.
- JIT provisioning begins least-privileged; SCIM is a separate future phase.

## Validation

- Compatibility assumptions referenced current official Supabase Auth documentation.
- Documentation-only change; consumer MVP remains unchanged.
- `npm run typecheck`
- `npm run mock:smoke`

## Remaining gates

- Organization/workspace schema and RLS design/implementation
- Enterprise entitlement and admin controls
- Provider configuration, secret management, audit, and break-glass process
- Staging IdP, cross-tenant RLS, and desktop callback security testing
- Legal, support, and commercial approval

