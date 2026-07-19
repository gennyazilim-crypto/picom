-- The custom Steam/Epic Edge Functions use the service-role client to create,
-- inspect, complete, and clean up short-lived OAuth handoffs. RLS bypass alone
-- does not grant table privileges, so grant only the operations those helpers use.
-- Forward-only and idempotent.
begin;

revoke all on table public.social_auth_handoffs from public, anon, authenticated;
grant select, insert, update, delete on table public.social_auth_handoffs to service_role;

commit;
