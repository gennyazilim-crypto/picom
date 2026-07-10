# Task 107 checkpoint: Security penetration test plan

## Delivered

- Authorized staging-only rules of engagement, identity matrix, stop criteria, evidence/redaction, severity, and exit gates.
- Critical manual tests for auth/session, Supabase RLS, visitor mode, private-channel leakage, Storage, XSS/message rendering, external/deep links, Electron IPC, LiveKit token Function/rooms, webhook/bot abuse, and bounded rate limits.
- Explicit release blockers and finding/retest template.

## Safety boundary

- No live test, exploit, scanner, provider mutation, malware execution, denial of service, or production/user-data access occurred.
- Actual penetration testing requires written authorization and an isolated staging environment.

## Validation

- Documentation-only task.
- `npm run typecheck`
- `npm run mock:smoke`
