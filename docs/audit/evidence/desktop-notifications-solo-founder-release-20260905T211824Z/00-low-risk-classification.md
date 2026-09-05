# Desktop Notifications — Solo-Founder Low-Risk Classification

**Reviewed source:** `72f512ae9bb149720cd11f0b1358a03e503560ee`  
**Migration:** `20260904100000_production_desktop_notifications.sql`  
**Target:** `picom-production` / `cqnsetsmcduraryemhbi` / `eu-central-1`

## Classification

`LOW_RISK_FORWARD`

The migration is a single explicit transaction. It adds nullable/defaulted
notification-delivery columns, partial indexes, fixed-search-path functions,
trusted event triggers, and recipient-owned delivery state RPCs. It keeps the
desktop notification feature disabled during migration and certification.

The direct `UPDATE` statements are limited to `public.notifications` rows where
`recipient_id = auth.uid()` and a caller-provided notification id matches. They
do not backfill, rewrite, or transform existing notification data.

The only replacement operations are one notification-type check constraint and
four notification-related triggers. Each is dropped and recreated inside the
same transaction; no table/column drop, `TRUNCATE`, `DELETE`, migration-history
mutation, or broad `PUBLIC` grant/execute occurs.

## Safety review result

| Check | Result |
| --- | --- |
| Table/column drop | None |
| `TRUNCATE` | None |
| Uncontrolled `DELETE` | None |
| Mass data rewrite | None |
| Migration history mutation | None |
| Public mutation or execute grant | None |
| RLS/grant posture | Authenticated INSERT/DELETE revoked; trusted notification insertion is not client-callable |
| Function search path | `public, pg_temp` fixed on created/replaced functions |
| Feature containment | `DESKTOP_NOTIFICATIONS_ENABLED` source default false; no hosted remote override row found |

The migration is not eligible for the solo-founder path if any future source
change invalidates this review.
