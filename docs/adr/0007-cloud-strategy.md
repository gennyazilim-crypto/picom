# ADR 0007 - Cloud Strategy

Status: accepted

## Context

Picom already uses Supabase Cloud for Auth, Postgres/RLS, Storage, Realtime, and Edge Functions, plus LiveKit for voice/screen share. Adding Firebase, Google Cloud, or Azure during Full MVP would duplicate core capabilities and operational boundaries without a measured requirement.

## Decision

Use Supabase Cloud + LiveKit as the Full MVP backend/media stack and Electron as the desktop runtime. Do not add Firebase, Google Cloud, or Azure dependencies for initial beta/stable release. Reconsider an additional provider only for a documented worker, storage/CDN, observability, enterprise, compliance, data-residency, or self-hosting requirement and record it in a new ADR.

## Consequences

- One primary backend owns identity, relational data, RLS, Storage metadata, and message Realtime.
- Desktop bundle and client configuration remain smaller and easier to audit.
- Operations can focus on Supabase/LiveKit reliability, backups, monitoring, and incident response.
- Provider-specific limits remain a risk and must be measured after launch.
- Future multi-cloud adoption requires explicit data transfer, IAM, secret, cost, SLO, and rollback design.

## Alternatives considered

- Firebase alongside Supabase: rejected for duplicate identity/data/realtime/storage and ambiguous authorization ownership.
- Google Cloud immediately: deferred because no approved workload currently requires Cloud Run, Cloud Storage/CDN, or GCP operations.
- Azure immediately: deferred because enterprise Azure tenancy/networking requirements are outside Full MVP.
- Self-host all services: deferred because it requires substantially more realtime/database/storage operations than the MVP team has approved.
