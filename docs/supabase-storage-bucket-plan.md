# Supabase Storage Bucket Plan

Task 164 defines the Supabase Storage bucket plan for Picom MVP image attachments.

## Bucket

Recommended bucket name:

- `message-attachments`

Recommended visibility:

- Private by default for MVP.
- Public URLs should not be assumed for private/community-scoped content.
- Signed URL support can be added after attachment access rules are finalized.

## Storage path structure

Use deterministic, scoped paths:

```text
communities/{communityId}/channels/{channelId}/messages/{messageId-or-pending}/{attachmentId}-{safeFileName}
```

For uploads before message send confirmation:

```text
communities/{communityId}/channels/{channelId}/pending/{userId}/{attachmentId}-{safeFileName}
```

## Metadata table relationship

`public.attachments` remains the metadata source for:

- uploader id
- message id nullable until attached
- storage path
- safe file name
- mime type
- size bytes
- attachment type
- width/height placeholder
- public/signed URL placeholder
- upload status

## Client access model

The Electron renderer should use the normal Supabase client only. It must not use service-role keys.

Allowed client operations for MVP:

- upload own pending attachment into an allowed community/channel path
- read attachment metadata through RLS
- request signed/public URL only through approved storage helper later

Privileged cleanup, moderation review, or cross-user access should use backend/Edge Function logic later, not renderer secrets.

## Example bucket setup SQL placeholder

Use the Supabase dashboard or migration once storage policy details are finalized:

```sql
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;
```

## Policy outline placeholder

Policies should enforce:

- authenticated users only
- uploader can upload own pending files
- member can access attachments only for communities/channels they can view
- private channel attachment access follows channel visibility
- normal users cannot access quarantined/suspicious files

Example policy names to create later:

- `message_attachments_upload_own_pending`
- `message_attachments_read_visible_channel`
- `message_attachments_delete_own_pending`
- `message_attachments_admin_review_placeholder`

## Environment variables

No new secret is required for browser/client uploads beyond existing Supabase env:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not commit service role keys. If an Edge Function later needs privileged storage access, store secrets only in Supabase/CI secret storage.

## Test plan

1. Create the private bucket locally or in staging.
2. Sign in as a seeded user.
3. Upload an allowed image type through the future upload service.
4. Confirm metadata row is created in `public.attachments`.
5. Confirm another unauthorized user cannot read private channel attachment metadata or file content.
6. Confirm oversized or unsupported MIME uploads are rejected before storage upload.

## Deferred work

- Storage policies migration.
- Upload service integration.
- Signed URL helper.
- Thumbnail generation.
- Quarantine/malware scanning path.