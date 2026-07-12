import { readFile } from "node:fs/promises";

const [main, preload, service, picker, control, dock, voice, focus, policy, lease, migration, sqlTest] = await Promise.all([
  readFile("electron/main.cts", "utf8"), readFile("electron/preload.cts", "utf8"), readFile("src/services/screenCaptureService.ts", "utf8"),
  readFile("src/components/voice/ScreenSharePicker.tsx", "utf8"), readFile("src/services/meeting/meetingControlService.ts", "utf8"),
  readFile("src/components/meeting/MeetingControlDock.tsx", "utf8"), readFile("src/services/voiceService.ts", "utf8"),
  readFile("src/components/meeting/MeetingScreenShareFocus.tsx", "utf8"), readFile("src/services/livekit/screenShareSubscriptionPolicy.ts", "utf8"),
  readFile("src/services/meeting/meetingScreenShareLeaseService.ts", "utf8"), readFile("supabase/migrations/20260711160300_meeting_screen_share_lease.sql", "utf8"),
  readFile("supabase/tests/meeting_screen_share_lease.sql", "utf8"),
]);
const checks=[
  [main.includes('types: ["screen", "window"]')&&main.includes("isTrustedIpcEvent")&&main.includes("screenCaptureSessions"),"validated main-process source enumeration"],
  [preload.includes("invokeWhitelisted")&&!preload.includes("desktopCapturer:"),"minimal preload screen-capture bridge"],
  [service.includes("userInitiated: true")&&service.includes("isValidSource")&&service.includes("cancelSelection"),"explicit source validation and cancel service"],
  [picker.includes("useEffect")&&picker.includes("activeRequestId")&&picker.includes("thumbnailDataUrl"),"picker thumbnails and unmount cleanup"],
  [control.includes("cancelShareSelection")&&dock.includes("thumbnailDataUrl")&&dock.includes("chooseShare"),"meeting dock safe source flow"],
  [voice.includes("publishTrack(track")&&voice.includes("Track.Source.ScreenShare")&&voice.includes("track.onended")&&voice.includes("TrackUnsubscribed"),"LiveKit publish and lifecycle cleanup"],
  [voice.includes("Another participant is already sharing")&&lease.includes("claim_meeting_screen_share")&&migration.includes("primary key references public.meeting_rooms"),"one active share per room"],
  [focus.includes("srcObject = share.stream")&&policy.includes("applySingleScreenShareSubscription"),"remote focus rendering and single subscription"],
  [voice.includes("audio: false")&&!dock.match(/system audio|share audio/i),"unsupported system audio remains hidden"],
  [migration.includes("authorize_meeting_action(target_room_id,'share_screen')")&&migration.includes("cleanup_meeting_screen_share_lease")&&sqlTest.includes("bypass lease RPCs"),"authoritative lease permission and cleanup"],
  [!service.includes("desktopCapturer")&&!picker.includes("desktopCapturer")&&!voice.includes("MediaRecorder"),"no raw Electron capture exposure or recording"],
];
const failed=checks.filter(([ok])=>!ok);if(failed.length){for(const[,label]of failed)console.error(`FAIL: ${label}`);process.exit(1)}for(const[,label]of checks)console.log(`PASS: ${label}`);console.log("Production meeting screen-share contract passed.");
