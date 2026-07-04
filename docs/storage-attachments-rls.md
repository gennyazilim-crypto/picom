# Storage RLS Policy for Attachments

Task 166 adds Supabase Storage policies for the private `message-attachments` bucket.

## Policies

Migration:

- `supabase/migrations/20260704002300_storage_message_attachments_policies.sql`

Policies:

- `message attachments upload own pending`
- `message attachments read attached visible community`
- `message attachments delete own pending`

## Upload rule

Authenticated users can upload only into their own pending path:

```text
communities/{communityId}/channels/{channelId}/pending/{userId}/...
```

The policy also checks that the user is a member of the community and that the channel belongs to that community.

## Read rule

Authenticated users can read:

- their own pending uploads
- attached files with matching `public.attachments.storage_path`, `status = attached`, and community membership through the linked message

## Delete rule

Authenticated users can delete only their own pending uploads.

## Security notes

- The renderer must never use service-role keys.
- Private channel visibility should be tightened further once per-channel permission policies are finalized.
- Quarantine/malware scan states are not enforced here yet and must be added before production.

## Manual verification

1. Apply migrations locally.
2. Sign in as a community member.
3. Upload to that user's pending path and confirm it succeeds.
4. Try uploading to another user's pending path and confirm it fails.
5. Try reading an attached object from a community where the user is not a member and confirm it fails.