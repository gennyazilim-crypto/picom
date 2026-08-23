-- Restore authenticated EXECUTE on audio Feed RLS helpers.
--
-- 20260729110000 revoked PUBLIC/anon from all SECURITY DEFINER functions.
-- can_save_audio_item never had an explicit authenticated grant, so ranked Feed
-- (list_ranked_unified_feed → audio_feed_read_states RLS) failed with:
--   permission denied for function can_save_audio_item
--
-- Staging project only for hosted proof; production applies via normal migration flow.

begin;

revoke all on function public.can_save_audio_item(text, uuid) from public, anon;
grant execute on function public.can_save_audio_item(text, uuid) to authenticated;

-- Defensive: ensure sibling helpers used by can_save_audio_item remain executable.
do $grants$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.can_view_radio_session(uuid)',
    'public.can_view_podcast_episode(uuid)',
    'public.can_view_community_audio(uuid, uuid)',
    'public.can_manage_community_audio(uuid, text)'
  ]
  loop
    if to_regprocedure(function_signature) is not null then
      execute format('revoke execute on function %s from public, anon', function_signature);
      execute format('grant execute on function %s to authenticated', function_signature);
    end if;
  end loop;
end
$grants$;

notify pgrst, 'reload schema';

commit;
