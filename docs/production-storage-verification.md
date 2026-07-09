# Picom Production Storage Verification

## MVP delivery decision

- Bucket: `message-attachments`.
- Access: private; never switch the bucket to public to work around policy failures.
- Database metadata stores the object path, file metadata, parent message relationship, and status.
- The upload path may return a one-hour signed URL to the authorized current session for immediate preview.
- Expiring signed URLs are not persisted in attachment metadata.
- A production-connected client must resolve/refresh signed URLs through an authenticated Storage service when loading historical messages.

The historical signed-URL resolver is not yet wired end-to-end. Treat reload rendering of private remote attachments as a production-connected blocker until verified.

## Deployment metadata check

Run in the approved Supabase SQL Editor:

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'message-attachments';
```

Expected:

- Exactly one row.
- `public = false`.
- `file_size_limit = 10485760`.
- MIME list contains only JPEG, PNG, WEBP, and GIF for the MVP.

Review object policies without copying production object names into public issues:

```sql
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
```

## Upload validation

- Renderer validates MIME, extension, and the 10 MB limit for immediate UX.
- Protected `validate-file` Edge Function repeats metadata validation and sanitizes names.
- Bucket configuration enforces MIME and size again.
- Storage path must use `communities/{community}/channels/{channel}/pending/{auth.uid()}/...`.
- Server policies, not client checks, are authoritative.

## Manual account matrix

1. Authorized member uploads an allowed image in a writable visible text channel: expect success.
2. Visitor uploads to public channel without membership: expect denial.
3. Member without channel send/access permission uploads: expect denial.
4. Upload MIME/extension mismatch: expect validation failure.
5. Upload file over 10 MB: expect validation failure.
6. Uploader reads/deletes own pending object: expect allowed per policy.
7. Different member reads another user’s pending object: expect denial.
8. Authorized member loads an attached public-channel image through a fresh signed URL: expect success.
9. Visitor/unauthorized member requests private-channel attachment metadata/object: expect denial.
10. User loses channel/community access and retries object resolution: expect denial.

Use synthetic images and accounts. Do not upload malware samples or production private data.

## URL and cache checks

- Verify generated URL has a finite expiry and contains no service-role credentials.
- Verify DB `public_url`/`thumbnail_url` fields do not store expiring signed URLs.
- Verify renderer requests a new signed URL after expiry/restart for historical attachments.
- Verify logs/diagnostics do not include full signed URLs or object secrets.
- Do not cache private full-size images beyond the authorized session without a reviewed encrypted cache policy.

## Release gate

Private attachment read by an unauthorized account, public bucket configuration, persistent signed URLs, or a service-role path in the renderer is a blocker. Historical attachment reload remains blocked until signed URL refresh is implemented and tested.
