begin;

update public.roles
set is_default = true
where system_key = 'member'
  and is_default = false;

create or replace function public.enforce_community_role_invariants()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.system_key = 'owner'
      and exists (select 1 from public.communities where id = old.community_id)
    then
      raise exception 'OWNER_ROLE_DELETE_FORBIDDEN' using errcode = '42501';
    end if;
    if old.system_key = 'member'
      and exists (select 1 from public.communities where id = old.community_id)
    then
      raise exception 'DEFAULT_ROLE_DELETE_FORBIDDEN' using errcode = '42501';
    end if;
    return old;
  end if;

  if new.system_key is null then
    new.system_key := case lower(new.name)
      when 'owner' then 'owner'
      when 'admin' then 'admin'
      when 'moderator' then 'moderator'
      when 'member' then 'member'
      else null
    end;
  end if;

  if new.system_key = 'member' then
    new.is_default := true;
  end if;

  if new.system_key = 'owner'
    and (lower(new.name) <> 'owner' or new.level <> 100 or new.is_default)
  then
    raise exception 'OWNER_ROLE_INVARIANT' using errcode = '23514';
  end if;
  if new.system_key <> 'owner' and new.level >= 100 then
    raise exception 'OWNER_POSITION_RESERVED' using errcode = '23514';
  end if;
  if new.system_key = 'admin' and new.level not between 80 and 99 then
    raise exception 'ADMIN_ROLE_POSITION_INVALID' using errcode = '23514';
  end if;
  if new.system_key = 'moderator' and new.level not between 60 and 79 then
    raise exception 'MODERATOR_ROLE_POSITION_INVALID' using errcode = '23514';
  end if;
  if new.system_key = 'member' and new.level not between 0 and 59 then
    raise exception 'MEMBER_ROLE_POSITION_INVALID' using errcode = '23514';
  end if;
  if new.is_default and new.system_key <> 'member' then
    raise exception 'DEFAULT_ROLE_INVALID' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE'
    and old.system_key = 'owner'
    and (
      new.community_id <> old.community_id
      or new.system_key is distinct from old.system_key
      or new.level <> 100
      or lower(new.name) <> 'owner'
    )
  then
    raise exception 'OWNER_ROLE_MUTATION_FORBIDDEN' using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.enforce_community_role_invariants() is
  'Central role invariant: every built-in Member role is the sole default role; owner and hierarchy protections remain enforced.';

commit;