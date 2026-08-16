# Task 35 blockers before Task 36

| Gate | Task 35 status | Task 36 action |
|---|---|---|
| Current packaged desktop | Installed package not attributable to canonical HEAD | Build via canonical official pipeline and seal its identity |
| Separate test identities | Unavailable | Inspect only approved internal provisioning path |
| Isolated client sessions | Unavailable | Inspect safe profile-launch capability |
| LiveKit client network | DNS only; TLS/443, TCP/7881, and TURN unavailable | Diagnose client/server configuration before any fix |
| Real mic/camera/screen share | Not certified | Re-test only after package, identities, sessions, and network are ready |
| OBS | Not installed | Inspect official package-manager availability |
| Chat / analytics / team runtime | Not run / partial | Re-test only with separate authenticated internal clients |
| Auth inbox | BLOCKED_RATE_LIMIT | Precheck only; no unbounded email retries |
| LiveKit Egress / media storage | Historical infrastructure and credential blockers | Explicitly out of scope and preserved |
