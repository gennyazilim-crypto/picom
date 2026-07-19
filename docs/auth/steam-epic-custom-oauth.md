# Steam & Epic custom sign-in

Supabase Auth has **no native Steam or Epic provider**, so these cannot be enabled by a
dashboard toggle like Google/Apple. Picom implements them with two custom Edge Functions
that verify the external identity and mint a Supabase session, which the desktop client
retrieves via a nonce-keyed poll (no tokens ever travel in a URL, and the deep-link
contract is untouched).

> ⚠️ **Status: code-complete, NOT deployed, NOT enabled.** The author's environment cannot
> deploy (Supabase MCP is read-only here and the CLI is blocked), and these functions mint
> Supabase sessions from an external identity — **a flaw is an auth bypass**. A security
> review MUST sign off before deploy/enable. Everything below is inert until an operator
> completes it.

> 🔴 **SECURITY BLOCKER — DO NOT ENABLE until fixed (found 2026-07-18 in security review).**
> `mintSessionForIdentity` (`supabase/functions/_shared/social-auth-session.ts`) resolves the
> account by a **guessable synthetic email** (`steam_<steamid64>@steam.users.picom.local`,
> `epic_<accountid>@epic.users.picom.local`) and treats "already registered" as success. Since
> SteamID64/EpicAccountId are public, an attacker can pre-register that exact email via normal
> email+password signup (`authService.signUpWithEmailPassword` has no domain allowlist); when the
> real user later signs in with Steam/Epic, the session is minted for the **attacker-owned** row
> → account takeover / session confusion. `verifyOtp` completes server-side regardless of email
> confirmation, so enabling email verification does NOT mitigate it.
> **Required fix before enabling:** resolve identity via a dedicated `external_identities(provider,
> external_id) -> user_id` mapping table written only by this trusted service-role path (not by
> email equality); or, on "already registered", fetch the existing row and reject unless its
> `user_metadata` provider + `steam_id`/`epic_account_id` matches. Also add a signup domain guard so
> the `*.users.picom.local` synthetic space cannot be self-registered.

## Pieces (already in the repo)

- `supabase/migrations/20260715010000_social_auth_handoffs.sql` — service-role-only,
  5‑minute, single-use session handoff store.
- `supabase/functions/_shared/social-auth-session.ts` — find/create user + mint session
  (magic-link generateLink + server-side verify) + handoff store/consume.
- `supabase/functions/steam-auth/index.ts` — Steam **OpenID 2.0** login/verify.
- `supabase/functions/epic-auth/index.ts` — Epic **OAuth2** authorize/token exchange.
- Frontend: `socialAuthService.beginCustomOAuth` + the Steam/Epic buttons (gated by
  `VITE_SUPABASE_STEAM_OAUTH_ENABLED` / `VITE_SUPABASE_EPIC_OAUTH_ENABLED`).

## Flow

1. Client generates a random `nonce`, opens `…/functions/v1/{steam|epic}-auth?action=login&nonce=…`.
2. The function redirects to Steam/Epic; on callback it verifies the identity, finds/creates
   the Supabase user, mints a session, and parks it in `social_auth_handoffs` under the nonce.
3. The client polls `…?action=poll&nonce=…`; on `ready` it calls `supabase.auth.setSession(...)`.

## Operator checklist (only you / Codex can do these)

1. **Register the developer apps** (needs your accounts):
   - Steam: get a **Steam Web API key** (`https://steamcommunity.com/dev/apikey`).
   - Epic: create a product + client in the **Epic Dev Portal**; set the redirect URI to
     `https://ufmtvqtsklqsmqxefbbs.supabase.co/functions/v1/epic-auth?action=callback`.
     Verify the current Epic OAuth endpoints against Epic's docs (they are versioned).
2. **Apply the migration** (SQL editor or `supabase db push`):
   `20260715010000_social_auth_handoffs.sql`.
3. **Set Edge secrets** (`supabase secrets set …`): `SUPABASE_SERVICE_ROLE_KEY`,
   `STEAM_WEB_API_KEY`, `EPIC_CLIENT_ID`, `EPIC_CLIENT_SECRET`, and confirm `PICOM_ALLOWED_ORIGINS`.
4. **Deploy the functions**: `supabase functions deploy steam-auth` and `… epic-auth`.
5. **Enable the buttons**: set `VITE_SUPABASE_STEAM_OAUTH_ENABLED=true` /
   `VITE_SUPABASE_EPIC_OAUTH_ENABLED=true` for the build.
6. **Security review** the session-minting path and the handoff table before enabling.

## Security notes for the review

- `social_auth_handoffs` briefly stores refresh tokens; it is service-role-only (RLS on, no
  policies), single-use, and 5‑minute TTL. Consider shortening the TTL and adding a scheduled
  purge of expired rows.
- Steam gives no email → synthetic `steam_{id}@steam.users.picom.local` accounts. Same for
  Epic (`epic_{id}@…`). Decide the account-linking/merge policy before enabling.
- The poll endpoint returns a session to an unauthenticated caller keyed only by the nonce;
  the nonce is 32 random bytes and single-use, but confirm this matches your threat model.
- Consider rate-limiting `login`/`poll` and binding the nonce to the initiating client more
  strongly (e.g. a PKCE-style verifier) if you want defense-in-depth.
