# Codex Tasks 001–260 Pack

Generated: 2026-07-04T09:49:09

This ZIP contains a reconstructed task pack for the Windows/Linux desktop community chat app.

## Contents

- `TASKS_INDEX.md` — task list and summaries.
- `ALL_TASKS_001_260.md` — all tasks in one Markdown file.
- `tasks_individual/` — one file per task.
- `tasks_grouped/` — grouped Markdown files in 20-task chunks.
- `tasks.json` — machine-readable task list.
- `tasks.csv` — spreadsheet-friendly task index.

## Important

Task 260 is:

**Final Production Launch Audit**

This pack is intended as a reference and recovery/rebuild aid. Do not ask Codex to run all 260 tasks in one pass.

## Safe usage order

1. Zip/commit the current project.
2. Run a read-only audit first.
3. Restore/rebuild only the missing parts.
4. Commit after every small task.
5. Run build/typecheck after each major block.

## Core guardrails

- Windows/Linux desktop-only.
- No mobile UI.
- No Discord branding, logos, copied assets, or exact colors.
- Coolicons may be used only with proper attribution.
- Keep existing working code unless the task explicitly targets it.
