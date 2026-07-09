# Picom Social Login

Picom uses Supabase Auth OAuth for Google and Apple. The Electron renderer receives only the public Supabase URL and anon key. Provider client secrets stay in the Supabase dashboard.

## Shared configuration

1. Set `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
2. Add `picom://auth/callback` to the Supabase Authentication redirect URL allowlist.
3. Keep `VITE_SUPABASE_OAUTH_REDIRECT_URL=picom://auth/callback`.
4. Ensure the packaged app registers the `picom` protocol. Picom already forwards validated protocol URLs through the preload deep-link bridge.

The flow uses PKCE: Picom asks Supabase for an authorization URL, opens it in the system browser, accepts only a bounded `picom://auth/callback?code=...` link, and calls `exchangeCodeForSession`. Supabase continues to own session persistence and refresh.

## Google provider

1. Create an OAuth web application in Google Cloud.
2. Add the Supabase callback URL shown on Authentication > Providers > Google as an authorized redirect URI.
3. Enter the Google client ID and client secret in Supabase. Never put the secret in a `VITE_` variable.
4. Enable Google in Supabase and set `VITE_SUPABASE_GOOGLE_OAUTH_ENABLED=true`.

## Apple provider

1. Create an Apple Services ID and Sign in with Apple key in the Apple Developer portal.
2. Configure the Supabase Apple callback domain and return URL shown in the provider panel.
3. Add the Services ID, team ID, key ID, and generated secret in Supabase only.
4. Enable Apple in Supabase and set `VITE_SUPABASE_APPLE_OAUTH_ENABLED=true`.

When Apple is not configured, Picom keeps the Apple button visible but disabled with a setup explanation.

## Local development

- Use a development Supabase project and the same `picom://auth/callback` allowlist entry.
- On Windows/Linux, install/register the development Electron protocol handler before testing a browser return.
- On macOS, launch the app once from the built bundle so Launch Services knows the protocol registration.
- Mock mode keeps email/password development auth available and disables social providers safely.

## Production

- Use separate provider applications for production.
- Restrict OAuth domains and Supabase redirect URLs to known Picom environments.
- Package metadata must retain the `picom` protocol registration.
- Rotate provider secrets in Google/Apple and Supabase; never ship them in Electron assets.

## Troubleshooting

- Disabled button: verify Supabase mode, public URL/anon key, and the matching provider availability flag.
- Browser opens but Picom does not return: verify OS protocol registration and the Supabase redirect allowlist.
- Invalid callback: ensure no proxy rewrites the query and that only `code`, `error`, or `error_description` is returned.
- Signed in without a profile: apply the auth profile trigger migration; Picom also performs a safe own-profile fallback insert after callback.
