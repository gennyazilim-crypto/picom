# Creator Studio Security Center

## Capabilities
- Account device sessions via existing `user_device_sessions` / `list_current_user_device_sessions`
- Sanitized studio audit hub (`publisher_studio_audit_events`)
- Recent-auth helper `publisher_studio_require_recent_auth` (JWT `iat` when present)

## Partial provider capability
ACTIVE SESSION ENUMERATION: PARTIAL_AUTH_PROVIDER_CAPABILITY  
(PICOM device metadata + Auth `signOut({scope:'others'})`; not a fabricated risk score or full GoTrue dump)

MFA GO is not claimed.
