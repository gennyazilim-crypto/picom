-- Owner-authorized Storage boundary split from Task 499 so ordinary schema/RPC
-- migrations can be reconciled without claiming Storage policy ownership.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('community-branding','community-branding',true,6291456,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "public reads community branding" on storage.objects for select to public using(bucket_id='community-branding');
create policy "managers upload community branding" on storage.objects for insert to authenticated with check(bucket_id='community-branding' and lower(storage.extension(name)) in ('png','jpg','jpeg','webp') and public.effective_community_permission(((storage.foldername(name))[1])::uuid,'manageCommunity'));
create policy "managers update community branding" on storage.objects for update to authenticated using(bucket_id='community-branding' and public.effective_community_permission(((storage.foldername(name))[1])::uuid,'manageCommunity')) with check(bucket_id='community-branding' and lower(storage.extension(name)) in ('png','jpg','jpeg','webp'));
create policy "managers delete community branding" on storage.objects for delete to authenticated using(bucket_id='community-branding' and public.effective_community_permission(((storage.foldername(name))[1])::uuid,'manageCommunity'));
commit;
