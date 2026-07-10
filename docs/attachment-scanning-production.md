# Attachment scanning production plan

## Status

Production malware scanning is **not enabled**. Picom currently validates image type, extension, size, and file signature; mock development uploads use `skipped_development`. Persistent Supabase metadata, RLS/storage gates, quarantine decisions, and blocked renderer states are already fail closed for `pending`, `suspicious`, and `failed` files.

No paid provider, paid-provider secret, scanner credential, or service-role key is added to the renderer or repository by this plan.

## Canonical states

| State | Meaning | Delivery/render decision |
| --- | --- | --- |
| `pending` | Awaiting trusted scanner result | Block |
| `clean` | Scanner completed without a detection | Allow only after normal message/channel authorization |
| `suspicious` | Detection or policy match | Quarantine and block |
| `failed` | Scanner could not produce a trusted result | Quarantine and block |

`skipped_development` is a local-development-only compatibility state. It must never be emitted by a production scanner or accepted in production without an explicit, audited environment policy.

## Non-negotiable safety rules

- **Do not execute uploaded files.** Do not import, preview, shell-open, or invoke them as programs.
- Never run a scanner from the Electron renderer or expose file-system/shell primitives through preload.
- Do not trust MIME type, extension, client scan status, or uploader-supplied metadata.
- Uploaders cannot write or update `scan_status`; the existing restricted column grants enforce this.
- Storage and signed-URL delivery fail closed unless the trusted state is clean and the caller can view the message/channel.
- Suspicious bytes, storage paths, signed query strings, tokens, and detections are excluded from normal logs and diagnostics.
- Manual release must require a separate privileged review flow and must not silently rewrite scanner history.

## Preferred provider-neutral architecture

1. The authenticated client uploads a validated object to the private pending namespace.
2. Attachment metadata is inserted with `scan_status = pending` by database default.
3. A storage/database event places a bounded job into a trusted server queue.
4. A backend worker or constrained Supabase Edge Function authenticates the event, rechecks object/metadata linkage, size, and MIME policy, then streams bytes to a scanner over a private interface.
5. The scanner runs in an isolated container/service with no application secrets, no arbitrary outbound network, strict CPU/memory/time limits, read-only input, and disposable workspace.
6. A trusted service identity records `clean`, `suspicious`, or `failed` plus a redacted reason code and scanner definition version.
7. Clean content becomes eligible for authorized delivery. Suspicious/failed content remains in the private quarantine namespace and cannot receive a public/signed URL.
8. Retry is bounded and idempotent. Repeated failure stays blocked and enters the restricted review queue.

A Supabase Edge Function may validate and enqueue, but native antivirus engines may require a dedicated worker/container rather than the Edge runtime. The Edge Function must never forward service-role credentials to clients.

## Scanner options and approval

- Start with a self-hosted, maintained open-source engine in an isolated worker if operational ownership is approved.
- A managed provider can be evaluated later, but legal/privacy review, regional processing, retention, cost limits, breach terms, and secret management are prerequisites.
- No paid provider is selected or configured in this task.
- Test files must use the standard harmless antivirus test string or synthetic fixtures in an isolated staging bucket; never commit malware samples.

## Data and audit contract

Allowed result metadata:

- attachment ID
- state
- redacted reason/category code
- scanner definition/version
- attempt count
- scanned timestamp
- restricted reviewer action reference

Forbidden result/log data:

- file content or extracted text
- auth/session tokens or authorization headers
- service-role/storage credentials
- signed URLs or raw private object paths in general logs
- message body, private channel name, or unnecessary user profile data

## Failure, rollback, and operations

- Scanner outage leaves new uploads `pending`; chat text remains available while attachments show a clear unavailable state.
- Backlog age, scan failure rate, suspicious count, worker health, and quarantine review age are aggregate restricted metrics.
- Emergency rollback disables new attachment uploads or scanner job intake; it must not treat pending/failed content as clean.
- Reprocessing uses idempotent attachment/version keys and never overwrites immutable audit outcomes.
- Source and thumbnail cleanup must preserve quarantined evidence according to the approved retention policy and legal hold rules.

## Verification before production enablement

1. Apply migrations in an isolated Supabase project and run RLS/storage policy tests as uploader, unrelated member, moderator, and service worker.
2. Confirm clients cannot set `scan_status` or read pending/suspicious/failed objects.
3. Confirm `AttachmentGrid` and `ImagePreviewModal` both block non-renderable states.
4. Confirm no signed URL is issued for quarantined content.
5. Exercise clean, detection, timeout, malformed image, oversized decompression, scanner outage, retry, and duplicate event paths.
6. Verify logs/support bundles contain only redacted result codes.
7. Load-test queue backpressure and worker resource limits.

Local checks:

- `npm run attachments:scan:production:test`
- `npm run attachments:scan:smoke`
- `npm run attachments:quarantine:smoke`
