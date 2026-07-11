import { readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(path,"utf8");
const includes = (source,marker,label) => { if(!source.includes(marker)) throw new Error(`${label} is missing: ${marker}`); };
const friend=read("src/services/friends/friendRequestService.ts");
const presence=read("src/services/friends/friendPresenceService.ts");
const facade=read("src/services/directMessages/directMessageService.ts");
const repository=read("src/services/supabase/directMessageService.ts");
const realtime=read("src/services/directMessages/directRealtimeService.ts");
const typing=read("src/hooks/useDirectTypingBroadcast.ts");
const upload=read("src/services/directMessages/directAttachmentUploadService.ts");
const migration=read("supabase/migrations/20260711151200_friends_dm_production_integration.sql");
const test=read("supabase/tests/rls/friends_dm_production_integration.sql");

for(const marker of ["send_friend_request","respond_friend_request","cancel_friend_request","remove_friend","list_friend_suggestions","subscribeToNotifications","removeChannel"]) includes(friend,marker,"Friend production lifecycle");
for(const marker of ["list_friend_presence","set_my_friend_presence","removeChannel"]) includes(presence,marker,"Friend presence lifecycle");
for(const marker of ["send_direct_message_v3","target_attachments","IDEMPOTENCY_CONFLICT","list_direct_shared_media","mark_direct_conversation_read_to"]) includes(repository,marker,"DM repository contract");
includes(facade,"attachments: input.attachments","DM facade atomic attachment handoff");
if(facade.includes("if (input.attachments?.length) { const saved = await addDirectMessageAttachments")) throw new Error("DM send still persists attachment metadata after the message transaction.");
for(const marker of ["direct_message:insert","direct_reaction:add","direct_attachment:add","direct_read_state:update","client.removeChannel"]) includes(realtime,marker,"DM Realtime lifecycle");
for(const marker of ["private: true","broadcast","removeChannel"]) includes(typing,marker,"DM private typing lifecycle");
for(const marker of ["direct-message-attachments","conversationId","attachmentId","userId","createSignedUrl"]) includes(upload,marker,"DM private upload path");
for(const marker of ["DM_IDEMPOTENCY_CONFLICT","jsonb_to_recordset","dm attachments author upload","direct_message_attachments"]) includes(migration,marker,"DM database integration");
includes(test,"Friends and Direct Messages Realtime publications cover production tables","Hosted-ready Friends/DM pgTAP contract");

for(const file of readdirSync("src/components").filter((name)=>/DirectMessages|Friends/.test(name)&&name.endsWith(".tsx"))){const source=read(`src/components/${file}`);if(/getSupabaseClient|supabase\.from|client\.from\(|client\.rpc\(|client\.storage\./.test(source))throw new Error(`Friends/DM UI bypasses services: ${file}`);}
console.log("Supabase Friends and Direct Messages production integration contract passed.");
