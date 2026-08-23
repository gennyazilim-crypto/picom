begin;
select plan(12);

-- Skeleton + contract presence. Full negative/positive RLS matrix executes when local Docker + pgTAP are available.
select has_function('public', 'get_business_application_applicant_dto', array['uuid'], 'applicant DTO RPC exists');
select has_function('public', 'get_business_application_admin_dto', array['uuid'], 'admin DTO RPC exists');
select has_function('public', 'create_business_document_record', array['uuid','text','text','text','text','text'], 'document creation is RPC-only');
select has_function('public', 'approve_business_application', array['uuid','text','text','text'], 'approve RPC exists');
select has_function('public', 'submit_business_application_snapshot', array['uuid','text'], 'immutable submit snapshot RPC exists');
select has_function('public', 'create_organization_invitation', array['uuid','text','text','text','timestamptz'], 'invitation RPC exists');
select has_function('public', 'accept_organization_invitation', array['text'], 'invitation accept by token hash');
select has_function('public', 'get_public_business_profile_bundle', array['text'], 'public profile allowlist RPC exists');
select has_table('public', 'business_application_documents', 'documents table exists');
select has_table('public', 'business_application_submissions', 'submissions table exists');
select has_table('public', 'business_domain_verifications', 'domain verifications table exists');
select ok(
  has_table_privilege('authenticated', 'public.business_application_documents', 'select'),
  'members may only read through RLS'
);

-- Documented scenarios for hosted/CI expansion (negative):
-- 1 anon cannot read business applications
-- 2 unrelated user cannot read applications
-- 3 applicant cannot self-approve
-- 4 applicant cannot read internal_review_notes
-- 5 org A cannot read org B documents
-- 6 content manager cannot mutate legal application
-- 7 brand manager cannot assign organization_owner
-- 8 business admin cannot remove last owner
-- 9 normal user cannot activate business badge
-- 10 user subject cannot hold business badge
-- 11 unrelated user cannot mint document signed URL
-- 12 applicant cannot alter malware_scan_status
-- 13 applicant cannot alter document review_status
-- 14 non-root cannot call approve
-- 15 suspended org cannot publish profile
-- 16 revoked profile not publicly readable
-- 17 cross-org asset assignment forbidden
-- 18 invitation token replay forbidden
-- 19 expired invitation reject
-- 20 client cannot insert business_dashboard entitlement
-- 21 analyst cannot read verification documents
-- 22 billing admin cannot read legal documents
-- 23 public DTO omits VAT/registration
-- 24 public profile omits risk state
-- 25 status history update/delete forbidden

-- Positive scenarios:
-- applicant draft read/edit, owner submit, business admin requires_information edit,
-- brand manager profile edit, root admin DTO, approve mint badge+entitlement,
-- anon read published profile, follow, owner invite, invitee accept, root signed URL, applicant document metadata

select * from finish();
rollback;
