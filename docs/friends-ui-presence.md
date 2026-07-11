# Friends UI, suggestions, and presence

The desktop Friends route now exposes controlled All, Online, Pending, Suggestions, and Blocked sections. DM shortcuts open All or Pending directly, while counts come from the canonical friend service state.

## Presence

Presence uses the RLS-protected `friend_presence` table and service RPCs. The renderer sends a minimal heartbeat, refreshes it every 45 seconds, marks the session offline during cleanup, and subscribes only to accepted friend rows. A stale or hidden heartbeat resolves to Offline.

Only fixed safe labels are returned: Online, Idle, Busy, and Offline. Custom profile status text is not published. Presence is represented by a small bottom-right status dot; verification remains a separate name-adjacent badge and never shares the presence visual.

The local `showOnlineStatus` preference controls whether the current user shares presence. Backend RLS still restricts visible rows to the user or an accepted friend.

## Suggestions

Supabase suggestions require at least one shared community and use an existing Follow edge as an ordering signal. The RPC excludes self, blocked/privacy-denied users, existing friends, and either-direction pending requests. It returns only profile identity, shared-community count, and the Follow signal; it does not expose private community names.

Mock suggestions use the same fields and are filtered again in the service against local friends, pending requests, and blocks.

## Validation boundary

Static smoke, TypeScript, build, and RLS contracts run without credentials. Real cross-client presence timing and Realtime delivery require two authenticated Supabase sessions and remain BLOCKED when an isolated hosted/local Supabase test environment is unavailable.
