import type { MeetingClientJoinRequest, MeetingClientResult, MeetingClientSnapshot } from "./meetingClient";
import type { MeetingJoinPolicy } from "./meeting";
import type { VoiceDeviceOption, VoiceDevicePermission } from "../services/voiceDeviceService";

export type MeetingPreJoinErrorCode = "CAMERA_DENIED"|"CAMERA_MISSING"|"CAMERA_BUSY"|"CAMERA_UNSUPPORTED"|"MICROPHONE_DENIED"|"DEVICE_UNAVAILABLE"|"TOKEN_FAILED";
export type MeetingNoiseShieldMode = "off"|"standard";

export type MeetingPreJoinRoomInfo = Readonly<{
  communityName:string;
  roomTitle:string;
  hostName:string;
  joinPolicy:MeetingJoinPolicy;
  waitingRoomEnabled:boolean;
  guestNotice?:string;
}>;

export type MeetingPreJoinSnapshot = Readonly<{
  request:MeetingClientJoinRequest|null;
  roomInfo:MeetingPreJoinRoomInfo|null;
  microphonePermission:VoiceDevicePermission;
  cameraPermission:VoiceDevicePermission;
  microphones:readonly VoiceDeviceOption[];
  cameras:readonly VoiceDeviceOption[];
  speakers:readonly VoiceDeviceOption[];
  selectedMicrophoneId:string;
  selectedCameraId:string;
  selectedSpeakerId:string;
  joinMuted:boolean;
  joinCameraOff:boolean;
  noiseShieldMode:MeetingNoiseShieldMode;
  cameraPreviewActive:boolean;
  cameraPreviewStream:MediaStream|null;
  microphoneTestActive:boolean;
  microphoneLevel:number;
  speakerTestActive:boolean;
  busy:boolean;
  notice:string|null;
  error:Readonly<{code:MeetingPreJoinErrorCode;message:string;recoverable:boolean}>|null;
}>;

export type MeetingPreJoinSubmitResult = MeetingClientResult<MeetingClientSnapshot>;
