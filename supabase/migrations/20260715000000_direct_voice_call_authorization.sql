-- Direct (1:1) voice-call LiveKit authorization for DM calls.
--
-- Mirrors public.authorize_livekit_room but scopes access to the participants of a
-- direct conversation instead of community membership, so a DM peer can be rung
-- into a private `direct:<conversationId>` LiveKit room. Forward-only and idempotent
-- (create or replace). Deploy alongside the livekit-token Edge Function change that
-- accepts a `conversationId`.
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

  -- Both participants of a 1:1 direct conversation may publish audio and screen.
  -- Note: block-list enforcement (reject if either participant has blocked the
  -- other) can be layered here once wired to the canonical blocks table.
  return query select target_conversation_id, true, true;
end $$;

revoke all on function public.authorize_direct_livekit_room(uuid, text) from public, anon;
grant execute on function public.authorize_direct_livekit_room(uuid, text) to authenticated;

commit;
