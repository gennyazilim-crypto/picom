# Picom Cloud Strategy

## Decision

Picom Full MVP uses:

- Electron for Windows, Linux, and macOS desktop clients.
- Supabase Cloud for Auth, Postgres, RLS, Storage, Realtime, and Edge Functions.
- LiveKit Cloud or an approved LiveKit deployment for voice and screen sharing.
- GitHub/CI release infrastructure for source, quality gates, and desktop artifacts.

Google Cloud, Azure, and Firebase are not required for the initial beta/stable MVP. No dependency or data copy is added merely to keep future options open.

## Current architecture

| Capability | MVP owner |
| --- | --- |
| Identity/session | Supabase Auth |
| Relational application data and authorization | Supabase Postgres + RLS |
| Message attachments | Private Supabase Storage bucket |
| Message changes | Supabase Realtime |
| Protected backend actions | Supabase Edge Functions |
| Voice and screen share | LiveKit |
| Desktop runtime | Electron renderer/main/preload |
| Packaging | electron-builder and platform-native signing/notarization later |

This keeps application identity, authorization, row visibility, storage metadata, and realtime events within one primary backend boundary.

## Why not add Firebase now

- Picom already uses Supabase Auth/Postgres/RLS/Storage/Realtime.
- Firebase would duplicate identity, data, realtime, storage, SDK, rules, monitoring, and billing surfaces.
- Synchronizing user/session/permission state between Firebase and Supabase would create ambiguous authorization ownership.
- Firestore data modeling would not replace or improve the current relational/RLS model without a costly migration.
- A second client SDK increases Electron bundle size and security review surface.

Firebase is not part of the Full MVP stack.

## Why not add Google Cloud or Azure now

- Full MVP does not yet have a measured worker, storage, analytics, compliance, or enterprise deployment need that Supabase/LiveKit cannot meet.
- Multi-cloud identity, networking, IAM, secret management, logs, egress, incident response, and backups would increase operational load before product reliability is proven.
- Cross-cloud egress and region mismatch can increase latency and cost for chat media/realtime workloads.
- Every provider adds separate access control, billing alerts, outage modes, data processing terms, and on-call knowledge.

The decision is to delay, not permanently reject, these platforms.

## Optional future uses

### Google Cloud

- Cloud Run for long-running/background workers that do not fit Edge Function limits.
- Cloud Storage/CDN for attachment delivery after private access/signing design is proven.
- Cloud Logging/Monitoring where a concrete operations need exists.
- Managed compute for self-hosted Supabase/LiveKit components only with dedicated ownership.

### Azure

- Azure Container Apps/Functions for workers where enterprise customer requirements favor Azure.
- Blob Storage/CDN for region/customer-specific attachment architecture.
- Azure Monitor and enterprise networking/identity integration.
- Customer-managed or isolated enterprise deployments after enterprise scope is approved.

### Provider-neutral

- External observability/error monitoring.
- Queue/worker platform for retention, thumbnails, notifications, or abuse processing.
- Regional object storage/CDN.
- Self-hosted Supabase or LiveKit where compliance/cost/residency evidence justifies it.

These are post-MVP options and require separate ADRs.

## Reconsideration triggers

Reopen this decision only when at least one trigger is measured and owned:

- Edge Function execution/time/concurrency limits block a required production workload.
- Supabase Storage/CDN latency, cost, region, or private delivery cannot meet an approved SLO.
- An enterprise contract requires Azure/GCP tenancy, private networking, or customer-managed keys.
- Data residency requires a region/topology unavailable in the selected Supabase/LiveKit plans.
- Observability cannot provide required incident evidence through current providers.
- Self-hosting yields a validated compliance or cost benefit with staffed operations.
- Backup/restore or disaster-recovery objectives require additional infrastructure.

## Evaluation gate

Any proposal must include:

1. Specific unmet requirement and measured evidence.
2. Build-versus-buy and provider comparison.
3. Data classification, residency, retention, and transfer map.
4. IAM/secret/network/backup/monitoring/incident ownership.
5. Recurring cost, egress, support, and staffing estimate.
6. Failure/degraded behavior and rollback/migration plan.
7. Desktop API compatibility and bundle impact.
8. Security/privacy review and a new ADR.

Do not introduce a provider through a UI placeholder or client SDK before this gate.

## Risks of early multi-cloud

- Duplicate sources of truth and inconsistent permissions.
- Secret sprawl and larger IAM attack surface.
- Higher operational/on-call complexity.
- Cross-cloud latency/egress costs.
- Fragmented logs, backups, restore, and incident evidence.
- More vendor SDKs in the Electron bundle.
- Harder privacy/data-residency disclosures.
- Reduced delivery focus during beta stabilization.

## Cost and operations policy

- Use provider budgets/alerts and a named billing owner before production traffic.
- Prefer one region/topology that meets initial users rather than speculative global duplication.
- Review database, Storage, Realtime, Function, LiveKit participant/minute, egress, and support costs monthly during beta/stable ramp.
- Do not trade security controls for free-tier limits.
- Scale only from observed utilization/SLOs.

## Data residency and enterprise considerations

Current production planning assumes one approved primary Supabase region and a compatible LiveKit media region. Backups, object storage, logs, and provider support access must be included in the residency record.

Future enterprise deployment, SSO/SCIM, dedicated tenancy, customer-managed keys, legal hold, and region pinning are outside Full MVP. If approved later, they may justify Azure/GCP or self-hosted components, but must not fork authorization behavior without a shared compatibility model.

## Decision review

Review after stable launch data exists or when a reconsideration trigger is accepted. Until then the supported architecture remains Supabase + LiveKit + Electron.
