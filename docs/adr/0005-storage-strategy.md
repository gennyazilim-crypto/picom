# ADR 0005 - Storage Strategy

Status: accepted

## Context

Picom MVP needs image attachments with validation, metadata, preview UI, and future private-channel access controls.

## Decision

Use Supabase Storage for MVP attachment storage, with attachment metadata in Postgres and validation routed through service abstractions.

## Consequences

- Storage object paths must include community/channel/message context where appropriate.
- Supabase Storage policies and metadata RLS must align.
- The renderer must never receive privileged storage credentials.
- Signed URLs/CDN/malware scanning remain production hardening work.

## Alternatives considered

- S3-compatible storage first: useful later, but adds provider complexity before MVP.
- Local-only storage: insufficient for multi-client Supabase mode.
