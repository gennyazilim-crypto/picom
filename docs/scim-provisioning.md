# SCIM provisioning placeholder

Picom may support SCIM-based user and group provisioning in a future enterprise track. This document defines the intended safe architecture and operational guardrails only. It does not expose SCIM endpoints and does not change current MVP authentication, community membership, or role behavior.

## Status

Placeholder only. Current user lifecycle remains managed through Supabase Auth, Picom profiles, community membership, and role assignments.

## Goals

- Prepare a future provisioning model for enterprise workspaces.
- Support controlled user create, update, deactivate, and group mapping later.
- Keep Supabase RLS and Picom permissions as the enforcement layer.
- Avoid storing secrets or provisioning tokens in the repository or renderer.
- Document failure, rollback, and audit expectations before implementation.

## Non-goals

- No SCIM server endpoint is implemented in this task.
- No bearer token, OAuth client secret, or IdP credential is added.
- No automatic role grants are enabled.
- No existing user data is deleted or overwritten.
- No enterprise admin console UI is exposed.

## Future SCIM resources

Future implementation may support:

- User resource placeholder
- Group resource placeholder
- ServiceProviderConfig placeholder
- ResourceTypes placeholder
- Schemas placeholder

Supported user operations should start conservatively:

- create user placeholder
- update display name/email placeholder
- deactivate user placeholder
- list users placeholder
- group membership mapping placeholder

Hard deletes should not be exposed through SCIM by default. Deactivation should revoke active sessions and remove access according to policy while preserving audit log integrity.

## Identity mapping

SCIM identities should map to Picom records through stable external identifiers:

- organizationId
- externalId
- authUserId
- profileId
- primaryEmail
- active
- lastProvisionedAt

Email alone should not be the only durable link because email changes and recycled addresses can cause account takeover risks.

## Group-to-role mapping

Group mapping must be explicit and auditable.

Rules:

- Group claims cannot grant app-level admin by default.
- Community owner transfer cannot be automated through SCIM without owner approval.
- Role grants must be bounded by organization/community policy.
- Removing a group should remove mapped access but must not delete user-generated content.
- Conflicts between manual role grants and SCIM grants need a clear precedence rule.

## Security model

Future SCIM endpoints must require:

- HTTPS only
- Per-organization provisioning token or OAuth credential stored in a secret manager
- Token rotation
- Request size limits
- Rate limits
- Strict schema validation
- Idempotent request handling where possible
- Redacted logs
- Audit entries for all provisioning changes

Never log authorization headers, provisioning tokens, raw secrets, or complete inbound payloads containing sensitive profile data.

## Desktop behavior

Desktop clients should not call SCIM endpoints. Provisioning is server-to-server only. The desktop app should only observe resulting session, profile, membership, and role changes through normal API/realtime flows.

If a provisioned user is deactivated:

- Current session should be revoked.
- Realtime connection should disconnect when supported.
- Desktop should show a safe signed-out or access-revoked message.
- Local cached non-sensitive metadata can remain until logout/cache clear.

## Audit events

Future audit events:

- scim_user_created
- scim_user_updated
- scim_user_deactivated
- scim_group_created
- scim_group_updated
- scim_group_deleted
- scim_membership_added
- scim_membership_removed
- scim_token_rotated
- scim_request_rejected

Audit metadata must exclude tokens, passwords, raw authorization headers, and unnecessary private profile data.

## Rollout plan

1. Finalize enterprise organization model.
2. Design SCIM schema and token storage with security review.
3. Add disabled database schema behind a feature flag.
4. Implement read-only ServiceProviderConfig endpoint first.
5. Add validation and audit tests.
6. Add create/update/deactivate operations in staging.
7. Test with a non-production IdP.
8. Enable per enterprise organization only after approval.

## Verification checklist

- Non-enterprise auth still works.
- Deactivated users cannot authenticate or use realtime.
- RLS blocks deactivated users from private data.
- Manual owner/admin controls cannot be bypassed by SCIM group input.
- Logs redact tokens and private payload fields.
- Duplicate provisioning requests do not create duplicate users.

## Risks and TODOs

- Account linking mistakes can expose private community data.
- Group mapping can overgrant permissions if defaults are too broad.
- Deactivation needs careful handling for owned communities and audit logs.
- Enterprise customers may require data retention/legal hold behavior before SCIM is safe.
- A full SCIM compatibility matrix should be created before implementation.
