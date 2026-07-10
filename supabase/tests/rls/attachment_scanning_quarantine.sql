-- Structural Task 139 checks. Behavioral object tests require disposable local/staging Supabase.
begin;
select plan(4);
select has_column('public','attachments','scan_status','attachment scan status exists');
select col_not_null('public','attachments','scan_status','scan status is required');
select has_index('public','attachments','idx_attachments_quarantine_review','quarantine review index exists');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='message attachments read scanned visible object'),'Storage scan-gated read policy exists');
select * from finish();
rollback;

-- Staging behavior: uploader cannot insert/update scan_status; pending/suspicious/
-- failed signed URL creation fails; clean visible message succeeds; private channel,
-- removed membership, wrong uploader, and cross-community object access fail.
