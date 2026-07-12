# Picom V1 LiveKit Production Environment

Status date: 2026-07-12  
Task result: **BLOCKED - provider environment is not provisioned or approved**

This is the public, redacted environment control record for the Voice Rooms and Screen Share V1 evidence sequence. It contains no project identifier, credential, connection value, token, user account, or private room identifier.

## Provider decision

| Field | Required evidence | Current record | Status |
| --- | --- | --- | --- |
| Hosting model | Approved LiveKit Cloud or reviewed self-hosted deployment | LiveKit Cloud is the recommended candidate; no authorized selection was found | BLOCKED |
| Staging project | Dedicated non-production project | No project/environment evidence available | BLOCKED |
| Production project | Dedicated production project | No project/environment evidence available | BLOCKED |
| Region/data residency | Selected region(s), legal basis and latency rationale | Unassigned | BLOCKED |
| Connection endpoint | Approved public `wss://` endpoint associated with each project | No value inspected or verified | BLOCKED |
| Plan/capacity | Participant, room, bandwidth/egress, TURN and support limits | Unassigned | BLOCKED |
| Support contact | Provider support path and severity process | Unassigned | BLOCKED |
| Operational owner | Named accountable role/person in the private register | Unassigned | BLOCKED |
| Billing/cost owner | Named owner, budget and alert threshold | Unassigned | BLOCKED |
| Monitoring | Quota, connection failure, packet-loss and room-spike alarms | Not configured/evidenced | BLOCKED |

No provider dashboard was available through the current authenticated tooling. No provider project was created or changed.

## Environment separation contract

| Property | Staging | Production |
| --- | --- | --- |
| LiveKit project | Dedicated staging-only | Dedicated production-only |
| Supabase project | Dedicated staging project | Dedicated production project |
| API key/secret | Staging secret store only | Production secret store only |
| Synthetic accounts | Required; no real user data | Forbidden for routine tests unless approved |
| Rooms | Staging namespace/project only | Production rooms only |
| Logs/telemetry | Short retention, synthetic identities | Approved production retention/redaction |
| Feature availability | Internal/protected validation | Enabled only after Task 654 |
| Deployment authority | Protected staging operator | Separate protected release operator |
| Confirmation guard | `STAGING_ONLY` | Explicit production change/release approval |

Staging credentials, project identifiers and endpoints must never be copied into a production package or production Edge Function configuration.

## Canonical runtime contract

The current repository implementation defines:

- Room name: `community:<communityId>:voice:<channelId>`.
- Participant identity: authenticated Supabase `auth.uid()`.
- Participant display name: bounded profile/auth metadata; never an authorization identity.
- Participant token TTL: **600 seconds (10 minutes)**.
- Subscription: allowed for an authorized room participant.
- Voice intent publication: microphone only when `speakInVoice` is authorized.
- Screen intent publication: `screen_share` and `screen_share_audio` only when `shareScreen` is authorized; microphone remains independent.
- Camera publication: denied.
- Data publication: denied by the current V1 token.
- Arbitrary renderer-supplied room name: rejected unless it exactly matches the derived room.
- Provider API key/secret: server/Edge only.

The previous one-hour wording in general runbooks was stale and is corrected by this task to match `supabase/functions/livekit-token/index.ts`.

## Participant and cost guardrails

The provider plan and application participant ceiling are not currently approved. Production enablement requires a private operations record containing:

- maximum concurrent participants per room;
- maximum concurrent rooms;
- monthly participant minutes and egress budget;
- TURN usage threshold;
- alert thresholds at 50%, 75% and 90% of approved limits;
- abuse/rate-limit policy;
- automatic or operator-controlled admission stop;
- emergency `disableVoice` and `disableScreenShare` procedure;
- billing owner and escalation contact.

Until exact limits are approved and enforced/observed, capacity is **BLOCKED**. No arbitrary participant number is invented in this public repository.

## Public and secret configuration

Renderer-safe public names:

- `VITE_LIVEKIT_ENABLED`
- `VITE_LIVEKIT_URL` (public endpoint only)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Supabase Edge/server-only names:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `PICOM_ALLOWED_ORIGINS`

Protected deployment names may include `SUPABASE_PROJECT_REF` and `SUPABASE_ACCESS_TOKEN`; they do not enter the renderer or release artifact.

## Current configuration evidence

Read-only checks found:

- No relevant LiveKit/Supabase value in the current process environment.
- The primary working copy has a gitignored `.env.local`, but no required provider value was present in the names-only check.
- No linked Supabase project-ref evidence file.
- No relevant repository-level GitHub Actions secret name.
- No GitHub `hosted-staging` environment.
- The V1 Edge release manifest still excludes LiveKit functions by Task 621 scope.
- No secret value was read, printed, copied or committed.

These findings prove absence of available configuration, not absence from every external dashboard. Dashboard state requires an authorized provider/Supabase operator.

## Network verification

Required checks:

1. Supabase Edge Function resolves and establishes TLS/WebSocket connectivity to the selected LiveKit endpoint.
2. The exact packaged Windows candidate resolves the endpoint and connects over the provider-supported UDP/TCP/TURN paths.
3. Representative restricted networks exercise TURN fallback.
4. DNS/TLS failures produce a recoverable Voice-unavailable state.
5. No endpoint test prints tokens, credentials, private room names or user identifiers.

Current result:

- Edge Function environment test: **BLOCKED**; no project/function/endpoint.
- Packaged Windows client test: **BLOCKED**; no approved provider endpoint and no immutable candidate for this scope.
- Local generic internet reachability would not satisfy either acceptance item and was not mislabeled as evidence.

## Provisioning runbook

An authorized operator must complete these actions outside shared logs:

1. Obtain approval for LiveKit Cloud or the reviewed self-hosted design.
2. Create distinct staging and production projects.
3. Record project aliases, regions, plan, limits and owners in the private operations register.
4. Store credentials in the approved secret manager.
5. Link only the staging Supabase project for Tasks 644-653.
6. Set secret values through protected Supabase secret management.
7. Verify names/status without printing values.
8. Run hosted allow/deny, two-client Voice and Screen Share tests.
9. Repeat production setup only after final authorization.
10. Record immutable provider/project revision metadata without credentials.

## Release decision

Task 643 cannot satisfy its real-provider acceptance criteria in the current environment. It is committed as a truthful **BLOCKED** operations checkpoint. Voice Rooms and Screen Share remain `HIDDEN_FROM_V1`.
