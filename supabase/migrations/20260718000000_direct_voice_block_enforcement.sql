-- Enforce user blocking on direct (1:1) voice/screen calls.
--
-- Security fix: authorize_direct_livekit_room only checked conversation membership, NOT the
-- block list — so a user who has been blocked could still obtain a publish-capable LiveKit
-- token for the shared direct room and ring/join a call with someone who blocked them,
-- defeating the harassment-prevention purpose of blocking (every other cross-user action —
-- DMs, friend requests, invites — already calls users_are_blocked). Forward-only create-or-replace
-- that adds the missing guard. Deploy to the app backend (ufmtv).
begin;

create or replace function public.authorize_direct_livekit_room(
  target_conversation_id uuid,
  target_intent text
)
returns table(
  conversation_id uuid,
  can_publish_audio boolean,
  can_publish_screen boolean
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_intent not in ('voice','screen') then raise exception 'VOICE_INTENT_INVALID' using errcode='22023'; end if;

  if not exists (
    select 1
    from public.direct_conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.user_id = auth.uid()
  ) then
    raise exception 'VOICE_DIRECT_FORBIDDEN' using errcode='42501';
  end if;

  -- Block-list enforcement: reject if either participant has blocked the other.
  if exists (
    select 1
    from public.direct_conversation_participants other
    where other.conversation_id = target_conversation_id
      and other.user_id <> auth.uid()
      and public.users_are_blocked(auth.uid(), other.user_id)
  ) then
    raise exception 'VOICE_DIRECT_FORBIDDEN' using errcode='42501';
  end if;

  -- Both (non-blocked) participants of a 1:1 direct conversation may publish audio and screen.
  return query select target_conversation_id, true, true;
end $$;

revoke all on function public.authorize_direct_livekit_room(uuid, text) from public, anon;
grant execute on function public.authorize_direct_livekit_room(uuid, text) to authenticated;

commit;
