\set ON_ERROR_STOP on

BEGIN;
INSERT INTO public.channel_categories(id,community_id,name,position) VALUES ('62400000-0000-4000-8000-000000000001',:'community','Task 624 isolated',6240);
INSERT INTO public.channels(id,community_id,category_id,name,type,topic,is_private,position,public_read_enabled) VALUES
 ('62400000-0000-4000-8000-000000000002',:'community','62400000-0000-4000-8000-000000000001','task-624-private','text','isolated lifecycle',true,6240,false),
 ('62400000-0000-4000-8000-000000000012',:'community','62400000-0000-4000-8000-000000000001','task-624-delete','text','isolated cascade',false,6241,false);
INSERT INTO public.messages(id,community_id,channel_id,author_id,body,client_message_id,sequence) VALUES
 ('62400000-0000-4000-8000-000000000003',:'community','62400000-0000-4000-8000-000000000002',:'actor1','Task 624 private fixture','task624-private',1),
 ('62400000-0000-4000-8000-000000000013',:'community','62400000-0000-4000-8000-000000000012',:'actor1','Task 624 cascade fixture','task624-cascade',1);
INSERT INTO public.attachments(id,message_id,uploader_id,storage_path,file_name,mime_type,size_bytes,attachment_type,status,scan_status) VALUES
 ('62400000-0000-4000-8000-000000000004','62400000-0000-4000-8000-000000000003',:'actor1','task624/private.png','private.png','image/png',4,'image','attached','clean'),
 ('62400000-0000-4000-8000-000000000014','62400000-0000-4000-8000-000000000013',:'actor1','task624/cascade.png','cascade.png','image/png',4,'image','attached','clean');
INSERT INTO public.community_invites(id,community_id,code,created_by,max_uses,uses) VALUES ('62400000-0000-4000-8000-000000000005',:'community','TASK624-ISOLATED',:'owner',1,0);
INSERT INTO public.direct_conversations(id,type,created_by) VALUES ('62400000-0000-4000-8000-000000000006','direct',:'actor1');
INSERT INTO public.direct_conversation_participants(id,conversation_id,user_id) VALUES
 ('62400000-0000-4000-8000-000000000007','62400000-0000-4000-8000-000000000006',:'actor1'),
 ('62400000-0000-4000-8000-000000000008','62400000-0000-4000-8000-000000000006',:'actor2');
INSERT INTO public.direct_messages(id,conversation_id,author_id,body,client_message_id) VALUES ('62400000-0000-4000-8000-000000000009','62400000-0000-4000-8000-000000000006',:'actor1','Task 624 DM fixture','task624-dm');
INSERT INTO public.direct_message_attachments(id,message_id,uploader_id,storage_path,file_name,mime_type,size_bytes,url,file_size) VALUES ('62400000-0000-4000-8000-000000000010','62400000-0000-4000-8000-000000000009',:'actor1','task624/dm.png','dm.png','image/png',4,'https://invalid.example/task624/dm.png',4);
INSERT INTO public.direct_message_reactions(id,message_id,user_id,emoji) VALUES ('62400000-0000-4000-8000-000000000011','62400000-0000-4000-8000-000000000009',:'actor2','ok');
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'outsider',true);
SELECT set_config('request.jwt.claims',json_build_object('sub',:'outsider','role','authenticated')::text,true);
SELECT ((SELECT count(*) FROM public.channels WHERE id='62400000-0000-4000-8000-000000000002')=0
 AND (SELECT count(*) FROM public.messages WHERE id='62400000-0000-4000-8000-000000000003')=0
 AND (SELECT count(*) FROM public.direct_conversations WHERE id='62400000-0000-4000-8000-000000000006')=0
 AND (SELECT count(*) FROM public.direct_messages WHERE id='62400000-0000-4000-8000-000000000009')=0) AS outsider_hidden \gset
ROLLBACK;
\if :outsider_hidden
\else
\quit 21
\endif

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'actor1',true);
SELECT set_config('request.jwt.claims',json_build_object('sub',:'actor1','role','authenticated')::text,true);
SELECT ((SELECT count(*) FROM public.direct_conversations WHERE id='62400000-0000-4000-8000-000000000006')=1
 AND (SELECT count(*) FROM public.direct_messages WHERE id='62400000-0000-4000-8000-000000000009')=1) AS participant_visible \gset
SELECT (SELECT count(*)=1 FROM public.delete_message_with_version('62400000-0000-4000-8000-000000000003',NULL)) AS message_rpc_ok \gset
ROLLBACK;
\if :participant_visible
\else
\quit 22
\endif
\if :message_rpc_ok
\else
\quit 23
\endif

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner',true);
SELECT set_config('request.jwt.claims',json_build_object('sub',:'owner','role','authenticated')::text,true);
SELECT (SELECT count(*)=1 FROM public.revoke_community_invite('62400000-0000-4000-8000-000000000005')) AS invite_rpc_ok \gset
ROLLBACK;
\if :invite_rpc_ok
\else
\quit 24
\endif

BEGIN;
UPDATE public.messages SET body='[deleted]',deleted_at=now() WHERE id='62400000-0000-4000-8000-000000000003';
DELETE FROM public.attachments WHERE id='62400000-0000-4000-8000-000000000004';
UPDATE public.community_invites SET revoked_at=now() WHERE id='62400000-0000-4000-8000-000000000005';
UPDATE public.direct_messages SET body='[deleted]',deleted_at=now() WHERE id='62400000-0000-4000-8000-000000000009';
DELETE FROM public.direct_conversations WHERE id='62400000-0000-4000-8000-000000000006';
UPDATE public.communities SET owner_id=:'actor2' WHERE id=:'community';
DELETE FROM public.community_members WHERE community_id=:'community' AND user_id=:'actor3';
INSERT INTO public.community_bans(id,community_id,user_id,banned_by,reason) VALUES ('62400000-0000-4000-8000-000000000015',:'community',:'actor3',:'owner','Task 624 isolated drill');
DELETE FROM public.channels WHERE id='62400000-0000-4000-8000-000000000012';
UPDATE public.profiles SET username='deleted_task624_'||substr(id::text,1,8),display_name='Deleted User',avatar_url=NULL,status='offline',status_text='Account deleted',bio='',is_deleted=true,deleted_at=now() WHERE id=:'outsider';
UPDATE auth.refresh_tokens SET revoked=true WHERE user_id::text=:'session_user';
DELETE FROM auth.sessions WHERE user_id=:'session_user';
UPDATE public.user_device_sessions SET revoked_at=now() WHERE user_id=:'session_user';
CREATE TABLE public.task624_migration_probe(id uuid PRIMARY KEY,marker text NOT NULL);
ALTER TABLE public.task624_migration_probe ADD COLUMN applied_at timestamptz DEFAULT now();
INSERT INTO public.task624_migration_probe VALUES ('62400000-0000-4000-8000-000000000016','forward',now());
DROP TABLE public.task624_migration_probe;
SELECT ((SELECT count(*) FROM public.messages WHERE id='62400000-0000-4000-8000-000000000003' AND deleted_at IS NOT NULL AND body='[deleted]')=1
 AND (SELECT count(*) FROM public.attachments WHERE id='62400000-0000-4000-8000-000000000004')=0
 AND (SELECT count(*) FROM public.community_invites WHERE id='62400000-0000-4000-8000-000000000005' AND revoked_at IS NOT NULL)=1
 AND (SELECT count(*) FROM public.direct_conversation_participants WHERE conversation_id='62400000-0000-4000-8000-000000000006')=0
 AND (SELECT count(*) FROM public.direct_messages WHERE conversation_id='62400000-0000-4000-8000-000000000006')=0
 AND (SELECT count(*) FROM public.direct_message_attachments WHERE message_id='62400000-0000-4000-8000-000000000009')=0
 AND (SELECT count(*) FROM public.direct_message_reactions WHERE message_id='62400000-0000-4000-8000-000000000009')=0
 AND (SELECT count(*) FROM public.communities WHERE id=:'community' AND owner_id=:'actor2')=1
 AND (SELECT count(*) FROM public.community_members WHERE community_id=:'community' AND user_id=:'actor3')=0
 AND (SELECT count(*) FROM public.community_bans WHERE id='62400000-0000-4000-8000-000000000015' AND revoked_at IS NULL)=1
 AND (SELECT count(*) FROM public.channels WHERE id='62400000-0000-4000-8000-000000000012')=0
 AND (SELECT count(*) FROM public.messages WHERE id='62400000-0000-4000-8000-000000000013')=0
 AND (SELECT count(*) FROM public.attachments WHERE id='62400000-0000-4000-8000-000000000014')=0
 AND (SELECT count(*) FROM public.profiles WHERE id=:'outsider' AND is_deleted AND deleted_at IS NOT NULL AND avatar_url IS NULL)=1
 AND (SELECT count(*) FROM auth.sessions WHERE user_id=:'session_user')=0
 AND (SELECT count(*) FROM auth.refresh_tokens WHERE user_id::text=:'session_user' AND revoked IS NOT TRUE)=0
 AND (SELECT count(*) FROM public.user_device_sessions WHERE user_id=:'session_user' AND revoked_at IS NULL)=0) AS lifecycle_ok \gset
ROLLBACK;
\if :lifecycle_ok
\else
\quit 25
\endif

SELECT jsonb_build_object('outsider_rls',true,'participant_dm_rls',true,'message_delete_rpc',true,'invite_revoke_rpc',true,'message_soft_delete',true,'attachment_delete',true,'dm_cascade',true,'ownership_transfer',true,'leave_kick_ban',true,'channel_cascade',true,'profile_anonymization',true,'database_session_revoke',true,'forward_fix_ddl',true);
