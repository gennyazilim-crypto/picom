# Picom security penetration test plan

## Authorization and status

This is a plan for an explicitly authorized Picom staging security assessment. It does not authorize testing any production system, third-party provider outside an approved Picom test project, real user account, public IP range, or unrelated tenant. No penetration commands or live attacks were run for this task.

Before testing, obtain a signed rules-of-engagement record containing:

- approved staging Supabase and LiveKit project aliases and exact hosts
- desktop build version/commit and supported Windows/Linux/macOS targets
- tester identities and source IP ranges where required
- start/end time, emergency contacts, stop authority, and provider notifications
- allowed techniques, rate ceilings, data handling, evidence storage, and cleanup
- explicitly excluded systems, accounts, data, availability tests, and social engineering

## Objectives

1. Prove authorization is enforced server-side, not only by hidden React controls.
2. Find cross-user, cross-community, private-channel, direct-message, Storage, Realtime, and voice-room access leaks.
3. Verify Electron renderer compromise cannot reach arbitrary Node, shell, filesystem, IPC, or navigation capabilities.
4. Test untrusted messages, links, filenames, metadata, and integration payloads without executing uploaded content.
5. Verify abuse controls and errors do not leak secrets, stack traces, private identifiers, or account existence.

## Rules of engagement

### Allowed only in staging

- Manual HTTP/RLS/Storage/Realtime requests using dedicated synthetic owner/admin/moderator/member/visitor/removed-member identities.
- Renderer input fuzzing with safe inert strings.
- Inspection of Electron main/preload/renderer boundaries and packaged configuration.
- Bounded rate-limit verification at the agreed ceiling.
- Bot/webhook token misuse tests using test-only credentials that can be revoked immediately.
- LiveKit token/room tests in dedicated empty rooms.

### Prohibited

- Production or real-user testing.
- Destructive database/storage actions outside disposable fixtures.
- Denial of service, unbounded concurrency, network flooding, brute force, credential stuffing, phishing, or social engineering.
- Malware execution, persistence, lateral movement, host escape, or accessing unrelated local files.
- Recording voice/screen content or testing with personal/sensitive data.
- Copying private content into normal issues, chat, screenshots, or logs.
- Testing Supabase/LiveKit infrastructure beyond Picom configuration/tenant authorization.

### Immediate stop criteria

Stop and notify the security lead if testing reveals real/production data, uncontrolled cross-tenant access, provider instability, secret exposure, unexpected destructive mutation, compromised tester host, or impact above the approved rate/availability threshold. Preserve minimal redacted evidence and follow incident response.

## Test environment and identities

Create two isolated communities with synthetic content:

- Community A: public-read channel, member channel, private role channel, attachment, thread/reply, search result, report, audit event, voice channel.
- Community B: equivalent records owned by another identity.

Identities:

| Identity | Expected access |
|---|---|
| A-owner | Full Community A owner actions; no Community B private access |
| A-admin | Granted A admin actions; no owner transfer/delete unless allowed |
| A-moderator | Moderation-only A access; no owner/admin-only settings |
| A-member | Normal permitted A content/write |
| A-private-member | Explicit A private-channel access |
| A-removed-member | No joined/private A access after removal; public visitor rules only |
| Visitor | Public-read only where enabled; no writes/private/member list secrets |
| B-owner/member | B-only controls/data |
| App-admin | Restricted app operations only, separately audited |
| Bot/webhook | Test integration with least scopes, revocable token |

Use unique request IDs and safe marker strings. Never use production emails, passwords, tokens, messages, files, or IP addresses.

## Critical manual tests

Any confirmed unauthorized private read/write, secret exposure, arbitrary native capability, token privilege escalation, or account takeover is a release blocker and SEV0/SEV1 escalation candidate.

### 1. Authentication and sessions

#### Registration/login

- Submit missing/invalid inputs and ensure safe generic errors.
- Confirm registration rejects unchecked/current-version-mismatched Terms acceptance.
- Verify signup creates exactly one profile and cannot forge protected legal acceptance timestamps.
- Test valid, invalid, disabled, deleted-request, unverified-email (when enabled), and rate-limited accounts.
- Confirm logs/diagnostics omit email/password/token/authorization details beyond approved redacted metadata.

#### Session lifecycle

- Capture only test-session identifiers; verify access/refresh tokens are not persisted in renderer logs or exported diagnostics.
- Revoke one/all sessions and verify API, Realtime, Storage, and LiveKit token access is rejected after expected JWT expiry/revocation semantics.
- Verify logout clears local session and multi-client revocation signs out the target account only.
- Test expired/tampered JWT, wrong project/issuer/audience where safely supported, and missing Authorization.
- Verify account deletion globally revokes sessions and cannot start while the user owns a community.

Expected: no account enumeration, session fixation, cross-account state, raw provider error, or client-only authorization.

### 2. Supabase RLS and tenant isolation

For every user-data table/RPC, attempt `select`, `insert`, `update`, and `delete` using each identity and known UUIDs from other users/communities. Include profiles, follows/blocks, communities/members/roles/categories/channels, messages/reactions/reads/threads, attachments, invites, reports/moderation, audit/account events, notifications/saved messages, discovery, bots/webhooks, export/deletion/legal acceptance, and app-admin data.

Critical probes:

- Community A user reads/mutates Community B rows by ID/filter/join/RPC.
- Member changes `community_id`, `author_id`, `user_id`, `role_id`, owner, permissions, or app-admin fields in payload.
- Removed/blocked/banned member continues read/write or realtime access.
- Error timing/body distinguishes hidden row existence.
- Security-definer functions omit `auth.uid()`, scope, `search_path`, or permission checks.
- Pagination/search/count/aggregate leaks hidden row existence.
- Service-role client accidentally appears in renderer path.

Run pgTAP/RLS suites with isolated staging credentials. A successful UI smoke is not RLS evidence.

### 3. Visitor read-only mode

- Public community metadata/channel/message reads succeed only when both community/channel policy allows.
- Private channels are absent, not merely disabled.
- Visitor cannot send/edit/delete/react/reply/upload/join Realtime private topics/read member-sensitive fields.
- Join requires auth; private/request communities follow approval/invite rules.
- Deep link, search, Mention Feed, Profile activity/media, attachment preview, unread/notification, and cached state do not leak member/private content.
- After leaving/removal, current view clears or safely blocks and composer/actions disable.

### 4. Private-channel leakage

Test direct IDs and secondary surfaces:

- Channel/message/reaction/thread/reply/read endpoints and realtime subscriptions.
- Advanced search, jump-to-message, notification/saved-message references, feeds/stories/profile activity/shared media.
- Attachment metadata, object path guessing, stale/signed URL, thumbnail/original, browser cache, copy link.
- Role removal, membership removal, ban/block, community switch, sleep/reconnect, second window, offline cache, deep link.
- Admin/mod/report/audit exports and diagnostics.

Expected: denied/hidden without title, author, body, filename, count, URL, or existence leak. Treat any credible leak as SEV0 and stop.

### 5. Supabase Storage access

- Upload allowed png/jpg/webp/gif within size to authorized channel; deny invalid MIME, extension mismatch, oversized, empty, polyglot/safe inert test fixture according to policy.
- Ensure object key is server/service-generated or safely normalized; test traversal/control/unicode/confusable names without accessing filesystem.
- Non-member, removed member, and Community B cannot read/list/update/delete private A object or thumbnail.
- Signed URL has short intended TTL/scope and access loss behavior is documented/tested.
- Suspicious/failed/quarantined state never renders/downloads publicly.
- Metadata failure/orphan produces unavailable state without raw bucket/path.
- Cancel/retry/idempotency does not duplicate objects or bypass scan/access state.

Never execute uploaded files or use live malware.

### 6. XSS and message rendering

Use inert payload strings in message, display name, username, status, bio, community/channel/category/event/poll/thread/report, filename, webhook/bot name, and search fields:

```text
<img src=x onerror=alert(1)>
<svg/onload=alert(1)>
"><script>alert(1)</script>
javascript:alert(1)
data:text/html,<script>alert(1)</script>
${7*7} {{7*7}}
```

Verify strings render as text, no `dangerouslySetInnerHTML`/DOM injection, no CSP bypass, no remote script/style/frame/object/webview load, and no persistence across reload/realtime/export. Verify image/link previews never inject remote HTML. Do not use payloads that exfiltrate data or contact external hosts.

### 7. External links and deep links

- Allow normalized `http`/`https` only through `externalLinkService` and safe Electron IPC/browser fallback.
- Block `javascript:`, `file:`, `data:`, `vbscript:`, `shell:`, UNC paths, control characters, encoded protocol confusion, credentials-in-URL, and unknown schemes.
- Verify display domain handles punycode/confusables and does not imply trust.
- `myapp://`/`picom://` links go only through validated deep-link routing; malformed/oversized/unknown links fail safely.
- External navigation, new windows, redirects, webviews, and file downloads cannot escape main-process controls.

### 8. Electron IPC/native boundary

Inspect packaged and dev behavior:

- `contextIsolation: true`, `nodeIntegration: false`, sandbox posture documented, no remote module/webview.
- `window.electronAPI`/preload exposes a minimal frozen/typed method surface, not `ipcRenderer`, `shell`, `fs`, `child_process`, `require`, paths, env, or Electron objects.
- IPC channels are allowlisted; payload type/length/range/URL/path validated in main process.
- Renderer cannot invoke arbitrary channel names or send objects causing prototype/path/command injection.
- Window controls accept no untrusted payload; titlebar inputs are no-drag.
- File/export/save dialogs do not accept arbitrary filesystem operations or expose raw paths unnecessarily.
- Clipboard, notification, tray, update, protocol, screen-capture, logs, and external-open handlers enforce intent and safe failure.
- CSP/navigation/window-open handlers remain strict in packaged app.

Critical: any renderer path to arbitrary shell command, filesystem read/write, Node module, or unrestricted IPC is a blocker.

### 9. LiveKit token Edge Function and rooms

- Missing/invalid/expired Supabase JWT rejected.
- User must be a permitted member of exact community/voice channel; visitor/removed/blocked user denied.
- Request cannot choose another user identity, arbitrary room, admin grant, token TTL, metadata, or publish/subscribe permissions.
- Returned token is short-lived, room-scoped, identity-scoped, sent only over HTTPS, and absent from logs/diagnostics/errors/local settings.
- Replay/duplicate/concurrent requests obey limits; revoked session cannot obtain fresh token.
- Room naming prevents cross-community collision; direct LiveKit join cannot exceed token grants.
- Screen-share permission denial and leave/disconnect clean resources.
- Error response does not reveal membership/private room existence more than policy permits.

Do not record media or test in rooms with real participants.

### 10. Webhook and bot abuse

Only test enabled staging foundations:

- Raw bot/webhook token shown once, stored hashed, never returned by list/update/log/diagnostic/export.
- Missing/wrong/revoked/rotated token rejected with non-enumerating errors.
- Token cannot change bot/webhook/community/channel identity or access private channel without explicit scope.
- Payload bounds content, embeds/URLs, mentions, attachments, idempotency key, and client message ID.
- Bot/webhook message is marked with origin and cannot impersonate a normal user/moderator/system.
- Management requires owner/admin permission; lower role cannot create/rotate/escalate scopes.
- Audit/abuse events contain IDs/status only, no raw token or unnecessary content.
- SSRF, arbitrary callback URL, redirect, local/metadata IP, and DNS rebinding are blocked if outbound webhooks are later added.

No public bot marketplace, arbitrary plugin runtime, or dynamic code execution is authorized.

### 11. Rate limiting and abuse resistance

At bounded approved rates, verify separate controls for login/register/reset/verification, session actions, messages/reactions/typing/presence, uploads, invites/join, reports, search/export/deletion, LiveKit tokens, bots/webhooks, and admin operations.

- Limits key on appropriate user/session/IP-hash/integration dimensions without storing raw secrets/content.
- `429` uses consistent safe error/retry guidance.
- Retry/idempotency does not duplicate message/community/channel/invite/webhook.
- Typing/presence coalesce/drop stale events; UI remains responsive.
- Limit cannot be bypassed by alternate casing/encoding/body/header/query, reconnect, or parallel desktop windows within agreed scope.
- Privileged/admin endpoints are not exempt without explicit reason.

Do not test beyond the written ceiling or measure infrastructure exhaustion.

## Tooling and evidence

Allowed tools should be named in rules of engagement and pinned/verified. Potential categories include browser/Electron DevTools, Supabase CLI/SQL test runner, an intercepting proxy for the test app, static dependency/secret scanners, and bounded HTTP/WebSocket clients.

Evidence must include test ID, UTC time, tester, build/commit, synthetic identity role, request ID, expected/actual status, minimal redacted response, reproducibility, impact, and cleanup. Store raw sensitive evidence only in the approved encrypted security system with least access and retention.

Do not attach access/refresh/LiveKit/bot/webhook tokens, passwords, signed URLs, message bodies, private filenames, provider secrets, or full environment dumps.

## Severity and release gates

| Severity | Examples | Release decision |
|---|---|---|
| Critical | Account takeover, service-role/secret exposure, arbitrary Electron shell/filesystem, cross-tenant private content, bot/webhook privilege escalation | Stop test, SEV0, block all promotion |
| High | Private metadata/existence leak, auth/session bypass, unauthorized write, broad stored XSS, unrestricted LiveKit room access | Block release; urgent fix/retest |
| Medium | Limited reflected UI injection without code execution, weak rate limit with bounded impact, information-rich error | Fix before stable or approved exception |
| Low | Hardening/defense-in-depth issue with no practical unauthorized impact | Track with owner/date |

Every Critical/High finding requires root-cause fix, regression test, independent retest, and security sign-off. Frontend hiding is never an acceptable fix for backend authorization.

## Reporting template

```text
Finding ID/title:
Severity and rationale:
Affected build/environment:
Preconditions and synthetic role:
Steps (safe/redacted):
Expected / actual:
User/security impact:
Evidence location (restricted):
Immediate containment:
Root cause:
Fix and tests:
Retest result/date:
Owner/due date:
```

## Exit criteria

- All planned critical manual tests completed or explicitly blocked with owner/date.
- No unresolved Critical/High finding.
- Private-channel/RLS/Storage/Realtime/LiveKit tests independently pass.
- Electron IPC/navigation tests find no arbitrary native access.
- Auth/session, integration token, XSS/link, and bounded rate-limit tests pass.
- Test tokens/accounts/data revoked/deleted safely; staging restored to known state.
- Final report and exceptions approved by security, engineering, product, and operations.

Production remains blocked when any authorization scope, staging environment, or live RLS/Storage/LiveKit evidence is unavailable.
