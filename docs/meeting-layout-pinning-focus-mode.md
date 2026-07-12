# Meeting layout, pinning, and focus mode

Picom exposes Auto, Grid, Speaker Focus, Screen Share Focus, and Stage only when each option is valid for the current room and active tracks. Auto follows screen sharing and stage-room experience. A manual choice remains authoritative until the user resets to Auto; an ended shared track is a critical invalid-state fallback and returns the preference to Auto.

Layout preference is stored in `sessionStorage` per meeting room. It is never synchronized to other participants. Participant and shared-track pins are local, and stale identifiers are cleared when the matching participant or track leaves.

Application focus mode applies a temporary body class that collapses ServerRail, CommunitySidebar, MemberSidebar, and the meeting right dock without entering operating-system fullscreen. Escape or the focus button exits, and cleanup restores the prior application layout without leaving the room.
