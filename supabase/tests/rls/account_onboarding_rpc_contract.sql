-- Account onboarding RPC contract and self-targeting guarantees.
-- Run only against an isolated local/staging Supabase database.
begin;
select plan(11);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('c1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onboarding-actor@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('c1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onboarding-other@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '');

insert into public.profiles(id, username, display_name, status, status_text, accent_color, bio)
values
  ('c1000000-0000-4000-8000-000000000001', 'onboarding-actor', 'Original Actor', 'online', 'Original status', '#007571', 'Keep this profile bio'),
  ('c1000000-0000-4000-8000-000000000002', 'onboarding-other', 'Other User', 'online', 'Other status', '#FF772E', 'Other profile bio');

select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select lives_ok(
  $$
    select *
    from public.complete_current_user_onboarding(
      jsonb_build_object('displayName', 'Finished Actor', 'username', 'onboarding-actor', 'statusText', 'Ready'),
      '{}'::uuid[],
      'dark',
      'joinInvite',
      'not-a-real-invite'
    )
  $$,
  'authenticated user completes only their onboarding'
);

reset role;

select is(
  (select onboarding_completed from public.profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  true,
  'completion marks the actor profile complete'
);
select ok(
  (select onboarding_completed_at is not null from public.profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  'completion writes a server timestamp'
);
select is(
  (select onboarding_completed from public.profiles where id = 'c1000000-0000-4000-8000-000000000002'),
  false,
  'the RPC cannot complete another user profile'
);
select is(
  (select onboarding_start_choice from public.profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  'joinInvite',
  'start choice is persisted for the actor'
);
select is(
  (select onboarding_initial_feed from public.profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  'invite',
  'initial feed is derived from the persisted start choice'
);

select set_config(
  'picom.onboarding.completed_at',
  (select onboarding_completed_at::text from public.profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  true
);
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select lives_ok(
  $$
    select *
    from public.complete_current_user_onboarding(
      jsonb_build_object('displayName', 'Finished Actor', 'username', 'onboarding-actor', 'statusText', 'Ready'),
      '{}'::uuid[],
      'dark',
      'joinInvite',
      'not-a-real-invite'
    )
  $$,
  'duplicate completion call succeeds'
);

reset role;

select is(
  (select onboarding_completed_at::text from public.profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  current_setting('picom.onboarding.completed_at', true),
  'duplicate completion preserves the original completion timestamp'
);
select is(
  (select count(*) from public.user_settings where user_id = 'c1000000-0000-4000-8000-000000000001'),
  1::bigint,
  'duplicate completion does not duplicate account settings'
);
select is(
  (select bio from public.profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  'Keep this profile bio',
  'completion preserves unrelated profile fields'
);
select is(
  (select accent_color from public.profiles where id = 'c1000000-0000-4000-8000-000000000001'),
  '#007571',
  'completion preserves unrelated profile presentation fields'
);

select * from finish();
rollback;
