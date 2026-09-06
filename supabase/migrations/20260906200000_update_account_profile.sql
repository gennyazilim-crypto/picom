-- Account Center edits use canonical profile storage atomically.
begin;
create or replace function public.update_account_profile(payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare actor uuid:=auth.uid(); country text:=nullif(upper(btrim(payload->>'country_code')),'');
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'PROFILE_PATCH_INVALID' using errcode='22023'; end if;
  if payload-array['display_name','bio','country_code','timezone']::text[]<>'{}'::jsonb then raise exception 'PROFILE_PATCH_FIELD_INVALID' using errcode='22023'; end if;
  if exists(select 1 from jsonb_each(payload) f where jsonb_typeof(f.value) not in ('string','null')) then raise exception 'PROFILE_PATCH_INVALID' using errcode='22023'; end if;
  if payload->>'display_name' is null or char_length(btrim(payload->>'display_name')) not between 1 and 64 then raise exception 'INVALID_DISPLAY_NAME' using errcode='22023'; end if;
  if char_length(coalesce(payload->>'bio',''))>280 then raise exception 'INVALID_BIO' using errcode='22023'; end if;
  if country is not null and country !~ '^[A-Z]{2}$' then raise exception 'INVALID_COUNTRY' using errcode='22023'; end if;
  if payload->>'timezone' is not null and not exists(select 1 from pg_catalog.pg_timezone_names where name=payload->>'timezone') then raise exception 'INVALID_TIMEZONE' using errcode='22023'; end if;
  perform 1 from public.profiles where id=actor for update;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='22023'; end if;
  perform public.update_own_profile_domain(jsonb_build_object('displayName',payload->>'display_name','bio',payload->>'bio','timezone',payload->>'timezone'));
  update public.profiles set country_code=country,updated_at=now() where id=actor;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.update_account_profile(jsonb) from public,anon;
grant execute on function public.update_account_profile(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
