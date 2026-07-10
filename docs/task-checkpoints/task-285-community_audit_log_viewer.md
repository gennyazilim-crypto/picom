# Task 285 - Community audit log viewer

## Status

Implemented for mock and Supabase data-source modes.

## Delivered

- Owner/admin-only community management section with actor, action, target, locale-aware timestamp and redacted reason.
- Actor search by display name, username or identifier; action and date filters remain local.
- Read-only JSON copy/export through the existing bounded redaction service.
- Friendly labels for deleted/former actors, channels and roles without exposing unrelated personal data.

## Append-only boundary

The viewer has no mutation controls. Existing migration `20260710144000_audit_log_immutability_hardening.sql` revokes normal insert/update/delete/truncate and rejects row update/delete with `AUDIT_LOG_APPEND_ONLY`.

## Supabase verification

Hosted verification should confirm owner/admin SELECT and member/moderator denial. Supabase CLI is unavailable locally, so hosted RLS execution is not claimed as passed.
