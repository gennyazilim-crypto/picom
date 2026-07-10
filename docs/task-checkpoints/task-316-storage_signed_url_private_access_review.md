# Task 316 - Storage signed URL/private access review

## Decision

- Keep `message-attachments` private; do not use stable public URLs for ordinary chat attachments.
- Persist object paths and metadata only. Never persist signed URLs.
- Issue future short-lived signed URLs only after current user, message/channel visibility, scan,
  quarantine, deletion, and attachment status checks.
- Do not break the existing upload flow. Historical private attachment reload remains fail-closed until
  the authenticated signed URL resolver is implemented and hosted-tested.

## Verified repository behavior

- Bucket migration forces `public = false`, 10 MB limit, and approved image MIME types.
- Current Storage policy uses `public.can_view_message()` and deliverable scan states.
- Upload service creates no public or signed URL.
- Metadata service stores `public_url: null` and never stores expiring URLs.
- Task 315 hosted runner includes private attachment metadata and Storage object leakage checks, but the
  hosted run remains blocked until staging synthetic credentials/fixture IDs are securely injected.

## Validation

- `npm run storage:private-access:review:test`
- `npm run attachment-delivery:smoke`
- `npm run attachments:quarantine:smoke`
- `npm run supabase:rls:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining P1 delivery gap

Historical signed URL resolution/refresh is not wired end-to-end. Public-bucket fallback is prohibited.
Implement and live-test the authenticated resolver before claiming private remote attachments are fully
production-ready.
