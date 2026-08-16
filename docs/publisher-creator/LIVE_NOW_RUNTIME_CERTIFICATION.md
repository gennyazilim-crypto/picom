# Live Now runtime certification

Updated: 20260816T113057Z
Canonical HEAD: `3b1d633155c3dfbacc652e33c43d5435ab4162af`

## Current results

| Gate | Status | Evidence |
|---|---|---|
| Clean canonical typecheck/build/package | GO | Windows x64 package built from the current canonical HEAD. |
| Packaged Electron security | GO | `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`. |
| Package signing | BLOCKED | Current installer is `NotSigned`; protected signing CI remains required. |
| LiveKit client network | FAIL | DNS resolves; TCP 443/7880/7881/5349 fail and HTTPS times out. |
| VPS diagnosis | BLOCKED_VPS_ACCESS | Non-interactive configured-alias SSH timed out on port 22. |
| TURN | BLOCKED_CONFIGURATION | Deployed configuration and client connectivity are unavailable. |
| Test identities | BLOCKED_PROVISIONING | No real internal Auth subjects were available. |
| Local profile isolation | PARTIAL_LOCAL_PROFILE_ISOLATION | Seven independent packaged profile roots launched and were cleaned up; authenticated token separation was not available. |
| Hardware | GO_INVENTORY | Microphone-class device and physical ACER camera are present. |
| Real media / OBS / chat / analytics / team runtime | BLOCKED_RUNTIME_PREREQUISITES | No WSS connection and no separate authenticated test identities. |
| Security Center | PARTIAL_AUTH_PROVIDER_CAPABILITY | PICOM-managed coverage is not equivalent to all provider sessions. |
| Auth inbox | BLOCKED_TEST_MAILBOX | No approved mailbox; no email was sent. |

## Release verdict

- INTERNAL: **GO** for clean-package/control-plane evidence with affected features still off.
- CONTROLLED_BETA: **BLOCKED** until WSS/API connectivity and real client media tests pass.
- PUBLIC_BETA: **BLOCKED** until controlled-beta gates, chat/analytics/OBS, and provider gates pass.
- GA: **BLOCKED**; additionally requires an authenticode-signed current package.

## Evidence

`docs/audit/evidence/live-now-runtime-unblock-20260816T113057Z/`
