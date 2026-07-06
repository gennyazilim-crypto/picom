# Message History Export Placeholder

Picom prepares a controlled message history export path without enabling production downloads yet. The current MVP only creates a safe placeholder request from the desktop UI/service layer.

## Status

- Runtime export generation: not enabled
- Real download: not enabled
- Current implementation: local placeholder request record
- Backend route placeholders:
  - `POST /channels/:channelId/export`
  - `GET /exports/:exportId/status`

## Goals

- Prepare a future export workflow for channel history.
- Keep private channel boundaries explicit.
- Avoid leaking auth tokens, invite secrets, storage credentials, internal IDs that are not needed, or private data the user cannot access.
- Keep user data export separate from admin/channel message export.
- Keep current desktop chat layout stable.

## Future formats

- `json`
- `csv`
- `html_placeholder`

HTML export remains a placeholder because it needs careful sanitization, attachment access checks, and CSP review.

## Permission model

Message history export should require one of:

- `manageCommunity`
- future `exportMessages`

Frontend checks are only UX. Supabase RLS and a trusted backend/Edge Function must enforce export eligibility.

## Access rules

The backend export job must:

- Verify the requester is authenticated.
- Verify the requester can export the target channel.
- Respect private channel access.
- Exclude messages from channels the requester cannot view.
- Redact or omit deleted/anonymized content according to retention and privacy policy.
- Avoid exporting quarantined or suspicious attachments as active media.

## Export contents

Allowed future fields:

- message id
- channel id
- author display name or deleted-user placeholder
- timestamp
- edited/deleted markers
- safe body text where policy allows
- attachment metadata that the requester can access
- reply context where visible

Do not include:

- passwords
- session values
- Supabase service-role keys
- storage credentials
- invite secrets
- webhook secrets
- audit log internals
- private channel content outside requester access

## Current UI placeholder

The channel context menu can queue a local export placeholder for users with community management permission. It does not generate a file or read message content.

## Future export status flow

1. User requests export from channel settings or channel context menu.
2. Backend creates export job after permission checks.
3. UI shows an export status modal.
4. When ready, backend returns a short-lived signed download URL.
5. Download expires automatically.
6. Export request and completion are audit logged.

## Manual verification

1. Open a channel context menu as an owner/admin-style mock user.
2. Choose `Export message history placeholder`.
3. Confirm a toast says the export placeholder was queued.
4. Switch to a lower-permission/visitor scenario and confirm the service returns a permission message when export is not allowed.
5. Confirm no message content is written into diagnostics/logs by this placeholder.

