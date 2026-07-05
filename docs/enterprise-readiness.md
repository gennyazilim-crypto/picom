# Enterprise Readiness Report

Picom is currently an MVP-focused Electron desktop community chat app for Windows, Linux, and macOS. It is not enterprise-ready yet. This report documents current readiness, gaps, assumptions, and a safe path toward enterprise suitability.

## Current readiness level

Status: early MVP foundation with production discipline documents.

Picom has strong desktop UI direction, Electron hardening foundations, Supabase/RLS architecture, LiveKit media foundations, logging redaction, and release/operations documentation. Enterprise deployment, identity, governance, compliance, and support controls are not complete.

## Existing strengths

- Desktop-only Electron app with custom chrome and safe preload principles.
- Supabase Auth/Postgres/RLS/Storage/Realtime direction.
- LiveKit/WebRTC direction for voice and screen sharing.
- Basic logs and diagnostics redaction.
- Multi-tenant isolation review and RLS boundary docs.
- Data export/deletion placeholders with safety notes.
- Dependency, license, API compatibility, and release discipline docs.
- No Discord branding/assets/exact colors in runtime guardrails.

## Missing enterprise features

- SSO.
- SCIM user provisioning.
- Enterprise admin console.
- Organization-level policy management.
- Centralized audit log viewer.
- Admin-controlled retention policies.
- Legal hold/eDiscovery.
- Data residency controls.
- Enterprise key management.
- Formal compliance evidence collection.
- Contractual SLA/support process.
- Role-based app admin separation from community admins.
- Device management/MDM deployment guidance.
- Production auto-update governance.

## SSO placeholder

Enterprise SSO is out of MVP scope. Future support should consider:

- SAML/OIDC provider configuration.
- Domain verification.
- Enforced SSO by organization.
- Break-glass admin accounts.
- Session revocation and audit events.

## SCIM placeholder

SCIM is out of MVP scope. Future support should consider:

- User provisioning and deprovisioning.
- Group-to-role mapping.
- Community membership provisioning.
- Audit logs for identity sync actions.
- Safe handling of deleted/deactivated users.

## Audit log status

- Current audit log strategy is documented but not fully production-implemented.
- Moderation/report actions should create append-only audit entries later.
- Audit logs must not store passwords, tokens, raw auth headers, or unnecessary message content.
- Enterprise readiness requires immutable audit log policy and export controls.

## Data retention status

- Message retention and deletion policies are documented as foundations.
- Production retention jobs must be server-side and disabled by default until reviewed.
- Audit log retention must remain separate from message retention.
- Account deletion and data export remain placeholder-safe and require backend implementation.

## Admin controls

Current state:

- Admin Operations and Trust/Safety concepts exist as restricted placeholders.
- Community owner/admin flows exist separately from app-level enterprise administration.

Needed:

- App-level admin authorization.
- Admin role management.
- Tenant/org admin boundaries.
- Admin action audit logs.
- Read-only support roles.

## Security controls

Current foundations:

- Electron renderer/native boundary docs and smoke tests.
- Logging/diagnostics redaction.
- Supabase RLS docs and tests.
- Storage and attachment safety docs.
- Dependency management plan.

Needed:

- Formal threat model.
- Penetration/security review.
- Secret scanning CI.
- Dependency vulnerability policy enforcement.
- Production incident response drills.
- Enterprise security questionnaires/evidence.

## Deployment options

Current:

- Desktop package foundations for Windows, Linux, and macOS.
- Supabase/LiveKit environment docs.

Needed:

- Enterprise deployment guide.
- MDM install/update notes.
- Offline installer policy.
- Signed Windows/macOS builds.
- Linux package repository/signing plan.

## Backup and restore

Current:

- Database backup/restore and restore drill docs exist or are planned in operations docs.

Needed:

- Verified recurring backup jobs.
- Restore drill evidence.
- RPO/RTO targets.
- Object storage backup strategy.
- Tenant-specific restore policy.

## Monitoring and support

Current:

- Observability/logging/reporting placeholders exist.
- SLO and incident docs are part of the launch discipline set.

Needed:

- Production metrics pipeline.
- Crash reporting provider.
- Support ticket workflow.
- Enterprise escalation path.
- Customer-facing status page.

## Compliance gaps

- No final legal/privacy terms.
- No final retention policy.
- No compliance framework mapping.
- No DPA/SCC/vendor review package.
- No enterprise access review process.
- No formal audit evidence export.

## Roadmap to enterprise readiness

1. Stabilize MVP desktop chat, Supabase mode, realtime, uploads, and LiveKit.
2. Complete production security checklist and RLS live tests.
3. Add immutable audit logs and app-admin authorization.
4. Add organization/tenant model if enterprise customers require it.
5. Add SSO/OIDC before SCIM.
6. Add SCIM provisioning and deprovisioning.
7. Add retention/legal hold/data export controls.
8. Add enterprise deployment/signing/update governance.
9. Complete monitoring, incident response, support, and compliance evidence.

## Final assessment

Picom is not enterprise-ready today. It is on a reasonable path because the MVP is desktop-focused, backend boundaries are documented, and security-sensitive placeholder behavior is explicitly marked. Enterprise features should not be built until the MVP chat, auth, realtime, upload, packaging, and security gates are stable.
