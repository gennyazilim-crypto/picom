-- Task 567: consent-gated, provider-neutral meeting captions control plane.
-- Caption text is ephemeral in Full MVP and is never persisted by this schema.
begin;
create table if not exists public.meeting_caption_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meeting_rooms(id) on delete cascade,
  session_id uuid not null unique references public.meeting_sessions(id) on delete cascade,
  provider text not null default 'deepgram_livekit_agent' check (provider='deepgram_livekit_agent'),
  model text not null default 'nova-3' check (char_length(model) between 1 and 80),
  language text not null default 'en' check (language in ('en','tr','de','es','fr')),
  status text not null default 'awaiting_consent' check (status in ('awaiting_consent','starting','active','stopping','stopped','failed')),
  retention_mode text not null default 'ephemeral' check (retention_mode='ephemeral'),
  consent_policy_version text not null check (char_length(consent_policy_version) between 1 and 40),
  consent_round integer not null default 1 check (consent_round between 1 and 1000),
  requested_by_user_id uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz,
  stopped_at timestamptz,
  stop_reason text check (stop_reason is null or char_length(stop_reason) between 1 and 80),
  error_code text check (error_code is null or char_length(error_code) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.meeting_caption_consents (
  id uuid primary key default gen_random_uuid(),
  caption_session_id uuid not null references public.meeting_caption_sessions(id) on delete cascade,
  participant_user_id uuid not null references public.profiles(id) on delete cascade,
  consent_round integer not null check (consent_round between 1 and 1000),
  decision text not null check (decision in ('accepted','declined')),
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(caption_session_id,participant_user_id,consent_round)
);
create table if not exists public.meeting_caption_dispatches (
  caption_session_id uuid primary key references public.meeting_caption_sessions(id) on delete cascade,
  dispatch_id text not null unique check (char_length(dispatch_id) between 1 and 180),
  provider_state text not null default 'created' check (provider_state in ('created','running','stopping','stopped','failed')),
  last_error_code text check (last_error_code is null or char_length(last_error_code) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_meeting_caption_sessions_room_status on public.meeting_caption_sessions(room_id,status,updated_at desc);
create index if not exists idx_meeting_caption_consents_session_round on public.meeting_caption_consents(caption_session_id,consent_round,decision);
alter table public.meeting_caption_sessions enable row level security;
alter table public.meeting_caption_consents enable row level security;
alter table public.meeting_caption_dispatches enable row level security;
revoke all on table public.meeting_caption_sessions,public.meeting_caption_consents,public.meeting_caption_dispatches from public,anon,authenticated;
grant select on table public.meeting_caption_sessions,public.meeting_caption_consents to authenticated;
create or replace function public.can_access_meeting_captions(target_room_id uuid,target_session_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists(
    select 1 from public.meeting_sessions session
    where session.id=target_session_id and session.room_id=target_room_id
      and (
        public.can_view_meeting_sensitive(target_room_id)
        or exists(select 1 from public.meeting_session_participants participant where participant.session_id=session.id and participant.user_id=auth.uid())
      )
  );
$$;
revoke all on function public.can_access_meeting_captions(uuid,uuid) from public,anon;
grant execute on function public.can_access_meeting_captions(uuid,uuid) to authenticated;
drop policy if exists meeting_caption_sessions_visible on public.meeting_caption_sessions;
create policy meeting_caption_sessions_visible on public.meeting_caption_sessions for select to authenticated
using(public.can_access_meeting_captions(room_id,session_id));
drop policy if exists meeting_caption_consents_visible on public.meeting_caption_consents;
create policy meeting_caption_consents_visible on public.meeting_caption_consents for select to authenticated using(
  participant_user_id=auth.uid() or exists(
    select 1 from public.meeting_caption_sessions caption
    where caption.id=caption_session_id and public.can_view_meeting_sensitive(caption.room_id)
  )
);
create or replace function public.get_meeting_caption_state(target_room_id uuid,target_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare caption public.meeting_caption_sessions%rowtype; decision text; pending_count integer:=0; can_start boolean:=false;
begin
  if auth.role()<>'service_role' then raise exception 'MEETING_CAPTION_DISPATCH_FORBIDDEN' using errcode='42501'; end if;
  begin perform public.authorize_meeting_action(target_room_id,'enable_captions'); can_start:=true; exception when others then can_start:=false; end;
  select * into caption from public.meeting_caption_sessions where room_id=target_room_id and session_id=target_session_id;
  if caption.id is null then
    return jsonb_build_object('roomId',target_room_id,'sessionId',target_session_id,'status','idle','provider','deepgram_livekit_agent','model','nova-3','language','en','retentionMode','ephemeral','canStart',can_start,'consentDecision',null,'pendingConsentCount',0,'consentRequired',false);
  end if;
  select consent.decision into decision from public.meeting_caption_consents consent where consent.caption_session_id=caption.id and consent.participant_user_id=auth.uid() and consent.consent_round=caption.consent_round;
  select count(*)::integer into pending_count from public.meeting_session_participants participant
  where participant.session_id=target_session_id and participant.state in ('joining','connected','reconnecting') and (
    participant.user_id is null or not exists(
      select 1 from public.meeting_caption_consents consent
      where consent.caption_session_id=caption.id and consent.participant_user_id=participant.user_id and consent.consent_round=caption.consent_round and consent.decision='accepted'
    )
  );
  return jsonb_build_object('id',caption.id,'roomId',caption.room_id,'sessionId',caption.session_id,'status',caption.status,'provider',caption.provider,'model',caption.model,'language',caption.language,'retentionMode',caption.retention_mode,'canStart',can_start,'consentDecision',decision,'pendingConsentCount',pending_count,'consentRequired',caption.status in ('awaiting_consent','starting','active') and decision is null,'startedAt',caption.started_at,'stoppedAt',caption.stopped_at,'errorCode',caption.error_code,'policyVersion',caption.consent_policy_version);
end;
$$;
create or replace function public.request_meeting_captions(target_room_id uuid,target_session_id uuid,target_language text,target_policy_version text)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare session_record public.meeting_sessions%rowtype; caption public.meeting_caption_sessions%rowtype;
begin
  perform public.consume_current_user_action_rate_limit('meeting_caption_write');
  perform public.authorize_meeting_action(target_room_id,'enable_captions');
  if target_language not in ('en','tr','de','es','fr') or target_policy_version<>'2026-07-11' then raise exception 'MEETING_CAPTION_POLICY_INVALID' using errcode='22023'; end if;
  select * into session_record from public.meeting_sessions where id=target_session_id and room_id=target_room_id and status in ('live','reconnecting') for update;
  if session_record.id is null then raise exception 'MEETING_CAPTION_SESSION_UNAVAILABLE' using errcode='22023'; end if;
  select * into caption from public.meeting_caption_sessions where session_id=target_session_id for update;
  if caption.id is null then
    insert into public.meeting_caption_sessions(room_id,session_id,language,consent_policy_version,requested_by_user_id)
    values(target_room_id,target_session_id,target_language,target_policy_version,auth.uid()) returning * into caption;
  elsif caption.status in ('stopped','failed') then
    update public.meeting_caption_sessions set language=target_language,status='awaiting_consent',consent_policy_version=target_policy_version,consent_round=consent_round+1,requested_by_user_id=auth.uid(),started_at=null,stopped_at=null,stop_reason=null,error_code=null,updated_at=now() where id=caption.id returning * into caption;
  end if;
  insert into public.meeting_caption_consents(caption_session_id,participant_user_id,consent_round,decision,policy_version)
  values(caption.id,auth.uid(),caption.consent_round,'accepted',target_policy_version)
  on conflict(caption_session_id,participant_user_id,consent_round) do update set decision='accepted',policy_version=excluded.policy_version,decided_at=now(),updated_at=now();
  return public.get_meeting_caption_state(target_room_id,target_session_id);
end;
$$;
create or replace function public.record_meeting_caption_consent(target_room_id uuid,target_session_id uuid,target_decision text,target_policy_version text)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare caption public.meeting_caption_sessions%rowtype; must_stop boolean:=false; state jsonb;
begin
  perform public.consume_current_user_action_rate_limit('meeting_caption_consent');
  if target_decision not in ('accepted','declined') or target_policy_version<>'2026-07-11' then raise exception 'MEETING_CAPTION_CONSENT_INVALID' using errcode='22023'; end if;
  if not public.can_access_meeting_captions(target_room_id,target_session_id) or not exists(select 1 from public.meeting_session_participants participant where participant.session_id=target_session_id and participant.user_id=auth.uid() and participant.state in ('joining','connected','reconnecting')) then raise exception 'MEETING_CAPTION_CONSENT_FORBIDDEN' using errcode='42501'; end if;
  select * into caption from public.meeting_caption_sessions where room_id=target_room_id and session_id=target_session_id for update;
  if caption.id is null or caption.status not in ('awaiting_consent','starting','active') then raise exception 'MEETING_CAPTION_NOT_REQUESTED' using errcode='22023'; end if;
  insert into public.meeting_caption_consents(caption_session_id,participant_user_id,consent_round,decision,policy_version)
  values(caption.id,auth.uid(),caption.consent_round,target_decision,target_policy_version)
  on conflict(caption_session_id,participant_user_id,consent_round) do update set decision=excluded.decision,policy_version=excluded.policy_version,decided_at=now(),updated_at=now();
  must_stop:=target_decision='declined' and caption.status in ('starting','active');
  if must_stop then update public.meeting_caption_sessions set status='stopping',stop_reason='consent_withdrawn',updated_at=now() where id=caption.id; end if;
  state:=public.get_meeting_caption_state(target_room_id,target_session_id);
  return state||jsonb_build_object('mustStop',must_stop);
end;
$$;
create or replace function public.prepare_meeting_caption_dispatch(target_room_id uuid,target_session_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare caption public.meeting_caption_sessions%rowtype; provider_room text; pending integer;
begin
  if not public.can_access_meeting_captions(target_room_id,target_session_id) then raise exception 'MEETING_CAPTION_ACCESS_FORBIDDEN' using errcode='42501'; end if;
  select * into caption from public.meeting_caption_sessions where room_id=target_room_id and session_id=target_session_id for update;
  if caption.id is null then raise exception 'MEETING_CAPTION_NOT_REQUESTED' using errcode='22023'; end if;
  if caption.status in ('starting','active') then return jsonb_build_object('shouldDispatch',false,'captionSessionId',caption.id,'status',caption.status); end if;
  if caption.status<>'awaiting_consent' then return jsonb_build_object('shouldDispatch',false,'captionSessionId',caption.id,'status',caption.status); end if;
  select count(*)::integer into pending from public.meeting_session_participants participant where participant.session_id=target_session_id and participant.state in ('joining','connected','reconnecting') and (participant.user_id is null or not exists(select 1 from public.meeting_caption_consents consent where consent.caption_session_id=caption.id and consent.participant_user_id=participant.user_id and consent.consent_round=caption.consent_round and consent.decision='accepted'));
  if pending>0 then return jsonb_build_object('shouldDispatch',false,'captionSessionId',caption.id,'status','awaiting_consent','pendingConsentCount',pending); end if;
  select provider_room_name into provider_room from public.meeting_sessions where id=target_session_id and room_id=target_room_id and status in ('live','reconnecting');
  if provider_room is null then raise exception 'MEETING_CAPTION_SESSION_UNAVAILABLE' using errcode='22023'; end if;
  update public.meeting_caption_sessions set status='starting',error_code=null,updated_at=now() where id=caption.id;
  return jsonb_build_object('shouldDispatch',true,'captionSessionId',caption.id,'roomName',provider_room,'language',caption.language,'policyVersion',caption.consent_policy_version,'retentionMode','ephemeral');
end;
$$;
create or replace function public.request_stop_meeting_captions(target_room_id uuid,target_session_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare caption public.meeting_caption_sessions%rowtype;
begin
  perform public.consume_current_user_action_rate_limit('meeting_caption_write');
  perform public.authorize_meeting_action(target_room_id,'enable_captions');
  select * into caption from public.meeting_caption_sessions where room_id=target_room_id and session_id=target_session_id for update;
  if caption.id is null then raise exception 'MEETING_CAPTION_NOT_REQUESTED' using errcode='22023'; end if;
  update public.meeting_caption_sessions set status=case when status in ('stopped','failed') then status else 'stopping' end,stop_reason='host',updated_at=now() where id=caption.id returning * into caption;
  return jsonb_build_object('captionSessionId',caption.id,'status',caption.status);
end;
$$;
create or replace function public.meeting_caption_audio_allowed(target_session_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare caption public.meeting_caption_sessions%rowtype;
begin
  if auth.uid() is null then return false; end if;
  select * into caption from public.meeting_caption_sessions where session_id=target_session_id and status in ('starting','active');
  if caption.id is null then return true; end if;
  return exists(select 1 from public.meeting_caption_consents consent where consent.caption_session_id=caption.id and consent.participant_user_id=auth.uid() and consent.consent_round=caption.consent_round and consent.decision='accepted');
end;
$$;
create or replace function public.stop_captions_when_meeting_ends()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status in ('ended','failed') and old.status is distinct from new.status then
    update public.meeting_caption_sessions set status='stopped',stopped_at=coalesce(stopped_at,now()),stop_reason=coalesce(stop_reason,'meeting_ended'),updated_at=now() where session_id=new.id and status not in ('stopped','failed');
  end if;
  return new;
end;
$$;
drop trigger if exists meeting_caption_stop_on_session_end on public.meeting_sessions;
create trigger meeting_caption_stop_on_session_end after update of status on public.meeting_sessions for each row execute function public.stop_captions_when_meeting_ends();
revoke all on function public.get_meeting_caption_state(uuid,uuid),public.request_meeting_captions(uuid,uuid,text,text),public.record_meeting_caption_consent(uuid,uuid,text,text),public.prepare_meeting_caption_dispatch(uuid,uuid),public.request_stop_meeting_captions(uuid,uuid),public.meeting_caption_audio_allowed(uuid) from public,anon,authenticated;
grant execute on function public.get_meeting_caption_state(uuid,uuid),public.request_meeting_captions(uuid,uuid,text,text),public.record_meeting_caption_consent(uuid,uuid,text,text),public.request_stop_meeting_captions(uuid,uuid),public.meeting_caption_audio_allowed(uuid) to authenticated;
grant execute on function public.prepare_meeting_caption_dispatch(uuid,uuid) to service_role;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='meeting_caption_sessions') then alter publication supabase_realtime add table public.meeting_caption_sessions; end if;
end $$;
comment on table public.meeting_caption_sessions is 'Consent and provider lifecycle only. Full MVP captions are ephemeral; transcript text and raw audio must not be stored here.';
comment on table public.meeting_caption_dispatches is 'Service-role-only LiveKit agent dispatch metadata. Never exposed to renderer clients.';
commit;
