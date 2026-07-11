# Meeting voice lounge

Camera-off Picom meetings use an audio-first lounge instead of empty video
tiles. The lounge consumes the canonical meeting client snapshot and keeps
participant identity, approved verification, meeting/community roles,
microphone state, speaking activity, raised hands, connection quality, and the
local Noise Shield state distinct.

Small, medium, and large density grids preserve readable identity and state at
desktop widths. Selecting an avatar/name focuses that participant; right-click
or the More control opens the bounded desktop context menu. The People action
opens the existing meeting right dock.

The lounge does not create media tracks and does not infer verification from a
name, role, or avatar. Approved verification originates from the reconciled
participant authority record. When camera or screen-share media is active, the
existing media stage remains responsible for presentation.
