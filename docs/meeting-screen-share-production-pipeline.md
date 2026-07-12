# Meeting Screen Share Production Pipeline

## Security boundary

Screen/window enumeration runs only in Electron main after a trusted, focused renderer sends an explicit user-initiated request. Payloads, source IDs, names, thumbnails, request lifetime, and source counts are bounded. Preload exposes three narrow methods: list, select, and cancel. Renderer code never receives `desktopCapturer`, Electron objects, or unrestricted IPC.

## End-to-end flow

1. User opens the source picker.
2. Main returns sanitized screen/window labels and bounded thumbnails.
3. The selected ID must belong to the still-valid main-process selection session.
4. Supabase atomically claims the room-level screen-share lease after authoritative `share_screen` permission and active-participant checks.
5. The existing LiveKit service captures the selected Electron desktop source and publishes it as `Track.Source.ScreenShare`.
6. Remote tracks render in Screen Share Focus; only one remote share publication is subscribed.
7. Stop, source-ended, permission failure, participant leave, disconnect, session end, component cancel, and unmount all clean local tracks and/or leases.

No captured screen media is recorded, stored, uploaded, or logged.

## System audio

System audio is disabled (`audio: false`) and no control is shown. Picom will expose it only after the exact Electron/Chromium/LiveKit combination is proven on each supported platform.

## Evidence limits

Static IPC, RLS, lifecycle, renderer, and build contracts run locally. Supabase CLI SQL execution, hosted LiveKit two-client publication, Wayland portal, macOS Screen Recording permission, and native Windows capture evidence remain **BLOCKED** until the required environments are available.
