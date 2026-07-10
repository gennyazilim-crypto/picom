# Enterprise tenant model

## Status

**Architecture proposal only. Not approved for implementation.** Picom currently treats each community as its own collaboration boundary and has no enterprise organization runtime. This document identifies the additive model and schema impact without changing Supabase, Electron, authentication, UI, or current community behavior.

The detailed companion design is [`enterprise/organization-workspace-model.md`](enterprise/organization-workspace-model.md). SSO and SCIM remain separate proposals and cannot authorize tenant access by themselves.

## Boundaries

```text
Organization (enterprise security, legal, policy boundary)
  -> Workspace (delegated administration and policy scope)
       -> Managed Community (existing Picom chat boundary)
            -> channels, roles, members, messages, files, voice
```

- **Organization:** customer tenant, verified domains, identity-provider references, enterprise admins, policy and audit scope.
- **Workspace:** optional subdivision for departments/projects and delegated administration.
- **Managed community:** existing Picom community adopted by or created under a workspace. Community membership and private-channel permissions remain authoritative.
- **Consumer community:** existing community with no workspace/organization association. Current behavior must remain unchanged.

Organization membership never grants automatic message, channel, attachment, voice, or member-list access. Enterprise roles and existing Owner/Admin/Moderator/Member roles are distinct.

## Proposed entities

| Entity | Purpose | Sensitive-data rule |
| --- | --- | --- |
| `organizations` | Stable tenant ID, slug/name, lifecycle, region/policy references | No payment data, IdP secrets, certificates, SCIM tokens, or legal documents |
| `organization_members` | Active/invited/suspended tenant membership and source | Stable user UUID only; no password/auth token |
| `organization_roles` / assignments | Owner, Admin, SecurityAdmin, AuditViewer, BillingAdmin | Typed permissions; no role from client/JWT metadata alone |
| `workspaces` | Organization-scoped administrative boundary | Unique slug within organization |
| `workspace_members` / roles | Explicit delegated workspace access | Organization membership alone is insufficient |
| `organization_domains` | Domain ownership verification state/evidence | Verification tokens stored hashed or in trusted provider, never returned to renderer |
| `organization_identity_providers` | Provider IDs and non-secret routing metadata | IdP credentials/config secrets stay in a secret manager |
| `enterprise_audit_events` | Append-only organization security/admin actions | Redacted metadata; no message content or credentials |

## Managed communities

The safest additive relationship is nullable `communities.workspace_id`:

- `null` preserves every consumer community policy and flow;
- a managed community belongs to one workspace and therefore one organization;
- direct moves between organizations are forbidden;
- adoption requires community owner and organization authorization, policy/region/retention compatibility checks, dry run, audit event, and rollback plan;
- organization suspension restricts enterprise access but does not cascade-delete community data;
- organization/workspace administrators do not bypass community or private-channel permissions.

## Domain model

- Domains require trusted DNS verification and conflict review.
- A verified domain may route users to an SSO option; it is not membership or authorization proof.
- Free/public email domains and wildcard claims are rejected.
- Domain transfer, removal, and IdP binding require step-up authentication, audit, notification, and rollback.
- Same-email identities are never merged automatically; authorization uses stable Auth UUID plus active database membership.

## Schema impact

### New tables

- `organizations`
- `organization_members`
- `organization_roles`
- `organization_role_assignments`
- `workspaces`
- `workspace_members`
- optional workspace roles/assignments
- `organization_domains`
- `organization_identity_providers`
- future hashed provisioning credentials and external-group mappings
- append-only `enterprise_audit_events`

### Existing table changes

- `communities.workspace_id uuid null` with index and controlled relationship.
- Optional immutable `organization_id` denormalization on high-volume tables only when protected by consistency triggers and proven necessary for RLS/query performance.
- Session/realtime/presence records need organization deprovisioning hooks, not duplicated auth secrets.
- Storage/search/export/job records need derived tenant scope and region/policy enforcement.

### Constraints and indexes

- Unique `(organization_id, slug)` for workspaces and `(organization_id, normalized_domain)` for domains.
- Unique organization/workspace memberships per user.
- Composite or trigger constraints preventing cross-organization parent/child references.
- Status checks for active/suspended/archived/pending-deletion lifecycles.
- Tenant-first indexes for membership, audit, policy, provisioning, and admin queries.
- No cascade deletion from organization to communities, messages, attachments, or audit evidence.

## RLS and authorization impact

- All enterprise RPCs derive actor identity from `auth.uid()`.
- Every organization/workspace row requires active tenant membership plus a resource permission.
- Community/channel/message/attachment policies continue to require community/channel access.
- Email domain, billing contact, client feature flag, JWT user metadata, or renderer state is never sufficient authorization.
- Trusted workers receive narrow tenant-scoped inputs and recheck lifecycle/policy.
- Realtime, LiveKit token issuance, Storage signed URLs, search, exports, caches, and background jobs must preserve the same tenant boundary.

## Policy inheritance

Resolve effective policy in this order: platform/legal minimum, organization, workspace, community/channel, then user preference where allowed. The stricter retention, external-sharing, identity, and privacy rule wins. Store policy version/evidence for high-risk operations rather than silently copying settings.

## Migration path

1. Approve product semantics, tenant threat model, lifecycle, support, legal, region, retention, and billing boundaries.
2. Add dormant organization/workspace tables and RLS without assigning existing communities.
3. Add nullable `workspace_id`; keep null-row consumer policies unchanged.
4. Build staging-only create/adopt/suspend transactions with append-only audit.
5. Run two-organization isolation tests across database, Storage, Realtime, LiveKit, search, jobs, exports, logs, and caches.
6. Pilot newly created enterprise communities behind entitlement; do not auto-adopt consumer communities.
7. Add SSO, then SCIM, only after tenant membership and deprovisioning are authoritative.

Rollback after community adoption is a data migration, not a simple schema drop.

## Approval gates before implementation

- Product approves organization/workspace/community semantics and consumer coexistence.
- Security approves threat model, RLS matrix, domain verification, break-glass access, and separation of duties.
- Data/legal approve residency, retention, deletion, audit, export, and ownership transfer behavior.
- Operations approve backup/restore, suspension, incident, support, and tenant migration runbooks.
- Billing/entitlement ownership is defined without granting content access.
- Staging proves cross-tenant isolation and current consumer/community regression tests.

Until all gates pass, do not add organization UI, migrations, SSO domain discovery, SCIM endpoints, enterprise claims, or marketing promises.

## Decision

Picom should use an additive organization/workspace layer if enterprise demand is approved. It must not reinterpret existing communities as organizations, and organization admins must never inherit private community content access. Runtime implementation remains intentionally deferred.
