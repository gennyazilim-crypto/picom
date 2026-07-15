-- T55 — pseudonymous identity layer for analytics consumption. Applied to piso prod 2026-07-15.
-- analytics_events stores raw actor_user_id (needed for anonymize-on-delete). Downstream
-- analytics should not see raw ids: this adds a server-generated salt (single-row table with
-- NO RLS policies -> reachable only by service_role / SECURITY DEFINER, never exposed to
-- clients or to anyone building this), a salted-sha256 pseudonymize_actor(), and an
-- admin/service-only accessor that exposes actor_hash instead of the raw id.
-- Uses built-in sha256() (no pgcrypto dependency).
-- Rollback: drop function get_pseudonymous_analytics(integer); drop function pseudonymize_actor(uuid);
--           drop table analytics_pseudonymization_salt;
create table if not exists public.analytics_pseudonymization_salt (
  id boolean primary key default true check (id),
  salt text not null,
  created_at timestamptz not null default now()
);
alter table public.analytics_pseudonymization_salt enable row level security;
-- intentionally no policies: locked to service_role / SECURITY DEFINER callers only.

insert into public.analytics_pseudonymization_salt(id, salt)
values (true, encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex'))
on conflict (id) do nothing;

create or replace function public.pseudonymize_actor(actor uuid)
returns text language sql stable security definer set search_path to 'public'
as $function$
  select case when actor is null then null
    else encode(sha256(convert_to((select salt from public.analytics_pseudonymization_salt where id) || actor::text, 'UTF8')), 'hex')
  end;
$function$;
revoke all on function public.pseudonymize_actor(uuid) from public;
revoke all on function public.pseudonymize_actor(uuid) from anon;
revoke all on function public.pseudonymize_actor(uuid) from authenticated;
grant execute on function public.pseudonymize_actor(uuid) to service_role;

create or replace function public.get_pseudonymous_analytics(limit_input integer default 500)
returns table(event_type text, actor_hash text, entity_type text, consent_category text, created_at timestamptz)
language sql stable security definer set search_path to 'public'
as $function$
  select event_type, public.pseudonymize_actor(actor_user_id), entity_type, consent_category, created_at
  from public.analytics_events
  order by created_at desc
  limit least(greatest(limit_input, 1), 5000);
$function$;
revoke all on function public.get_pseudonymous_analytics(integer) from public;
revoke all on function public.get_pseudonymous_analytics(integer) from anon;
revoke all on function public.get_pseudonymous_analytics(integer) from authenticated;
grant execute on function public.get_pseudonymous_analytics(integer) to service_role;
