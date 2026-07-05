# Expired Invites Cleanup Job

Picom now has a safe development foundation for an expired invite cleanup job.

## Current state

- The production invite table is not implemented yet.
- `accept-invite` remains a protected placeholder and returns `INVITE_ACCEPTANCE_NOT_IMPLEMENTED`.
- The cleanup job does not delete invite history.
- The default script is dry-run only and does not connect to production data.

## Processor behavior

`scripts/lib/jobs/cleanup-expired-invites.mjs` exports:

- `isInviteExpired(invite, now)`
- `cleanupExpiredInvites(options)`

The processor:

- Scans invite-like records.
- Ignores already revoked invites.
- Treats records with `expiresAt <= now` as expired.
- Marks expired invites as revoked only when `dryRun: false` and a `markRevoked` adapter is provided.
- Logs a summary with scanned, expired, revoked, and error counts.

## Commands

```powershell
npm run invites:cleanup:smoke
npm run invites:cleanup:dry-run
```

## Future Supabase implementation

When the invite schema lands, the production adapter should:

- Query unrevoked invites where `expires_at <= now()`.
- Update `revoked_at` or an equivalent expired/revoked state.
- Preserve audit history and invite metadata.
- Reject expired invites inside the acceptance transaction.
- Run through a scheduled Edge Function or approved worker path.

## Safety requirements

- Do not hard-delete invite records as part of cleanup.
- Do not log invite secrets, raw invite tokens, auth headers, or member emails.
- Destructive mode must remain explicit and environment-scoped.
