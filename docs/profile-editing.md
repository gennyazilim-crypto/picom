# Profile Editing

Task 471 completes the desktop profile editing and media-storage path.

## Current behavior

- Settings > Profile edits username, display name, presence, status text, bio, location, timezone, preferred language, and tags.
- Text changes update optimistically and roll back if the profile service rejects validation, ownership, or username uniqueness.
- Avatar and cover controls validate MIME, file content, dimensions, and size before upload, show progress, retain failed selections for retry, support removal, and clean up replaced objects.
- Mock mode persists profile fields locally. Supabase mode uses `update_own_profile_domain`; components never call Supabase directly.
- Profile changes update the active member card and current full-profile view through the existing app profile settings state.
- The camera and Edit Profile controls appear only for the current user and open Settings > Profile.

## Boundaries

## Storage and ownership

- Bucket: `profile-media`.
- Paths: `<auth.uid()>/avatar/<uuid>.<ext>` and `<auth.uid()>/cover/<uuid>.<ext>`.
- Accepted types: PNG, JPEG, WEBP.
- Avatar limit: 5 MB and at least 128 x 128.
- Cover limit: 8 MB and at least 640 x 200.
- Storage insert/update/delete policies require the authenticated user's UUID path. Profile updates remain owner-only through the authenticated RPC.
- The bucket is public-read because avatar and cover identity surfaces are public after profile privacy projection; object listing and all writes remain RLS controlled.

## Remaining hosted evidence

- Apply migrations to an isolated Supabase staging project and execute owner/non-owner upload, replace, and delete probes.
- Verify multi-client profile propagation through hosted Realtime after staging credentials are available.
- Profile text abuse/moderation review remains a separate trust-and-safety concern.

## Manual test steps

1. Run `npm run dev`.
2. Open Settings.
3. Go to Profile.
4. Change each profile field and save.
5. Select a valid avatar and cover, inspect previews, and upload.
6. Select an invalid or undersized image and confirm the actionable validation error.
7. Retry a failed upload and remove an uploaded image.
8. Confirm UserMiniCard and the current user's full profile update.
9. Open another user's profile and confirm edit/camera controls are absent.
10. Open Privacy & Safety from the profile editor and verify visibility controls remain functional.
