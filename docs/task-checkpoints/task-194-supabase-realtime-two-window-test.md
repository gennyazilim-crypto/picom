# Task 194 - Supabase realtime two-window test

## Scope

- Created a dedicated two-window manual test runbook for Supabase Realtime message verification.
- Documented required SQL, environment variables, expected behavior, and RLS/security implications.
- Kept runtime code unchanged for this documentation/test-definition task.

## Verification path

- Run the schema smoke check before attempting the manual two-window test.
- Start Picom in Supabase mode.
- Open two desktop windows and follow `docs/supabase-realtime-two-window-test.md`.

## Notes

- No service-role key is required or allowed in the renderer.
- Existing RLS policies remain the security boundary for realtime message visibility.
