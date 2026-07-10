# Task 167 checkpoint: Attachment virus scanning production

## Result

- Verified the persistent state model includes `pending`, `clean`, `suspicious`, and `failed` and fails closed.
- Verified suspicious/failed attachments are quarantined and do not render normally.
- Verified normal uploaders cannot self-mark an attachment clean and Storage serves only allowed scan states with message visibility checks.
- Added a provider-neutral production worker/Edge Function plan without scanner execution, paid provider secrets, or renderer-native capabilities.
- Added a production scanning contract test that rejects shell/process execution markers.

## Validation

- `npm run attachments:scan:production:test`
- `npm run attachments:scan:smoke`
- `npm run attachments:quarantine:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining blocker

- A scanner, isolated worker runtime, trusted service identity, queue, staging RLS tests, operational ownership, and privacy/legal approval are required before production enablement. Until then production attachments must remain disabled or pending/fail-closed.
