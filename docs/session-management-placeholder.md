# Session Management Hardening

Picom uses Supabase Auth for MVP authentication. The desktop renderer can inspect safe session metadata, but it must never display, persist, or log raw access tokens, refresh tokens, authorization headers, password values, or server-only token hashes.

## Current MVP behavior

- Settings > Account shows an Active Sessions section.
- The current desktop session is represented with safe metadata only: provider, platform/runtime label, current marker, and expiry when Supabase exposes it safely.
- Mock mode shows a deterministic local current session so the desktop UI remains testable without Supabase.
- Expired or locally revoked current sessions return a recoverable “sign in again” state instead of crashing the app.
- “Revoke other sessions” is a placeholder until a trusted Supabase/server-side session revocation flow exists.

## Production requirements

- Store revocation records and token hashes only in trusted backend/database code, never in React renderer state.
- Keep auth middleware or Supabase RLS as the source of truth for revoked/expired sessions.
- Refresh `lastUsedAt` only through trusted server-side logic when available.
- Disconnect realtime sockets for revoked sessions in the future realtime layer.
- Avoid logging passwords, tokens, cookies, authorization headers, or reset/verification secrets.

## Manual verification

1. Open Settings > Account.
2. Confirm Active Sessions renders without exposing tokens.
3. Click Refresh sessions.
4. Click Revoke other sessions placeholder and confirm the app remains signed in.
5. In Supabase mode with an expired session, confirm Picom shows a clean sign-in-required message.