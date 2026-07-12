# V1 Hosted Supabase Closure

## Decision

Status: **BLOCKED - hosted evidence is not yet available.**

Task 619 prepared a release-scoped, deny-by-default hosted validation path. It did not produce a hosted PASS. The Supabase dashboard confirms that a dedicated `picom-staging` project exists, but the current machine has no Supabase CLI access token or synthetic hosted test identities. The GitHub repository also has no `hosted-staging` environment, so the protected workflow cannot start with its required secrets and fixture variables.

## V1 boundary

The hosted matrix covers only enabled V1 Core domains: community text, Mention Feed, stories, privacy-projected profiles, friends, direct messages, settings, audit, private Storage, and private Realtime. Radio, Podcast, Events, Meeting Workspace, Discovery, bots, webhooks and production auto-update are excluded.

## Actors and fixture contract

The protected staging environment must provide synthetic owner, admin, moderator, member, visitor, blocked and DM-nonparticipant accounts. Fixture IDs must refer to non-production staging rows. The private-profile fixture is the member account with `friends` visibility and no friendship to the other actors, so only the subject can read the full projection. Mutation probes create uniquely identified text/DM rows and remove them before completion.

No service-role key is used by the runners. No credential, token, URL, UUID, message body or private response payload is printed.

## Realtime finding

The latest policy reads the verified Realtime JWT subject from `request.jwt.claims`, checks `realtime.topic()`, and denies unknown topic/extension combinations. Both hosted runners call `realtime.setAuth(session.access_token)` before private joins, matching Supabase's private Broadcast/Presence model.

Earlier staging evidence reported `Unauthorized` for private Presence. Because no current hosted run was possible, the cause cannot be closed locally. Migration parity, the Realtime public-access setting, fixture membership, and a fresh two-client run remain required.

## Edge Function release scope

Release-scoped: `client-config`, `validate-file`, and `user-data-export`. Placeholder, post-V1, provider-gated, and operations-gated functions are excluded truthfully. The hosted runner checks JWT, method, malformed/oversized body, CORS denial, V1 flags, safe errors, and export rate limiting.

## Required closure procedure

1. Create the protected GitHub environment `hosted-staging` with required reviewers.
2. Add only the secrets and fixture variables listed in `.github/workflows/hosted-validation.yml`.
3. Link Supabase CLI to staging and verify migration parity without printing connection data.
4. Deploy only functions in `supabase/functions/release-manifest.json` using the guarded script.
5. Confirm private-channel enforcement in Realtime settings.
6. Dispatch `Picom Hosted Validation` with `STAGING_ONLY`.
7. Attach its immutable URL and commit SHA to the blocker record.
8. Close RB-01, RB-02 and RB-03 only when every hosted step passes.

Local contract success must never be recorded as hosted certification.
