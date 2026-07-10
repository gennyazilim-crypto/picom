# Task 242 checkpoint: keyboard shortcuts customization final

- Replaced the static shortcut list with typed local bindings used by both Settings and the global renderer listener.
- Added conflict detection, OS/runtime-reserved shortcut rejection, editable-target protection, persistence, and reset defaults.
- Kept `Escape` fixed as the reliable overlay close path and did not register global OS-level shortcuts.
- Added desktop settings editing UI, documentation, and a focused smoke contract.

Validation: `npm run shortcuts:customization:smoke`, `npm run typecheck`, `npm run mock:smoke`, `npm run build`.
