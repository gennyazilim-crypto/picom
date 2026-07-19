# Data Residency Strategy (T93)

## Posture
- **Primary processing region: EU (AWS eu-central-1, Frankfurt)** — the production Supabase
  project (`piso`) database, auth, storage, and Edge Functions run there (verified 2026-07-15).
- Personal data of Picom users is stored and processed in the EU by default.

## Rules
1. New infrastructure (LiveKit project, email/SMTP, analytics sink, model serving) MUST be
   provisioned in an EU region unless a documented exception with SCCs exists.
2. Cross-border transfers are limited to sign-in identifiers sent to Steam/Epic OAuth (US) —
   strictly the identifiers needed for authentication; no content or behavioral analytics.
   Recorded in [subprocessors.md](subprocessors.md).
3. Backups and any restore targets stay in-region (do not restore into non-EU scratch projects
   with production data).
4. No region change without updating this doc, the DPIA (Task 49), and the sub-processor register.

## Operator open items
- Confirm/pin LiveKit project region to EU when provisioning voice (currently beta-gated).
- Confirm email/SMTP provider region when SMTP is set up.
