# Self-Hosted LiveKit Secret Custody

Status: **CONTROL_PLANE_PREPARED / OWNER_ASSIGNMENTS_AND_REAL_SECRETS_BLOCKED**

Voice Rooms and Screen Share remain active V1 product capabilities. This document controls media infrastructure credentials; it never disables Feed, Community Chat, or Direct Messages.

## Environment separation

Development, staging, and production never share a LiveKit key pair, Redis password, TURN private key, host, Supabase project, DNS name, GitHub environment, or backup. Development credentials are generated under ignored `.tmp` storage and cannot be promoted. Staging and production use equivalent paths only because they are separate hosts; files are never copied between them.

The value-free inventory is `infra/livekit/secrets/secret-inventory.json`. It records names and approved custody locations only.

## Custody locations

- LiveKit API key/secret: root-owned LiveKit config, `root:picom-livekit 0640`.
- Redis password: root-owned Redis config, `root:picom-livekit 0640`.
- TURN private key: `/etc/picom-livekit/tls/turn.key`, `root:picom-livekit 0640`.
- Supabase Edge secrets: Supabase secret storage for the matching environment/project only.
- CI deployment credentials: protected GitHub environment secrets only after deployment approval.
- SSH/signing/database/service-role credentials: their existing approved managers; never this repository or Compose.

The renderer receives only the public `wss://` URL and short-lived participant token. Provider API secrets, Redis passwords, TURN keys, service-role keys, and host credentials never enter Vite, Electron preload, local settings, diagnostics, logs, support exports, screenshots, or artifacts.

## Owner assignment

`infra/livekit/secrets/owner-roles.json` defines primary and backup duties for host, LiveKit, Redis, TLS/DNS, Supabase deployment, secret rotation, cost, and incident response. Actual people/accounts must be assigned in the private operations register with MFA and recovery contacts.

Current status: **UNASSIGNED_RELEASE_BLOCKER**. Repository placeholders are not assignments, and personal contact data must not be committed.

## API key rotation

Use a unique `PICOM_ROTATION_ID` and the environment-specific confirmation:

1. `prepare` snapshots the current host config in root-only rotation storage, creates a new key pair, adds it alongside old keys, restarts/health-checks LiveKit, and changes the matching Supabase Edge secrets to the new key.
2. Run real member Voice and Screen Share flows through the Edge Function. Validate token issue, room join, publish, subscribe, reconnect, and leave without printing the token.
3. `finalize` requires `PICOM_ROTATION_VALIDATION_EVIDENCE=PASSED`, removes old keys, and health-checks LiveKit.
4. `rollback` restores the protected pre-rotation config and Edge secrets only when the old key is not compromised. A compromised key can never be re-enabled; perform a new emergency rotation.

```bash
export PICOM_ROTATION_ID=rotation-YYYYMMDD-001
export PICOM_ROTATION_CONFIRM=ROTATE_STAGING
sudo --preserve-env=PICOM_ROTATION_ID,PICOM_ROTATION_CONFIRM,PICOM_SUPABASE_PROJECT_REF \
  infra/livekit/secrets/rotate-livekit-api-key.sh prepare

export PICOM_ROTATION_VALIDATION_EVIDENCE=PASSED
sudo --preserve-env=PICOM_ROTATION_ID,PICOM_ROTATION_CONFIRM,PICOM_ROTATION_VALIDATION_EVIDENCE,PICOM_SUPABASE_PROJECT_REF \
  infra/livekit/secrets/rotate-livekit-api-key.sh finalize
```

Production uses `ROTATE_PRODUCTION` on the separate production host/project. Redis password and TLS key rotation require their own controlled maintenance/renewal procedures because they do not support this same participant-token overlap.

## Emergency revoke and kill switch

For a provider/token authorization incident, the protected operator sets the environment-specific confirmation and runs `emergency-disable-media.sh`. It sets only the server-side `PICOM_V1_VOICE_SCREEN_ENABLED=false` Edge secret. New media tokens fail closed and the UI can explain infrastructure unavailability. Feed, Chat, DM, auth, communities, and existing message data remain available.

Optionally stop the LiveKit service with `PICOM_EMERGENCY_STOP_PROVIDER=STOP_PROVIDER`. Recover only after rotating compromised credentials and rerunning security plus two-client media validation.

## GitHub environments

Requested names:

- `hosted-staging`: protected staging validations/deployment only.
- `production-release`: protected production release only.

Required controls: required reviewers, prevent self-review, restricted branches/tags, minimal Actions permissions, no pull-request secret access, and environment-scoped secrets. Current status is **CI_DEPLOYMENT_NOT_APPROVED**, so repository environments/secrets are not created or mutated by this task. Approval and private owner assignment are prerequisites.

## Environment-mix and leak checks

Run before every candidate:

```bash
npm run livekit:environment:check
npm run livekit:secrets:contract
npm run secrets:smoke
npm run secrets:management:smoke
npm run secrets:ci:smoke
npm run build
npm run livekit:environment:check
```

The environment check rejects server secrets under `VITE_*`, probable embedded secret literals, and staging/localhost LiveKit endpoints in generated production artifacts. Existing secret scans cover source, config, docs, CI, and generated outputs without printing matches that could contain values.

## Blocked evidence

- Real staging and production key generation: BLOCKED, no protected hosts/projects.
- Primary/backup owner assignments: BLOCKED, private register unassigned.
- GitHub protected deployment environments: BLOCKED, CI deployment not approved.
- Live rotation and emergency drill: BLOCKED until staging is deployed.
- Source/build scans may pass locally; host and provider secret-store inspection requires the protected environment.
