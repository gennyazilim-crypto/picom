# Task 290 - Block and mute UX polish

## Status

Implemented for desktop mock and Supabase modes.

## Delivered

- Existing block/unblock controls remain available from member/profile actions; Settings > Privacy & Safety lists and unblocks users.
- ServerRail community and channel context menus toggle persistent mute state.
- Privacy & Safety shows global notification mute plus named muted community/channel scopes with unmute actions.
- Mention Feed cards, stories and companion events exclude blocked authors and muted scopes immediately.
- Native notification routing continues to honor global, community and channel mutes.

## Moderation boundary

Block/mute preferences affect personal feed, direct interaction and notification presentation. They do not delete community messages, alter RLS, hide source content from authorized moderator queues, or remove audit/report evidence.

## Mock and Supabase behavior

- Block records persist locally in mock mode and synchronize through the existing protected Supabase block/unblock RPCs in Supabase mode.
- Community/channel mutes are device-local notification/feed preferences in both modes; no server-wide mute claim is made.
