# Meeting Control Dock

The centered meeting dock exposes only controls backed by typed Picom services and current server-issued capabilities.

- Microphone and camera controls include device selection and report requested, active, loading, and error states.
- Screen sharing uses the validated Electron source-selection bridge before LiveKit publication.
- Noise Shield updates supported capture constraints and the active microphone track preference.
- Reactions and raised hands use authenticated meeting signal services.
- Lock and End for Everyone use an authenticated Supabase RPC. End requires the host, is destructive, and always requires confirmation.
- Layout, people, focus, and deafen remain available under More so existing behavior is preserved.

Recording, AI notes, breakout rooms, and fake controls are intentionally absent. Renderer capability checks guide the UI; token grants and the session-control RPC enforce access.
