# Decision Log

This log records major Picom architecture and product decisions. It is intentionally lightweight and should be updated when a task makes a durable project choice.

## Decision format

Each entry should include:

- Date
- Status
- Decision
- Reason
- Consequences

## Decisions

### 2026-07-04: Electron desktop runtime

- Status: Accepted
- Decision: Picom targets Electron desktop for Windows, Linux, and macOS.
- Reason: The product requires a polished desktop shell and future native integrations.
- Consequences: React components must not call native APIs directly. Preload and typed service wrappers are required.

### 2026-07-04: React + TypeScript renderer

- Status: Accepted
- Decision: Keep React + TypeScript for the desktop renderer.
- Reason: The current MVP UI baseline already uses Vite, React, and TypeScript.
- Consequences: Future UI work should preserve strong typing and desktop layout constraints.

### 2026-07-04: Supabase-first backend

- Status: Accepted
- Decision: Use Supabase Auth, Postgres, RLS, Storage, Realtime, and Edge Functions for MVP backend capabilities.
- Reason: Supabase provides a fast path to auth, database, storage, realtime, and server-side functions.
- Consequences: RLS must be designed carefully. Client code must not bypass RLS or include service-role secrets.

### 2026-07-04: LiveKit/WebRTC voice direction

- Status: Accepted
- Decision: Use LiveKit/WebRTC for MVP voice rooms and screen sharing.
- Reason: LiveKit provides a production-oriented voice/video room model without custom WebRTC signaling.
- Consequences: LiveKit tokens must be generated server-side or through Supabase Edge Functions.

### 2026-07-04: Coolicons Free icon system

- Status: Accepted
- Decision: Use Coolicons Free as the single approved MVP icon system.
- Reason: A single icon system keeps the UI visually consistent and avoids mixed icon styles.
- Consequences: Keep CC BY 4.0 attribution and avoid Coolicons PRO unless licensed.

### 2026-07-04: Original Picom branding

- Status: Accepted
- Decision: Do not use Discord branding, logos, copied assets, icons, or exact colors.
- Reason: Picom must be original and legally safe.
- Consequences: The reference image informs quality and structure only, not brand assets.

### 2026-07-04: Centralized logging and error UX direction

- Status: Proposed
- Decision: Use a centralized logging/error service when implementation reaches diagnostics/error handling tasks.
- Reason: Logs and errors must be consistent, safe, and support developer diagnostics without exposing secrets to users.
- Consequences: Future logging code must redact passwords, tokens, cookies, authorization headers, and private secrets. User-facing errors should be friendly, while technical details should remain in diagnostics/log exports.

## Open decisions

These are intentionally deferred until their implementation tasks:

- exact Electron builder/package tooling
- Supabase schema and RLS policy details
- LiveKit token Edge Function shape
- loggingService implementation details
- desktop packaging outputs per platform
- automated test framework depth