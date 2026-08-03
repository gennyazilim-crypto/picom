select
  (position('owner_id' in d1) > 0) as eligibility_has_owner_id,
  (position('largest_owned' in d1) > 0) as eligibility_has_largest,
  (position('publisher_badges' in d2) > 0) as discovery_has_badges,
  (position('approved' in d2) > 0) as discovery_has_approved,
  left(d2, 400) as discovery_head
from (
  select pg_get_functiondef(p.oid) as d1
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_publisher_application_eligibility'
) e
cross join (
  select pg_get_functiondef(p.oid) as d2
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='live_session_is_publisher_discovery_eligible'
) d;
