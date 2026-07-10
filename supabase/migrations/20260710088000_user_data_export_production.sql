alter table public.data_export_requests
  add column if not exists format text not null default 'json' check (format in ('json')),
  add column if not exists expires_at timestamptz,
  add column if not exists failure_code text check (failure_code is null or char_length(failure_code) <= 80);

create index if not exists idx_data_export_requests_user_requested
  on public.data_export_requests(user_id, requested_at desc);
create index if not exists idx_data_export_requests_expiry
  on public.data_export_requests(expires_at)
  where expires_at is not null;

revoke update, delete on public.data_export_requests from authenticated;

comment on table public.data_export_requests is
  'User-owned export job metadata only. Export payloads, auth tokens, passwords, service keys, and private content are not stored in this table.';
