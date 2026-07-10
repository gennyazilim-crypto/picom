# Picom penetration test preparation

## Authorization boundary

No testing may begin without signed scope, dates/time zone, source IPs, named test/incident contacts, approved tools/rates and emergency stop authority. **Production attack testing is prohibited.** Use isolated staging with synthetic accounts/data and provider projects that cannot reach production. Third-party Supabase, LiveKit, GitHub, Apple/Microsoft or CDN systems are out of scope unless their written authorization and policies explicitly permit the exact test.

## In-scope staging surfaces

- Electron Windows/Linux/macOS renderer, custom titlebar, preload IPC allowlist, context isolation/sandbox/CSP/navigation/deep-link/external-link boundaries;
- Supabase Auth/session restore/revoke, Postgres schema/RPC/RLS, Realtime subscriptions/room authorization and Storage/upload/signed delivery;
- Edge Functions including client config, LiveKit token, invite, export/deletion, moderation, notification, validation and webhook foundations that are deployed to test staging;
- community/channel/message/member/role/notification/report/audit/admin boundaries;
- upload MIME/size/scanning/quarantine/orphan behavior using inert approved fixtures;
- LiveKit token identity/room/grant/TTL and cross-community voice denial; no recording/private media interception.

Excluded: denial-of-service/load beyond limits, social engineering, physical tests, real malware, persistence, destructive database operations, production credentials/data, provider control planes, public bot/plugin marketplace, billing and mobile.

## Synthetic accounts and fixtures

Provision unique owner/admin/moderator/member/visitor, two communities, public/private channels, blocked/banned/revoked users, app-admin and non-admin accounts. Use generated emails/passwords from the approved vault; never place credentials in reports/repo/chat. Seed synthetic text/images only. Record expected access matrix and destroy/reset fixtures after evidence retention approval.

## Priority tests

1. RLS/adversarial IDs: cross-community select/insert/update/delete, private messages/search/attachments/realtime, role escalation, owner transfer and app-admin RPC denial.
2. Auth/session: invalid/revoked/expired sessions, enumeration, reset/verification, rate limit, concurrent clients and logout/socket disconnect.
3. Electron: renderer Node access, preload object mutation/channel abuse, IPC payload validation, navigation/window-open/webview, protocol/deep-link injection, CSP and unsafe URL schemes.
4. Uploads: extension/MIME mismatch, polyglot/inert scanner fixtures, oversized/truncated files, quarantine bypass, signed URL authorization/cache and object path isolation.
5. Realtime/voice: unauthorized subscriptions/room joins, event spoof/dedupe/order, token replay/expiry/cross-room grants and reconnect authorization.
6. Abuse/admin/export: rate-limit bypass, audit mutation, report/appeal scope, data export/deletion secret/private-data exclusion.

## Rules of engagement

Use bounded rates and test windows; no credential stuffing, uncontrolled fuzzing or automated exploit chaining outside approval. Stop immediately for production reachability, real user data, provider instability, destructive state, credible cross-tenant leak or secret exposure. Notify the security contact through the approved channel, preserve minimal encrypted evidence and follow incident response. Do not prove impact by downloading more data than the smallest synthetic record.

## Evidence and severity

Evidence uses UTC, test case, synthetic actor/resource labels, sanitized request shape, safe response/error code, commit/environment and reproduction. Redact tokens, cookies, credentials, signed URLs, private host/project refs, raw IP and unnecessary content. Encrypt/restrict evidence and delete per engagement retention.

Severity combines exploitability, authorization boundary, confidentiality/integrity/availability impact and affected scope. Any private-channel/cross-tenant access, credential exposure, arbitrary native code/shell/file access, signing/update compromise or destructive unauthenticated action is release-blocking pending validation.

## Entry and exit

Entry requires staging reset/migrations, scope/ROE, backups, monitoring/on-call, test accounts, known-issue list, build hashes and provider approvals. Exit requires findings triage, owners/dates, critical/high remediation, regression tests, retest evidence, residual-risk approval, fixture cleanup and signed report acceptance.

Use `docs/security/pentest-report-template.md`. This preparation is not a penetration test result or security certification.
