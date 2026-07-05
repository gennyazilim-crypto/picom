# Beta Bug Triage Workflow

This workflow is used during Picom beta testing for the Windows, Linux, and macOS Electron desktop app.

## Goals

- Keep beta feedback actionable.
- Separate blockers from acceptable beta limitations.
- Protect user secrets and private data.
- Preserve the current premium desktop UI direction while fixing reliability issues.

## Intake sources

- Settings > Advanced feedback placeholder
- Exported diagnostics JSON
- Screenshots or screen recordings from testers
- Platform smoke-test checklists
- Manual issue reports from beta testers

Do not ask testers to share passwords, auth tokens, Supabase service-role keys, LiveKit secrets, signing keys, cookies, or authorization headers.

## Categories

- `crash`: app crashes, startup error boundary, renderer exception
- `startup`: app does not open, white screen, session restore issue
- `auth`: login, register, logout, session restore
- `community`: community list, create/switch community
- `channel`: channel list, create/switch channel
- `message`: send, edit, delete, realtime duplication, optimistic state
- `attachment`: upload, preview, validation, image modal
- `realtime`: Supabase realtime, typing, presence, two-window sync
- `voice`: LiveKit join/leave, mute/deafen, participants
- `screen-share`: source picker, start/stop, platform permissions
- `ui`: layout, theme, overflow, modal, context menu, profile popover
- `packaging`: installer/package, icon, desktop entry, app launch
- `performance`: startup, message list, memory growth, large bundle
- `security`: RLS, permission leak, secret exposure, unsafe native bridge
- `documentation`: setup instructions, beta notes, known issues

## Severity levels

### Blocker

Must be fixed before beta distribution or promotion.

Examples:

- App does not start.
- Login/register is unusable in the target beta mode.
- Message sending is broken.
- Private data or secrets are exposed.
- Installer/package cannot launch on a target platform.

### Critical

Must be fixed before wider beta.

Examples:

- Frequent renderer crashes.
- Realtime creates duplicate messages.
- Attachment upload accepts unsafe file types.
- Native bridge exposes unsafe APIs.
- Severe layout break at `1440x900` or minimum `1100x700`.

### Major

Acceptable only for limited beta with a documented workaround.

Examples:

- Platform-specific packaging workaround required.
- LiveKit permission flow needs manual OS steps.
- Supabase CLI missing locally.
- A non-core modal has a visual bug.

### Minor

Can ship in beta notes if tracked.

Examples:

- Copy polish.
- Non-blocking chunk-size warning.
- Cosmetic spacing issue that does not break layout.

### Suggestion

Product idea or post-MVP improvement.

Examples:

- Bot/plugin request.
- Public discovery marketplace idea.
- Advanced analytics request.
- Mobile support request.

## Required triage fields

- Issue title
- Category
- Severity
- Platform: Windows, Linux, or macOS
- App version and release channel
- Mode: mock or Supabase
- Supabase project: beta placeholder name only, never secrets
- Steps to reproduce
- Expected result
- Actual result
- Frequency: once, intermittent, always
- Attachments: screenshot, recording, exported diagnostics if safe
- Workaround
- Owner placeholder
- Decision: accept, fix now, fix before beta, postpone, duplicate

## Triage steps

1. Confirm the report contains platform, mode, version/channel, and repro steps.
2. Check `docs/known-issues.md` for duplicates.
3. Reproduce in mock mode if the issue is UI/local-state related.
4. Reproduce in Supabase mode if the issue depends on backend/realtime/auth/storage.
5. Classify severity using the definitions above.
6. If secrets are present in the report, delete/redact the unsafe material before sharing internally.
7. Add or update the issue in the known issues list if it affects beta testers.
8. Decide whether it blocks beta, wider beta, or stable release.
9. Assign owner placeholder and next action.
10. Verify the fix with the smallest relevant test before closing.

## Release blocker criteria

An issue blocks beta if it affects any of these:

- App startup
- Login/register/session restore
- Core desktop layout at `1440x900` or minimum `1100x700`
- Community/channel switching
- Message sending
- Secret exposure
- RLS/private-channel data isolation
- Native bridge safety
- Target platform package launch

## Diagnostics handling

- Prefer diagnostics exported through the Settings > Advanced placeholder.
- Logs must remain redacted by `loggingService`.
- Developer diagnostics can include stack traces only when redacted.
- User-facing summaries should remain short and non-technical.

## Duplicate handling

- Link duplicates to the oldest active known issue.
- Keep platform-specific duplicates if the root cause may differ.
- Close duplicates only after the original issue has a clear owner and reproduction path.

## Closure checklist

- Reproduced or explained why reproduction is not possible.
- Severity assigned.
- Fix or workaround documented.
- Relevant test/build command run.
- Known issues updated if tester-visible.
- Release notes updated if it affects beta testers.
