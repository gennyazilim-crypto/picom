# MVP+ Security Review

## Reviewed boundaries

- Direct messages are readable only by conversation members. DM attachment inserts now also require the uploader to be the author of the linked message.
- Discovery queries require `public`, `public_read_enabled`, and `discovery_listed`; RLS still controls direct community visibility.
- Events no longer expose a linked private or cross-community channel to public readers. Immutable event identity fields are not client-updatable.
- Invite codes are accepted through the authenticated security-definer function; bans, expiry, revocation, duplicate membership, and maximum uses are checked transactionally.
- Reports validate visible target ownership and moderators can update only review fields.
- Saved messages re-check message/channel visibility on every read and insert.
- Webhook raw tokens are returned only once. Authenticated clients cannot select `token_hash` after this migration.
- Bot records contain no raw bot token or executable plugin payload.
- Renderer code contains no Supabase service-role key or LiveKit API secret. LiveKit signing remains in the Edge Function.
- External URLs allow only HTTP/HTTPS and are opened through validated preload IPC. Deep links use their separate parser.
- Message rendering does not use `dangerouslySetInnerHTML`.
- Uploads enforce MIME type, extension, size, and image magic-byte signature before storage upload.
- Logs redact credential-like keys, bearer values, JWTs, cookies, sessions, and authorization values.
- Mention search/feed and mock profile activity/media filter channels through the same community access helper.
- Visitor write actions remain blocked by RLS; public reads require public community and channel configuration.
- Electron keeps `contextIsolation: true`, `nodeIntegration: false`, navigation/webview restrictions, an explicit preload API, IPC payload parsing, and protocol allowlists.

## Remaining production risks

- The Supabase CLI is not installed in the current workstation, so the new policies require live local/staging RLS execution before release.
- Client-side image signature checks are defense in depth. Production uploads still require server-side malware scanning and trusted image decoding.
- Webhook delivery remains disabled until the Edge Function has production rate limits, delivery audit records, and abuse monitoring.
- Mock profile/feed filtering is not an authorization boundary. Supabase mode must continue relying on RLS-backed queries.
- Content Security Policy deployment and packaged Electron penetration testing remain release-gate work.

## Manual RLS verification

1. Apply all migrations to a disposable Supabase project.
2. As a visitor, verify public events linked to private channels are absent.
3. As a DM participant, attempt to attach metadata to another participant's message; expect RLS denial.
4. As a normal member, attempt `select token_hash from webhooks`; expect a column permission error.
5. As a reporter, submit mismatched message/community identifiers; expect RLS denial.
6. As a moderator, attempt to update report target/reporter fields; expect a column permission error.
