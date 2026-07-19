# Profile Media Realtime Flow

1. The editor processes and uploads main plus thumbnail objects.
2. commit_profile_media_v1 increments the relevant media version on profiles.
3. Supabase emits one profiles UPDATE event.
4. profileMediaRealtimeService invalidates that user in the normalized store.
5. profileMediaResolver fetches the current metadata and fresh signed URLs.
6. useProfileMedia notifies all mounted UserAvatar and ProfileCover instances for that user.

The Realtime channel registers postgres_changes before subscribe, avoiding the Supabase callback-after-subscribe renderer crash class. Only one channel instance is active. It is removed on sign-out and tracked users are refreshed after SUBSCRIBED, covering reconnect and sleep/wake recovery.

Stale events cannot replace a higher avatar or cover version. Signed URL refreshes do not alter the canonical path or database version.
