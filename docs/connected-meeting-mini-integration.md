# Connected meeting mini integration

The MeetingDeepLinkGateway owns one active meeting session. Minimizing the Meeting Workspace unmounts only its presentation layer; `meetingService`, its store, and the existing LiveKit room remain active. Opening the same meeting restores that workspace, while a different meeting link is blocked until the current session is left so Picom cannot create duplicate provider rooms.

The global mini surface is lazy loaded and available over Feed, Profile, Direct Messages, and Community views. It identifies voice, camera, screen-sharing, and stage experiences; reports reconnect and terminal state; and exposes only controls authorized by the current meeting token and role. Microphone, deafen, camera, Noise Shield, screen-share return, and leave actions use the existing meeting control service.

The workspace minimize button and participant Profile/DM navigation preserve the call. Return reuses the exact room/session. Leave, terminal dismissal, and app `beforeunload` invoke the existing meeting cleanup path. While a meeting mini surface is active, the older Feed-only Connected Voice card is hidden to prevent duplicate controls.
