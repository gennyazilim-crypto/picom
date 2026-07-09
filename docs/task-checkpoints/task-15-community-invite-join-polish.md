# Task 15 - Community Invite / Join Polish

## Status

Implemented the Full MVP invite, join, leave, and visitor read-only flow.

## Delivered

- Limited invite creation and safe clipboard copy.
- Join-with-invite modal and deep-link handoff.
- Mock persistence plus Supabase `community_invites` schema and atomic acceptance RPC.
- Invite entry points for permitted owner/admin/moderator surfaces.
- Existing public visitor read-only, private-channel filtering, and disabled composer behavior preserved.
- Owner leave remains blocked until ownership transfer.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- Supabase staging RLS/RPC verification remains required after applying migration 028.
