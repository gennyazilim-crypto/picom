# Supabase Storage Lifecycle

## Bucket inventory

### Public identity assets

`profile-media` stores avatars and profile covers. `community-branding` stores community icons and banners. These are deliberate public identity surfaces and must never contain confidential content. Object listing is not granted; clients receive a known URL after an owner- or manager-authorized upload.

Paths are owner-scoped and UUID-based:

- `{userId}/avatar/{objectId}.{ext}`
- `{userId}/cover/{objectId}.{ext}`
- `{communityId}/icon/{objectId}.{ext}`
- `{communityId}/banner/{objectId}.{ext}`

### Private content buckets

- `message-attachments`: private Text-channel images; access follows message/channel RLS and scan state.
- `direct-message-attachments`: private DM images; access requires conversation participation.
- `audio-covers`: private Radio/Podcast artwork; access follows source/community visibility.
- `podcast-audio`: private episode audio; access follows episode visibility.

Private media is represented in database rows by storage path. Services resolve short-lived signed URLs after RLS-authorized metadata reads. Signed URLs are never treated as durable metadata.

## Validation and upload behavior

Bucket-level MIME and byte limits are reinforced by service validation and path policies. Services use sanitized or UUID object names, `upsert: false`, stage progress, abort checks, and replacement/failure cleanup. A retry is a new explicit service invocation with a new object UUID; Picom does not blindly retry unsafe uploads.

Text, DM, profile, branding, Radio, and Podcast services expose cancellation and/or explicit removal. If cancellation races with a completed Text upload, the uploaded object is deleted before returning `UPLOAD_CANCELED`.

## Orphan lifecycle

`list_storage_orphan_candidates` inventories objects older than the grace period that are not referenced by authoritative metadata. It is read-only and executable only by `service_role`. Renderer clients cannot call it.

The operator script defaults to dry-run. Apply mode requires both:

```powershell
$env:PICOM_CONFIRM_STORAGE_DELETE='DELETE_ORPHANS'
node scripts/cleanup-orphaned-uploads.mjs --apply
```

The server-only environment must provide `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The script reports counts and reasons, not object names or user content. Missing credentials are reported as `BLOCKED`; no deletion is attempted.

## Deletion rules

- Failed/canceled pending uploads are removed immediately where the client still has control.
- Replaced profile/community/audio media is removed after the new metadata succeeds.
- Podcast deletion removes private media before metadata deletion.
- Crashes and abandoned drafts are recovered by the delayed orphan sweep.
- The default 24-hour grace period protects in-flight uploads and eventual metadata commits.

Hosted cross-user and deletion validation requires an authorized staging project. Structural RLS tests remain available locally without exposing a service-role key.
