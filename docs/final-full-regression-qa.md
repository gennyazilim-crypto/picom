# Final Full Regression QA

Status date: 2026-07-10  
Overall result: **Not ready for stable release; local/static regression suite passed after two stale smoke assertions were corrected**

## Automated/local results

| Surface | Result | Evidence |
| --- | --- | --- |
| TypeScript and Electron/Vite production build | Passed | `npm run typecheck`, `npm run build` |
| Mock auth/community/channel/message paths | Passed | `npm run mock:smoke` |
| Consolidated desktop QA | Passed | `npm run qa:smoke` |
| Session/password-reset/email-verification contracts | Passed | Auth smoke scripts |
| Mention Feed comments, profile activity, follow persistence | Passed static contracts | Feature smoke scripts |
| Private channel and composer permission states | Passed | Permission smoke scripts |
| Emoji, verification, and Direct Messages | Passed | Feature smoke scripts |
| Diagnostics, log redaction, desktop-only, branding | Passed | QA and targeted smoke scripts |
| Voice device and screen-share preview/recovery contracts | Passed local/static | Voice/screen-share smoke scripts |
| Overlay focus/escape structure | Passed | `npm run overlay:stack:audit` |
| Desktop display structure | Passed static | Physical DPI/multi-monitor evidence still manual |

## Corrected QA regressions

- Composer permission smoke now checks the central `getComposerDisabledReason(access, channel)` boundary instead of the removed role lookup.
- Story Viewer focus-trap audit now inspects `StoryViewerModal`, where the modal and shared focus trap currently live.

No product UI or permission behavior changed.

## Manual or hosted matrix

| Flow | Result | Reason / next gate |
| --- | --- | --- |
| Electron packaged startup, custom titlebar, window controls | Skipped/blocked | Requires selected packaged candidate and interactive smoke |
| Register/login/logout/session restore against production-like Supabase | Skipped/blocked | Approved hosted project/fixtures unavailable |
| Hosted community/message/upload/private access | Skipped/blocked | Task 354 |
| Hosted Mention Feed/profile/DM isolation | Skipped/blocked | Task 354 and Task 361 |
| Two-window Supabase Realtime | Skipped/blocked | Approved hosted environment unavailable |
| Two-client LiveKit voice | Skipped/blocked | Task 355 |
| Windows/Linux/macOS screen sharing | Skipped/blocked | Task 356 |
| Windows/Linux/macOS install/uninstall | Skipped/blocked | Tasks 357-359 |

## Release blockers

The external/platform blockers in `docs/release-blockers.md` remain open. This QA result proves local structural and deterministic behavior only; it does not certify public stable distribution.
