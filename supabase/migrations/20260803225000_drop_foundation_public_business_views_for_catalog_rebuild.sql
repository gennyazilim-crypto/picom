-- Additive compatibility predecessor for 20260803230000.
-- PostgreSQL CREATE OR REPLACE VIEW cannot rename/reorder columns (SQLSTATE 42P16).
-- Foundation (20260803173000) created public_business_products with column "sku".
-- Catalog migration replaces that view with "price_display_mode" (and expands posts).
-- Drop views only so 230000 can recreate them safely. Does not rewrite prior migrations.

begin;

drop view if exists public.public_business_products cascade;
drop view if exists public.public_business_posts cascade;

commit;
