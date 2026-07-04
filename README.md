# Picom

Picom is a fresh premium desktop community chat app rebuild.

## Active task source

The active task pack is now:

- `docs/electron_mac_supabase_livekit_full_mvp_tasks_001_186_txt.zip`
- Extracted tasks: `docs/tasks-electron-supabase-livekit-mvp-001-186/`

The older 260-task packs remain as historical archive material only. New implementation work should follow the 001-186 Electron + Supabase + LiveKit MVP task sequence.

## Current MVP direction

- Runtime: Electron desktop app.
- Platforms: Windows, Linux, macOS.
- Frontend: React + TypeScript + Vite.
- Backend foundation: Supabase Auth, Postgres, RLS, Storage, Realtime, Edge Functions.
- Media foundation: LiveKit/WebRTC for voice and screen sharing.
- UI target: premium 4-column desktop community chat structure.
- Icon system: Coolicons Free icon set, attributed in `THIRD_PARTY_NOTICES.md`.

## Brand inputs

- App name: Picom
- Logo concept: `assets/brand/picom-logo-concept.png`
- Palette: `#007571`, `#10C2BB`, `#C24D0F`, `#FF772E`, `#752C05`
- UI references: provided desktop chat reference image, Orion preview assets, Material X reference where accessible.

## Hard exclusions

- No iOS or Android in this Electron MVP.
- No Discord branding, logos, copied assets, icons, or exact colors.
- No enterprise/plugin/bot marketplace work before the MVP is stable.

## Development

```bash
npm install
npm run dev
```

Open the local Vite URL and use a desktop viewport such as `1440x900`.

## Workflow

1. Follow one task file at a time from the active 001-186 pack.
2. Test after each task.
3. Commit stable checkpoints to Git.
4. If build/typecheck breaks, stop feature work and fix the blocker first.