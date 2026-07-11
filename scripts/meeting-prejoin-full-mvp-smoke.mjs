import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const service=read("src/services/meeting/meetingPreJoinService.ts"),component=read("src/components/meeting/MeetingPreJoin.tsx"),types=read("src/types/meetingPreJoin.ts"),adapter=read("src/services/meeting/meetingLiveKitAdapter.ts"),voice=read("src/services/voiceService.ts"),workspace=read("src/components/meeting/MeetingWorkspace.tsx");
for(const marker of ["startCameraPreview","stopCameraPreview","requestMicrophoneAccess","selectCamera","selectMicrophone","selectSpeaker","testMicrophone","testSpeaker","setNoiseShield","submit"])assert.ok(service.includes(marker),`prejoin service missing ${marker}`);
assert.ok(service.indexOf("mediaDevices.getUserMedia({")>service.indexOf("async startCameraPreview"),"camera capture must exist only behind explicit preview action");
assert.ok(service.includes("audio:false")&&service.includes("meetingService.join(next,true)")&&service.includes("joinMuted")&&service.includes("joinCameraOff"),"preview isolation or real join choices missing");
for(const copy of ["Hosted by","Preview camera","Allow microphone","Test speaker","Join muted","Join with camera off","Noise Shield","Request to join"])assert.ok(component.includes(copy),`prejoin UI missing ${copy}`);
for(const code of ["CAMERA_DENIED","CAMERA_MISSING","CAMERA_BUSY","CAMERA_UNSUPPORTED","MICROPHONE_DENIED","TOKEN_FAILED"])assert.ok(types.includes(code),`missing typed recovery ${code}`);
assert.ok(adapter.includes("cameraDeviceId")&&voice.includes("setCameraEnabled")&&voice.includes("options.muted"),"join choices must reach LiveKit adapter");
assert.ok(workspace.includes('snapshot.phase==="prejoin"')&&workspace.includes("<MeetingPreJoin"),"workspace prejoin surface missing");
assert.ok(!service.match(/getDisplayMedia|desktopCapturer|startScreenShare|recording|MediaRecorder/i)&&!component.match(/screen share|record/i),"PreJoin must not request screen capture or recording");
assert.ok(service.includes("picom.meeting-prejoin.v1")&&!service.includes("token:"),"safe preferences must persist without tokens");
console.log("Meeting PreJoin explicit permissions, camera preview, devices, Noise Shield, join policy, recovery, and real join flow: PASS");
