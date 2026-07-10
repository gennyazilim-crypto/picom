# SCIM provisioning implementation plan

## Decision

**Implementation deferred.** Picom's organization tenant model, SSO, enterprise entitlement, and deprovisioning control plane are not approved or active. Exposing a partial SCIM endpoint would create account-collision, cross-tenant, stale-session, and privilege-escalation risks.

This plan does not add an endpoint, token, feature flag runtime, database table, enterprise UI, or Electron integration. The protocol design remains in [`scim-provisioning-design.md`](scim-provisioning-design.md).

## Enterprise-only availability

Future availability requires all three gates:

1. server-side enterprise entitlement for the target organization;
2. organization SecurityAdmin/Owner authorization with step-up authentication;
3. typed kill switch/feature flag such as `enableEnterpriseScim`.

The flag controls rollout and visibility only. It is never authorization. A normal user, community admin, unentitled organization, suspended tenant, or wrong-tenant token must be rejected by the trusted backend even if the flag is enabled locally or remotely. No renderer fallback may emulate SCIM.

## Service boundary

- Versioned HTTPS SCIM service under a trusted backend, never Electron or direct public table access.
- Tenant is derived from authenticated credential binding, not a request body/path value alone.
- Store only credential hash/prefix/scopes/lifecycle; display raw credential once in a step-up protected flow.
- Use bounded body size, pagination, allowlisted filters/attributes, idempotency, ETags, rate limits, request IDs, transactions, and RFC-compatible errors.
- Never accept/provision passwords or return auth/session/private-content fields.

## User lifecycle

### Create

- Resolve by tenant-scoped external ID, never email alone.
- Create organization membership as least-privileged and active/pending according to approved policy.
- Write resource, membership, idempotency record, and audit event atomically.
- Do not grant organization/community privileged roles from directory attributes.

### Update

- Allow only approved mutable attributes.
- Reject tenant, stable ID, credential, and authorization-field mutation.
- Require version/ETag safeguards and make repeated equivalent PATCH idempotent.

### Suspend/deprovision

- Atomically suspend the organization membership and remove derived group permissions.
- Revoke relevant sessions and enqueue realtime/LiveKit disconnect after commit.
- Block new tenant tokens immediately and expose delayed revocation only to restricted operations.
- Preserve consumer identity, unrelated tenants/communities, ownership safeguards, audit, and retention obligations.
- Treat DELETE as tenant deprovision/tombstone, never global hard deletion.

### Reactivate

- Require active tenant/provider, no security hold, and current mappings.
- Restore least privilege; do not resurrect obsolete elevated grants.
- Require fresh authentication and audit the change.

## Groups and role mapping

- Store directory group identity separately from Picom roles.
- Authorize mappings by stable external group ID, not display name.
- Mapping starts with no privilege and requires explicit reviewed configuration.
- Prohibit automatic AppAdmin, OrganizationOwner, SecurityAdmin, BillingAdmin, community Owner/Admin, and break-glass grants.
- Enforce role hierarchy and separation of duties server-side.
- Removing membership removes only mapping-derived grants; manual grants follow explicit precedence policy.
- Community membership/roles require a separate reviewed mapping and still obey community/private-channel RLS.

## Audit events

Append-only events cover credential create/rotate/revoke, user/group lifecycle, group membership delta, mapping change, cross-tenant rejection, rate limit, reconciliation drift, and revocation failure. Store stable tenant/client/target IDs, operation, outcome, request ID, changed attribute names, timestamp, and redacted reason only.

Never store raw credential/hash, Authorization header, password, assertion, full request body, message content, private profile attributes, or raw IP.

## Reconciliation and recovery

- Periodically compare active directory resources with organization memberships and derived grants.
- Report drift counts, queue age, and failed revocations without exposing private user data.
- Require dry-run and approval for mass suspension/removal.
- Maintain idempotent retry and dead-letter handling for post-commit session/realtime revocation.
- Define ownership transfer/archive before deprovisioning the last owner.
- Test rollback without recreating stale privileged sessions.

## Delivery phases

1. Approve and ship tenant model, entitlement, RLS, audit, and session revocation independently.
2. Add dormant SCIM schema/credential tables and cross-tenant tests in disposable staging.
3. Implement read-only discovery/schema endpoints.
4. Implement Users create/read/update with least privilege and idempotency.
5. Implement suspend/reactivate plus measured revocation completion.
6. Implement Groups without privileged mapping, then reviewed mapping controls.
7. Add reconciliation, operations dashboards, SLOs, incident response, security testing, and one-tenant pilot.
8. Consider bulk/OAuth extensions only after measured need.

## Release blockers

- Tenant model, enterprise entitlement, RLS, or audit is not production-proven.
- Credential can be retrieved after creation or reaches renderer/logs.
- Email/group display text can merge identities or grant privilege.
- Deprovisioning leaves session/realtime/voice access active beyond approved objective.
- Operations are not idempotent/transactional/audited.
- Cross-tenant enumeration or error-shape leaks exist.
- Consumer identity/data can be deleted by tenant SCIM lifecycle.

Until these blockers are cleared, `enableEnterpriseScim` must remain absent or false and no SCIM capability should be advertised.
