# Self-Hosted Supabase LiveKit Token Service

Status: **BLOCKED_PENDING_REAL_SELF_HOSTED_STAGING**

The existing hardened `livekit-token` Edge Function is provider-neutral and is retained. Task 664 adds the protected deployment path that binds it to Picom's self-hosted staging WSS endpoint. LiveKit Cloud is not required.

## Security contract

- Supabase verifies the caller JWT and loads the canonical profile for `auth.uid()`.
- Deletion-pending profiles and bots are denied.
- `authorize_livekit_room` validates community/channel, Voice type, accepted active membership, bans, timeouts, removals, and active account state.
- Owner, Admin, Moderator, Member, and roleless active Member receive the same ordinary join/subscribe/microphone/screen grants.
- Visitor, non-member, banned, timed-out, removed, unauthenticated, bot, and invalid channel requests fail closed.
- Moderation remains a separate role/hierarchy RPC.
- Voice intent can publish microphone; Screen intent can publish microphone, screen-share, and screen-share-audio.
- Camera, data publication, recording, Egress, Ingress, SIP, and arbitrary room names are denied.
- Tokens use canonical user identity, deterministic room names, and a ten-minute TTL.
- Exact CORS allowlist, POST/JSON/2 KiB body, per-user rate limit, safe URL, and typed redacted errors remain mandatory.

## Protected deployment flow

The deployment wrapper requires:

- the approved staging Supabase project and protected access token;
- a root-owned LiveKit config outside the repository containing exactly one initial key pair;
- protected network metadata outside the repository containing the trusted primary hostname;
- exact allowed origins and a controlled test origin;
- explicit `STAGING_ONLY` and reviewed-migration confirmations.

It performs:

1. Reject repo-contained config, placeholder/publicly invalid hostname, wildcard CORS, non-TLS non-loopback origins, ambiguous key overlap, or wrong Supabase project.
2. Build a temporary `0600` env file with `LIVEKIT_URL=wss://...`, API key/secret, origins, and server-side enable gate.
3. Run pinned Supabase CLI `secrets set --env-file`; values are never command arguments or output.
4. Invoke the existing reviewed migration reconciliation and Function deployment.
5. Run owner/admin/moderator/member/roleless success and visitor/non-member/banned/rate-limit denial fixtures.
6. Run the existing multi-client Electron media harness against the URL returned by the Edge Function, proving the issued token connects to the self-hosted provider.
7. Delete temporary files and write only redacted boolean evidence.

Dry run:

```powershell
npm run livekit:token:self-hosted:deploy:staging
npm run livekit:token:self-hosted:contract
npm run livekit:token:security:smoke
```

Protected execution:

```bash
npm run livekit:token:self-hosted:deploy:staging -- --run
```

The environment variables are intentionally documented by name in dry-run output; values belong only in the protected operator environment.

## Rollback and emergency behavior

- Function code rollback uses the prior reviewed bundle through the protected deployment procedure.
- Provider key rollback follows Task 663 and is forbidden for a compromised key.
- Incident disable sets only `PICOM_V1_VOICE_SCREEN_ENABLED=false`; new media tokens fail closed while Feed, Chat, and DM continue.
- A provider outage returns a safe unavailable state; it must not crash or hide the permanent V1 navigation.

## Blocked evidence

- Secret setup and Function deployment: BLOCKED, self-hosted staging/DNS not available.
- Hosted role/denial fixture: BLOCKED, protected Supabase access not supplied.
- Token-to-self-hosted-WSS media connection: BLOCKED, provider endpoint not deployed.
- No secret value was created, read from the user's browser, or committed by this task.
