# Picom V1 LiveKit Secret Custody

Status date: 2026-07-12  
Custody result: **BLOCKED - required owners and protected stores are unassigned**

This document defines the control model without containing secret values.

## Secret inventory and approved stores

| Name/category | Sensitivity | Approved location | Renderer/package |
| --- | --- | --- | --- |
| `LIVEKIT_URL` | Public endpoint but environment-controlled | Supabase Function secrets or approved server config | Optional public URL only; no credentials |
| `LIVEKIT_API_KEY` | Provider credential | Supabase Function secrets / production secret manager | Forbidden |
| `LIVEKIT_API_SECRET` | Critical signing secret | Supabase Function secrets / production secret manager | Forbidden |
| `PICOM_ALLOWED_ORIGINS` | Security configuration | Supabase Function secrets/config | Forbidden as mutable renderer authority |
| Supabase deployment token | Critical deployment credential | Protected CI/operator secret store | Forbidden |
| Supabase project reference | Deployment metadata | Protected environment configuration | Not a renderer authority |
| Synthetic staging passwords | Test credentials | Protected hosted-staging environment | Forbidden |
| Participant JWTs | Short-lived bearer credentials | Memory only | Never persisted/logged |

## Ownership matrix

Every row must be assigned in the private operations register before Task 643 can pass.

| Responsibility | Required owner | Current status |
| --- | --- | --- |
| LiveKit organization/account administrator | Named primary and backup | UNASSIGNED |
| LiveKit staging project operator | Named least-privilege operator | UNASSIGNED |
| LiveKit production project operator | Separate named operator/approver | UNASSIGNED |
| Provider billing and quota | Named finance/operations owner | UNASSIGNED |
| Supabase Edge deployment | Named backend/release owner | UNASSIGNED |
| LiveKit secret rotation | Named security owner and backup | UNASSIGNED |
| Incident response | On-call owner and escalation path | UNASSIGNED |
| Emergency revocation/kill switch | Two-person authorized path | UNASSIGNED |
| Access review | Quarterly reviewer | UNASSIGNED |
| Offboarding | Account/secret removal owner | UNASSIGNED |

A role name in this public document is not an assignment. The private register must contain the accountable identity, backup, approval date and review date.

## Access policy

- Least privilege and separate staging/production access.
- Multi-factor authentication required for provider and deployment administrators.
- No shared personal account.
- Production secret read/write access limited to authorized operators.
- Routine CI jobs receive no provider secret.
- Hosted validation uses a protected environment and synthetic staging accounts.
- Renderer, preload, support bundle, diagnostics, screenshots and release artifacts receive no API secret or token.
- Secret names/status may be audited; values must not be printed.
- Access changes require an audit entry in the private operations register.

## Secret lifecycle

### Initial issue

1. Provider administrator creates a project credential.
2. Secret custodian stores it directly in the approved secret manager.
3. Edge deployment operator references the secret by name.
4. A second reviewer verifies project/environment mapping without exposing value.
5. Hosted token tests confirm the credential works.
6. Original copy/paste buffers and temporary files are cleared according to operations policy.

### Rotation

- Scheduled review at least quarterly.
- Immediate rotation after suspected exposure, owner departure, provider incident or environment mix-up.
- Create replacement credential.
- Update staging and validate.
- Update production only under change approval.
- Revoke old credential.
- Verify token issuance and provider room access.
- Record dates, actor, reviewer and incident/change identifier without the value.

### Emergency revocation

1. Activate `disableVoice` and `disableScreenShare`.
2. Revoke provider credential.
3. Disable or roll back token function if authorization integrity is uncertain.
4. Audit provider rooms, token function logs and deployment history.
5. Rotate affected Supabase/deployment credentials where required.
6. Keep Chat/Feed/DM available in degraded mode.
7. Resume only after hosted authorization, two-client media and cleanup gates pass.

## Environment mix-up prevention

- Staging and production use different LiveKit projects and credentials.
- Protected workflow environments have distinct names and approvers.
- Deployment scripts require an explicit environment confirmation and approved project match.
- Production package metadata contains no staging endpoint.
- A release gate checks the public endpoint classification without printing its value.
- Staging users and room identifiers are synthetic.
- Production credentials are never available to pull-request or ordinary QA jobs.

## Repository and CI findings

Names-only checks on 2026-07-12 found:

- Relevant repository-level GitHub Action secret names: none.
- GitHub `hosted-staging` environment: absent.
- Current process LiveKit/Supabase provider variables: absent.
- Linked Supabase project evidence: absent.
- Protected owner/custody record: unavailable.
- Result: **BLOCKED**.

## Secret scan evidence

The following checks passed without printing secret values:

- `npm run env:placeholders:check`
- `npm run secrets:smoke`
- `npm run secrets:ci:smoke`

They verified placeholder-only committed env examples, renderer/server name separation, gitignore coverage and no known service-role/LiveKit/signing secret in runtime code. This is repository evidence only; it cannot inspect external provider dashboards or untracked logs on other machines.

## Build output and log controls

Before Tasks 655-656:

- scan tracked source and generated application bundles;
- scan package metadata, provenance and support bundle fixtures;
- exclude `.env*`, token payloads, raw Electron logs and local release directories from artifacts;
- verify diagnostics redact Authorization headers, JWTs, API keys, device IDs and room-sensitive metadata;
- verify no captured audio/frame/thumbnail is logged or uploaded;
- keep secret-scanner allowlist narrow, reviewed and documented.

## Pass criteria

Task 643 may change from `BLOCKED` to `PASS` only when:

- real staging and production provider projects exist;
- region/plan/capacity are approved;
- all owner rows are assigned with backups;
- secret names exist in the correct protected stores;
- staging/production separation is reviewed;
- outbound Edge and packaged-client connectivity is evidenced;
- secret scan and incident/rotation drills pass;
- no value is exposed.

Until then, Voice Rooms and Screen Share remain `HIDDEN_FROM_V1`.
