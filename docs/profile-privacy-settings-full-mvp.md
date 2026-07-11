# Profile and Privacy Settings

Settings > Profile uses profileService for identity fields and the existing media editor/storage service for avatar and cover uploads. Successful profile edits update the shared App profile state, so the current profile card and full Profile page use the same values.

Settings > Privacy & Safety separates the following authoritative domains:

- profilePrivacyService owns profile audience and section visibility;
- directSafetyService owns who may start a direct conversation;
- userSafetyCenterService owns friend-request privacy plus local read-receipt and safety preferences;
- userBlockingService owns block/unblock state;
- Supabase RPC, RLS, and security-definer projections enforce production reads and writes.

## Profile projection

The profile audience can be everyone, shared communities, or friends. Independent controls cover online state, location, timezone, activity, media, communities and roles, friends, follow counts, and Radio/Podcast activity. The open current-user Profile page subscribes to privacy changes and updates immediately.

Visitors receive only the safe profile projection allowed by the selected audience. Activity and media still require a friend or shared-community relationship. Source-channel access is checked independently, so private-channel messages, attachments, communities, and audio activity cannot be disclosed by broad profile visibility.

## DM, friend requests, and blocking

The UI exposes one DM privacy selector backed by directSafetyService. The older local-only duplicate selector is removed. Friend-request privacy performs an optimistic service update but rolls back both UI and local cache when the Supabase write fails. Blocking refreshes from Supabase when Settings opens; unblock failures restore the prior local state.

Backend functions reject blocked relationships and enforce recipient DM/friend-request privacy. Components never call Supabase directly.

## External validation

Static contracts and mock mode verify service wiring, rollback, projection, and UI synchronization. Real cross-account visitor, shared-community, friend, blocked-user, private-channel, DM, and friend-request cases require the repository pgTAP suite against an isolated Supabase staging project.
