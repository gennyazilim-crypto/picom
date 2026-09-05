-- Forward-only follow-up for the qualified-ID hotfix.
-- A PL/pgSQL RETURNS TABLE function also exposes output-column names as
-- variables, so every ranked CTE candidate reference must be CTE-qualified.

begin;

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.list_community_live_discovery(integer,text,uuid[],text,text)'::regprocedure
  ) into function_definition;

  if position('partition by broadcaster_user_id' in function_definition) = 0
    or position('partition by community_id' in function_definition) = 0
    or position('partition by category' in function_definition) = 0
    or position('order by recently_exposed, excluded_by_client, shuffle_key, eligible.id' in function_definition) = 0 then
    raise exception 'COMMUNITY_DISCOVERY_RANK_SCOPE_BASELINE_MISMATCH';
  end if;

  function_definition := replace(
    function_definition,
    'partition by broadcaster_user_id',
    'partition by eligible.broadcaster_user_id'
  );
  function_definition := replace(
    function_definition,
    'partition by community_id',
    'partition by eligible.community_id'
  );
  function_definition := replace(
    function_definition,
    'partition by category',
    'partition by eligible.category'
  );
  function_definition := replace(
    function_definition,
    'order by recently_exposed, excluded_by_client, shuffle_key, eligible.id',
    'order by eligible.recently_exposed, eligible.excluded_by_client, eligible.shuffle_key, eligible.id'
  );

  execute function_definition;
end;
$$;

notify pgrst, 'reload schema';

commit;
