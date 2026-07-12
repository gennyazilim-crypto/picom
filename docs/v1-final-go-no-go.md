# Picom V1 Final Go/No-Go Decision

Decision date: 2026-07-12
Decision: **NO_GO**
Evaluated base SHA: `8884ba7a631b18c98c726296538bdcbd1d4733b4`
Requested release: Picom `1.0.0` stable, Windows-first

## Decision rule

Picom V1 may publish only when every critical privacy, production data, recovery, legal, ownership, artifact trust and installed-client gate is closed. Missing evidence is a blocker, not a non-blocker. Local contracts cannot substitute for hosted, native or authorized evidence.

At least four automatic No-Go conditions are present: unsigned/untrusted Windows artifact, missing legal approval, missing production owner, and incomplete recovery. Publication is therefore prohibited regardless of passing local tests.

## Final evidence matrix

| Gate | Evidence | Result |
| --- | --- | --- |
| V1 scope registry | Core scope and hidden-feature contracts pass | PASS |
| Production data source | Stable/production is explicit Supabase-only and fails closed | PASS locally |
| Hosted Supabase | Local schema/RLS/contracts pass; hosted actors, Realtime, Storage and Edge closure incomplete | BLOCKED |
| Core functional acceptance | Deterministic V1 contracts pass; hosted and installed end-to-end flows incomplete | BLOCKED |
| Voice/Screen Share | Included for active members; runs 29197503222, 29198913461, and 29199409039 passed | PASS TECHNICAL / PUBLIC RELEASE STILL GATED |
| Windows trust | No signing tool/certificate/workflow run/signed artifact/clean Windows matrix | BLOCKED |
| Legal/license | Beta drafts and placeholder root license; no authorized approval | BLOCKED |
| Production ownership | All accountable/recovery/custody owners remain unassigned | BLOCKED |
| Backup/restore | Full DB restore and DB lifecycle pass; Storage bytes and live Auth token rejection do not | PARTIAL / BLOCKED |
| RC inventory | Artifact count zero; package remains `0.1.1-beta.1` | BLOCKED |
| Checksum/provenance | Generator contracts pass; no signed artifact outputs exist | BLOCKED |
| Release notes/support/legal links | Draft/support runbooks exist; final URLs, owners and approved versions are not frozen | BLOCKED |
| Rollback | Technical runbook exists; production owner and prior signed known-good artifact do not | BLOCKED |

No critical blocker was waived, downgraded or hidden.

## Task 626 quality result

The second clean quality run passed dependency audit, secrets, licenses, dependency/API policies, typecheck, mock contract, renderer/Electron build, QA smoke, static Supabase QA, visual/E2E coverage contracts, checksum/provenance contracts, CI workflow contract, performance hard caps and package configuration verification.

`npm run release:go-no-go:guard` then exited nonzero with `Release blocked by stable Go/No-Go decision: No-Go.` This is the correct required behavior. The remaining V1 scope/data/Edge guards pass while legal/ownership and Windows signing guards explicitly report release blockers.

Contract-only limitations remain explicit:

- visual coverage does not claim pixel screenshot execution;
- E2E coverage does not claim Electron UI runner execution;
- static Supabase QA does not claim hosted actor/provider execution;
- checksum/provenance fixtures do not claim artifact evidence.

## Publication verification

- Remote Git tag `v1.0.0`: **ABSENT**.
- GitHub Release `v1.0.0`: **ABSENT**.
- Signed Windows artifact: **ABSENT**.
- Public SHA-256/provenance: **ABSENT**.
- Website Download page/changelog release update: **NOT PERFORMED**.
- Linux/macOS stable artifacts or support claims: **NOT PUBLISHED**.
- Post-launch rollout/monitoring evidence: **NOT CREATED**.

## Required closure order

1. Assign production, recovery, legal, support, incident, backup and secret-custody owners.
2. Obtain authorized immutable project-license and V1 policy approval with final links.
3. Complete hosted Supabase actor, private Storage, Realtime and Edge evidence.
4. Complete Storage object-byte recovery and isolated Auth token/session behavior.
5. Freeze package/version/channel/config/URLs at `1.0.0` from a clean approved commit.
6. Build, sign and timestamp on the protected Windows path.
7. Generate SHA-256 and provenance only from the verified signed artifact.
8. Pass clean Windows 10/11 install, upgrade, core-flow, rollback and uninstall smoke.
9. Obtain named Product, Engineering, Security, Operations, Legal and Support sign-offs.
10. Rerun this decision from the exact artifact/source evidence.

Until every step passes, the only authorized decision is **NO_GO**.
