insert into supabase_migrations.schema_migrations (version)
values
  ('20260808340000'),
  ('20260808350000'),
  ('20260808360000'),
  ('20260808370000'),
  ('20260808380000')
on conflict do nothing;

select version
from supabase_migrations.schema_migrations
where version like '202608083%'
order by version;

select
  to_regclass('public.publisher_kyc_profiles') as kyc,
  to_regclass('public.publisher_tax_profiles') as tax,
  to_regclass('public.publisher_payout_accounts') as accounts,
  to_regclass('public.publisher_payout_requests') as requests,
  to_regclass('public.publisher_payout_holds') as holds,
  to_regclass('public.publisher_finance_statements') as stmts,
  to_regclass('public.publisher_payout_batches') as batches,
  to_regclass('public.publisher_payout_reconciliation_issues') as recon;
