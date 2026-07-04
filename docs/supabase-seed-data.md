# Supabase seed data

Task 118 adds deterministic local seed data for Picom API-mode development.

## File

- `supabase/seed.sql`

## Development users

These accounts are for local development only:

- `owner@picom.local` / `PicomDev123!`
- `admin@picom.local` / `PicomDev123!`
- `member@picom.local` / `PicomDev123!`

Do not use these credentials in staging or production.

## Seeded data

- 3 Supabase Auth development users.
- 3 public profiles.
- 2 communities.
- Owner, Admin, and Member roles.
- Community memberships.
- Channel categories.
- Text and voice placeholder channels.
- Messages for chat rendering.
- One image attachment metadata row.
- Message reactions.
- Read state markers.

## Security notes

The seed file is development-only. It does not add production secrets. The password is intentionally public and local-only. RLS policies are still required before using client-side Supabase API mode against a shared backend.

## How to run

With Supabase CLI configured for local development:

```powershell
supabase db reset
```

Supabase automatically applies migrations and then runs `supabase/seed.sql`.

## Login troubleshooting

If `owner@picom.local` returns invalid credentials in local Supabase mode, rerun the seed/reset workflow. The seed now refreshes the development password hash on conflict, so `PicomDev123!` is restored for local users.

```powershell
supabase db reset
```

If you are not using Supabase locally, keep `VITE_DATA_SOURCE=mock` so the desktop MVP can sign in without backend services.

## Manual verification

1. Start local Supabase.
2. Run `supabase db reset`.
3. Log in with `owner@picom.local` and the local password.
4. Confirm `Picom Studio` and `Autumn Lab` exist in `public.communities`.
5. Confirm the `general` channel has seeded messages, reaction rows, and read states.