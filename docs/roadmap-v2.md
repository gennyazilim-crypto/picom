# Picom Roadmap v2

Status: Planning baseline  
Product: Picom Electron desktop community chat  
Platforms: Windows, Linux, macOS  
Mobile: Out of scope unless separately approved

## Planning principles

- Reliability, privacy, and backend enforcement precede feature expansion.
- The post-MVP production audit is the current release gate; documentation or structural smoke alone is not production evidence.
- New capabilities ship behind typed feature flags and backend authorization where applicable.
- Mock mode remains a development aid. Supabase/RLS, storage, realtime, and privileged Edge Functions are authoritative in production.
- Picom keeps its original desktop visual identity, design tokens, Coolicons/AppIcon, and light/dark themes.
- No phase may introduce mobile UI, Discord branding/assets/exact colors, arbitrary plugin execution, or secrets in the renderer.

## Phase 1: Stable hardening

Objective: promote the current beta foundation to a supportable stable desktop release.

Included:

- Resolve every blocker in `docs/audits/post-mvp-production-audit.md`.
- Pass diagnostics redaction and privacy-safe support export gates.
- Run clean Supabase migration, pgTAP/RLS, backup, restore, and tenant-isolation tests in staging.
- Operate production attachment scanning/quarantine and signed delivery.
- Certify LiveKit voice/screen share and realtime reconnect/load behavior with multiple clients.
- Produce signed/notarized Windows, Linux, and macOS artifacts with checksum/provenance evidence.
- Complete accessibility, performance, install/upgrade/uninstall, rollback, incident, and support drills.

Excluded:

- Public bot/plugin marketplace.
- Enterprise contracts or billing.
- Mobile clients.

Dependencies:

- Staging Supabase, LiveKit, storage/scanner, Redis/realtime resources.
- Signing identities and protected CI secrets.
- Named release, security, operations, support, and legal owners.

Exit criteria:

- Production audit decision is Ready or Ready with explicitly accepted non-blockers.
- Go/no-go sign-offs and release-candidate dry run pass.
- Error, crash, message, upload, and realtime SLO telemetry is available without sensitive content.

## Phase 2: Trust and safety maturity

Objective: make growing public communities safer without exposing private content unnecessarily.

Included:

- Production report/moderation queue and appeal lifecycle.
- Abuse-event aggregation, rate-limit visibility, and suspicious-upload operations.
- Moderator authorization, immutable audit records, redacted evidence, and retention controls.
- Community listing review and anti-spam controls before wider discovery exposure.
- User blocking, privacy controls, notification safety, and transparent enforcement notices.

Excluded:

- Automated punitive decisions without human review and appeal.
- Bulk private-message surveillance.
- Public discovery marketplace until review operations and safety SLOs are staffed.

Dependencies:

- Stable hardening complete.
- Trained moderation/support ownership and escalation policy.
- RLS-backed evidence access and legal/privacy review.

Exit criteria:

- Critical moderation actions are authorized server-side, audited, appealable, and tested across tenant boundaries.
- Safety queues have staffed response targets and privacy-safe metrics.

## Phase 3: Bot, webhook, and developer ecosystem

Objective: expose a narrow, auditable integration platform without executing arbitrary desktop code.

Included:

- Versioned Bot API with scoped tokens, rotation, revocation, rate limits, and audit events.
- Production webhooks with signed delivery, replay protection, retry/dead-letter handling, quotas, and abuse controls.
- Slash-command registration and permission-aware execution.
- Developer Portal for owned applications, webhook status, safe one-time credentials, and documentation.
- Review/signing policy for future extension packages; architecture-only desktop plugin sandbox research.

Excluded:

- Arbitrary plugin runtime or dynamic code loading in the renderer/main process.
- Shell, unrestricted file-system, Node, or raw Electron access for plugins.
- Public marketplace before review, moderation, billing, support, and revocation operations exist.

Dependencies:

- Trust and safety maturity.
- Public API versioning, abuse protection, immutable audit, secret rotation, and incident response.
- Dedicated integration service ownership.

Exit criteria:

- Integration credentials are scoped, non-recoverable after one-time display, rotatable, and backend-enforced.
- Load, replay, abuse, revocation, and compatibility tests pass in staging.

## Phase 4: Platform ecosystem

Objective: grow useful community workflows after the integration foundation is stable.

Included:

- Curated applications and bot/webhook templates.
- Permission-aware community templates and export/import review flow.
- Discovery expansion only for approved, moderated public listings.
- Stable event, forum, announcement, poll, thread, emoji, sticker, and saved-message capabilities selected by usage and reliability evidence.
- Public developer documentation, SDK generation, and compatibility guarantees.

Excluded:

- Unreviewed executable extensions.
- Cross-community data aggregation without consent and access checks.
- Growth features that bypass safety, rate limits, or release gates.

Dependencies:

- Developer ecosystem exit criteria.
- Moderation review capacity and platform SLOs.
- Feature-level ownership and deprecation policy.

Exit criteria:

- Ecosystem features are independently kill-switchable, observable, documented, and compatible with supported desktop clients.
- Public surfaces have approval, reporting, ranking-abuse, privacy, and takedown operations.

## Phase 5: Enterprise readiness

Objective: support governed organizations without weakening the community product.

Included:

- Organization/workspace tenancy and delegated administration.
- SSO/SAML and SCIM with domain verification, break-glass access, and deprovisioning controls.
- Enterprise audit export, retention, legal hold, data residency, backup/restore, and deployment guidance.
- Compliance evidence, security review, support tiers, and contractual SLO operations.

Excluded:

- Enterprise promises before controls are implemented and independently verified.
- Frontend-only administrative enforcement.
- Silent collection of employee/user content for analytics.

Dependencies:

- Stable platform APIs and multi-tenant isolation.
- Legal, privacy, security, operations, and enterprise support owners.
- Regional infrastructure and audited data lifecycle.

Exit criteria:

- Enterprise controls are backend-enforced, tested, documented, supportable, and backed by approved contracts/evidence.

## Phase 6: Monetization later

Objective: fund sustainable operations only after reliability and value are proven.

Candidate scope:

- Transparent organization/community plans tied to measurable storage, retention, support, or integration value.
- Billing portal and entitlement service separated from permission/security enforcement.
- Quotas, invoices, refunds, tax/privacy obligations, and account recovery.
- Optional paid platform capabilities with fair free-tier limits.

Explicitly deferred:

- Ads based on private conversations or sensitive behavioral profiling.
- Paywalls that prevent account export/deletion, security updates, moderation appeals, or access to owned data.
- Marketplace revenue sharing before fraud, review, payout, tax, and dispute operations exist.

Dependencies:

- Stable adoption/retention evidence and cost model.
- Legal, finance, support, fraud, and privacy readiness.
- Enterprise/platform entitlement architecture.

Exit criteria:

- Billing failures cannot break authentication, message access, security controls, export, or deletion.
- Pricing, entitlement, refund, tax, and support policies are approved and tested.

## Mobile consideration

Mobile remains out of scope. A future proposal requires explicit product approval and a new ADR covering native technology, security model, notification/background limits, media permissions, accessibility, release operations, staffing, and API compatibility. Desktop UI must not be converted into a mobile/web-first responsive layout in anticipation.

## Sequencing and gates

1. Stable hardening is mandatory and cannot be bypassed by ecosystem work.
2. Trust and safety must be operational before wider public discovery or marketplace exposure.
3. Bot/webhook APIs precede marketplace/platform expansion.
4. Enterprise work starts only after multi-tenant and API boundaries are stable.
5. Monetization follows demonstrated value and operational maturity.

Each phase requires an owner, dependency review, threat/privacy review, measurable success criteria, staged rollout, rollback/kill switch, documentation, support handoff, and post-release SLO review.
