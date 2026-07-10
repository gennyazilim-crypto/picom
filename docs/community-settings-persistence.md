# Community settings persistence

The Community Admin Panel persists name, description, HTTPS icon placeholder, visibility, and public-read policy through `communityService.updateCommunitySettings`. The UI never calls Supabase directly and updates App state only after the service returns the authoritative row.

`update_community_settings` allows the owner or an admin role at level 80+, validates all fields, forces public read off for private communities, updates `updated_at`, and appends a redacted `community_update` audit entry. Frontend section visibility is convenience only; the security-definer RPC is the authorization boundary.

Name is required and limited to 80 characters, description to 500, and icon URLs to HTTPS with a 2048-character cap. Icon upload/storage remains a placeholder; no new upload feature is introduced.

Hosted permission and RLS behavior must be checked after applying the migration. No hosted result is claimed by the static repository test.
