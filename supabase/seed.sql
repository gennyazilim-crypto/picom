-- Picom local Supabase seed data
-- Development only. Do not use these credentials in production.
-- LOCAL RESET ONLY: never deploy this file with `db push --include-seed` or paste it into a hosted SQL editor.
-- Production starts with no synthetic users/communities/messages; defaults are created transactionally per community.

-- Known local credentials:
-- owner@picom.local / PicomDev123!
-- admin@picom.local / PicomDev123!
-- member@picom.local / PicomDev123!

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner@picom.local',
    crypt('PicomDev123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Aylin Studio"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@picom.local',
    crypt('PicomDev123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Mert Admin"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'member@picom.local',
    crypt('PicomDev123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Deniz Member"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do update set
  aud = excluded.aud,
  role = excluded.role,
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) values
  (
    '00000000-0000-4000-8000-000000001101',
    '00000000-0000-4000-8000-000000000101',
    'owner@picom.local',
    '{"sub":"00000000-0000-4000-8000-000000000101","email":"owner@picom.local"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000001102',
    '00000000-0000-4000-8000-000000000102',
    'admin@picom.local',
    '{"sub":"00000000-0000-4000-8000-000000000102","email":"admin@picom.local"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-4000-8000-000000001103',
    '00000000-0000-4000-8000-000000000103',
    'member@picom.local',
    '{"sub":"00000000-0000-4000-8000-000000000103","email":"member@picom.local"}'::jsonb,
    'email',
    now(),
    now(),
    now()
  )
on conflict (provider, provider_id) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, username, display_name, avatar_url, status, status_text, bio, accent_color, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000101', 'aylin', 'Aylin Studio', null, 'online', 'Designing Picom', 'Picom owner seed profile for local development.', '#007571', now(), now()),
  ('00000000-0000-4000-8000-000000000102', 'mert', 'Mert Admin', null, 'idle', 'Reviewing channels', 'Admin seed profile for local Supabase testing.', '#10C2BB', now(), now()),
  ('00000000-0000-4000-8000-000000000103', 'deniz', 'Deniz Member', null, 'online', 'Testing chat', 'Member seed profile for message and reaction flows.', '#FF772E', now(), now())
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  status = excluded.status,
  status_text = excluded.status_text,
  bio = excluded.bio,
  accent_color = excluded.accent_color,
  updated_at = now();

insert into public.communities (id, owner_id, kind, name, description, icon_url, accent_color, created_at, updated_at) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'text'::public.community_kind, 'Picom Studio', 'Premium desktop chat seed community.', null, '#007571', now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', 'text'::public.community_kind, 'Autumn Lab', 'Secondary workspace for channel switching tests.', null, '#C24D0F', now(), now())
on conflict (id) do update set
  kind = excluded.kind,
  name = excluded.name,
  description = excluded.description,
  accent_color = excluded.accent_color,
  updated_at = now();

insert into public.roles (id, community_id, name, color, level, permissions, created_at, updated_at) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Owner', '#007571', 100, '{"manageCommunity":true,"manageChannels":true,"sendMessages":true}'::jsonb, now(), now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Admin', '#10C2BB', 80, '{"manageChannels":true,"sendMessages":true}'::jsonb, now(), now()),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Member', '#FF772E', 10, '{"sendMessages":true}'::jsonb, now(), now()),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Owner', '#752C05', 100, '{"manageCommunity":true,"manageChannels":true,"sendMessages":true}'::jsonb, now(), now()),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Member', '#FF772E', 10, '{"sendMessages":true}'::jsonb, now(), now())
on conflict (id) do update set
  name = excluded.name,
  color = excluded.color,
  level = excluded.level,
  permissions = excluded.permissions,
  updated_at = now();

insert into public.community_members (id, community_id, user_id, role_id, joined_at) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', now()),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000002', now()),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000003', now()),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000004', now()),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000005', now())
on conflict (community_id, user_id) do update set
  role_id = excluded.role_id;

insert into public.channel_categories (id, community_id, name, position, created_at, updated_at) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Information', 0, now(), now()),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'General', 10, now(), now()),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Voice', 20, now(), now()),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'General', 0, now(), now())
on conflict (id) do update set
  name = excluded.name,
  position = excluded.position,
  updated_at = now();

insert into public.channels (id, community_id, category_id, name, type, topic, is_private, position, created_at, updated_at) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'announcements', 'text', 'Project updates and product notes.', false, 0, now(), now()),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'general', 'text', 'Daily desktop chat testing.', false, 10, now(), now()),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'studio-voice', 'voice', 'Voice placeholder channel.', false, 20, now(), now()),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004', 'general', 'text', 'Autumn Lab general chat.', false, 0, now(), now())
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  topic = excluded.topic,
  position = excluded.position,
  updated_at = now();

insert into public.messages (id, community_id, channel_id, author_id, body, client_message_id, created_at) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101', 'Welcome to Picom Studio. This seed keeps API mode close to the desktop mock UI.', 'seed-msg-001', now() - interval '12 minutes'),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102', 'The four-column desktop shell is ready for Supabase data.', 'seed-msg-002', now() - interval '9 minutes'),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'Testing messages, reactions, and local attachment metadata.', 'seed-msg-003', now() - interval '6 minutes'),
  ('60000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'Picom MVP seed data is installed for local Supabase testing.', 'seed-msg-004', now() - interval '3 minutes')
on conflict (id) do update set
  body = excluded.body,
  client_message_id = excluded.client_message_id;

insert into public.attachments (id, message_id, uploader_id, storage_path, file_name, mime_type, size_bytes, attachment_type, width, height, public_url, thumbnail_url, status, created_at) values
  ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000103', 'seed/picom-preview.png', 'picom-preview.png', 'image/png', 123456, 'image', 1200, 800, null, null, 'attached', now())
on conflict (id) do update set
  file_name = excluded.file_name,
  status = excluded.status;

insert into public.message_reactions (id, message_id, user_id, emoji, created_at) values
  ('80000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', '👍', now()),
  ('80000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', '🔥', now())
on conflict (message_id, user_id, emoji) do nothing;

insert into public.read_states (id, user_id, channel_id, last_read_message_id, updated_at) values
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', '50000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000003', now()),
  ('90000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000102', '50000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', now()),
  ('90000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000103', '50000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', now())
on conflict (user_id, channel_id) do update set
  last_read_message_id = excluded.last_read_message_id,
  updated_at = now();

-- Task 531 local-only meeting metadata parity. No raw media or provider credentials.
insert into public.meeting_rooms (
  id,community_id,channel_id,linked_chat_channel_id,source_kind,mode,title,description,status,join_policy,
  default_role,host_user_id,created_by,capabilities,waiting_room_enabled,max_participants,created_at,updated_at
) values (
  'a1000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000002',
  'community_channel','meeting','Picom Studio Sync','Local deterministic meeting seed.','live','members','participant',
  '00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000101',
  '{"canPublishAudio":true,"canPublishVideo":true,"canShareScreen":true,"canSendChat":true}'::jsonb,
  false,50,now(),now()
) on conflict(id) do update set title=excluded.title,status=excluded.status,capabilities=excluded.capabilities,updated_at=now();

insert into public.meeting_sessions (
  id,room_id,provider,provider_room_name,status,connection_state,started_by_user_id,started_at,participant_count,last_event_sequence,idempotency_key
) values (
  'a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','livekit',
  'picom-local-community-voice-meeting','live','connected','00000000-0000-4000-8000-000000000101',now(),2,1,'seed-meeting-session-001'
) on conflict(id) do update set status=excluded.status,connection_state=excluded.connection_state,participant_count=excluded.participant_count,updated_at=now();

insert into public.meeting_session_participants (
  id,session_id,user_id,provider_identity,display_name,role,state,capabilities,joined_at,last_seen_at
) values
  ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','local-owner','Aylin Studio','host','connected','{"canManageParticipants":true,"canEndRoom":true}'::jsonb,now(),now()),
  ('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000103','local-member','Deniz Member','participant','connected','{"canPublishAudio":true,"canSendChat":true}'::jsonb,now(),now())
on conflict(id) do update set role=excluded.role,state=excluded.state,capabilities=excluded.capabilities,last_seen_at=now(),updated_at=now();

insert into public.meeting_invites (id,room_id,invited_user_id,invited_by_user_id,role,status,token_hash,created_at,expires_at) values (
  'a4000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000101','cohost','active','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',now(),now()+interval '1 day'
) on conflict(id) do update set role=excluded.role,status=excluded.status,expires_at=excluded.expires_at;

insert into public.meeting_events (id,room_id,session_id,actor_user_id,event_type,event_source,idempotency_key,sequence,payload,occurred_at) values (
  'a5000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000101','session_started','backend','seed-meeting-event-001',1,'{"status":"live"}'::jsonb,now()
) on conflict(id) do update set sequence=excluded.sequence,payload=excluded.payload,occurred_at=excluded.occurred_at;
