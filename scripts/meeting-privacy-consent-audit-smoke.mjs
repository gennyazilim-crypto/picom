import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const expect=(source,markers,label)=>{for(const marker of markers)if(!source.includes(marker))throw new Error(`${label}: missing ${marker}`)};

const migration=read("supabase/migrations/20260711163000_meeting_privacy_consent_audit.sql");
const pgtap=read("supabase/tests/meeting_privacy_consent_audit.sql");
const indicator=read("src/components/meeting/MeetingMediaPrivacyIndicator.tsx");
const topbar=read("src/components/meeting/MeetingTopBar.tsx");
const waiting=read("src/components/meeting/MeetingWaitingRoomHostQueue.tsx");
const auditService=read("src/services/auditLogService.ts");
const retention=read("docs/meeting-privacy-retention.md");
const diagnostics=read("docs/meeting-diagnostics-privacy.md");
const legal=["meeting-terms-draft.md","meeting-privacy-draft.md","meeting-community-guidelines-draft.md"].map((name)=>read(`docs/legal/${name}`));

expect(migration,["audit_log_actor_kind_check","audit_log_safe_metadata_check","audit_log_retention_window_check","meeting_events_append_only","meeting_event_to_restricted_audit","meeting_caption_lifecycle_audit","record_livekit_meeting_moderation","meeting_admission","meeting_moderation","meeting_media","meeting_caption","retention_until"],"privacy/audit migration");
expect(migration,["message_body","request_message","raw_audio","raw_video","raw_screen","transcript","access_token","livekit_token","provider_identity"],"forbidden audit metadata keys");
expect(pgtap,["select plan(18)","clients cannot update meeting events","caption audit never stores transcript text"],"privacy pgTAP contract");
expect(indicator,["Microphone live","Camera live","Screen sharing","Captions live","Media off","role=\"status\""],"media privacy indicator");
expect(topbar,["MeetingMediaPrivacyIndicator"],"top bar integration");
expect(waiting,["Waiting requests are visible only to authorized hosts/cohosts"],"waiting privacy disclosure");
expect(auditService,["actor_id: string | null","actor_kind","row.actor_kind === \"system\" ? \"system\""],"system audit actor mapping");
expect(retention,["365-day minimum marker","730-day minimum marker","90-day minimum marker","No automatic purge","do not claim end-to-end encryption"],"retention policy");
expect(diagnostics,["Forbidden diagnostic content","Caption/transcript text","LiveKit keys/secrets/tokens","Waiting-room request messages"],"diagnostic privacy contract");
for(const draft of legal)expect(draft,["DRAFT - NOT LEGALLY APPROVED"],"legal draft status");
if(/end-to-end encrypted|E2EE protected/i.test([indicator,retention,...legal].join("\n")))throw new Error("Unsupported E2EE claim found");
if(/transcriptRetained\s*[:=]\s*true|recordingAvailable\s*[:=]\s*true/.test([migration,indicator,retention,...legal].join("\n")))throw new Error("Unsupported retained media claim found");

console.log("Task 569 meeting privacy/consent/audit structural smoke PASS (legal approval and hosted pgTAP evidence remain BLOCKED)");
