# Trust & Safety dashboard production

## Access and purpose

The dashboard is an app-operations surface, separate from community administration. It is available only when:

- `import.meta.env.DEV` grants the explicit development source; or
- authenticated Supabase `is_app_admin()` returns true.

Unauthorized users receive no dashboard component and cannot execute the aggregate RPC. The RPC repeats app-admin authorization server-side with `security definer`; renderer visibility is not the security boundary.

## Signals

Production RPC returns only non-negative counts and a timestamp for a fixed 24-hour window where noted:

- open reports;
- suspicious/failed attachment scans;
- pending attachment scans needing review;
- content-free abuse events and critical subset;
- backend user-action rate-limit denials;
- active bans created recently;
- trusted moderation action records of type kick created recently.

Development mode uses the existing bounded local report, quarantine, and abuse-event aggregates. Ban/kick values show “Unavailable locally” rather than fabricated zeros.

## Data minimization

The RPC and UI do not return or render:

- message/report/appeal text;
- user/community/channel/attachment/report IDs;
- usernames, email addresses, IPs or IP hashes;
- file names, object paths, signed/public URLs, attachment bytes;
- abuse reason codes or metadata;
- tokens, cookies, headers, service-role/provider keys;
- private channel/member context.

`abuse_events` is a backend-only content-free signal table with event type, severity, optional community relation, bounded reason code, and timestamp. Authenticated/anonymous clients have no table grants or policies. Backend ingestion is not wired by this task and must use a reviewed trusted service path.

## Read-only behavior

The dashboard has no action/review/export buttons and performs no moderation, account, report, attachment, ban, kick, audit, or retention mutation. Detailed investigation stays in separately permissioned community moderation/quarantine/report tools and must revalidate access.

## Failure behavior

- App-admin RPC failure shows a generic unavailable state and does not fall back to mock/local production counts.
- Malformed/missing count fields normalize to zero; IDs/content are never parsed.
- Access revocation is rechecked whenever Settings recreates the restricted panel; future long-open sessions should add periodic/session-revocation refresh.
- Missing backend ingestion yields zero aggregate events and is documented, not presented as proof of no abuse.

## Manual verification

1. Production non-admin: confirm Admin Operations is absent and direct RPC returns `APP_ADMIN_REQUIRED`.
2. Development: confirm dashboard opens, local report/abuse/quarantine counts render, and bans/kicks say unavailable.
3. App admin in staging: seed only synthetic content-free rows and verify aggregate counts/time window.
4. Inspect network payload and UI: confirm no IDs, text, reasons, paths, URLs, IP data, credentials, or private context.
5. Verify suspicious/pending attachment counts match scan states but no file can be opened from this dashboard.
6. Verify recent bans/kicks use the 24-hour cutoff and revoked bans are excluded.
7. Revoke app-admin, restart/re-authenticate, and confirm access disappears/RPC denies.
8. Confirm no dashboard control mutates any table or emits moderation action.

## Automated checks

- `npm run trust-safety:production:test`
- `npm run abuse:events:smoke`
- `npm run attachments:quarantine:smoke`
- `npm run reports:production:test`
- Supabase RLS/RPC behavior tests in an isolated project when CLI is available.
