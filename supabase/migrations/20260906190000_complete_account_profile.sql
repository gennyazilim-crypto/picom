-- Account Center compatibility RPC. No account/role changes run during deployment.
-- Rollback: a forward migration may revoke execute on this function and drop it.
begin;
alter table public.profiles add column if not exists country_code text;
alter table public.profiles add column if not exists profile_completed_at timestamptz;
create or replace function public.complete_account_profile(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  handle text := lower(btrim(payload->>'username'));
  display text := btrim(payload->>'display_name');
  country text := nullif(upper(btrim(payload->>'country_code')), '');
  zone text := payload->>'timezone';
  language text := payload->>'preferred_language';
begin
  if actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'PROFILE_PATCH_INVALID' using errcode='22023';
  end if;
  if payload - array['username','display_name','bio','country_code','timezone','preferred_language']::text[] <> '{}'::jsonb then
    raise exception 'PROFILE_PATCH_FIELD_INVALID' using errcode='22023';
  end if;
  if exists (select 1 from jsonb_each(payload) field where jsonb_typeof(field.value) not in ('string','null')) then
    raise exception 'PROFILE_PATCH_INVALID' using errcode='22023';
  end if;
  if handle is null or handle !~ '^[a-z0-9_]{3,24}$' then raise exception 'INVALID_USERNAME' using errcode='22023'; end if;
  if display is null or char_length(display) not between 1 and 64 then raise exception 'INVALID_DISPLAY_NAME' using errcode='22023'; end if;
  if char_length(coalesce(payload->>'bio','')) > 280 then raise exception 'INVALID_BIO' using errcode='22023'; end if;
  if country is not null and country !~ '^[A-Z]{2}$' then raise exception 'INVALID_COUNTRY' using errcode='22023'; end if;
  if zone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception 'INVALID_TIMEZONE' using errcode='22023'; end if;
  if language is null or language not in ('en','tr') then raise exception 'INVALID_LANGUAGE' using errcode='22023'; end if;
  perform 1 from public.profiles where id=actor for update;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='22023'; end if;

  perform public.update_own_profile_domain(jsonb_build_object(
    'username', handle, 'displayName', display, 'bio', payload->>'bio',
    'timezone', zone, 'preferredLanguage', language));
  update public.profiles set country_code=country,
    profile_completed_at=coalesce(profile_completed_at, now()),
    onboarding_completed=true, onboarding_completed_at=coalesce(onboarding_completed_at, now()),
    updated_at=now() where id=actor;
  return jsonb_build_object('ok', true, 'user_id', actor);
end;
$$;
revoke all on function public.complete_account_profile(jsonb) from public, anon;
grant execute on function public.complete_account_profile(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
