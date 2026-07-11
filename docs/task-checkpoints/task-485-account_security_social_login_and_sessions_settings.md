# Task 485 - Account Security, Social Login, and Sessions Settings

Date: 2026-07-11

## Outcome

Settings > Account now exposes the authenticated identity and verified-email state, truthful Google/Apple availability and linked identity state, password reset, current-password re-authenticated password change, active sessions, confirmed session revocation, confirmed logout, data export, and re-authenticated account deletion.

## Fixes and safeguards

- Removed the successful-session-refresh recursion that repeatedly called the session API.
- Fixed the data-export button so it invokes the export request.
- Password changes require the current password, 12-character new password confirmation, and global Supabase sign-out.
- Google/Apple connection uses the service layer and Supabase linkIdentity only when the corresponding provider flag is enabled.
- Browser launch is reported as pending completion, never as a completed provider link.
- Provider, password, session, export, and deletion UI never renders tokens.
- Session revoke and logout require explicit confirmation.
- Password change, session revoke, logout, and deletion request actions create redacted local activity records; existing Supabase security RPC/Edge paths retain authoritative audit events.
- Out-of-scope fake 2FA controls were removed from the Account acceptance path.

## Validation

- npm run settings:account-security:smoke: PASS
- npm run auth:password-reset:production:test: PASS
- npm run auth:email-verification:production:test: PASS
- npm run auth:sessions:production:test: PASS
- npm run privacy:data-export:real:test: PASS
- npm run privacy:account-deletion:real:test: PASS
- npm run secrets:smoke: PASS
- npm run typecheck: PASS
- npm run mock:smoke: PASS
- npm run build: PASS
- npm run qa:smoke: PASS
- npm run performance:budget:ci: PASS hard caps

Renderer warnings remain below hard caps: initial JS 1583.1 KiB, initial CSS 229.8 KiB, and total assets 3091.7 KiB. The existing voiceService static/dynamic import warning is unrelated.

## Manual and external evidence

- Static and mock contracts confirm that disabled providers remain visibly unavailable and cannot start OAuth.
- Account controls are wired through services rather than direct Supabase component calls.
- Live Google/Apple browser return, SMTP delivery, multi-device revocation, and real hosted export/deletion execution are BLOCKED because protected provider credentials and a configured hosted staging environment are unavailable.
- No live-provider, cross-device, or destructive hosted success is claimed. These flows must be exercised with dedicated staging accounts before stable release.
