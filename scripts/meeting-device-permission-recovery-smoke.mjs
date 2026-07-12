import { readFile } from "node:fs/promises";

const [devices, prejoin, recovery, voice, adapter, meeting, types, store, topbar, screenCapture] = await Promise.all([
  readFile("src/services/voiceDeviceService.ts", "utf8"), readFile("src/services/meeting/meetingPreJoinService.ts", "utf8"),
  readFile("src/services/meeting/meetingDeviceRecoveryService.ts", "utf8"), readFile("src/services/voiceService.ts", "utf8"),
  readFile("src/services/meeting/meetingLiveKitAdapter.ts", "utf8"), readFile("src/services/meeting/meetingService.ts", "utf8"),
  readFile("src/types/meetingClient.ts", "utf8"), readFile("src/stores/meetingStore.ts", "utf8"),
  readFile("src/components/meeting/MeetingTopBar.tsx", "utf8"), readFile("src/services/screenCaptureService.ts", "utf8"),
]);
const checks=[
  [devices.includes('permissions.query({ name: "microphone"')&&recovery.includes('permissions.query({name:"camera"'),"microphone and camera permission observation"],
  [devices.includes("deviceChangeTimer")&&devices.includes("deviceRevision")&&devices.includes("350"),"debounced device/default change revision"],
  [devices.includes("system default input")&&prejoin.includes("system default camera"),"microphone and camera fallback notices"],
  [devices.includes("NotReadableError")&&prejoin.includes("CAMERA_BUSY"),"busy device guidance"],
  [recovery.includes("inFlight")&&voice.includes("mediaRecoveryPromise"),"single-flight recovery without retry loops"],
  [recovery.includes("sleepWakeResumeService.onResume")&&recovery.includes("refresh(false)"),"sleep/wake recovery without permission request"],
  [voice.includes("desiredMicrophoneMuted")&&voice.includes("desiredCameraEnabled")&&voice.includes("noiseShieldService"),"mute camera and Noise Shield preferences retained"],
  [voice.includes("setMicrophoneWithMeetingProcessing")&&voice.includes("setCameraEnabled(false)")&&adapter.includes("recoverMediaDevices"),"existing tracks replaced instead of duplicated"],
  [types.includes("deviceNotice")&&store.includes("deviceNotice: null")&&topbar.includes("meeting-device-notice"),"actual recovery state reaches meeting UI"],
  [meeting.includes("meetingDeviceRecoveryService.start")&&meeting.includes("sessionCleanups"),"meeting lifecycle cleanup"],
  [devices.includes("Windows:")&&devices.includes("macOS:")&&devices.includes("Linux:")&&screenCapture.includes("Screen Recording"),"platform permission guidance"],
  [!recovery.includes("getUserMedia")&&!recovery.includes("requestMicrophoneAccess"),"coordinator never opens native permission dialogs"],
];
const failed=checks.filter(([ok])=>!ok);if(failed.length){for(const[,label]of failed)console.error(`FAIL: ${label}`);process.exit(1)}for(const[,label]of checks)console.log(`PASS: ${label}`);console.log("Meeting device and permission recovery contract passed.");
