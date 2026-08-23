begin;
select plan(10);

select has_function('public', 'publish_business_product', array['uuid'], 'publish product RPC');
select has_function('public', 'submit_business_product_for_review', array['uuid'], 'submit product RPC');
select has_function('public', 'create_business_post_promotion_request', array['uuid'], 'promotion request RPC');
select has_function('public', 'create_business_promotion_creative_snapshot', array['uuid'], 'creative snapshot RPC');
select has_function('public', 'create_business_campaign_draft_from_promotion', array['uuid','text'], 'campaign draft RPC');
select has_function('public', 'get_public_business_product', array['text','text'], 'public product DTO');
select has_function('public', 'resolve_sponsored_delivery_eligibility', array['uuid','uuid'], 'sponsored eligibility');
select has_table('public', 'ad_creative_snapshots', 'creative snapshots table');
select has_table('public', 'business_post_promotion_requests', 'promotion requests table');
select has_table('public', 'business_product_variants', 'variants table');

-- Documented negative matrix (execute under Docker pgTAP fixtures when available):
-- anon draft product denied; cross-org product mutate denied; content manager cannot approve moderation;
-- analyst cannot create product; client cannot set campaign active; creative snapshot immutable;
-- draft product cannot be tagged; pending malware media not public; ad_free ineligible for sponsored delivery;
-- ad_free still eligible to see organic business posts via not_paid_placement / organic contentKind.

select * from finish();
rollback;
