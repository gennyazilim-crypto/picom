# Meeting Right Dock

The meeting dock presents one mutually exclusive panel at a time:

- **People** groups authoritative participants by host, speaker, participant, and viewer roles; includes search, waiting-room decisions, focus, and permitted stage role actions.
- **Chat** resolves the durable linked Picom meeting context, uses the existing message service, marks read state, and refreshes from Supabase Realtime with a bounded polling fallback.
- **Captions** remains hidden until Task 567 configures an approved consent-capable provider and the user has permission.
- **Info** shows room, community, host, live/schedule state, join policy, role, capabilities, status, and a copyable Picom meeting link.

The selected panel is stored locally per session. At medium desktop widths the dock becomes a closable overlay instead of shrinking the stage below a usable width.
