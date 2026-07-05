# Task 426: User Activity History

## Scope

- Added a local account activity history service.
- Recorded login, logout, and session-revoked placeholder events.
- Added Settings > Account > Account Activity.
- Documented the future `/account/activity` backend route.

## Safety decisions

- No passwords, tokens, cookies, authorization headers, or raw IP addresses are stored.
- Location remains a placeholder.
- Metadata is passed through `loggingService` redaction.

## Validation

- `npm run account:activity:smoke`
- `npm run typecheck`
- `npm run build`

## Manual test

1. Sign in.
2. Open Settings > Account.
3. Confirm Account Activity shows recent local events.
4. Log out and sign back in.
5. Confirm activity remains free of secrets and raw IP data.
