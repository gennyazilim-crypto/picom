# Task 284 - Member management MVP polish

## Status

Implemented in mock mode and prepared for Supabase mode.

## Delivered

- Reason-required desktop confirmation for timeout, removal and ban actions.
- Owner and self protection, plus strict actor-role-greater-than-target-role checks in UI and database RPC.
- Kick/ban membership removal, ban persistence and bounded timeout persistence.
- Moderation action ledger entry and redacted community audit event.

## Supabase verification

Apply `20260710220000_member_management_mvp_polish.sql` in staging and test owner/admin/moderator/member role combinations. Supabase CLI is unavailable locally, so hosted policy/RPC execution remains an explicit staging check.
