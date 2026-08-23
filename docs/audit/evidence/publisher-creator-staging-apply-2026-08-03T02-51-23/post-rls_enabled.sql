select c.relname, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'publisher_%' order by 1;
