-- Correct the discovery classification for the existing Cs GO community.
-- This targeted backfill avoids changing any other community's owner-selected category.
update public.communities
set category = 'gaming'
where name = 'Cs GO'
  and category = 'work';
