select column_name, is_nullable, data_type from information_schema.columns where table_schema='public' and table_name='communities' and is_nullable='NO' order by ordinal_position;
