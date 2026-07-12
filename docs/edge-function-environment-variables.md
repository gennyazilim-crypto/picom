# Edge Function environment variables

Task 203 documents environment variables for Picom Supabase Edge Functions.

## Rule of thumb

Renderer variables use `VITE_` and are visible to the Electron renderer bundle. Edge Function variables do not use `VITE_` and must be stored in Supabase function secret storage when they contain secrets.

## Supabase-provided / function runtime values

These are used by protected Edge Functions:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

Purpose:

- Validate the caller through `supabase.auth.getUser()`.
- Create a Supabase client scoped to the caller's JWT.
- Preserve RLS behavior for function-side data checks.

## Function variable matrix

| Function | JWT required | Required environment variables | Notes |
| --- | --- | --- | --- |
| `health` | No | none | Public non-sensitive health response only. |
| `livekit-token` | Yes | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `PICOM_ALLOWED_ORIGINS`, `PICOM_V1_VOICE_SCREEN_ENABLED` | LiveKit credentials stay server-side; missing allowlist/release gate fails closed. |
| `accept-invite` | Yes | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Placeholder currently uses caller-scoped Supabase auth only. |
| `moderation-helper` | Yes | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Placeholder only; future privileged actions may require documented service-role use. |
| `notification-fanout` | Yes | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Placeholder only; future fanout must respect notification preferences. |
| `validate-file` | Yes | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Metadata validation only; does not read or store uploaded bytes. |
| Email service placeholder | N/A | `EMAIL_PROVIDER` | Shared helper only. `log` mode records safe email intent metadata; SMTP remains a placeholder. |

Keep this matrix updated before adding a new Edge Function or a new required secret.

## LiveKit function secrets

Required by `livekit-token`:

```env
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

Rules:

- `LIVEKIT_URL` may be returned to the renderer as a public connection URL.
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` must never be placed in renderer `.env.example`, `.env.local`, Vite variables, renderer code, preload code, or docs with real values.
- Store real values only in Supabase function secret storage.
- `supabase/functions/.env.example` may list placeholder names for local function testing, but it must never contain real values.

## Optional future server-only values

Future Edge Functions may need:

```env
SUPABASE_SERVICE_ROLE_KEY=
STORAGE_SCANNER_API_KEY=
```

Rules:

- Add these only when a task explicitly needs them.
- Keep them server-only.
- Do not use service-role access for normal client-visible reads/writes that RLS can handle.
- Document each usage before implementation.

## Renderer-safe comparison

Renderer-safe values remain documented in `.env.example`:

```env
VITE_DATA_SOURCE=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_LIVEKIT_URL=
```

These are visible to the desktop renderer and must not contain private credentials.

## Local setup commands

When Supabase CLI is available, set local/function secrets with placeholder values only:

```powershell
supabase secrets set LIVEKIT_URL=https://your-livekit-host.example
supabase secrets set LIVEKIT_API_KEY=replace-with-local-dev-key
supabase secrets set LIVEKIT_API_SECRET=replace-with-local-dev-secret
```

Do not commit the real output of these commands.

For local `.env` files used by `supabase functions serve`, start from `supabase/functions/.env.example` and keep the same placeholder discipline:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=replace-with-local-anon-key
LIVEKIT_URL=https://your-livekit-host.example
LIVEKIT_API_KEY=replace-with-local-dev-key
LIVEKIT_API_SECRET=replace-with-local-dev-secret
EMAIL_PROVIDER=log
SMTP_HOST_PLACEHOLDER=
SMTP_PORT_PLACEHOLDER=
SMTP_USER_PLACEHOLDER=
SMTP_PASS_PLACEHOLDER=
```

Never copy these server-only names into Vite variables unless they are explicitly renderer-safe and prefixed with `VITE_`.

## Verification checklist

- Search the repository for real secret values before committing.
- Confirm `.env.example` contains only renderer-safe placeholders.
- Confirm `supabase/functions/.env.example` contains only server-side placeholder values, never real secrets.
- Confirm Edge Function docs show placeholder names, not real values.
- Confirm protected functions use `requireSupabaseUser()` before privileged work.
- Confirm every new required variable is listed in the function matrix.
- Confirm function logs do not print tokens, authorization headers, passwords, or provider secrets.
