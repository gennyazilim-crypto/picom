-- Task 175: atomic bot credential rotation and explicit security contract.

alter table public.bot_credentials add column if not exists hash_algorithm text not null default 'sha256';
alter table public.bot_credentials drop constraint if exists bot_credentials_hash_algorithm_check;
alter table public.bot_credentials add constraint bot_credentials_hash_algorithm_check check (hash_algorithm in ('sha256'));

create or replace function public.rotate_community_bot_credential(target_community_id uuid, target_bot_id uuid)
returns table(raw_token text, token_prefix text, created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare revoked boolean;
begin
  -- Both called functions repeat manager, installation and owner/app-admin checks.
  select public.revoke_community_bot_credential(target_community_id, target_bot_id) into revoked;
  if not revoked then raise exception 'ACTIVE_BOT_CREDENTIAL_REQUIRED'; end if;
  return query select issued.raw_token, issued.token_prefix, issued.created_at from public.issue_community_bot_credential(target_community_id, target_bot_id) issued;
end;
$$;

revoke all on function public.rotate_community_bot_credential(uuid,uuid) from public, anon;
grant execute on function public.rotate_community_bot_credential(uuid,uuid) to authenticated;

comment on function public.rotate_community_bot_credential(uuid,uuid) is
  'Atomically revokes the active credential and returns a replacement token once. Any issue failure rolls back the revocation; hashes and raw tokens are never returned together.';
comment on column public.bot_credentials.hash_algorithm is
  'High-entropy token hash algorithm identifier. Raw bot credentials are never stored.';
