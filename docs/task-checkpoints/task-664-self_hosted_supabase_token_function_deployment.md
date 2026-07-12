# Task 664 Checkpoint: Self-Hosted Supabase Token Function Deployment

## Status

Source/deployment/authorization contract: **PASS**

Real hosted deployment and self-hosted WSS connection: **BLOCKED_PENDING_REAL_SELF_HOSTED_STAGING**

Voice Rooms and Screen Share remain active V1 capabilities.

## Delivered

- Provider-neutral hardened Edge Function retained.
- Protected repo-external host config and trusted WSS binding.
- Temporary `0600` Supabase CLI env-file secret transport.
- Approved staging-project and explicit confirmation guards.
- Existing migration/Function deploy orchestration reused rather than duplicated.
- Active-member role matrix, denial/rate-limit matrix, and real provider media harness chained after deploy.
- Redacted boolean evidence only; no token/key/endpoint output.

## Validation

- `npm run livekit:token:self-hosted:contract`: PASS
- `npm run livekit:token:security:smoke`: PASS
- wrapper dry-run/no-network mode: PASS
- `npm run typecheck`: PASS
- real Supabase secrets/deploy: BLOCKED, protected staging unavailable
- real role/denial/media matrix: BLOCKED, protected staging unavailable

Redacted contract evidence: `docs/evidence/task-664-self-hosted-token-contract.json`.

## Remaining blockers

- Tasks 660-663 require real host, DNS/TLS/TURN, secret custody, and owner evidence.
- Protected Supabase staging access and synthetic fixture approval are required.
- No public release readiness is claimed.
