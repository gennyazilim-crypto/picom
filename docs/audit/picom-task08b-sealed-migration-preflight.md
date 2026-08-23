# TASK 08B — Sealed Migration Preflight

Generated: 2026-08-04T00:20:00+02:00  
Branch: `feat/community-rebuild`  
HEAD: `d68b486e5ef5a911ab10a8e58fae3f8a426c20d7`

## Defect diagnosis

File: `supabase/migrations/20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql`

| Item | Value |
| --- | --- |
| Function | `public.ads_allow_internal_transition()` |
| Lines | 737–744 |
| Language | `sql` |
| Volatility | `stable` |
| search_path | `public, pg_temp` |
| Defective open | line 742: `as $` |
| Defective close | line 744: `$;` |
| Canonical nearby style | `as $$` … `$$;` (e.g. line 733–735) |
| Old LF SHA | `91b3d1990d6b3d1d46f2a89e3bf5a94da8e67b316419baa40bf17c86bfd846c9` |
| SQLSTATE on clean reset | `42601` syntax error at or near `$` |

Body (unchanged intent):

```sql
select coalesce(nullif(current_setting('picom.ads_internal', true), ''), '') = '1';
```

## Why additive supersede cannot bypass

PostgreSQL stops applying `20260803240000` mid-file. Later timestamps never run. Skip/repair history is not a clean chain. Broken file left in place permanently breaks `db reset`.

## Tools

Docker Server 29.4.2 PASS · Supabase CLI 2.109.1 · Node v24.15.0 · psql not on PATH (docker exec used)
