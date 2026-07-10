-- Enable DM rows for Supabase Realtime. RLS remains authoritative for row delivery.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages') then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_message_reactions') then
    alter publication supabase_realtime add table public.direct_message_reactions;
  end if;
end $$;
