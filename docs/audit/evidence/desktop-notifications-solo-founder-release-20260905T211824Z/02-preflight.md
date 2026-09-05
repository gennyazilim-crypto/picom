# Preflight Evidence — Desktop Notifications

## Fresh provider and target evidence

- The authenticated Supabase CLI project listing identified
  `picom-production` / `cqnsetsmcduraryemhbi` in `eu-central-1` as
  `ACTIVE_HEALTHY`.
- The current backup response reported PITR enabled and a physical recovery
  window from `2026-08-29T21:15:06Z` through `2026-09-05T21:15:06Z`.
- The checked migration's raw SHA-256 was
  `B4CCAB77D5F1065AAA96B77B6370D712F3FF0D28F5522948EECB00271181B1ED`; its
  LF-normalized SHA-256 matched the sealed pin.
- A read-only query found no remote feature-flag row for
  `DESKTOP_NOTIFICATIONS_ENABLED`; the canonical source default is `false`.

## CLI pending-set proof

The official linked CLI dry-run reported exactly one pending migration:

```text
20260904100000_production_desktop_notifications.sql
```

The temporary comments-only compatibility shim for the already-applied remote
legacy version `20260808220000` was not a pending migration and was removed
after the dry-run.

## Focused checks

```text
desktop-notifications-contract.test.mjs: PASS
```

Typecheck and build were previously verified for the same product source. The
two commits introduced only release documentation and no product build inputs.
