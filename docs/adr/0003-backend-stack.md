# ADR 0003 - Backend Stack

Status: accepted

## Context

Picom needs auth, community/channel/message storage, RLS, uploads, realtime, and privileged server-side boundaries for token generation and future jobs.

## Decision

Use Supabase for MVP backend capabilities: Auth, Postgres, RLS, Storage, Realtime, and Edge Functions.

## Consequences

- RLS remains the primary data access control boundary.
- The Electron renderer uses anon/public configuration only.
- Privileged workflows require Edge Functions or trusted backend code.
- Supabase local/staging tests are required before API-backed beta.

## Alternatives considered

- Custom Node/Postgres backend: more control, but slower MVP delivery.
- Firebase: viable for realtime, but current schema/RLS strategy fits Supabase better.
- Local-only mock app: insufficient for Full MVP backend requirements.
