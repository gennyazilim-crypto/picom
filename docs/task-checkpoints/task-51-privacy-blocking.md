# Task 51 - Privacy Controls and User Blocking

Date: 2026-07-10
Status: Complete

## Result
- Added owner-only `blocked_users` RLS and two-way block checks.
- A block prevents creating, reading, or sending in a DM conversation through backend and UI boundaries.
- Profile and popover actions expose Block/Unblock; Settings contains DM/friend-request, online status, and blocked-user controls.
- Community messages from blocked users continue to render as collapsed placeholders.
- Local fallback remains available and connected mode mirrors block changes to Supabase.

## Validation
- `npm run typecheck`
- `npm run supabase:smoke`
- `npm run mock:smoke`
- `npm run build`

## Remaining live check
Run blocker/blocked/outsider DM and RLS account-matrix tests against staging before release claims.
