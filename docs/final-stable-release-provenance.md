# Final Stable Release Provenance

Status date: 2026-07-10  
Result: **Pending - no final artifact provenance can be issued**

## Evaluation baseline

- Product: Picom
- Current package version: `0.1.1-beta.1`
- Current channel: beta/development contracts; stable not frozen
- Blocker-closure baseline before final decision: commit `1a551fb`
- Desktop runtime: Electron
- Renderer: React, TypeScript, Vite
- Evaluation host: Windows x64

This is assessment metadata, not release provenance. A valid record must be generated after each platform's final signing/notarization bytes exist and must include exact source commit, version, channel, build date, runner identity, runtime/tool versions, artifact name/size/hash, signature/notarization result, and immutable release location. No secret, username, private path, certificate identity material beyond approved public publisher metadata, or credential may be included.

## Task 415 provenance decision

Source review baseline: `b4d4bc0`; package version remains `0.1.1-beta.1`. This is not a stable provenance record. No final signed/notarized bytes, platform runner identities, approved stable version/channel, or immutable download locations exist, so provenance generation was intentionally not represented as complete.
# Task 430 provenance decision (2026-07-11)

No final stable provenance statement was emitted because no immutable stable RC artifact exists.

- Evaluated source commit: `5d01d1ce09d050c90cc2eaf6ae841e9054022d88`
- Package version at evaluation: `0.1.1-beta.1`
- Decision: `NO-GO`
- Stable artifact digest set: not generated
- Windows trusted-signing identity: unavailable
- macOS signing/notarization identity: unavailable
- Linux native package evidence: unavailable

The release provenance generator contract passed in fixture/smoke mode. That result validates the generator only; it does not claim production artifact provenance, signing, notarization, publication, or custody.
