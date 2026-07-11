begin;
select plan(10);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token) values
('51000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task510-owner@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('51000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task510-member@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','',''),
('51000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','task510-visitor@picom.local',crypt('PicomDev123!',gen_salt('bf')),now(),'{}','{}',now(),now(),'','','','');
insert into public.profiles(id,username,display_name,status,status_text,accent_color) values
('51000000-0000-4000-8000-000000000001','task510-owner','Task 510 Owner','online','','#007571'),
('51000000-0000-4000-8000-000000000002','task510-member','Task 510 Member','online','','#10C2BB'),
('51000000-0000-4000-8000-000000000003','task510-visitor','Task 510 Visitor','online','','#FF772E');

select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select * from public.create_text_community_with_defaults('51000000-0000-4000-8000-000000000010','Task 510 Text')$$,'owner creates Text fixture');
reset role;

insert into public.community_members(community_id,user_id,role_id)
select community.id,'51000000-0000-4000-8000-000000000002',role.id from public.communities community join public.roles role on role.community_id=community.id and role.name='Member' where community.creation_request_id='51000000-0000-4000-8000-000000000010';
insert into public.channels(id,community_id,category_id,name,type,is_private,public_read_enabled,position)
select '51000000-0000-4000-8000-000000000040',community.id,category.id,'private-room','text',true,false,99
from public.communities community
join public.channel_categories category on category.community_id=community.id
where community.creation_request_id='51000000-0000-4000-8000-000000000010'
order by category.position,category.id
limit 1;
insert into public.communities(id,owner_id,kind,name,visibility,public_read_enabled) values('51000000-0000-4000-8000-000000000020','51000000-0000-4000-8000-000000000001','radio','Task 510 Radio','private',false);
insert into public.channels(id,community_id,name,type,is_private,public_read_enabled,position) values('51000000-0000-4000-8000-000000000021','51000000-0000-4000-8000-000000000020','invalid-text','text',false,false,0);

select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select lives_ok(format($sql$select * from public.send_text_message_idempotent(%L,%L,'hello','task510-idempotent')$sql$,(select id from public.communities where creation_request_id='51000000-0000-4000-8000-000000000010'),(select channel.id from public.channels channel join public.communities community on community.id=channel.community_id where community.creation_request_id='51000000-0000-4000-8000-000000000010' and channel.name='general')),'member sends through authoritative RPC');
select lives_ok(format($sql$select * from public.send_text_message_idempotent(%L,%L,'hello','task510-idempotent')$sql$,(select id from public.communities where creation_request_id='51000000-0000-4000-8000-000000000010'),(select channel.id from public.channels channel join public.communities community on community.id=channel.community_id where community.creation_request_id='51000000-0000-4000-8000-000000000010' and channel.name='general')),'idempotent retry returns the previous successful message');
select is((select count(*) from public.messages where author_id='51000000-0000-4000-8000-000000000002' and client_message_id='task510-idempotent'),1::bigint,'retry creates no duplicate');
select throws_like(format($sql$select * from public.send_text_message_idempotent(%L,%L,'changed','task510-idempotent')$sql$,(select id from public.communities where creation_request_id='51000000-0000-4000-8000-000000000010'),(select channel.id from public.channels channel join public.communities community on community.id=channel.community_id where community.creation_request_id='51000000-0000-4000-8000-000000000010' and channel.name='general')),'%MESSAGE_IDEMPOTENCY_CONFLICT%','idempotency key cannot be reused for different message content');
select throws_like($$select * from public.send_text_message_idempotent('51000000-0000-4000-8000-000000000020','51000000-0000-4000-8000-000000000021','blocked','task510-radio')$$,'%MESSAGE_SEND_FORBIDDEN%','member cannot send Text messages to a Radio community');
select throws_like(format($sql$select * from public.send_text_message_idempotent(%L,%L,'private','task510-private')$sql$,(select id from public.communities where creation_request_id='51000000-0000-4000-8000-000000000010'),'51000000-0000-4000-8000-000000000040'),'%MESSAGE_SEND_FORBIDDEN%','private channel denial is enforced by the message RPC');
insert into public.attachments(id,uploader_id,storage_path,file_name,mime_type,size_bytes,attachment_type,status) select '51000000-0000-4000-8000-000000000030','51000000-0000-4000-8000-000000000002',format('communities/%s/channels/%s/pending/51000000-0000-4000-8000-000000000002/image.png',community.id,channel.id),'image.png','image/png',12,'image','pending' from public.communities community join public.channels channel on channel.community_id=community.id and channel.name='general' where community.creation_request_id='51000000-0000-4000-8000-000000000010';
select lives_ok(format($sql$select * from public.send_text_message_idempotent(%L,%L,'with image','task510-attachment',null,array['51000000-0000-4000-8000-000000000030'::uuid])$sql$,(select id from public.communities where creation_request_id='51000000-0000-4000-8000-000000000010'),(select channel.id from public.channels channel join public.communities community on community.id=channel.community_id where community.creation_request_id='51000000-0000-4000-8000-000000000010' and channel.name='general')),'message and attachment commit together');
select ok((select message_id is not null and status='attached' from public.attachments where id='51000000-0000-4000-8000-000000000030'),'pending attachment is linked atomically to the sent message');
reset role;

select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select throws_like(format($sql$select * from public.send_text_message_idempotent(%L,%L,'visitor','task510-visitor')$sql$,(select id from public.communities where creation_request_id='51000000-0000-4000-8000-000000000010'),(select channel.id from public.channels channel join public.communities community on community.id=channel.community_id where community.creation_request_id='51000000-0000-4000-8000-000000000010' and channel.name='general')),'%MESSAGE_SEND_FORBIDDEN%','visitor cannot send through the RPC');
reset role;

select * from finish();
rollback;
