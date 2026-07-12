# Picom V1 Release Candidate Artifact Inventory

Status date: 2026-07-12
Decision: **BLOCKED / NO RELEASE CANDIDATE ARTIFACT**

## Freeze audit

| Field | Required V1 value | Audited value | Result |
| --- | --- | --- | --- |
| Product/version | Picom `1.0.0` | `package.json` is `0.1.1-beta.1` | BLOCKER |
| Channel | `stable` | Stable scope contract exists; package identity remains beta | BLOCKER |
| Evaluated source | Immutable full SHA | `fec56816516dd50ece073428aef126cbae14025d` before Task 625 evidence commit | RECORDED, NOT FROZEN |
| Data source | Production Supabase only | Fail-closed contract passes; production hosted evidence is missing | BLOCKER |
| Supabase target/region | Approved production project/region | Only synthetic staging evidence exists; production target is unassigned | BLOCKER |
| Edge Functions | Deployed, versioned V1 allowlist | Local release-scope contract passes; hosted deployment is unverified | BLOCKER |
| Voice/Screen Share | Included with hosted, packaged-Windows, and security evidence | `IN_V1` | PASS TECHNICAL |
| Post-V1 features | Absent from V1 navigation/release claims | V1 scope contract passes | PASS BY SCOPE |
| Legal versions | Approved immutable versions | Beta drafts; root license placeholder | BLOCKER |
| Support/status/download URLs | Approved frozen HTTPS locations | Unassigned/unapproved | BLOCKER |
| Installer identity | Versioned and trusted | Product/app ID contracts pass; stable version/signature absent | BLOCKER |

This table is an audit record, not release provenance. The Task 625 documentation commit is not an artifact source commit.

## Artifact inventory

| Artifact/evidence | Required order | Result |
| --- | --- | --- |
| Windows x64 installer | Build from frozen `1.0.0` source | NOT PRODUCED |
| Windows unpacked candidate | Build from same source/config | NOT PRODUCED |
| Authenticode publisher/signature | Sign installer before hashing | NOT AVAILABLE |
| RFC 3161 timestamp | Validate after signing | NOT AVAILABLE |
| SHA-256 manifest | Generate only after signature validation | NOT GENERATED |
| Provenance metadata | Bind signed hash, source SHA and build identity | NOT GENERATED |
| Clean Windows 10 install/smoke | Test exact signed hash | NOT RUN |
| Clean Windows 11 install/smoke | Test exact signed hash | NOT RUN |

No unsigned beta package was renamed, copied, checksummed, or represented as a V1 RC. Existing local/release outputs are not part of this inventory.

## Local build evidence

The renderer and Electron bundles compile from the evaluated source, Electron packaging configuration validates, checksum/provenance fixture contracts pass, and the performance budget remains below hard caps. These checks prove build tooling only; they do not create a distributable candidate.

## Required next attempt

1. Close hosted Supabase, legal, ownership and full recovery blockers.
2. Freeze an approved `1.0.0` source commit and stable environment identifiers.
3. Run the protected Windows signing workflow with trusted certificate custody.
4. Verify publisher, signature and timestamp before generating hashes.
5. Generate provenance from the exact signed hash.
6. Install and smoke the same hash on clean Windows 10 and 11 targets.

Until then, artifact count is zero and Task 626 must remain No-Go.
