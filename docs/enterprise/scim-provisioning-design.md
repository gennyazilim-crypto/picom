# SCIM 2.0 Provisioning Design

## Status

**Architecture proposal only.** Picom does not expose a SCIM endpoint, token, enterprise workspace UI, or provisioning behavior. SCIM is outside the consumer MVP and must not be advertised as available.

This design follows the SCIM 2.0 core schema in RFC 7643 and HTTP protocol in RFC 7644. It extends the organization/SSO prerequisites in `docs/enterprise/sso-saml-design.md`.

## Goals

- Let an authorized enterprise identity system manage Picom organization users and groups.
- Make create, update, suspend, reactivate, and group membership operations idempotent and auditable.
- Apply least privilege and tenant isolation independently of SSO authentication.
- Remove organization access quickly without deleting unrelated consumer identity/data.
- Keep provisioning credentials server-side, scoped, rotatable, and redacted.

## Non-goals

- No consumer MVP provisioning.
- No password provisioning or password return through SCIM.
- No automatic community Owner/Admin grants from arbitrary IdP text.
- No global Picom user deletion when one organization deprovisions a member.
- No SCIM calls from Electron renderer code.

## Enterprise workspace prerequisites

Implementation is blocked until Picom has:

- authoritative `organizations` and active/suspended lifecycle state;
- `organization_members` keyed by organization ID and immutable Auth user UUID;
- organization roles/permissions separate from community roles;
- organization-owned resource IDs and proven cross-tenant RLS;
- verified domains and configured SSO provider binding;
- app/organization admin authorization with step-up authentication;
- append-only security/audit events and retention policy;
- session revocation and realtime/LiveKit disconnect paths;
- ownership transfer for organization-owned communities;
- enterprise entitlement, support, legal/privacy, incident, and recovery processes.

SCIM may provision membership, but it never replaces RLS or backend permission checks.

## Service architecture

Picom would operate as a tenant-scoped SCIM Service Provider under a versioned HTTPS base URI such as `/enterprise/scim/v2/{organizationId}`. Requests terminate in a trusted backend/Edge/API service, never Electron or a public Supabase table endpoint.

Initial resource surface:

- `GET /ServiceProviderConfig`
- `GET /Schemas`
- `GET /ResourceTypes`
- `POST`, `GET`, `PATCH`, and policy-controlled `PUT` for `/Users`
- `POST`, `GET`, `PATCH`, and policy-controlled `PUT` for `/Groups`
- SCIM filter support limited to an explicitly tested subset, including `userName eq` and `externalId eq`

`DELETE` should safely deactivate/unassign rather than hard-delete identity or audit records. Bulk operations remain disabled until bounded size, atomicity, partial-failure behavior, and abuse controls are proven.

## Tenant and identity keys

- SCIM `id`: Picom-generated stable provisioning resource ID, not an email.
- `externalId`: tenant-scoped immutable IdP/directory identifier when provided.
- `userName`: normalized sign-in/display routing value; never the database authorization key.
- Picom Auth user UUID: internal identity reference and RLS subject.
- Every lookup is scoped by organization ID plus provider/token identity.
- Enforce unique `(organization_id, external_id)` and an explicit normalized-userName policy.

The same email may belong to separate Auth users, especially with SAML. Provisioning must not merge users silently by email.

## User lifecycle

### Create

1. Authenticate and authorize the tenant-scoped SCIM client.
2. Validate schema, content type, size, supported attributes, and uniqueness.
3. Deduplicate by idempotency key/external ID inside the organization.
4. Resolve an existing SSO/Auth identity only through an approved reconciliation policy; otherwise create a pending organization identity/membership.
5. Assign only the default least-privileged organization role.
6. Write membership and append-only audit event in one transaction.
7. Emit realtime/session effects only after commit.

### Read/list

Return only the tenant's SCIM resources and approved attributes. Apply pagination, bounded filters, rate limits, stable ordering, ETags/version metadata, and redaction. Never return password values, tokens, auth metadata, private user content, community messages, or internal security fields.

### Update/PATCH

- Support approved mutable attributes such as display name, active state, preferred language, and controlled profile fields.
- Reject immutable ID/tenant/provider mutations.
- Use ETag/version preconditions where supported to avoid lost updates.
- Treat repeated equivalent PATCH operations as idempotent.
- Route role/group changes through explicit mapping, hierarchy, and anti-escalation checks.

### Suspend (`active: false`)

1. Mark organization membership disabled atomically.
2. Revoke relevant Picom sessions or organization grants according to policy.
3. Disconnect organization-scoped realtime and LiveKit participation where supported.
4. Remove effective group/role permissions.
5. Preserve audit logs and ownership constraints.
6. Do not delete unrelated consumer account data or memberships in other organizations.

### Reactivate (`active: true`)

Require the organization/provider to remain active and verify ownership/security holds. Restore least privilege and currently valid group mappings; do not resurrect obsolete elevated roles automatically. Record the event and require fresh authentication/session issuance.

### Delete request

Map SCIM DELETE to organization deprovisioning/tombstone, not global hard deletion. Owned resources require transfer/archive policy first. User privacy deletion remains the separate authenticated account-deletion workflow.

## Group and role mapping

SCIM Groups represent enterprise directory groups. Store stable external group ID, display name, active state, and membership separately from Picom permissions.

Mapping rules:

- Default is no privileged mapping.
- Organization admins explicitly map approved external group IDs to Picom organization roles.
- Display names are informational and never authorize access.
- Mappings cannot grant app-admin, organization Owner, billing/security break-glass, or community ownership automatically.
- A delegated admin cannot create a mapping above their own manageable role.
- Removing a group removes only permissions derived from that mapping.
- Multiple group grants combine through a deterministic, documented least-privilege policy; deny/suspension wins.
- Community roles require a separate explicit policy and hierarchy check.
- Every mapping create/change/delete and effective elevation is audited.

Group membership changes should be transactional, idempotent, bounded, and reconcileable. Out-of-order updates must use resource version/timestamp safeguards rather than overwrite newer state.

## Deprovisioning guarantees

Target objective placeholders must be approved contractually. The implementation should:

- acknowledge accepted deprovisioning only after durable commit;
- revoke effective organization access promptly;
- retry post-commit session/realtime disconnect with an operational queue;
- surface delayed/failed revocation to restricted operations dashboards;
- reconcile active memberships against the directory on a schedule;
- preserve organization ownership and audit integrity;
- retain/anonymize data according to Picom deletion and retention policies, not the IdP's delete semantics alone.

## Authentication and token management

SCIM uses HTTPS and standard HTTP authentication/authorization; Picom's proposed first option is a high-entropy tenant-scoped bearer credential stored as a hash, or a provider-supported OAuth client-credentials design after separate review.

Controls:

- Generate tokens only in a restricted enterprise admin flow with step-up authentication.
- Display a raw token once after creation; never make it retrievable again.
- Store only a strong token hash, prefix/identifier, organization, scopes, created/last-used/expires/revoked timestamps.
- Keep secrets in provider/production secret storage, never renderer local storage, logs, diagnostics, support exports, URL query strings, or source control.
- Scope to one organization and approved User/Group read/write operations.
- Support overlapping rotation, expiry, immediate revocation, last-used visibility, and emergency revoke-all.
- Rate-limit by tenant/token/IP-risk signal without storing raw IP when policy is unresolved.
- Reject tokens for suspended organizations and use constant-time credential verification.

## Audit and observability

Append-only events include token create/rotate/revoke, user create/update/suspend/reactivate, group create/update/delete, membership delta, mapping change, rejected cross-tenant/filter/schema request, rate limit, reconciliation drift, and post-commit revocation failure.

Store actor/client ID, organization ID, operation, target stable ID, outcome, request ID, timestamp, changed attribute names, and redacted reason. Exclude token values/hashes, passwords, assertions, authorization headers, full request bodies, and unnecessary personal attributes.

Operational metrics should cover latency, success/error rate, rate limits, deprovisioning completion, reconciliation drift, and queue age by tenant/version without exposing user content.

## Error and consistency policy

- Return RFC 7644 SCIM error shape and appropriate HTTP status.
- Validate `schemas`, attribute mutability, filters, pagination, and JSON body limits.
- Use transactions for resource plus audit updates.
- Use request IDs and idempotency records for retry-safe creates/changes.
- Do not emit downstream events until commit succeeds.
- Partial group/bulk changes must never silently report full success.
- Avoid existence leaks across tenants through response differences.

## Security threats

| Threat | Control |
| --- | --- |
| Cross-tenant object reference | Tenant from authenticated credential; organization-scoped queries and RLS; no client-selected tenant trust. |
| Privilege escalation by group name | Stable external group IDs, explicit approved mappings, hierarchy enforcement. |
| Token theft | One-time display, hash-at-rest, narrow scopes, expiry/rotation/revocation, redaction. |
| Replay/duplicate provisioning | Idempotency key/external ID, ETag/version checks, bounded request lifetime where applicable. |
| Mass deprovisioning error | Rate/anomaly controls, audit, ownership safeguards, restricted bulk support, recovery procedure. |
| PII overcollection | Minimal schema/attribute allowlist and privacy review. |
| Account collision | UUID/external ID authority; no email-only automatic merge. |
| Stale access | Transactional disable, session/realtime revoke queue, reconciliation and alerts. |

## Rollout plan

1. Complete organization model and cross-tenant RLS tests.
2. Implement read-only discovery/schema endpoints in isolated staging.
3. Add User create/read/update with least privilege and idempotency.
4. Add suspend/reactivate plus session/realtime revocation evidence.
5. Pilot Group resources without privileged mappings.
6. Add reviewed mapping UI and one enterprise pilot.
7. Add reconciliation, operational SLOs, incident runbooks, and independent security test.
8. Consider bulk/OAuth/SCIM extensions only after measured need.

## Test requirements

- RFC schema/protocol contract and malformed request tests
- Cross-tenant access and token-scope tests
- Create retry/idempotency and duplicate external ID tests
- PATCH/ETag/out-of-order conflict tests
- Group add/remove and role hierarchy/anti-escalation tests
- Suspend/reactivate/session revocation tests
- Ownership and consumer-account preservation tests
- Rate limit, token rotation/revocation, audit redaction, and reconciliation tests

## Standards references

- [RFC 7642: SCIM definitions, overview, concepts, and requirements](https://datatracker.ietf.org/doc/rfc7642/)
- [RFC 7643: SCIM core schema](https://datatracker.ietf.org/doc/html/rfc7643)
- [RFC 7644: SCIM protocol](https://datatracker.ietf.org/doc/html/rfc7644)

