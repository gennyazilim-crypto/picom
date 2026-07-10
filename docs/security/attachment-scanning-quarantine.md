# Attachment Scanning and Quarantine

## Enforced foundation

Attachment metadata now stores `pending`, `clean`, `suspicious`, `failed`, or `skipped_development`. The default and missing-state behavior is fail-closed `pending`. Mock fixtures alone are explicitly marked `skipped_development`.

Supabase uploads use private `message-attachments` object paths and return no signed URL while scan status is pending. The Storage SELECT policy requires a matching metadata row with `clean` or `skipped_development`, plus uploader ownership for pending metadata or normal parent-message/channel visibility for attached metadata. Pending, suspicious, and failed objects cannot receive normal authenticated reads/signed URLs.

Authenticated users cannot insert or update `scan_status`; table-wide mutation grants are replaced with an explicit column allowlist. A future trusted scanner/service-role job owns scan transitions. RLS and Storage policies remain authoritative; `AttachmentGrid` also blocks pending/suspicious/failed rendering as defense-in-depth.

## Workflow

1. Client validates bounded image MIME, size, extension/content signature and never executes the file.
2. Client uploads to a private `pending/<uploader>/...` object key; no raw local filesystem path is transmitted or displayed.
3. Metadata is inserted with database-default `pending`.
4. A future isolated scanner reads through service credentials, scans bytes without executing them, and atomically records `clean`, `suspicious`, or `failed` plus content-free audit/abuse metadata.
5. `clean` may be attached/delivered through short-lived signed URLs after normal message/channel authorization.
6. `suspicious` and `failed` remain quarantined and unavailable to normal users. `pending` shows scanning/unavailable UI.
7. Restricted reviewers may later block/delete or approve a false positive through an audited backend operation; no renderer-only release is valid.

## Scanner requirements

Use an isolated managed scanner or hardened worker with no file execution, macros, archive extraction without strict depth/size limits, shell, desktop session, or broad storage credentials. Bound CPU, memory, time, decompression ratio, nested archives, object size, retry count, and output. Verify MIME/magic bytes server-side and keep definitions/engine patched.

`skipped_development` is allowed only in local/staging fixtures under explicit config. Production jobs must never assign it. Unknown/provider timeout becomes `failed` or remains `pending` according to reviewed retry policy, never `clean`.

## Quarantine administration

The existing Admin Operations count/routes remain placeholders. A production review queue requires app-admin/trust-safety authorization, re-authentication, bounded metadata (ID, safe filename, MIME, size, status, timestamps, reason code), no direct object URL, dual-control release for suspicious files, append-only audit, retention/deletion rules, and content-free abuse events.

Normal community owners/moderators and uploaders cannot release quarantine. Raw object keys/local paths, scanner internals, signatures, credentials, and file contents are not exposed in UI or logs.

## Privacy and retention

Scanning processes private user files, so provider region, subprocessors, retention, legal basis, encryption, access logs, incident response, and deletion/orphan cleanup require review. Preserve only bounded result/reason metadata. Suspicious evidence retention is separate from audit-log retention and legal hold.

## Verification

Run `npm run attachments:scan:smoke`, `npm run attachments:quarantine:smoke`, `npm run supabase:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.

Live staging gates:

- normal user cannot insert/update `scan_status`;
- pending/suspicious/failed object read and signed URL fail;
- clean object works only for uploader/visible parent message;
- private channel, removed membership, cross-community path, and deleted message fail;
- UI never places blocked URL in `<img>` or preview modal;
- scanner failure/retry and admin review create redacted audit evidence;
- no uploaded file is executed and no raw local path/token enters logs.

## Remaining production blocker

No malware scanner worker/provider or admin release endpoint is implemented. The system therefore safely keeps Supabase production uploads pending/unserved until a trusted scanner updates them. Live Storage RLS tests require Supabase CLI/staging access.
