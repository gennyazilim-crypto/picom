# User Data Export Production Workflow

## Status

Picom has a hardened user-triggered JSON export path. Mock mode generates from safe local state. Supabase mode invokes an authenticated Edge Function that queries every server section under the requesting user's RLS context. Large-account asynchronous archival remains a staged follow-up.

## User flow

1. User opens Settings > Account or Privacy & Safety.
2. User selects **Request data export**.
3. Picom shows processing state and invokes `user-data-export` in Supabase mode.
4. Edge Function creates a user-owned request metadata row.
5. Server sections are queried through the authenticated user client.
6. Edge Function returns a bounded JSON payload and marks request ready.
7. Renderer merges safe local desktop settings in memory.
8. User explicitly downloads the JSON file.

The payload is not persisted in `data_export_requests`; only job ID/status/timestamps/format/failure code are stored. Renderer localStorage stores only request metadata, not exported messages or settings. Reloading requires a fresh export.

## Included data

### Profile

- User ID, username, display name.
- Avatar URL, status/status text, bio, accent color.
- Onboarding-completed state and account timestamps.

No auth identity internals, password hash, provider token, or session is selected.

### Community memberships

- Membership ID.
- Community ID.
- Role ID.
- Joined timestamp.

No other member profile, role permission JSON, invite, ban, audit, or private community content is included.

### Local desktop settings

- Schema version.
- Theme.
- Notification/quiet-hours preferences.
- Profile draft settings.
- Accessibility settings.

These settings are merged by the renderer from `settingsService`; they are not sent to the Edge Function or stored in the export request row.

### Own messages

- Only messages with `author_id = auth.uid()` that remain selectable under message RLS.
- ID, community/channel IDs, body, client message ID, created/edited/deleted timestamps, and webhook ID marker.

Messages from inaccessible channels are not returned even if authored earlier. Other users' messages, reactions, reads, and private content are excluded.

### Attachment metadata

- Only rows with `uploader_id = auth.uid()` and existing attachment RLS.
- ID, message ID, file name, MIME type, size, attachment type, dimensions, status, created timestamp.

Raw storage paths, signed/public URLs, file bytes, scanner internals, and other users' attachments are excluded.

### Follows

- Relationships where the user is the follower: relationship ID, followed profile ID, timestamp.
- No followed user's private profile fields are exported.

### Saved messages

- User-owned saved record ID, message ID, and timestamp.
- Referenced message body is not duplicated through this section; current message visibility remains authoritative.

## Explicit exclusions

- Password and password hashes.
- Access, refresh, session, bot, webhook, invite, email, and LiveKit tokens.
- Cookies and raw authorization headers.
- Supabase service-role, signing, updater, storage, email, and provider keys.
- Other users' private/profile/message/attachment data.
- Raw storage paths and file bytes.
- Audit/security logs, abuse metadata, raw IPs, and internal moderation notes.
- Full environment/configuration dumps.

## RLS and service-role boundary

`requireSupabaseUser()` validates the caller. All exported sections use the user-scoped Supabase client, so normal RLS applies. A separate service-role client is used only to update the request row from requested to processing/ready/failed; it never performs export data queries.

The function does not log request authorization or payload content. Errors return generic codes/messages.

## Limits and expiration

- Ten-minute duplicate-processing guard per user.
- Up to 5,000 rows per list section in the synchronous v1 path.
- A section exceeding the limit is marked `truncated`.
- Ready response is marked with a 15-minute expiration timestamp.
- Browser keeps the returned payload only in memory until download/dismiss/reload.

For larger accounts, production should enqueue a background export, stream/paginate reads, encrypt an archive in private object storage, issue a short-lived authenticated download, and purge it after expiry. That asynchronous path is not claimed by this task.

## Request table safety

`data_export_requests` contains only job metadata. Authenticated users can select/insert only their own rows through RLS. Renderer roles cannot update/delete status. Service-role workflow updates status. No export payload, secret, auth header, password, or object-storage key belongs in this table.

## Failure behavior

- Missing auth returns sign-in error.
- Recent active request returns `429` with retry guidance.
- Query failure marks request failed and returns no partial payload.
- Missing service-role configuration fails before querying export sections.
- Renderer keeps current session/UI and offers a safe retry.
- Failed/expired payload cannot be downloaded from stale local metadata.

## Production verification

- User A cannot request/export as User B.
- Export includes only User A profile/memberships/messages/attachments/follows/saved records.
- Inaccessible/private channel message authored by User A is excluded when RLS denies it.
- Other users' message bodies and profile fields are absent.
- Storage path, token, password, auth header, and service-role patterns are absent.
- Duplicate request guard works.
- Failed query returns no partial payload and status is failed.
- Large sections set `truncated`.
- Local settings merge contains only typed Picom settings.
- Download filename and JSON are valid on Windows, Linux, and macOS.

## Current limitations

- Synchronous v1 is bounded and may truncate large accounts.
- No encrypted asynchronous archive/object-storage delivery exists yet.
- Export-status polling across app restarts is not implemented.
- Live Edge Function/RLS tests require Supabase CLI or staging.

