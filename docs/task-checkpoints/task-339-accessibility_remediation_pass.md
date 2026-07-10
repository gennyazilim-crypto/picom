# Task 339 - Accessibility remediation pass

Status: structural remediation completed; manual platform assistive-technology certification remains pending.

## Delivered

- Hardened the shared focus trap for topmost dialogs, meaningful initial focus, out-of-dialog Tab recovery and focus restoration.
- Applied the shared trap to create/edit/delete channel, create community, invite, poll, Developer Portal, story viewer, member moderation, reporting and feedback modals.
- Preserved guarded closing while report/poll operations are busy.
- Added key dialog descriptions, programmatic focus fallbacks and announced creation validation errors.
- Confirmed `AppIcon` decorative/screen-reader behavior and existing focus/high-contrast token paths through a structural smoke test.
- Added a desktop-only keyboard, Narrator, Orca, VoiceOver and contrast checklist without making a conformance claim.

## Validation

- `npm run accessibility:remediation:test`
- `npm run accessibility:display:smoke`
- `npm run accessibility:external-audit:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining work

- Execute and record manual Windows Narrator, Linux Orca and macOS VoiceOver testing on a release candidate.
- Measure token contrast against the standard/version approved by Product/Legal.
- Commission the independent audit described in `docs/accessibility-external-audit.md`; this task does not claim certification.

