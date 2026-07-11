# Adaptive meeting video grid

Picom uses deterministic grid rules for one, two, three-to-four, five-to-six,
seven-to-nine, and ten-to-twelve visible participants. Rooms larger than 12
paginate rather than shrinking tiles below a readable desktop size. Participant
IDs remain the stable tie-breaker while focus, active speaking, local self-view,
and published cameras receive explicit priority.

Camera streams are exposed by the voice transport through the meeting adapter
and client store. Camera-off or not-yet-subscribed participants render an avatar
surface, never a black rectangle. Video elements detach on page/unmount without
stopping provider-owned tracks.

The visible page supplies a typed subscription plan. Remote camera publications
outside that page are unsubscribed; focused/small layouts request high quality,
active speakers/medium layouts request medium quality, and dense layouts request
low quality. LiveKit adaptive stream and dynacast remain enabled. The UI never
calls LiveKit directly.
