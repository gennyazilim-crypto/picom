alter table public.polls
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null;
create unique index if not exists idx_poll_votes_poll_user_single_choice_guard
  on public.poll_votes(poll_id, user_id, option_id);
create or replace function public.can_vote_poll(target_poll_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.polls poll
    join public.messages message on message.id = poll.message_id
    where poll.id = target_poll_id
      and poll.closed_at is null
      and (poll.closes_at is null or poll.closes_at > now())
      and public.can_send_message_to_channel(message.channel_id)
  );
$$;
create or replace function public.get_poll_state(target_poll_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', poll.id,
    'messageId', poll.message_id,
    'question', poll.question,
    'allowMultiple', poll.allow_multiple,
    'closesAt', poll.closes_at,
    'closedAt', poll.closed_at,
    'createdAt', poll.created_at,
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', option.id,
        'text', option.text,
        'position', option.position,
        'voteCount', (select count(*) from public.poll_votes vote where vote.option_id = option.id),
        'votedByCurrentUser', exists(select 1 from public.poll_votes vote where vote.option_id = option.id and vote.user_id = auth.uid())
      ) order by option.position)
      from public.poll_options option where option.poll_id = poll.id
    ), '[]'::jsonb)
  )
  from public.polls poll
  where poll.id = target_poll_id and public.can_view_poll(poll.id);
$$;
create or replace function public.create_poll_atomic(
  target_message_id uuid,
  poll_question text,
  option_texts text[],
  allow_multiple_choices boolean default false,
  poll_closes_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare target_poll_id uuid; target_channel_id uuid; normalized_options text[];
begin
  select message.channel_id into target_channel_id from public.messages message where message.id = target_message_id and message.author_id = auth.uid();
  if target_channel_id is null or not public.can_send_message_to_channel(target_channel_id) then raise exception 'POLL_CREATE_FORBIDDEN'; end if;
  poll_question := btrim(poll_question);
  select array_agg(btrim(value)) into normalized_options from unnest(option_texts) value where btrim(value) <> '';
  if char_length(poll_question) not between 1 and 240 or coalesce(array_length(normalized_options, 1), 0) not between 2 and 10 then raise exception 'POLL_VALIDATION_ERROR'; end if;
  if (select count(*) from unnest(normalized_options) value) <> (select count(distinct lower(value)) from unnest(normalized_options) value) then raise exception 'POLL_DUPLICATE_OPTIONS'; end if;
  if exists(select 1 from unnest(normalized_options) value where char_length(value) > 100) then raise exception 'POLL_OPTION_TOO_LONG'; end if;
  if poll_closes_at is not null and poll_closes_at <= now() then raise exception 'POLL_CLOSE_TIME_INVALID'; end if;
  insert into public.polls(message_id, question, allow_multiple, closes_at) values(target_message_id, poll_question, allow_multiple_choices, poll_closes_at) returning id into target_poll_id;
  insert into public.poll_options(poll_id, text, position) select target_poll_id, value, ordinal - 1 from unnest(normalized_options) with ordinality item(value, ordinal);
  return public.get_poll_state(target_poll_id);
end;
$$;
create or replace function public.toggle_poll_vote(target_poll_id uuid, target_option_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare multiple_allowed boolean; already_selected boolean;
begin
  if auth.uid() is null or not public.can_vote_poll(target_poll_id) then raise exception 'POLL_VOTE_FORBIDDEN'; end if;
  if not exists(select 1 from public.poll_options option where option.id = target_option_id and option.poll_id = target_poll_id) then raise exception 'POLL_OPTION_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_poll_id::text || ':' || auth.uid()::text, 0));
  select allow_multiple into multiple_allowed from public.polls where id = target_poll_id for update;
  select exists(select 1 from public.poll_votes where poll_id = target_poll_id and option_id = target_option_id and user_id = auth.uid()) into already_selected;
  if already_selected then
    delete from public.poll_votes where poll_id = target_poll_id and option_id = target_option_id and user_id = auth.uid();
  else
    if not multiple_allowed then delete from public.poll_votes where poll_id = target_poll_id and user_id = auth.uid(); end if;
    insert into public.poll_votes(poll_id, option_id, user_id) values(target_poll_id, target_option_id, auth.uid()) on conflict do nothing;
  end if;
  return public.get_poll_state(target_poll_id);
end;
$$;
create or replace function public.close_poll(target_poll_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare target_community_id uuid; author_id uuid;
begin
  select message.author_id, channel.community_id into author_id, target_community_id from public.polls poll join public.messages message on message.id = poll.message_id join public.channels channel on channel.id = message.channel_id where poll.id = target_poll_id;
  if auth.uid() is null or (auth.uid() <> author_id and not public.can_moderate_community_reports(target_community_id)) then raise exception 'POLL_CLOSE_FORBIDDEN'; end if;
  update public.polls set closed_at = coalesce(closed_at, now()), closed_by = coalesce(closed_by, auth.uid()) where id = target_poll_id;
  return public.get_poll_state(target_poll_id);
end;
$$;
revoke insert, update, delete on public.polls, public.poll_options, public.poll_votes from authenticated;
grant execute on function public.can_vote_poll(uuid), public.get_poll_state(uuid), public.create_poll_atomic(uuid,text,text[],boolean,timestamptz), public.toggle_poll_vote(uuid,uuid), public.close_poll(uuid) to authenticated;
alter publication supabase_realtime add table public.polls;
