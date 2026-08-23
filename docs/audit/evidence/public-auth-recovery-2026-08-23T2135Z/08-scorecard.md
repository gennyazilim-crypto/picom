```text
VPS: PASS
PUBLIC IP: PASS
NETWORK INTERFACE: PASS
DEFAULT ROUTE: PASS
PROVIDER FIREWALL: PASS
HOST FIREWALL: PASS
DNS picom.gg: PASS
DNS account.picom.gg: PASS
DNS auth.picom.gg: PASS
TCP 80: PASS
TCP 443: PASS
TLS: PASS
NGINX/REVERSE PROXY: PASS
PICOM.GG: PASS
ACCOUNT.PICOM.GG: BLOCKED
AUTH.PICOM.GG: PASS
AUTH HEALTH: PASS
EMAIL LOGIN: BLOCKED
REGISTER: BLOCKED
PASSWORD RESET: BLOCKED
GOOGLE: BLOCKED
EPIC: FAIL
STEAM: BLOCKED
ELECTRON DEEP LINK: BLOCKED
SESSION CREATION: BLOCKED
SESSION RESTORE: BLOCKED
PROFILE PROVISIONING: BLOCKED
ACCOUNT LINKING: BLOCKED
RLS: BLOCKED
SECURITY: BLOCKED
PACKAGED WINDOWS: BLOCKED
TESTS: FAIL
```

ACCOUNT.PICOM.GG is BLOCKED because UI/TLS respond but account operations (login, reset completion) were not executed with real credentials.

GOOGLE/STEAM are BLOCKED (routes reachable; no real identity completed).

EPIC is FAIL because `epic-auth` is absent (404) and Epic Edge secrets are missing.

TESTS is FAIL because `secrets:smoke` failed; applicable auth unit/contract tests passed.

SECURITY is BLOCKED because the production Windows bundle was not scanned this run.
