alter table public.communities add column if not exists discovery_listed boolean not null default false, add column if not exists category text;
do $$ begin if not exists(select 1 from pg_constraint where conname='communities_discovery_category_check') then alter table public.communities add constraint communities_discovery_category_check check(category is null or category in ('development','design','gaming','music','study','work')); end if; end $$;
create index if not exists idx_communities_discovery on public.communities(category,created_at desc) where visibility='public' and public_read_enabled=true and discovery_listed=true;
-- Existing communities SELECT RLS exposes public rows and members only. Discovery queries must additionally filter all three public/listed fields.
