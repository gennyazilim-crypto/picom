# Publisher / Creator — Deployment

**Date:** 2026-08-03  
**Canonical DB:** Supabase (not Neon)

## Migrations

Apply in order to staging first:

1. `supabase/migrations/20260803140000_publisher_creator_program_core.sql`
2. `supabase/migrations/20260803141000_publisher_livekit_broadcast_gate.sql`

Example (staging project ref — confirm before run):

```powershell
powershell -File scripts/with-supabase-cli-token.ps1 npx supabase db push --linked
```

Or project-scoped apply used by the team’s existing staging workflow. Do **not** point `DATABASE_URL` at Neon.

## Post-apply smoke

1. Run checklist in `scripts/publisher-eligibility-sql-smoke.sql`  
2. Call `get_publisher_application_eligibility` as a signed-in user  
3. Confirm `can_start_picom_live_stream` returns `allowed: false` for regular accounts  
4. Confirm Root Dashboard module **Publisher & Creator Review** loads for reviewers  
5. Confirm routes: `/publisher/apply`, `/publisher/dashboard`

## App rollout

- Desktop/Web clients that include publisher views + Live Now gates  
- No payment env vars required for Phase 1  
- Feature does not auto-approve anyone

## Rollback

- Prefer feature-flag / client hide if needed; SQL rollback of SECURITY DEFINER functions is high risk  
- If emergency: restore prior `can_view_live_screen_session` / LiveKit authorize function definitions from previous migration revisions, then disable Root module in client

## Production promotion gate

Staging PASS on eligibility boundaries + Live Now exclusion + Root approve path required before production migrate.
