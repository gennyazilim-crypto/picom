# Picom Social Login

## Production finalization decision

- **Google:** implementation prepared, production enablement **blocked** until a hosted staging and packaged Windows/Linux/macOS callback test passes. No provider configuration was verified by repository tests.
- **Apple:** implementation prepared, production enablement **blocked** until Apple Services ID/key/domain configuration, hosted staging and packaged macOS plus Windows/Linux browser-return tests pass.
- **Steam/Epic:** remain post-MVP/MVP+ decisions and are not approved or exposed.

Provider flags are availability hints, not proof of configuration. Keep them false until provider console, Supabase dashboard, redirect allowlist, PKCE callback, account linking/recovery, rate/abuse behavior and support ownership are verified. After provider login, `ensureProfile` creates only an allowlisted Picom profile. The normal versioned Terms/Privacy acceptance gate still applies; provider consent never substitutes for Picom legal acceptance.

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

## Account linking

- Supabase Auth identities remain the source of truth for linked Google/Apple identities.
- Picom must not silently merge two existing accounts only because provider metadata contains the same display name.
- Email-based automatic linking is allowed only when Supabase has verified the provider email and the project linking policy explicitly permits it.
- A future account-settings linking action must require an active session and recent authentication before adding or removing an identity.
- Test account recovery before enabling a provider for external beta users; users must retain at least one working sign-in method.

## Steam and Epic scope

- Steam login is MVP+ work requiring a custom OpenID flow and a trusted backend or Supabase Edge Function. It is not implemented in the Full MVP social login.
- Epic login is MVP+ work requiring custom OAuth/Epic Online Services integration and server-side credential handling. It is not implemented in the Full MVP social login.
- Picom does not expose disabled Steam/Epic buttons or claim these providers are available in this beta.

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
- Verify a newly authenticated provider user receives a profile, cannot bypass current Terms/Privacy acceptance, and can recover the account before enabling the provider flag.

## Troubleshooting

- Disabled button: verify Supabase mode, public URL/anon key, and the matching provider availability flag.
- Browser opens but Picom does not return: verify OS protocol registration and the Supabase redirect allowlist.
- Invalid callback: ensure no proxy rewrites the query and that only `code`, `error`, or `error_description` is returned.
- Signed in without a profile: apply the auth profile trigger migration; Picom also performs a safe own-profile fallback insert after callback.
