-- TASK30: clips + media job queue (server-side processing; max clip 60s).

begin;

create table if not exists public.publisher_clips (
  id uuid primary key default gen_random_uuid(),
  replay_id uuid not null references public.publisher_replays(id) on delete cascade,
  recording_id uuid not null references public.publisher_recordings(id) on delete cascade,
  stream_id uuid not null references public.publisher_streams(id) on delete cascade,
  publisher_user_id uuid not null references public.profiles(id) on delete cascade,
  created_by_user_id uuid not null references public.profiles(id) on delete cascade,
  start_ms bigint not null check (start_ms >= 0),
  end_ms bigint not null check (end_ms > start_ms),
  duration_ms bigint not null check (duration_ms > 0 and duration_ms <= 60000),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  visibility text not null default 'PRIVATE'
    check (visibility in ('PUBLIC', 'UNLISTED', 'PRIVATE')),
  status text not null default 'REQUESTED'
    check (status in (
      'REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'PUBLISHED', 'PRIVATE', 'TAKEDOWN', 'DELETED'
    )),
  media_storage_bucket text,
  media_storage_path text,
  thumbnail_storage_bucket text,
  thumbnail_storage_path text,
  processing_state text not null default 'PENDING'
    check (processing_state in ('PENDING', 'PROCESSING', 'READY', 'FAILED')),
  moderation_state text not null default 'VISIBLE'
    check (moderation_state in ('VISIBLE', 'RESTRICTED', 'TAKEDOWN', 'DELETED')),
  failure_code text,
  published_at timestamptz,
  deleted_at timestamptz,
  idempotency_key text,
  internal_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publisher_clips_bounds check (end_ms - start_ms = duration_ms)
);

create unique index if not exists publisher_clips_idempotency_uidx
  on public.publisher_clips (idempotency_key)
  where idempotency_key is not null;

create index if not exists publisher_clips_publisher_idx
  on public.publisher_clips (publisher_user_id, created_at desc);

create index if not exists publisher_clips_replay_idx
  on public.publisher_clips (replay_id, created_at desc);

create table if not exists public.publisher_media_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null
    check (job_type in ('MEDIA_PROBE', 'THUMBNAIL', 'CLIP_EXTRACT', 'CLEANUP_TEMP')),
  recording_id uuid references public.publisher_recordings(id) on delete cascade,
  replay_id uuid references public.publisher_replays(id) on delete cascade,
  clip_id uuid references public.publisher_clips(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 10),
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists publisher_media_jobs_idempotency_uidx
  on public.publisher_media_jobs (idempotency_key)
  where idempotency_key is not null;

create index if not exists publisher_media_jobs_claim_idx
  on public.publisher_media_jobs (status, run_after)
  where status in ('queued', 'running');

alter table public.publisher_clips enable row level security;
alter table public.publisher_media_jobs enable row level security;

revoke all on table public.publisher_clips from public, anon, authenticated;
revoke all on table public.publisher_media_jobs from public, anon, authenticated;
grant all on table public.publisher_clips to service_role;
grant all on table public.publisher_media_jobs to service_role;

create policy publisher_clips_owner_select
  on public.publisher_clips for select to authenticated
  using (publisher_user_id = auth.uid() and deleted_at is null);

create or replace function public.request_publisher_clip(
  target_replay_id uuid,
  target_start_ms bigint,
  target_end_ms bigint,
  target_title text,
  target_visibility text default 'PRIVATE',
  target_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  replay_row public.publisher_replays%rowtype;
  rec public.publisher_recordings%rowtype;
  clip_row public.publisher_clips%rowtype;
  duration bigint;
  safe_vis text := coalesce(nullif(target_visibility, ''), 'PRIVATE');
  key text;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into replay_row from public.publisher_replays where id = target_replay_id for share;
  if not found or replay_row.publisher_user_id is distinct from actor then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if replay_row.deleted_at is not null or replay_row.moderation_state in ('TAKEDOWN', 'DELETED') then
    raise exception 'REPLAY_LOCKED';
  end if;
  if replay_row.status not in ('READY', 'PUBLISHED', 'UNLISTED', 'PRIVATE') then
    raise exception 'REPLAY_NOT_READY';
  end if;
  select * into rec from public.publisher_recordings where id = replay_row.recording_id;
  if rec.status <> 'READY' or rec.storage_path is null then
    raise exception 'MEDIA_UNAVAILABLE';
  end if;

  if target_start_ms is null or target_end_ms is null or target_start_ms < 0 or target_end_ms <= target_start_ms then
    raise exception 'CLIP_BOUNDS_INVALID';
  end if;
  duration := target_end_ms - target_start_ms;
  if duration > 60000 then
    raise exception 'CLIP_DURATION_EXCEEDED';
  end if;
  if replay_row.duration_ms is not null and target_end_ms > replay_row.duration_ms then
    raise exception 'CLIP_BOUNDS_INVALID';
  end if;
  if safe_vis not in ('PUBLIC', 'UNLISTED', 'PRIVATE') then
    safe_vis := 'PRIVATE';
  end if;

  key := nullif(btrim(coalesce(target_idempotency_key, '')), '');
  if key is not null then
    select * into clip_row from public.publisher_clips where idempotency_key = key;
    if found then
      return jsonb_build_object('clip_id', clip_row.id, 'status', clip_row.status, 'duplicate', true);
    end if;
  end if;

  insert into public.publisher_clips (
    replay_id, recording_id, stream_id, publisher_user_id, created_by_user_id,
    start_ms, end_ms, duration_ms, title, visibility, status, processing_state, idempotency_key
  ) values (
    replay_row.id, rec.id, replay_row.stream_id, actor, actor,
    target_start_ms, target_end_ms, duration,
    left(btrim(coalesce(target_title, 'Clip')), 120),
    safe_vis, 'REQUESTED', 'PENDING', key
  )
  returning * into clip_row;

  if not exists (
    select 1 from public.publisher_media_jobs
    where idempotency_key = 'clip-extract:' || clip_row.id::text
  ) then
    insert into public.publisher_media_jobs (
      job_type, recording_id, replay_id, clip_id, status, idempotency_key, payload
    ) values (
      'CLIP_EXTRACT', rec.id, replay_row.id, clip_row.id, 'queued',
      'clip-extract:' || clip_row.id::text,
      jsonb_build_object('start_ms', target_start_ms, 'end_ms', target_end_ms)
    );
  end if;

  perform public.publisher_media_append_audit(
    'CLIP_CREATED', replay_row.stream_id, rec.id, replay_row.id, clip_row.id, actor,
    jsonb_build_object('duration_ms', duration)
  );

  return jsonb_build_object('clip_id', clip_row.id, 'status', clip_row.status, 'duplicate', false);
end;
$$;

create or replace function public.claim_publisher_media_jobs(
  worker_id text,
  batch_size integer default 5
)
returns setof public.publisher_media_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lim integer := greatest(1, least(coalesce(batch_size, 5), 25));
begin
  return query
  with claimed as (
    select j.id
    from public.publisher_media_jobs j
    where j.status = 'queued'
      and j.run_after <= now()
    order by j.created_at
    for update skip locked
    limit lim
  )
  update public.publisher_media_jobs j
  set status = 'running',
      locked_at = now(),
      locked_by = left(coalesce(worker_id, 'worker'), 120),
      attempts = attempts + 1,
      updated_at = now()
  from claimed
  where j.id = claimed.id
  returning j.*;
end;
$$;

create or replace function public.complete_publisher_media_job(
  target_job_id uuid,
  target_success boolean,
  target_error text default null,
  target_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  job public.publisher_media_jobs%rowtype;
  safe jsonb := coalesce(target_result, '{}'::jsonb)
    - 'signed_url' - 'token' - 'secret' - 'command';
begin
  select * into job from public.publisher_media_jobs where id = target_job_id for update;
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  if target_success then
    update public.publisher_media_jobs
    set status = 'succeeded', last_error = null, updated_at = now(), payload = payload || safe
    where id = target_job_id;

    if job.clip_id is not null and job.job_type = 'CLIP_EXTRACT' then
      update public.publisher_clips
      set status = 'READY',
          processing_state = 'READY',
          media_storage_bucket = coalesce(safe->>'bucket', media_storage_bucket),
          media_storage_path = coalesce(safe->>'path', media_storage_path),
          updated_at = now()
      where id = job.clip_id;
    end if;
  else
    update public.publisher_media_jobs
    set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
        run_after = case when attempts >= max_attempts then run_after else now() + make_interval(secs => least(300, attempts * 15)) end,
        last_error = left(coalesce(target_error, 'JOB_FAILED'), 500),
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where id = target_job_id;

    if job.clip_id is not null and job.attempts >= job.max_attempts then
      update public.publisher_clips
      set status = 'FAILED', processing_state = 'FAILED', failure_code = 'CLIP_PROCESSING_FAILED', updated_at = now()
      where id = job.clip_id;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.request_publisher_clip(uuid, bigint, bigint, text, text, text) from public, anon;
revoke all on function public.claim_publisher_media_jobs(text, integer) from public, anon, authenticated;
revoke all on function public.complete_publisher_media_job(uuid, boolean, text, jsonb) from public, anon, authenticated;

grant execute on function public.request_publisher_clip(uuid, bigint, bigint, text, text, text) to authenticated;
grant execute on function public.claim_publisher_media_jobs(text, integer) to service_role;
grant execute on function public.complete_publisher_media_job(uuid, boolean, text, jsonb) to service_role;

comment on table public.publisher_clips is
  'Publisher clips from own replays. Max duration 60s. Server-side FFmpeg/worker only.';
comment on table public.publisher_media_jobs is
  'SKIP LOCKED media processing queue. Payload must not contain shell command fragments.';

commit;
