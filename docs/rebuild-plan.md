# Picom Rebuild Plan

## Active source of truth

Use the new active task pack:

- `docs/electron_mac_supabase_livekit_full_mvp_tasks_001_186_txt.zip`
- `docs/tasks-electron-supabase-livekit-mvp-001-186/`

The previous 260-task archives are kept for context only. Do not continue from the old post-260 direction.

## New MVP scope

Picom is now planned as an Electron desktop MVP for:

- Windows
- Linux
- macOS

Core foundations:

- Premium desktop chat UI from the provided reference direction.
- React + TypeScript + Vite renderer.
- Electron secure shell.
- Supabase Auth/Postgres/RLS/Storage/Realtime/Edge Functions.
- LiveKit/WebRTC for voice and screen sharing.
- Coolicons Free as the single approved icon system.
- Picom palette and logo.

## Execution rule

Work one task at a time:

1. Read the specific task file.
2. Implement only that task.
3. Run the required test/check for that task.
4. Commit the stable checkpoint.
5. Move to the next task only after the current one is stable.

## Immediate next step

Start with `task_001.txt`: read-only project audit and reset plan for the new Electron + Supabase + LiveKit MVP direction.