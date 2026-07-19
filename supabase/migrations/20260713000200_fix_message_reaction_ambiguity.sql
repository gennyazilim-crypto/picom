-- Fix PL/pgSQL output-column ambiguity in community message reaction writes.
begin;
create or replace function public.set_message_reaction(
  target_message_id uuid,
  target_emoji text,
  target_reacted boolean
)
returns table(
  message_id uuid,
  emoji text,
  reaction_count bigint,
  reacted_by_current_user boolean
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  normalized_emoji text := btrim(target_emoji);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if normalized_emoji='' or char_length(normalized_emoji)>64 or normalized_emoji~'[[:cntrl:]]' then
    raise exception 'REACTION_INVALID' using errcode='22023';
  end if;

  if not exists(
    select 1
    from public.messages target_message
    join public.community_members member
      on member.community_id=target_message.community_id
     and member.user_id=auth.uid()
    where target_message.id=target_message_id
      and target_message.deleted_at is null
      and public.can_view_message(target_message.id)
  ) then
    raise exception 'REACTION_FORBIDDEN' using errcode='42501';
  end if;

  if target_reacted then
    insert into public.message_reactions(message_id,user_id,emoji)
    values(target_message_id,auth.uid(),normalized_emoji)
    on conflict on constraint message_reactions_message_id_user_id_emoji_key do nothing;
  else
    delete from public.message_reactions stored_reaction
    where stored_reaction.message_id=target_message_id
      and stored_reaction.user_id=auth.uid()
      and stored_reaction.emoji=normalized_emoji;
  end if;

  return query
  select
    target_message_id,
    normalized_emoji,
    count(stored_reaction.id)::bigint,
    exists(
      select 1
      from public.message_reactions own_reaction
      where own_reaction.message_id=target_message_id
        and own_reaction.user_id=auth.uid()
        and own_reaction.emoji=normalized_emoji
    )
  from public.message_reactions stored_reaction
  where stored_reaction.message_id=target_message_id
    and stored_reaction.emoji=normalized_emoji;
end $$;
revoke all on function public.set_message_reaction(uuid,text,boolean) from public,anon;
grant execute on function public.set_message_reaction(uuid,text,boolean) to authenticated;
commit;
