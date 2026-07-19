begin;

-- Channel INSERT RLS evaluates this helper as the authenticated caller.
-- Keep the helper read-only while allowing the policy to execute it.
revoke all on function public.community_has_kind(uuid, public.community_kind) from public, anon;
grant execute on function public.community_has_kind(uuid, public.community_kind) to authenticated, service_role;

commit;
