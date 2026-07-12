# Task 627 checkpoint: Social authentication audit and scope lock

Status: complete
Date: 2026-07-12
Baseline: `origin/main` at `b7d3b4f`

## Result

The prior Task 627 audit was refreshed against the current post-Task-628 implementation. Product source was not changed.

## Confirmed

- Electron 43.0.0, Supabase JS 2.110.0 and electron-builder 26.15.3.
- Supabase PKCE with URL auto-detection disabled.
- System-browser provider launch through a narrow Electron bridge.
- Exact `picom://auth/callback` parser and protocol registration.
- Cold/running callback paths for Windows/Linux plus macOS `open-url`.
- Protected pending-attempt/result lifecycle with expiry, replay rejection, pull and acknowledgement.
- Supabase session/PKCE persistence through OS `safeStorage`; memory-only fallback when secure storage is unavailable.
- Existing email/password, recovery, legal, onboarding, profile trigger and Feed landing remain in scope.

## Provider status

| Provider | Status |
| --- | --- |
| Email/password | READY_TO_IMPLEMENT |
| Google | CREDENTIAL_BLOCKED |
| Apple | CREDENTIAL_BLOCKED |
| Epic | APPROVAL_BLOCKED |
| Steam | ARCHITECTURE_BLOCKED |

No hosted provider dashboard, real provider login or packaged callback was claimed. No secret value was read, printed or added.

## Outputs

- `docs/social-auth-current-state-audit.md`
- `docs/social-auth-scope-lock.md`
- `docs/task-checkpoints/task-627-social_authentication_current_state_audit_and_scope_lock.md`

## Validation posture

- Documentation-only change.
- Existing OAuth foundation smoke is the targeted local contract.
- Complete auth/security/quality and real hosted matrices remain Tasks 640-641.

## Next task

Task 628 revalidates the already-present Electron PKCE, durable callback and secure-session foundation against this refreshed baseline and closes any verified gaps without creating a second auth stack.

## Commit

`docs audit Picom social authentication`
