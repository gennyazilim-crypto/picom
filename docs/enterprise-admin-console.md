# Enterprise admin console placeholder

Picom may include an enterprise admin console in a future enterprise track. This document defines the placeholder scope, access boundaries, and implementation guardrails. No admin console runtime or UI entry point is added by this task.

## Status

Documentation-only placeholder. Existing MVP community admin/moderation surfaces remain unchanged.

## Goals

- Define a safe future enterprise admin console boundary.
- Keep app-level administration separate from community-level moderation.
- Prevent normal users from seeing enterprise controls.
- Require backend authorization and RLS enforcement for every enterprise action.
- Document security and audit requirements before implementation.

## Non-goals

- No enterprise admin console UI is added.
- No routes, panels, or navigation entries are exposed.
- No app-level admin role is granted.
- No SSO, SCIM, billing, or legal hold runtime is implemented.
- No secrets, tokens, certificates, or production credentials are added.

## Future sections

A future console may include:

- Organization overview
- Users and sessions
- SSO configuration placeholder
- SCIM provisioning placeholder
- Audit exports
- Retention and legal hold placeholder
- Security events and abuse summaries
- Desktop client compatibility
- Release channels and rollout status placeholder
- Support diagnostics
- Billing placeholder

Every section should be feature-flagged and permission-gated.

## Access model

Enterprise admin access should require explicit app-level or organization-level permission.

Possible permissions:

- manageEnterpriseOrganization
- manageEnterpriseUsers
- manageEnterpriseSecurity
- viewEnterpriseAuditLogs
- exportEnterpriseAuditLogs
- manageEnterpriseRetention
- manageEnterpriseBillingPlaceholder

Community owners and moderators should not automatically become enterprise admins.

## Security boundaries

- Renderer checks are only UX.
- Backend authorization must enforce every operation.
- RLS must prevent cross-organization/community access.
- Sensitive data must be redacted before reaching the renderer.
- Destructive actions require confirmation and audit logging.
- Enterprise console must not expose raw tokens, secrets, SAML assertions, SCIM tokens, or private keys.

## Desktop UX constraints

If implemented later:

- Use desktop modal/panel patterns, not mobile sheets.
- Keep Picom design tokens and Coolicons.
- Do not disturb the 4-column community chat layout unless explicitly opened.
- Do not add mobile navigation.
- Keep light/dark support.
- Provide clear empty/disabled states for unavailable enterprise features.

## Audit requirements

Future console actions should log:

- enterprise_admin_panel_opened placeholder
- enterprise_user_session_revoked
- enterprise_sso_settings_changed
- enterprise_scim_settings_changed
- enterprise_audit_export_requested
- enterprise_retention_policy_changed
- enterprise_legal_hold_changed
- enterprise_billing_settings_changed placeholder

Audit entries must exclude secrets, tokens, raw authorization headers, and private message content unless a future compliance policy explicitly permits it.

## Verification checklist

- Normal users never see enterprise console entry points.
- Community moderators cannot open enterprise console.
- Backend rejects unauthorized enterprise actions.
- Sensitive fields are redacted from logs and diagnostics.
- Feature flag disabled state fails closed.
- Opening enterprise console does not alter community chat layout state.

## Risks and TODOs

- Overlapping community/admin terminology can confuse permissions.
- Enterprise console can become a high-value attack target.
- Cross-tenant data exposure risk requires strong RLS and tests.
- SSO/SCIM/billing/legal hold should not be exposed until individually reviewed.
- Support workflows need careful redaction before enterprise diagnostics are shown.
