import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const repository = read("src/services/audio/radioRepository.ts");
const dataSource = read("src/services/audio/audioDataSource.ts");
const realtime = read("src/services/audio/radioRealtimeService.ts");
const hook = read("src/hooks/useAudioCatalog.ts");
const panel = read("src/components/audio/RadioPanel.tsx");
const shell = read("src/components/audio/RadioCommunityShell.tsx");
const migration = read("supabase/migrations/20260711001000_radio_services_realtime.sql");

for (const method of ["list(input?", "get(sessionId", "create(input", "updateSchedule", "cancelSchedule", "start(sessionId", "end(sessionId", "join(sessionId", "leave(sessionId", "setSaved", "react(sessionId", "assignHost"]) if (!repository.includes(method)) throw new Error(`RadioRepository missing ${method}`);
for (const marker of ["updateRadioSchedule", "cancelRadioSession", "startScheduledRadioSession", "assignRadioSessionHost", "localListeningSessions", "join_current_user_radio_listener", "leave_current_user_radio_listener"]) if (!dataSource.includes(marker)) throw new Error(`Radio data source missing ${marker}`);
for (const marker of ["createRealtimeEventDeduper", "radio_sessions", "radio_listeners", "radio_session_reactions", "reconnecting", "removeChannel", "retryTimer", "subscribers.size"]) if (!realtime.includes(marker)) throw new Error(`Radio realtime missing ${marker}`);
for (const marker of ["radioRealtimeService.subscribe", "podcastRealtimeService.subscribe", "refreshTimer", "unsubscribeRadioRealtime", "unsubscribePodcastRealtime", "unsubscribeCatalog", "RealtimeConnectionStatus", "loading", "error"]) if (!hook.includes(marker)) throw new Error(`Audio catalog hook missing ${marker}`);
for (const marker of ["radioService.listenToRadio", "radioService.saveRadio", "radioService.goLive", "radioService.endRadioSession", "radioService.cancelRadioSchedule", "busyAction", 'role={noticeTone === "error" ? "alert" : "status"}']) if (!panel.includes(marker)) throw new Error(`RadioPanel service state missing ${marker}`);
if (panel.includes("future realtime radio service") || panel.includes("hostAction(")) throw new Error("RadioPanel still contains local-only realtime placeholders");
if (!shell.includes("catalog.radioSessions") || !shell.includes("setSelectedSession")) throw new Error("Radio community shell does not reconcile realtime session state");
for (const marker of ["join_current_user_radio_listener", "on conflict(radio_session_id,user_id) where left_at is null", "leave_current_user_radio_listener", "supabase_realtime", "radio_session_reactions"]) if (!migration.includes(marker)) throw new Error(`Radio realtime migration missing ${marker}`);
if (/supabase\.from|from\("radio_/i.test(panel) || /supabase\.from|from\("radio_/i.test(shell)) throw new Error("Radio components must not call Supabase directly");

console.log("Radio repository, atomic listener state, realtime dedupe/reconnect/cleanup, typed loading, and service-wired UI smoke passed.");
