-- Trusted message mention extraction.
-- Clients write only message text. This trigger resolves canonical identities from
-- same-community membership and maintains normalized mention rows atomically.

create or replace function public.sync_message_mentions_from_body()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.message_mentions mention
  where mention.message_id = new.id;

  -- Deleted and integration-authored messages do not produce user notifications.
  if new.deleted_at is not null
    or btrim(new.body) = ''
    or new.webhook_id is not null
  then
    return new;
  end if;

  insert into public.message_mentions (message_id, mentioned_user_id)
  with username_tokens as (
    select distinct lower(capture.parts[2]) as token
    from regexp_matches(
      new.body,
      '(^|[^[:alnum:]_.+-])@([[:alnum:]_.-]{3,32})',
      'g'
    ) as capture(parts)
  ),
  quoted_display_tokens as (
    -- Display names require explicit quotes so whitespace and punctuation are
    -- unambiguous: @"Display Name".
    select distinct lower(btrim(capture.parts[1])) as token
    from regexp_matches(new.body, '@"([^"\r\n]{1,80})"', 'g') as capture(parts)
  ),
  eligible_profiles as (
    select profile.id, lower(profile.username) as username, lower(btrim(profile.display_name)) as display_name
    from public.community_members member
    join public.profiles profile on profile.id = member.user_id
    where member.community_id = new.community_id
      and profile.id <> new.author_id
  ),
  username_targets as (
    select profile.id as user_id
    from eligible_profiles profile
    join username_tokens token on token.token = profile.username
  ),
  display_targets as (
    select min(profile.id) as user_id
    from eligible_profiles profile
    join quoted_display_tokens token on token.token = profile.display_name
    group by token.token
    having count(distinct profile.id) = 1
  ),
  resolved_targets as (
    select user_id from username_targets
    union
    select user_id from display_targets
  )
  select new.id, target.user_id
  from resolved_targets target
  order by target.user_id
  limit 20
  on conflict (message_id, mentioned_user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.sync_message_mentions_from_body() from public, anon, authenticated;

drop trigger if exists messages_sync_mentions on public.messages;
create trigger messages_sync_mentions
after insert or update of body, deleted_at, community_id on public.messages
for each row
execute function public.sync_message_mentions_from_body();

alter table public.message_mentions replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_mentions'
    )
  then
    alter publication supabase_realtime add table public.message_mentions;
  end if;
end $$;

comment on function public.sync_message_mentions_from_body() is
  'Trigger-only canonical mention extraction. Resolves same-community @username and unambiguous @"Display Name" tokens, caps unique targets at 20, and reconciles edits/deletes.';
comment on trigger messages_sync_mentions on public.messages is
  'Maintains message_mentions in the same transaction as message create, edit, or soft delete.';
