# Supabase API Mode Regression Test

Task 163 adds a lightweight regression guard for Supabase API mode wiring.

## Command

```bash
npm run supabase:api-regression
```

## What it checks

The script checks that the Supabase API-mode wiring still exists for:

- data source mode
- Supabase Auth sign-in
- communities
- channels
- messages list and send mutation
- members
- reactions
- ServerRail data loading
- CommunitySidebar category/channel data loading
- MessageList data loading
- MemberSidebar data loading
- key RLS migration files

## Environment variables

Live Supabase mode still requires:

- `VITE_DATA_SOURCE=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The regression script does not require real credentials and does not contact production services.

## RLS and SQL

The regression script verifies that core RLS migration files exist. It does not replace a live Supabase RLS test. Live testing should use seeded users against a local or staging Supabase project.

## Manual verification

1. Configure local Supabase env values in `.env.local`.
2. Run migrations and seed data.
3. Start the app in Supabase mode.
4. Sign in.
5. Confirm ServerRail, CommunitySidebar, MessageList, and MemberSidebar load through Supabase-visible data.