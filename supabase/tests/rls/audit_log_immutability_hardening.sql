begin;
select plan(7);
select has_trigger('public','audit_log','audit_log_append_only','append-only trigger exists');
select has_function('public','prevent_audit_log_mutation','mutation blocker exists');
select has_function('public','redact_audit_reason',array['text'],'reason redactor exists');
select ok(not has_table_privilege('authenticated','public.audit_log','INSERT'),'authenticated cannot insert audit rows directly');
select ok(not has_table_privilege('authenticated','public.audit_log','UPDATE'),'authenticated cannot update audit rows');
select ok(not has_table_privilege('authenticated','public.audit_log','DELETE'),'authenticated cannot delete audit rows');
select is(public.redact_audit_reason('token=example password=example'), 'token=[REDACTED] password=[REDACTED]', 'secret-like reason values are redacted');
select * from finish();
rollback;

-- Staging behavior must also test owner/admin scoped SELECT, member denial,
-- direct INSERT denial, service-role UPDATE/DELETE trigger denial, correction
-- as a new row, account/community delete restriction, and export redaction.
