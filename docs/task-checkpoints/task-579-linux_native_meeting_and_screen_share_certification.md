# Task 579 Checkpoint: Linux Native Meeting and Screen Share Certification

## Status

- Linux x64 certification contract: **PASS**
- Native AppImage/DEB execution: **BLOCKED**
- Wayland/X11 portal screen-share proof: **BLOCKED**
- Remote render proof: **BLOCKED**
- Windows cross-build accepted: **No**

## Implemented

- A 23-flow native matrix covers both Linux package formats, desktop integration, permissions, PreJoin, voice/camera/devices, Noise Shield, layouts/stage, chat/signaling/waiting, portal share/recovery, remote render/stop, reconnect, cleanup, sandbox, controls, and reinstall.
- The fail-closed validator requires native Linux x64, Linux-built artifact hashes, executable AppImage, valid DEB metadata, Wayland and X11 portal passes, environment/device inventory, a distinct remote client, and redacted evidence for every flow.
- Unsupported RPM, ARM64, Flatpak, and Snap claims are excluded.

## Validation commands

- `node scripts/linux-meeting-native-certification.mjs` - contract PASS; native execution BLOCKED without Linux access.
- `node scripts/meeting-contract-suite.mjs` - PASS (44/44).
- `node scripts/meeting-production-screen-share-smoke.mjs` - PASS.
- `node scripts/screen-share-picker-bridge-full-mvp-smoke.mjs` - PASS.
- `node scripts/screen-share-publish-render-full-mvp-smoke.mjs` - PASS.
- `node scripts/linux-repository-distribution-smoke-test.mjs` - PASS.
- `npm run typecheck` - PASS in an isolated clean worktree.
- `npm run mock:smoke` - PASS in an isolated clean worktree.
- `npm run build` - PASS in an isolated clean worktree.
- `npm run qa:smoke` - PASS in an isolated clean worktree.

## Native evidence

No native Linux host/runner, AppImage, DEB, Wayland/X11 desktop session, PipeWire/portal stack, real media device, hosted meeting, or remote client was available. No package was installed, no portal/device permission changed, no media was captured, and no native PASS was fabricated.

RB-04, RB-05, and RB-07 remain release-blocking.
