# Task 580 Checkpoint: macOS Native Meeting, Notarization, and Screen Share Certification

## Status

- macOS x64 certification contract: **PASS**
- Native signed/notarized/stapled execution: **BLOCKED**
- Gatekeeper/TCC permission evidence: **BLOCKED**
- Remote screen-share proof: **BLOCKED**
- Apple sensitive material committed: **No**

## Implemented

- A 27-flow matrix covers post-staple artifacts, deep/nested signing, hardened runtime/entitlements, notarization/staple/Gatekeeper, DMG install, first launch, microphone/camera/Screen Recording denial-grant-restart, full meeting behavior, remote screen render, reconnect, mini meeting, cleanup, controls/focus, and reinstall.
- The fail-closed validator requires native macOS x64, exact final hashes, every trust result, device inventory, distinct remote client, and redacted evidence before invoking the existing signing and application contract suites.
- Apple Silicon/universal support is excluded because the protected candidate workflow and evidence are x64-only.

## Validation commands

- `node scripts/macos-meeting-native-certification.mjs` - contract PASS; native execution BLOCKED without macOS/Apple access.
- `node scripts/macos-notarization-production-smoke-test.mjs` - PASS without loading Apple material.
- `node scripts/meeting-contract-suite.mjs` - PASS (44/44).
- `node scripts/meeting-production-screen-share-smoke.mjs` - PASS.
- `node scripts/screen-share-picker-bridge-full-mvp-smoke.mjs` - PASS.
- `node scripts/screen-share-publish-render-full-mvp-smoke.mjs` - PASS.
- `npm run typecheck` - PASS in an isolated clean worktree.
- `npm run mock:smoke` - PASS in an isolated clean worktree.
- `npm run build` - PASS in an isolated clean worktree.
- `npm run qa:smoke` - PASS in an isolated clean worktree.

## Native evidence

No native macOS runner/device, Developer ID identity, notary access, signed/stapled candidate, quarantined Gatekeeper test, TCC permission run, hosted room, or remote client was available. No Apple material was accessed, no permission changed, no media captured, and no native PASS fabricated.

RB-04, RB-05, and RB-08 remain release-blocking.
