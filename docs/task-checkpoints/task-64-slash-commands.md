# Task 64 - Slash Commands Foundation

- Added typed built-in command registry and compact composer suggestion popover.
- Added Up/Down selection, Enter apply, and Escape close keyboard behavior.
- Added `/help`, `/invite`, `/me`, `/shrug`, `/tableflip`, `/topic`, and `/poll`.
- `/invite` opens the existing permission-gated invite modal.
- `/topic` and `/poll` remain clean permission-aware placeholders.
- Unknown slash input remains normal message content.
- No bot/plugin command API or dynamic code execution was added.

Validation: `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
