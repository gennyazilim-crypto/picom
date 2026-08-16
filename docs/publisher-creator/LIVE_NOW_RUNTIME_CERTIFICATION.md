# Live Now runtime certification

Updated: 20260816T120423Z
Canonical HEAD: `a99135729a7098cd841b84688cb7ac056346da8d`

## Current results

| Gate | Status | Evidence |
|---|---|---|
| Authoritative installer | CONFIGURATION_BLOCKED | SHA-256 `15A1C11F…BCD1AA2EC` is correct, but the package stops fail-closed before sign-in because its public renderer configuration is absent. |
| Current runtime test package | GO | A separate package from the same canonical HEAD, with only public production renderer configuration, completed authenticating-session verification. |
| Packaged Electron security | GO | Previous certification preserved `contextIsolation=true`, `nodeIntegration=false`, and `sandbox=true`. |
| Package signing | NOT_CONFIGURED | The authoritative installer and runtime test executable are `NotSigned`; no trusted code-signing certificate was found. |
| LiveKit client network | FAIL | DNS resolves, but TCP 443/7880/7881/5349 fail and HTTPS times out from the certification workstation. |
| VPS diagnosis | BLOCKED_NETWORK_REACHABILITY | A configured non-interactive SSH identity exists, but `23.254.166.240:22` times out. |
| TURN | BLOCKED_CONFIGURATION | Deployed configuration and client connectivity cannot be inspected without VPS reachability. |
| Test identities | GO | Seven distinct production Supabase Auth subjects were created as internal test users and excluded through the service-role-only platform statistics registry. |
| Authenticated session isolation | GO | Seven current packaged-desktop instances authenticated with distinct subjects in separate user-data roots; all local profiles and processes were cleaned up. |
| Hardware | GO_INVENTORY | Microphone-class and camera-class devices are present; actual publication remains gated by LiveKit network reachability. |
| Real media / OBS / chat / analytics / team runtime | BLOCKED_RUNTIME_PREREQUISITES | No external LiveKit signaling/RTC path is available. |
| Auth inbox | BLOCKED_VPS_ACCESS | An approved IMAP test mechanism exists, but its VPS dependency is unreachable; no email was sent. |

## Release verdict

- INTERNAL: **GO** for configuration-safe package/control-plane evidence with affected Live features off.
- CONTROLLED_BETA: **BLOCKED** until external WSS/API reachability and real client media tests pass.
- PUBLIC_BETA: **BLOCKED** until controlled-beta gates, chat/analytics/OBS, and provider gates pass.
- GA: **BLOCKED**; additionally requires a trusted signed current package.

## Evidence

`docs/audit/evidence/live-now-task38-runtime-provisioning-20260816T120423Z/`
