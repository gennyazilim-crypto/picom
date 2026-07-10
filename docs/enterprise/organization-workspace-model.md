# Organization and Workspace Model

## Status

**Proposed architecture; no schema change.** Current Picom Supabase migrations have communities owned directly by profiles and contain no `organizations`, `workspaces`, `organization_id`, or `workspace_id`. Introducing these tables before enterprise tenancy, RLS, billing, SSO, and migration semantics are approved would be unsafe.

This model preserves existing consumer communities and defines an additive future enterprise layer.

## Model overview

```text
Organization (enterprise tenant, security/legal/billing boundary)
  -> one or more Workspaces (administrative collaboration and policy boundary)
       -> zero or more Communities (Picom chat/community product surface)
            -> channels, roles, members, messages, attachments, voice rooms
```

### Organization

The customer/tenant boundary used for enterprise contract, verified identity providers/domains, billing-owner placeholder, global organization administrators, data region, retention/security policies, provisioning, and enterprise audit events.

An organization is not a chat community and should not appear in ServerRail as one. Organization membership does not automatically grant access to every workspace/community.

### Workspace

An administrative grouping inside one organization. It may represent a department, business unit, project portfolio, or policy boundary. A workspace can define default membership/role mappings, community creation policy, SSO requirement, retention/region inheritance, and enterprise export scope.

A workspace is not required for consumer MVP communities. Future enterprise communities belong to exactly one workspace.

### Community

The existing Picom user-facing chat container with categories, channels, roles, members, messages, attachments, events, voice, and moderation. Community permissions remain independent and additive to organization/workspace access.

Existing consumer communities remain `workspace_id = null` after a future migration unless explicitly and safely adopted into an organization.

## Proposed entities

### `organizations`

- `id uuid primary key`
- `slug text unique` with controlled rename/history policy
- `name text`
- `status`: `active`, `suspended`, `pending_deletion`
- `billing_owner_user_id uuid null` placeholder only
- `default_region text null`
- `enterprise_entitlement_status text`
- `created_at`, `updated_at`

Do not store payment instruments, SSO secrets, SCIM tokens, legal agreements, or signing credentials directly in this table.

### `workspaces`

- `id uuid primary key`
- `organization_id uuid not null`
- `name`, organization-scoped `slug`
- `status`: `active`, `archived`
- `created_by`, `created_at`, `updated_at`
- policy references/defaults, not duplicated secrets
- unique `(organization_id, slug)`

### `organization_members`

- `organization_id`, `user_id`
- `status`: `invited`, `active`, `suspended`, `removed`
- membership source: `manual`, `sso_jit`, `scim`
- joined/disabled timestamps
- unique `(organization_id, user_id)`

### `workspace_members`

- `workspace_id`, `user_id`
- explicit status/role assignment and source
- unique `(workspace_id, user_id)`

This table may be omitted only if product requirements prove every active organization member can see every workspace. Default design assumes that is not safe.

### Administrative roles

- `organization_roles` and `organization_role_assignments`
- `workspace_roles` and `workspace_role_assignments` if delegated administration is needed
- stable permission keys, role hierarchy, actor/target management constraints
- system roles cannot be edited/deleted casually

Organization/workspace roles are separate from existing community Owner/Admin/Moderator/Member roles.

### Identity/domain/provisioning

- `organization_domains`: verification state/evidence, no secrets
- `organization_identity_providers`: protocol/provider reference/state
- `organization_scim_credentials`: token hash/prefix/scopes/lifecycle only
- `organization_external_groups` and reviewed group-to-role mappings
- append-only enterprise security/audit events

See `sso-saml-design.md` and `scim-provisioning-design.md`.

### Community relationship

A future additive `communities.workspace_id uuid null` references an active workspace. Constraints/triggers or trusted RPCs ensure:

- a community cannot move directly between organizations;
- adoption/move requires owner and organization authorization, audit, data-region/retention review, and rollback plan;
- organization suspension can restrict enterprise access without deleting community data;
- consumer ownership remains valid for `workspace_id is null`;
- enterprise ownership/control policy is represented explicitly rather than inferred from `owner_id` alone.

## Billing owner placeholder

`billing_owner_user_id` is a contact/administrative placeholder, not a payment system or universal authorization role.

- Billing ownership cannot grant message/private-channel access.
- Organization Owner/Security Admin and Billing Admin are distinct permissions.
- Transfer requires step-up authentication, two-party notification, audit event, and unresolved invoice/contract review.
- If billing moves to a provider, store provider customer/subscription opaque IDs server-side; never card/bank data in Picom tables.
- Organization deletion/suspension must not be driven solely by a renderer billing flag.

Billing, plans, invoicing, and entitlements remain out of current scope.

## SSO domains

- Domains belong to one organization after backend DNS TXT verification and conflict review.
- A verified domain helps discover an IdP but is not membership or authorization proof.
- Multiple domains and IdPs per organization may be allowed; ambiguous routing requires provider selection.
- Provider ID/issuer evidence plus active database membership drives RLS.
- Consumer/free-email domains and wildcard claims are rejected or manually reviewed.
- Domain/provider mutation requires step-up authentication, audit, canary test, and safe rollback.

## Member provisioning

### Manual

Authorized organization/workspace administrators invite users with least privilege. Invite acceptance creates active organization/workspace membership but does not automatically grant community access.

### SSO JIT

An approved SSO provider may create pending/default organization membership when organization policy allows. IdP attributes cannot directly grant Owner/Admin or community ownership.

### SCIM

Tenant-scoped SCIM creates/updates/suspends memberships and external groups. Deprovisioning revokes enterprise access/sessions but does not hard-delete the consumer user or unrelated memberships.

### Community access

Workspace policy may propose/default community memberships. Actual community role assignments remain explicit and enforce hierarchy/RLS. Organization membership alone does not expose private channel content.

## Role and permission model

Suggested organization roles:

- `OrganizationOwner`: lifecycle, ownership transfer, high-risk configuration; cannot be granted by SCIM group text.
- `OrganizationAdmin`: workspace/member/policy administration excluding protected owner/billing/security actions.
- `SecurityAdmin`: SSO/SCIM/session/security/audit policy with separation-of-duties controls.
- `AuditViewer`: read/export approved audit scopes only.
- `BillingAdmin`: billing contact/entitlement placeholder only.
- `Member`: no administrative rights.

Suggested workspace roles:

- `WorkspaceAdmin`
- `WorkspaceManager`
- `WorkspaceMember`

Permissions use stable typed keys such as `manageOrganization`, `manageWorkspaces`, `manageIdentityProviders`, `manageProvisioning`, `manageOrganizationMembers`, `viewEnterpriseAudit`, and `exportEnterpriseAudit`. Backend functions must verify target hierarchy; frontend gates are UX only.

## Data isolation

### Tenant key

Every enterprise-owned row carries an immutable `organization_id` directly or via a verified immutable parent. High-value tables may denormalize organization ID only with consistency constraints/triggers to simplify RLS and indexing.

### RLS principles

- Derive current user from `auth.uid()`, never client-supplied actor/user/organization IDs.
- Require active organization membership plus resource-specific workspace/community membership/permission.
- Do not authorize using email/domain, JWT user metadata role text, billing owner field, renderer state, or feature flags alone.
- Service-role/worker paths re-check tenant scope and use narrow trusted functions.
- Consumer rows (`workspace_id null`) retain existing community policies.
- Private community/channel/message/attachment rules remain enforced inside an enterprise tenant.
- Cross-organization relations are rejected with foreign-key/composite constraint or trusted RPC validation.

### Realtime, Storage, LiveKit, search, and exports

- Realtime room join validates organization/workspace/community/channel access.
- Storage paths/metadata include scoped resource IDs; signed URLs require access revalidation.
- LiveKit token issuance checks current membership and room scope; deprovisioning disconnects active sessions.
- Search/discovery indexes never mix private tenant data into public results.
- Audit/data exports execute server-side with exact scope and private artifacts.
- Backups, cache, analytics/diagnostics, and logs preserve region/redaction/tenant boundaries.

## Policy inheritance

Policy resolution should be explicit and deterministic:

1. legal/platform minimum safety rule (cannot be weakened);
2. organization policy;
3. workspace policy within allowed organization range;
4. community/channel policy within allowed parent range;
5. user preference where policy permits.

For retention, privacy, external sharing, and authentication, the stricter effective policy wins unless legal/product rules define otherwise. Store resolved policy version/evidence for sensitive operations rather than silently copying defaults.

## Lifecycle

### Organization create

Trusted backend transaction creates organization, owner membership/role, initial workspace, audit event, and entitlement placeholder. Realtime/events occur after commit.

### Workspace create/archive

Requires organization permission. Archive blocks new activity/creation according to policy but does not hard-delete communities/messages/audit logs.

### Organization suspension

Blocks enterprise administration/new sessions and optionally content access according to incident/billing/legal policy. It must be reversible, audited, and must not silently delete data.

### Ownership transfer/delete

Use step-up authentication, explicit confirmation, active replacement owner, grace period, export/retention/legal hold review, session revocation, and append-only audit. Organization deletion is a separate orchestrated workflow, not cascade delete.

## Additive migration path

1. Add organization/workspace tables and RLS with no runtime use.
2. Seed no organization for existing communities.
3. Add nullable `workspace_id` to communities and indexes; preserve current policies for null rows.
4. Create a controlled adoption RPC with dry-run, authorization, audit, and region/retention checks.
5. Add tenant-aware service DTOs/selectors behind a disabled feature/entitlement gate.
6. Test consumer regression and two-organization isolation in disposable staging.
7. Pilot newly created enterprise communities; do not auto-migrate consumer data.

Migration rollback must account for any adopted communities and cannot simply drop tenant columns after enterprise data exists.

## Required tests before implementation

- organization A cannot read/write organization B rows across all direct APIs;
- workspace member cannot access another workspace without explicit membership;
- organization admin cannot bypass community/private channel permission;
- billing/audit roles cannot read messages by role alone;
- suspended/SCIM-deprovisioned users lose sessions/realtime/voice access;
- SSO same-email/different-UUID identities do not merge or cross tenants;
- consumer community behavior remains unchanged;
- adoption/move/ownership/delete transactions cannot leave partial state;
- storage/search/export/cache/log paths preserve tenant and privacy boundaries.

## Decision summary

- Organization is the enterprise tenant/security/legal/billing boundary.
- Workspace is a subdivision/policy and delegated administration boundary.
- Community remains the user-facing chat/role/moderation boundary.
- Existing consumer communities stay organization-independent by default.
- Enterprise roles never replace community permissions or Supabase RLS.
- Schema implementation is intentionally deferred until tenancy and migration tests are ready.

