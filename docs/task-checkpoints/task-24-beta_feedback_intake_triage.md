# Task 24 Checkpoint: Beta Feedback Intake and Triage

## Scope

- Added beta feedback intake, severity, privacy, and escalation guidance.
- Added a manual beta triage board template.
- Expanded the existing in-app feedback modal instead of creating a duplicate support flow.
- Preserved explicit opt-in for redacted diagnostics and logs.
- Linked the known-issues document to the intake and triage workflow.

## Safety

- No automatic report submission or production support integration was added.
- Passwords, tokens, service-role keys, LiveKit secrets, cookies, and authorization headers remain excluded.
- Electron chrome, community/chat UI, Supabase behavior, and LiveKit behavior were not changed.

## Validation commands

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining operational work

- Select the approved beta support channel and assign human triage owners.
- Populate the board only with redacted report references.
- Validate reports on native Linux/macOS beta hosts when those platforms are available.
