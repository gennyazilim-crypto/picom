# Task 627 Checkpoint: Social Authentication Current-State Audit and Scope Lock

Status: complete
Date: 2026-07-12
Baseline: origin/main at c332730

## Objective

Audit the social-auth foundation and lock Tasks 628-641 without changing product code.

## Outputs

- docs/social-auth-current-state-audit.md
- docs/social-auth-scope-lock.md
- docs/task-checkpoints/task-627-social_authentication_current_state_audit_and_scope_lock.md

## Inspected

- Login, registration, recovery, legal acceptance, onboarding, and authenticated landing.
- Google/Apple UI, socialAuthService, Auth wrapper, Supabase client, profile trigger/backfill, local Auth config, and Edge Function inventory.
- Electron main, preload, IPC validation, single-instance, open-url, system browser, and builder protocol declaration.
- Deep-link parser, Settings connected accounts, and Epic/Steam POC documents.
- Locked dependency versions and current official provider/framework documentation.
- Current environment and GitHub secret-name access for presence only.

## Findings

| Area | Result |
| --- | --- |
| Supabase session authority | Retained |
| System browser | Implemented through validated IPC |
| PKCE | Enabled |
| Callback parser | Bounded and allowlisted |
| Native event paths | Present in source; not packaged-certified |
| Session persistence | Blocked because default renderer storage is used |
| Callback delivery | Blocked because it is event-only and unacknowledged |
| Google | ARCHITECTURE_BLOCKED; hosted config unverified |
| Apple | APPROVAL_BLOCKED; config/rotation ownership unverified |
| Epic | APPROVAL_BLOCKED; no verified provider contract |
| Steam | ARCHITECTURE_BLOCKED; public browser contract is OpenID 2.0 |
| Account linking | Partial; no recent-auth, unlink, or last-method control |
| Profile normalization | Inconsistent between trigger and social upsert |
| Real provider evidence | Absent |

## Hosted-state limits

- Current shell had none of the audited Supabase/provider variables.
- Repository files contain placeholders only; no secret was added or printed.
- GitHub returned HTTP 403 for repository secret names.
- Hosted Supabase/provider consoles were not verified.
- No real provider login or packaged callback was attempted.

## Validation

- The isolated task worktree was clean before edits.
- Changes are documentation-only.
- Official references match the locked runtime and current provider contracts.
- No app test/build was run because Task 627 is a read-only audit with no product modification. Task 628 owns implementation validation.

## Release decision

Social auth remains No-Go. Google/Apple remain disabled in release config. Epic/Steam remain unexposed. No success claim is authorized.

## Next task

Task 628: Electron PKCE/deep-link/secure-session foundation, including secure async storage, durable callback delivery, attempt lifecycle, replay protection, and packaged-platform test contracts.

## Commit

Intended message: docs audit Picom social authentication
