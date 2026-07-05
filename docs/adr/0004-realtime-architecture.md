# ADR 0004 - Realtime Architecture

Status: accepted

## Context

Chat must support live messages, edits, deletes, typing, presence, unread foundations, and two-window testing.

## Decision

Use Supabase Realtime for MVP message, typing, and presence foundations. Keep realtime logic inside hooks/services rather than UI components.

## Consequences

- Realtime visibility depends on Supabase Auth/RLS policies.
- Client logic must deduplicate optimistic messages and realtime echoes.
- Two-window testing is required for release confidence.
- Horizontal scaling beyond Supabase Realtime remains post-MVP.

## Alternatives considered

- Socket.IO/WebSocket server: more custom control, but adds infrastructure before MVP.
- Polling only: simpler but not sufficient for desktop chat expectations.
