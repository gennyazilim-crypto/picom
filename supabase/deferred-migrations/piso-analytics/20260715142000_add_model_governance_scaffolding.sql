-- T83 model registry/deployments, T85 drift metrics, T87 prediction+explanation log,
-- T88 feedback loop. Applied to piso prod 2026-07-15. Additive; admin-read RLS + service_role
-- writers. This is the DB-side scaffolding for the ML-governance tasks; the serving/training
-- side (T84) still requires external infra — see OPERATOR_RUNBOOK_INFRA_ML_TASKS.md.
-- Rollback: drop the five tables + register_model()/record_feedback_signal() functions.

create table if not exists public.model_registry (
  model_key text not null,
  version text not null,
  artifact_uri text,
  metrics jsonb not null default '{}'::jsonb,
  status text not null default 'registered' check (status in ('registered','staged','production','archived')),
  created_at timestamptz not null default now(),
  primary key (model_key, version)
);
alter table public.model_registry enable row level security;
create policy "model registry admin read" on public.model_registry for select using (public.is_app_admin());

create table if not exists public.model_deployments (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  version text not null,
  env text not null default 'production',
  active boolean not null default true,
  deployed_at timestamptz not null default now()
);
alter table public.model_deployments enable row level security;
create policy "model deployments admin read" on public.model_deployments for select using (public.is_app_admin());

create or replace function public.register_model(model_key_input text, version_input text,
  artifact_uri_input text default null, metrics_input jsonb default '{}'::jsonb, status_input text default 'registered')
returns void language sql security definer set search_path to 'public'
as $function$
  insert into public.model_registry(model_key, version, artifact_uri, metrics, status)
  values (model_key_input, version_input, artifact_uri_input, coalesce(metrics_input,'{}'::jsonb), coalesce(status_input,'registered'))
  on conflict (model_key, version) do update
    set artifact_uri = excluded.artifact_uri, metrics = excluded.metrics, status = excluded.status;
$function$;
revoke all on function public.register_model(text,text,text,jsonb,text) from public;
revoke all on function public.register_model(text,text,text,jsonb,text) from anon;
revoke all on function public.register_model(text,text,text,jsonb,text) from authenticated;
grant execute on function public.register_model(text,text,text,jsonb,text) to service_role;

create table if not exists public.model_drift_metrics (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  metric text not null,
  value numeric not null,
  window_label text,
  computed_at timestamptz not null default now()
);
create index if not exists model_drift_model_idx on public.model_drift_metrics (model_key, computed_at desc);
alter table public.model_drift_metrics enable row level security;
create policy "model drift admin read" on public.model_drift_metrics for select using (public.is_app_admin());

create table if not exists public.model_predictions (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  subject_hash text,
  score numeric,
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists model_predictions_model_idx on public.model_predictions (model_key, created_at desc);
alter table public.model_predictions enable row level security;
create policy "model predictions admin read" on public.model_predictions for select using (public.is_app_admin());

create table if not exists public.feedback_events (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid,
  signal text not null,
  weight numeric not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists feedback_events_subject_idx on public.feedback_events (subject_type, subject_id);
alter table public.feedback_events enable row level security;
create policy "feedback events admin read" on public.feedback_events for select using (public.is_app_admin());

create or replace function public.record_feedback_signal(subject_type_input text, subject_id_input uuid, signal_input text, weight_input numeric default 1)
returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare new_id uuid;
begin
  insert into public.feedback_events(subject_type, subject_id, signal, weight)
  values (subject_type_input, subject_id_input, signal_input, coalesce(weight_input,1))
  returning id into new_id;
  return new_id;
end;
$function$;
revoke all on function public.record_feedback_signal(text,uuid,text,numeric) from public;
revoke all on function public.record_feedback_signal(text,uuid,text,numeric) from anon;
revoke all on function public.record_feedback_signal(text,uuid,text,numeric) from authenticated;
grant execute on function public.record_feedback_signal(text,uuid,text,numeric) to service_role;
