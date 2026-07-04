# Task Checkpoint: Electron Live Smoke

## Scope

Verified the Electron development startup path for the locked Full MVP without adding product features or redesigning the UI.

Out of scope for this checkpoint:

- Mention Feed
- Full Profile Page
- LiveKit renderer
- Supabase CLI installation
- UI redesign
- Mobile UI

## Finding

The intended Electron dev command is:

```bash
npm run dev
```

This delegates to:

```bash
npm run electron:dev
```

The previous command failed when port `5173` was already occupied. Electron waited for `http://127.0.0.1:5173`, while Vite could not start on that same port.

## Fix

Replaced the fixed-port `concurrently` dev command with a small Node launcher:

- builds Electron first through the existing script
- finds an available local Vite port starting at `5173`
- starts Vite on that port with `--strictPort`
- passes the matching `VITE_DEV_SERVER_URL` to Electron
- keeps the native Electron menu disabled through the existing main process configuration

This avoids killing an existing developer server and keeps the Electron app aligned with the actual renderer URL.

## Electron smoke result

`npm run dev` was run after the fix.

Observed behavior:

- The original `5173` conflict was avoided.
- The launcher selected `http://127.0.0.1:5174`.
- Vite and Electron processes were created for the Picom app.
- No startup compile error appeared before the observation timeout.

Limitations:

- The Codex shell command timed out because `npm run dev` is a long-running development command.
- Window interactions such as minimize, maximize, close, drag region, search click, and theme toggle still require a manual visual smoke pass in the desktop session.

## Manual smoke checklist

Run:

```bash
npm run dev
```

Then verify:

- Electron window opens.
- No native File/Edit/View/Window menu is visible.
- Custom Picom titlebar is visible.
- Minimize button works.
- Maximize/restore button works.
- Close button works.
- Titlebar drag area moves the window.
- Search button is clickable and does not drag the window.
- Theme toggle is clickable.
- Normal window mode keeps the premium floating frame.
- Maximized mode removes outer floating padding and rounded frame corners.
- Login screen appears safely when no session exists.
- Mock login with `owner@picom.local` / `PicomDev123!` enters the desktop shell.
- The 4-column community layout appears.
- Composer remains pinned.
- No renderer error overlay appears on startup.

## Commands run

```bash
npm run dev
npm run typecheck
npm run mock:smoke
npm run build
```

## Results

- `npm run typecheck`: passed
- `npm run mock:smoke`: passed
- `npm run build`: passed
- `npm run dev`: launcher started Electron after moving from occupied `5173` to `5174`; command observation timed out because dev mode stays running

## Remaining issues

- Supabase CLI is still not installed; this does not block Electron startup.
- Production build still reports the existing large chunk warning.
- Manual GUI verification is still needed for window controls and drag/click behavior.
