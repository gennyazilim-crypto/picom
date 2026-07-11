# Meeting workspace shell

Task 543 adds Picom's desktop-contained meeting canvas as a lazy module. It is intentionally original: a compact identity/status top bar, dark token-driven media stage, optional right dock, and balanced bottom control dock.

The shell consumes only the canonical meeting store and service actions. It never receives Supabase or LiveKit clients. The stage and dock use `min-width: 0`, `min-height: 0`, internal overflow, and a `minmax(0,1fr)` grid so the workspace fills its Electron content region without creating page-level scroll or an empty right gutter.

Focus mode temporarily removes the right dock and tightens workspace chrome while preserving controls. Waiting, authorization, connecting, reconnecting, disconnected, ended, and fatal-error states have accessible, truthful surfaces. Captions, recording, and unavailable media controls are not shown before their dedicated production tasks.

`MeetingWorkspaceLazy` is the supported app integration boundary. The workspace and its CSS are emitted only when a caller opens the meeting route.
