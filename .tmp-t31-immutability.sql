do $$
begin
  update public.publisher_finance_ledger_entries
  set amount_minor = 1
  where internal_test = true;
  raise notice 'UNEXPECTED_UPDATE_ALLOWED';
exception
  when others then
    raise notice 'IMMUTABILITY_OK: %', SQLERRM;
end $$;

do $$
begin
  delete from public.publisher_finance_ledger_entries where internal_test = true;
  raise notice 'UNEXPECTED_DELETE_ALLOWED';
exception
  when others then
    raise notice 'IMMUTABILITY_DELETE_OK: %', SQLERRM;
end $$;
