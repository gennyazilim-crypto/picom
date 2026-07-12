# Task 559 checkpoint - Meeting layout selection, pinning, and focus mode

- Added an accessible context-valid layout menu for Auto, Grid, Speaker Focus, Screen Share Focus, and Stage.
- Added session-local manual preference persistence and deterministic Auto resolution.
- Preserved manual overrides while enforcing critical fallback after a pinned/shared track ends.
- Added participant and share pin/unpin behavior with stale target cleanup.
- Expanded meeting focus mode to temporarily collapse Picom's outer rails and restore them on exit or unmount.
- Added Escape handling, menu arrow-key navigation, ARIA state, and visible focus behavior.

Electron operating-system fullscreen was intentionally not added; Picom application focus mode satisfies this MVP scope without expanding preload permissions.
