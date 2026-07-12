# Picom V1 LiveKit Secret Custody

> Historical LiveKit Cloud custody record. Task 657 replaces provider-project custody with separate development, self-hosted staging, and self-hosted production secret stores. No value in this file is current self-hosted production evidence.

Status date: 2026-07-12  
Custody result: **PARTIAL - projects separated; protected runtime installation pending**

This document defines custody without containing secret values.

## Current provider inventory

| Environment | Project alias | Credential state | Approved runtime destination |
| --- | --- | --- | --- |
| Staging | `Picom Staging` | One project-local key record exists; secret not revealed in Task 658 | Supabase staging Edge Function secrets |
| Production | `Picom Production` | One distinct project-local key record exists; secret not revealed in Task 658 | Production Supabase/approved production secret manager only |

Task 658 created/separated the projects and verified their public endpoints. Task 659 owns staging secret installation. Production credentials must not be installed in staging or ordinary GitHub QA.

## Secret inventory and approved stores

| Name/category | Sensitivity | Approved location | Renderer/package |
| --- | --- | --- | --- |
| `LIVEKIT_URL` | Public endpoint but environment-controlled | Supabase Function secrets or approved server config | Public WSS URL may be supplied through approved runtime config |
| `LIVEKIT_API_KEY` | Provider credential | Supabase Function secrets / production secret manager | Forbidden |
| `LIVEKIT_API_SECRET` | Critical signing secret | Supabase Function secrets / production secret manager | Forbidden |
| `PICOM_ALLOWED_ORIGINS` | Security configuration | Supabase Function secrets/config | Forbidden as mutable renderer authority |
| `PICOM_V1_VOICE_SCREEN_ENABLED` | Server-side release gate | Supabase Function secrets/config | Forbidden as renderer authority |
| Supabase deployment token | Critical deployment credential | Protected CI/operator secret store | Forbidden |
| Synthetic staging passwords | Test credentials | Protected `hosted-staging` environment | Forbidden |
| Participant JWTs | Short-lived bearer credentials | Memory only | Never persisted/logged |

## Ownership matrix

| Responsibility | Required assignment | Current status |
| --- | --- | --- |
| LiveKit account/project administrator | Named primary and backup | Primary account present; backup UNASSIGNED |
| Staging operator | Least-privilege named operator | UNASSIGNED in private register |
| Production approver | Separate named approver | UNASSIGNED |
| Billing/quota owner | Named owner and budget | UNASSIGNED |
| Supabase Edge deployment | Named backend/release owner | UNASSIGNED |
| Secret rotation | Security owner and backup | UNASSIGNED |
| Incident response | On-call and escalation | UNASSIGNED |
| Emergency revoke | Authorized two-person path | UNASSIGNED |
| Quarterly access review | Named reviewer | UNASSIGNED |

A role label in this public document is not an identity assignment. The private register must hold names, backups, approval dates, and review dates.

## Custody rules

- Staging and production projects, endpoints, and credentials stay separate.
- MFA and least privilege are required for provider and deployment administrators.
- Provider secrets never enter Vite variables, renderer code, preload DTOs, local settings, diagnostics, support bundles, screenshots, docs, package metadata, or release artifacts.
- Pull-request and ordinary QA jobs receive no provider secret.
- Hosted tests use protected staging environment secrets and synthetic accounts.
- Production credentials are unavailable to staging jobs.
- Secret names/presence may be reported; values may not be printed.

## Safe transfer procedure

1. Open the target LiveKit project and target Supabase project in controlled authenticated sessions.
2. Reveal/copy one secret only when immediately transferring it to that environment's protected Edge Function secret form or CLI stdin.
3. Never paste it into terminal history, files, chat, screenshots, clipboard logs, or Codex output.
4. Save `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `PICOM_ALLOWED_ORIGINS`, and the server release gate in the target environment.
5. Verify names/presence and token issuance without echoing values.
6. Clear the temporary clipboard and close secret-reveal UI.
7. Record actor/reviewer/time in the private register.

## Rotation and emergency revoke

- Review at least quarterly and immediately after suspected exposure, owner departure, provider incident, or environment mix-up.
- Create replacement credential, validate staging, then change production under approval.
- Revoke old credential after successful cutover.
- On incident, activate Voice/Screen kill switches, revoke provider credential, inspect redacted deployment/provider logs, and rerun hosted authorization/two-client/cleanup gates.

## Task 658 evidence

- Real `Picom Staging` and `Picom Production` projects exist.
- Their public endpoints resolve and complete TLS on port 443.
- Agent observability is disabled in both projects.
- Distinct project-local API key records exist.
- No key/secret/token value was read or emitted.
- Protected runtime stores and backup ownership remain incomplete.

## Pass criteria

Full custody becomes PASS only when staging and production secret names are present in their separate protected stores, backup/rotation/billing/incident owners are assigned, environment mapping is independently reviewed, and no value appears in source, logs, artifacts, or diagnostics.
