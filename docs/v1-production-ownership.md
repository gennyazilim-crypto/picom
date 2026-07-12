# Picom V1 Production Ownership Gate

Status date: 2026-07-12
Decision: **BLOCKED / NO-GO**

No accountable owner assignment was supplied. A team label, placeholder, Codex, or the person running a command is not an operational assignment. This document intentionally contains identifiers and duties only, never secret values.

## Accountable ownership matrix

| V1 system/duty | Accountable owner | Backup/recovery owner | On-call/escalation contact | Approval/evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Supabase project, Auth and production organization | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Database migrations and RLS | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Storage buckets and access policies | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Edge Functions and deployment secrets | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Windows signing identity and timestamping | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Release artifacts, checksums and provenance | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Domain, DNS, download manifest and public URLs | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Support queue and user communications | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Incident command and security escalation | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Legal documents and publication approval | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Backup, restore and disaster-recovery drills | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Secret rotation, revocation and recovery | UNASSIGNED | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| LiveKit provider custody | UNASSIGNED | UNASSIGNED | UNASSIGNED | Feature hidden from V1 | POST-V1 |

## Secret-custody register

Record values only in an approved protected store. The repository records categories and controls:

| Secret/category | Approved store | Accountable owner | Rotation/revocation evidence | Status |
| --- | --- | --- | --- | --- |
| Supabase production access token | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Supabase production database password | UNASSIGNED | UNASSIGNED | MISSING | BLOCKER |
| Supabase service-role key | Supabase server/Edge/protected CI only; final store unassigned | UNASSIGNED | MISSING | BLOCKER |
| Windows signing certificate/private key and password | Managed signing service/HSM required; final store unassigned | UNASSIGNED | MISSING | BLOCKER |
| Backup encryption/recovery credentials | Approved recovery vault required; final store unassigned | UNASSIGNED | MISSING | BLOCKER |
| LiveKit API key/secret | Edge/server store only if post-V1 scope reopens | UNASSIGNED | NOT V1-SCOPED | POST-V1 |

Renderer-safe values such as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public configuration, not secrets. Their production project, channel and change approval still require a frozen owner record.

## Change-control freeze

Until all V1 blocker rows have named people or accountable teams with reachable escalation paths:

- production values, provider targets and public URLs are not frozen;
- no stable deployment or public artifact promotion is authorized;
- no local `.env` file may become production custody;
- protected CI/server stores are the only permitted injection boundary;
- emergency changes require an incident record, two-person review and rollback plan;
- owner, backup owner, approval date and evidence link must be recorded for every change;
- access removal and secret revocation must be tested after staff/role changes.

## Closure evidence

RB-09 closes only when the matrix has real assignments, approved stores, last/next rotation dates, tested revoke/recovery procedures, production identifiers frozen by version (not secret value), and a signed operations Go decision. None of that evidence was supplied, so the V1 production ownership gate remains blocked.
