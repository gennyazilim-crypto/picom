# Windows Signed Build and Clean-Machine Matrix

Status date: 2026-07-10  
Result: **Not ready - trusted signature and clean-machine evidence missing**

## Completed controls

- Electron packaging configuration passed.
- Signing workflow contract passed and fails closed for production verification.
- Local unsigned NSIS remains clearly classified as internal/beta only.
- First-launch persistence and installer branding contracts passed.
- No certificate, private key, password, publisher credential, or timestamp credential was loaded or committed.

## Artifact status

The existing `Picom-0.1.1-beta.1-beta-Windows-x64.exe` is an unsigned local candidate. It is not immutable stable output and must not be distributed as signed or trusted.

| Check | Result |
| --- | --- |
| Trusted Authenticode signature | Blocked: certificate unavailable |
| Publisher and timestamp verification | Blocked |
| SHA-256 after signing | Blocked: no signed artifact |
| Windows 10 clean-machine install | Blocked |
| Windows 11 clean-machine install | Blocked |
| Launch and included V1 Core flows, including Voice/Screen Share | Blocked on trusted clean candidate |
| Uninstall/reinstall/data retention | Blocked on clean candidate |

## Required completion

Build from the frozen stable commit in protected CI, sign installer and binaries using managed credentials, verify Authenticode and timestamp, then generate the checksum. Run the full install/launch/core-flow/restart/uninstall/reinstall matrix on clean Windows 10/11 machines or VMs. Preserve only redacted evidence.

## Recommendation

**Not ready.** RB-06 remains open. The unsigned candidate cannot be relabeled stable.
