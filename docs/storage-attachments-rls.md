# Storage RLS Policy for Attachments

Task 166 adds Supabase Storage policies for the private `message-attachments` bucket.

## Policies

Migration:

- `supabase/migrations/20260704002300_storage_message_attachments_policies.sql`

Initial policies:

- `message attachments upload own pending`
- `message attachments read attached visible community`
- `message attachments delete own pending`

Later hardening migrations replace the initial read policy:

- `20260710121000_multi_tenant_realtime_storage_hardening.sql` changes attached reads from community
  membership to `public.can_view_message()`, closing private-channel leakage.
- `20260710139000_attachment_scanning_quarantine.sql` installs the current
  `message attachments read scanned visible object` policy, preserving message visibility and adding a
  clean/`skipped_development` scan gate.

## Upload rule

Authenticated users can upload only into their own pending path:

```text
communities/{communityId}/channels/{channelId}/pending/{userId}/...
```

The policy also checks that the user is a member of the community and that the channel belongs to that community.

## Read rule

Under the current policy, authenticated users can read:

- their own pending upload only after its scan state is deliverable
- attached files with matching `public.attachments.storage_path`, deliverable scan state, `status = attached`,
  and `public.can_view_message(message_id)`

## Delete rule

Authenticated users can delete only their own pending uploads.

## Security notes

- The renderer must never use service-role keys.
- Private-channel visibility is enforced by the latest `public.can_view_message()`/`can_view_channel()` chain.
- Pending, suspicious, and failed scan states are denied by the current Storage SELECT policy.
- The bucket is private; signed URLs must be short-lived, authorization-checked, and never persisted.
- A hosted two-user private metadata/object leakage test remains required before release.

## Manual verification

1. Apply migrations locally.
2. Sign in as a community member.
3. Upload to that user's pending path and confirm it succeeds.
4. Try uploading to another user's pending path and confirm it fails.
5. Try reading an attached object from a community where the user is not a member and confirm it fails.
6. Try reading a private-channel object as a normal member/visitor and confirm it fails.
7. Change a clean fixture to suspicious/failed and confirm both metadata rendering and object delivery fail.
