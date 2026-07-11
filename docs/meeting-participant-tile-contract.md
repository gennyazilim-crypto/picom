# Meeting Participant Tile Contract

`MeetingParticipantTile` is the shared identity and media surface for Grid, Speaker Focus, Filmstrip, Voice Lounge, Stage, and Screen Share participant lists.

## State separation

- Approved verification is rendered beside the display name. It never implies a meeting role.
- Presence uses a small status dot. Speaking uses a restrained Picom teal border.
- Focus and selection use neutral focus/active tokens rather than verification or presence colors.
- Meeting role, microphone, camera, raised hand, screen sharing, and connection quality remain visible independently.
- Provider identities, track identifiers, and room SIDs are never rendered.

## Variants

- `grid` and `stage` use a full media tile.
- `focus` fills the speaker stage.
- `filmstrip` is compact but keeps critical microphone state.
- `voice` emphasizes avatar identity while retaining media and connection state.
- `share` is a compact participant row beside shared content.

All interactive media regions are keyboard accessible, state is announced without relying on color, and motion is removed under `prefers-reduced-motion`.
