# Picom V1 Release Provenance

Status date: 2026-07-12
Status: **NOT GENERATED - RELEASE CANDIDATE BLOCKED**

This document intentionally does not fabricate provenance for an unsigned or nonexistent artifact.

## Evaluation record, not artifact provenance

| Field | Value |
| --- | --- |
| Product | Picom Desktop |
| Requested release | `1.0.0` / `stable` / Windows x64 |
| Audited package version | `0.1.1-beta.1` |
| Audited base source SHA | `fec56816516dd50ece073428aef126cbae14025d` |
| Production data source contract | Supabase-only, fail closed |
| Voice/Screen Share | Included by Task 668; evidence runs 29197503222, 29198913461, 29199409039 |
| Build result | Renderer and Electron bundle PASS |
| Package result | NOT PRODUCED |
| Signing result | NOT AVAILABLE |
| Signed artifact SHA-256 | NOT GENERATED |
| Clean-machine result | NOT RUN |

The source SHA above is the input to the Task 625 audit, not a frozen artifact-producing commit. This documentation commit must not be substituted for signed build provenance.

## Required immutable provenance fields

Final provenance must be emitted after trusted signing and include:

- product/version/channel/platform/architecture and exact artifact filename;
- full source commit and clean-worktree assertion;
- lockfile hash, build workflow run and protected environment;
- approved production configuration identifiers without secret values;
- Electron/Node/builder runtime versions;
- build date in UTC and controlled builder identity;
- Authenticode publisher, signature digest and RFC 3161 timestamp result;
- signed artifact byte size and SHA-256;
- checksum-manifest hash;
- approved legal/policy versions and release decision reference;
- clean Windows 10/11 smoke evidence IDs.

Never include machine-local credentials, certificate material, passwords, tokens, connection strings or `.env` contents.

## Generation order

1. Freeze approved `1.0.0` source and production identifiers.
2. Build in the protected Windows workflow.
3. Sign and timestamp the installer.
4. Verify signature, publisher and timestamp.
5. Generate SHA-256 and provenance from that exact signed file.
6. Store artifacts/manifest/provenance immutably.
7. Install and smoke the same hash on clean targets.

Because steps 1-4 are blocked, no final provenance file or checksum is authorized.
