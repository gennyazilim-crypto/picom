# Execution Rules

Picom uses a strict one-task-at-a-time workflow for the Electron + Supabase + LiveKit MVP.

## Core rule

Do exactly one task file at a time.

For each task:

1. Read the active task file from `docs/tasks-electron-supabase-livekit-all-old-new-001-473/`.
2. Implement only the smallest safe slice required by that task.
3. Do not refactor unrelated working code.
4. Do not add post-MVP roadmap features unless the current Full MVP task explicitly requires them.
5. Run the smallest relevant check for the task.
6. List changed files and test steps.
7. Commit the completed task before moving to the next task.

## Product constraints

- Picom is an Electron desktop app for Windows, Linux, and macOS.
- The project is locked to the Full MVP scope.
- No mobile UI.
- No web-first responsive layout.
- No Discord branding, logos, copied assets, icons, or exact colors.
- Coolicons Free is the approved icon system.
- Picom palette remains the brand palette.
- The desktop UI must keep the premium 4-column community chat structure.

## Technical direction

- Frontend: React + TypeScript + Vite inside Electron.
- Backend MVP: Supabase Auth, Postgres, RLS, Storage, Realtime, and Edge Functions.
- Voice and screen sharing MVP: LiveKit/WebRTC.
- Native desktop APIs must be accessed through service abstractions, not directly from React components.

## Full MVP boundaries

Included Full MVP areas:

- Electron shell, premium desktop UI, Supabase backend, auth, communities/channels, messaging, attachments, emoji/reactions/replies, Mention Feed, Full Profile Page, LiveKit voice, screen share, settings, and QA/build.

Excluded post-MVP areas:

- Bot marketplace, webhook production system, plugin runtime, enterprise admin console, SSO, SCIM, billing, public discovery marketplace, production auto-update, E2EE production, advanced analytics, and mobile app.

## Safety rules

- Never run `git reset --hard` or destructive cleanup without explicit user approval.
- If a task would delete large parts of the project, stop and ask before doing it.
- If typecheck/build breaks, stop new feature work and fix the blocker first.
- If a dependency or native API is unavailable, add a safe placeholder and document the gap.

## Commit format

Use task-scoped commit messages, for example:

```text
task-002 Execution rules one task at a time test and commit
```
