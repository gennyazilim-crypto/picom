# Windows Trusted Signing and Clean-Machine Release Test

Status date: 2026-07-10  
Execution status: **BLOCKED**

No trusted code-signing certificate or protected signing environment was available. No stable source/version was frozen, no signed installer was produced, and no clean Windows 10/11 machine or VM tested the exact bytes.

| Real Windows release evidence | Result |
| --- | --- |
| Trusted signature/publisher/timestamp | BLOCKED |
| SHA-256 after signing | BLOCKED |
| Clean-machine install and first launch | BLOCKED |
| Auth/feed/profile/community/message/upload/DM | BLOCKED |
| Voice and screen share | BLOCKED |
| Restart/settings persistence | BLOCKED |
| Uninstall/retention/reinstall | BLOCKED |
| Window controls/native menu/startup | BLOCKED on signed RC |

The existing unsigned beta candidate is excluded. Signing workflow smoke and packaging configuration are not a trusted signature or SmartScreen result. No certificate, key, password, or private publisher material was accessed.

RB-06 remains open. Recommendation: **Not ready**.
