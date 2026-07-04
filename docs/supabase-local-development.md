# Supabase local development notes

These notes describe how Picom developers should work locally while Supabase backend tasks are still being built.

## Recommended default

Use mock mode for normal desktop UI development:

```env
VITE_DATA_SOURCE=mock
```

This keeps the Electron app usable without running Supabase locally.

## When to use Supabase mode

Use Supabase mode only when working on backend integration tasks:

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=local-anon-key-from-supabase-status
```

The exact local URL and anon key should come from the local Supabase CLI output.

## Local Supabase workflow placeholder

When the Supabase CLI/project scaffold is added later, the expected flow is:

```powershell
supabase start
supabase status
supabase db reset
supabase db diff
supabase db push
```

Do not run destructive reset commands against staging or production.

## Renderer safety

The Electron renderer may only use the anon key.

Never expose:

- service-role key
- database password
- JWT secret
- storage provider private keys
- LiveKit API secrets

## RLS local testing

For every table exposed to the renderer:

1. Enable RLS.
2. Add policies before UI wiring.
3. Test as an allowed member.
4. Test as a non-member.
5. Test private channel denial.
6. Confirm denied queries fail cleanly and do not leak data.

## Local data strategy

- Keep mock data as the desktop UI baseline.
- Supabase seed data should mirror the mock communities enough to test the same UI flows.
- Seed users should use development-only credentials.
- Never copy production data into local development.

## Troubleshooting

- If Supabase is not running, switch back to `VITE_DATA_SOURCE=mock`.
- If URL/key are missing, `getSupabaseClient()` returns `null` instead of crashing.
- If RLS blocks expected data, verify membership/channel policies before changing frontend code.
- If realtime is unavailable, text fetch/send paths should still be tested separately.

## Manual verification

1. Run Picom in mock mode and confirm the desktop UI works.
2. Start local Supabase when available.
3. Switch to Supabase mode with local URL and anon key.
4. Confirm the client is configured without using secrets.
5. Run typecheck/build after changes.
