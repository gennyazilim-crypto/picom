# Production apply and post-verify

Target: `picom-production` / `cqnsetsmcduraryemhbi`.

The official linked Supabase migration path applied exactly one migration:

```text
20260905214245_production_desktop_notifications.sql
```

Post-apply remote migration history contains the new version exactly once and
does not contain `20260904100000`.

Production catalog verification confirmed:

- all eleven notification-delivery columns;
- seven notification functions, including the corrected trusted insert;
- four logical notification triggers (the presence trigger is registered for
  both insert and update events);
- recipient dedupe, unseen, and undelivered indexes;
- RLS remains enabled on `public.notifications`;
- `authenticated` and `anon` cannot execute the trusted insert function;
- `authenticated` can execute the recipient-owned claim RPC;
- `public.notifications` is in the `supabase_realtime` publication.

The feature flag source default remains `false` and production has no remote
override row for `DESKTOP_NOTIFICATIONS_ENABLED`.
