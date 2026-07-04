# Development Workflow

Picom development follows a task-by-task workflow to keep the desktop app stable and recoverable.

## Core rule

Work on exactly one task at a time from the active task pack:

`docs/tasks-electron-supabase-livekit-all-old-new-001-473/`

Each task should be completed, minimally verified, and committed before moving to the next task.

## Standard task loop

1. Read the current task file.
2. Identify the smallest safe implementation slice.
3. Avoid unrelated refactors.
4. Make scoped changes only.
5. Run the smallest relevant verification.
6. Commit with the task number in the message.
7. Continue to the next task.

## Verification levels

Use the smallest relevant check:

- Documentation-only task: confirm files exist and content is scoped.
- TypeScript/runtime task: run `npm run typecheck`.
- Build-sensitive task: run `npm run build` when the task affects build output.
- Electron task: run the Electron dev/build command once those scripts exist.
- UI task: use manual desktop smoke testing at 1440x900 after implementation.

## Commit discipline

Commit every completed task separately.

Example:

```powershell
git add <changed-files>
git commit -m "task-016 Electron Vite React foundation"
```

## Desktop UI constraints

All UI work must preserve:

- Windows/Linux/macOS desktop direction
- no mobile UI
- no web-first responsive layout
- no Discord branding/assets/exact colors
- Coolicons Free icon direction
- Picom palette and design tokens
- fixed desktop shell with independent chat scrolling

## Native API constraints

- React components must not call Electron native APIs directly.
- Use preload and typed service wrappers.
- Keep `contextIsolation` enabled.
- Keep `nodeIntegration` disabled unless a future task documents otherwise.

## Backend constraints

- Supabase is the MVP backend direction.
- Client access must respect RLS.
- Secrets must not be committed.
- Privileged actions must use server-side functions or equivalent controlled execution.

## Voice constraints

- LiveKit/WebRTC is the MVP voice direction.
- Token generation is server-side.
- No LiveKit secrets in renderer or committed files.

## Recovery rule

If a task creates a blocker, stop expanding scope. Fix only the blocker or revert the scoped task commit if needed. Do not continue adding features on top of an unstable state.