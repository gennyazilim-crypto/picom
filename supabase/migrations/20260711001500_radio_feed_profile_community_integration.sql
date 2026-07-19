create table if not exists public.audio_feed_read_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('radio_session', 'podcast_episode')),
  item_id uuid not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create index if not exists audio_feed_read_states_user_read_idx on public.audio_feed_read_states (user_id, read_at desc);
alter table public.audio_feed_read_states enable row level security;

drop policy if exists "users read visible own audio feed state" on public.audio_feed_read_states;
create policy "users read visible own audio feed state" on public.audio_feed_read_states for select to authenticated
using (user_id = auth.uid() and public.can_save_audio_item(item_type, item_id));

drop policy if exists "users mark visible audio feed items read" on public.audio_feed_read_states;
create policy "users mark visible audio feed items read" on public.audio_feed_read_states for insert to authenticated
with check (user_id = auth.uid() and public.can_save_audio_item(item_type, item_id));

drop policy if exists "users remove own audio feed state" on public.audio_feed_read_states;
create policy "users remove own audio feed state" on public.audio_feed_read_states for delete to authenticated
using (user_id = auth.uid());

revoke all on public.audio_feed_read_states from anon;
grant select, insert, delete on public.audio_feed_read_states to authenticated;
comment on table public.audio_feed_read_states is 'Private per-user read state for visible Radio and Podcast feed items; source visibility remains RLS-enforced.';;
