import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const checks=[
  ["migration lifecycle and ephemeral retention",read("supabase/migrations/20260711161000_meeting_captions_transcript.sql"),["meeting_caption_sessions","retention_mode='ephemeral'","meeting_caption_consents","meeting_caption_dispatches","auth.role()<>'service_role'","grant execute on function public.prepare_meeting_caption_dispatch(uuid,uuid) to service_role"]],
  ["consent-aware token",read("supabase/functions/meeting-token/index.ts"),["meeting_caption_audio_allowed","captionConsentRequired","canPublishAudio"]],
  ["secure lifecycle edge",read("supabase/functions/meeting-captions/index.ts"),["AgentDispatchService/${path}","CreateDispatch","createLiveKitRoomAdminToken","deepgram_livekit_agent","retentionMode: \"ephemeral\"","SUPABASE_SERVICE_ROLE_KEY"]],
  ["authenticated agent callback",read("supabase/functions/meeting-captions-agent/index.ts"),["secureEqual","X-Picom-Captions-Callback-Secret","meeting_caption_sessions"]],
  ["server-side Deepgram agent",read("services/captions-agent/agent.py"),["deepgram.STT","nova-3","AutoSubscribe.AUDIO_ONLY","retentionMode","DEEPGRAM_API_KEY"]],
  ["LiveKit text stream",read("src/services/voiceService.ts"),["registerTextStreamHandler(\"lk.transcription\"","lk.transcription_final","subscribeTranscriptions","unregisterTextStreamHandler"]],
  ["caption service",read("src/services/meeting/meetingCaptionService.ts"),["segments:current.slice(-200)","meeting-captions","Live captions are unavailable in mock mode","recordConsent"]],
  ["caption UI",read("src/components/meeting/MeetingCaptionPanel.tsx"),["Ephemeral by design","Allow live transcription?","Request captions","Stop captions"]],
  ["room indicator and overlay",read("src/components/meeting/MeetingWorkspace.tsx")+read("src/components/meeting/MeetingTopBar.tsx"),["MeetingCaptionsOverlay","meetingCaptionService.activate","Captions live","Caption consent"]],
];
for(const [label,source,markers] of checks){for(const marker of markers){if(!source.includes(marker))throw new Error(`${label}: missing ${marker}`)}}
const forbidden=["fake caption","mock transcript","VITE_DEEPGRAM","dangerouslySetInnerHTML"];
const renderer=[read("src/services/meeting/meetingCaptionService.ts"),read("src/components/meeting/MeetingCaptionPanel.tsx"),read("src/components/meeting/MeetingCaptionsOverlay.tsx")].join("\n");
for(const marker of forbidden){if(renderer.includes(marker))throw new Error(`renderer contains forbidden caption marker: ${marker}`)}
console.log("Task 567 live captions/transcript structural smoke PASS (hosted provider evidence remains separate)");
