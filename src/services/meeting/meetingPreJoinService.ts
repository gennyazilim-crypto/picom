import type { MeetingClientJoinRequest } from "../../types/meetingClient";
import type {
  MeetingPreJoinErrorCode,
  MeetingPreJoinRoomInfo,
  MeetingPreJoinSnapshot,
  MeetingPreJoinSubmitResult,
} from "../../types/meetingPreJoin";
import { meetingStore } from "../../stores/meetingStore";
import { voiceDeviceService } from "../voiceDeviceService";
import { meetingService } from "./meetingService";
import { meetingInviteCredentialService } from "./meetingInviteCredentialService";
import { noiseShieldService } from "../noiseShieldService";
import type { MeetingNoiseShieldMode } from "../../types/meetingPreJoin";

const STORAGE_KEY = "picom.meeting-prejoin.v1";
type Listener = () => void;
type SafePreferences = Pick<
  MeetingPreJoinSnapshot,
  "selectedCameraId" | "joinMuted" | "joinCameraOff" | "noiseShieldMode"
>;

const listeners = new Set<Listener>();
const mediaDevices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
let cameraStream: MediaStream | null = null;
let cameraPreviewGeneration = 0;
let cameraDeviceListenerAttached = false;
let cameraDeviceRefreshPending = false;

function readPreferences(): SafePreferences {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<SafePreferences>;
    return {
      selectedCameraId: typeof value.selectedCameraId === "string" ? value.selectedCameraId : "default",
      joinMuted: value.joinMuted !== false,
      joinCameraOff: value.joinCameraOff !== false,
      noiseShieldMode: ["off", "standard", "enhanced", "voice_focus"].includes(value.noiseShieldMode ?? "") ? value.noiseShieldMode as MeetingNoiseShieldMode : "off",
    };
  } catch {
    return { selectedCameraId: "default", joinMuted: true, joinCameraOff: true, noiseShieldMode: "off" };
  }
}

const preferences = readPreferences();
const voiceSnapshot = voiceDeviceService.getSnapshot();
const initialNoiseShield = noiseShieldService.getSnapshot();
let snapshot: MeetingPreJoinSnapshot = {
  request: null,
  roomInfo: null,
  microphonePermission: voiceSnapshot.permission,
  cameraPermission: mediaDevices?.getUserMedia ? "prompt" : "unsupported",
  microphones: voiceSnapshot.inputDevices,
  cameras: [],
  speakers: voiceSnapshot.outputDevices,
  selectedMicrophoneId: voiceSnapshot.selectedInputId,
  selectedCameraId: preferences.selectedCameraId,
  selectedSpeakerId: voiceSnapshot.selectedOutputId,
  joinMuted: preferences.joinMuted,
  joinCameraOff: preferences.joinCameraOff,
  noiseShieldMode: preferences.noiseShieldMode,
  noiseShieldAvailableModes: initialNoiseShield.availableModes,
  noiseShieldStatus: initialNoiseShield.status,
  noiseShieldFallbackReason: initialNoiseShield.fallbackReason,
  cameraPreviewActive: false,
  cameraPreviewStream: null,
  microphoneTestActive: false,
  microphoneLevel: 0,
  speakerTestActive: false,
  busy: false,
  notice: null,
  error: null,
};

const emit = (patch: Partial<MeetingPreJoinSnapshot>) => {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
};

noiseShieldService.subscribe(() => { const state = noiseShieldService.getSnapshot(); emit({ noiseShieldMode: state.requestedMode, noiseShieldAvailableModes: state.availableModes, noiseShieldStatus: state.status, noiseShieldFallbackReason: state.fallbackReason }); });

const persist = () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedCameraId: snapshot.selectedCameraId,
        joinMuted: snapshot.joinMuted,
        joinCameraOff: snapshot.joinCameraOff,
        noiseShieldMode: snapshot.noiseShieldMode,
      } satisfies SafePreferences),
    );
  } catch {
    // Restricted storage keeps session-only preferences. Media is never persisted.
  }
};

const createError = (code: MeetingPreJoinErrorCode, message: string, recoverable = true) => ({ code, message, recoverable });

function cameraError(value: unknown) {
  if (value instanceof DOMException) {
    if (value.name === "NotAllowedError" || value.name === "SecurityError") {
      return createError("CAMERA_DENIED", "Camera permission was denied. Enable it in system settings and try again.");
    }
    if (value.name === "NotFoundError" || value.name === "OverconstrainedError") {
      return createError("CAMERA_MISSING", "No compatible camera is available. Choose another device or join with camera off.");
    }
    if (value.name === "NotReadableError" || value.name === "AbortError") {
      return createError("CAMERA_BUSY", "The selected camera is busy in another application. Close that application and retry.");
    }
  }
  return createError("DEVICE_UNAVAILABLE", "Picom could not open the selected camera.");
}

function toCameraOptions(devices: MediaDeviceInfo[], revealLabels: boolean) {
  return devices
    .filter((device) => device.kind === "videoinput")
    .map((device, index) => ({
      deviceId: device.deviceId || "default",
      label: revealLabels && device.label ? device.label : `Camera ${index + 1}`,
      isDefault: device.deviceId === "default" || index === 0,
    }));
}

function fallbackCameraId(cameras: MeetingPreJoinSnapshot["cameras"]): string {
  return cameras.find((device) => device.isDefault)?.deviceId ?? cameras[0]?.deviceId ?? "default";
}

function videoConstraints(): MediaTrackConstraints {
  return {
    ...(snapshot.selectedCameraId === "default" ? {} : { deviceId: { exact: snapshot.selectedCameraId } }),
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 24, max: 30 },
  };
}

function releaseCameraStream(): void {
  const stream = cameraStream;
  cameraStream = null;
  stream?.getTracks().forEach((track) => track.stop());
}

function stopCameraTracks(): void {
  cameraPreviewGeneration += 1;
  releaseCameraStream();
}

async function refreshCameraDevices(restartPreviewOnFallback: boolean): Promise<void> {
  if (!mediaDevices?.enumerateDevices) {
    emit({
      cameraPermission: "unsupported",
      cameras: [],
      error: createError("CAMERA_UNSUPPORTED", "Camera selection is unavailable in this runtime."),
    });
    return;
  }

  const devices = await mediaDevices.enumerateDevices();
  const cameras = toCameraOptions(devices, snapshot.cameraPermission === "granted");
  const previousCameraId = snapshot.selectedCameraId;
  const selectionStillExists = cameras.some((device) => device.deviceId === previousCameraId);
  const selectedCameraId = selectionStillExists ? previousCameraId : fallbackCameraId(cameras);
  const cameraWasRemoved = previousCameraId !== "default" && !selectionStillExists;
  const previewWasActive = snapshot.cameraPreviewActive;

  if (!cameras.length) {
    stopCameraTracks();
    emit({
      cameras: [],
      selectedCameraId: "default",
      cameraPreviewActive: false,
      cameraPreviewStream: null,
      notice: "The camera was disconnected. You can still join with camera off.",
      error: createError("CAMERA_MISSING", "No camera was detected. You can still join with camera off."),
    });
    persist();
    return;
  }

  if (cameraWasRemoved) stopCameraTracks();
  emit({
    cameras,
    selectedCameraId,
    ...(cameraWasRemoved
      ? {
          cameraPreviewActive: false,
          cameraPreviewStream: null,
          notice: "The selected camera was removed. Picom switched to the system default camera.",
          error: null,
        }
      : {}),
  });
  persist();

  if (cameraWasRemoved && previewWasActive && restartPreviewOnFallback) {
    await meetingPreJoinService.startCameraPreview();
  }
}

async function handleCameraDeviceChange(): Promise<void> {
  if (cameraDeviceRefreshPending) return;
  cameraDeviceRefreshPending = true;
  try {
    await refreshCameraDevices(true);
  } catch {
    emit({ error: createError("DEVICE_UNAVAILABLE", "Media devices changed, but Picom could not refresh the camera list.") });
  } finally {
    cameraDeviceRefreshPending = false;
  }
}

function attachCameraDeviceListener(): void {
  if (cameraDeviceListenerAttached || !mediaDevices) return;
  mediaDevices.addEventListener("devicechange", handleCameraDeviceChange);
  cameraDeviceListenerAttached = true;
}

function detachCameraDeviceListener(): void {
  if (!cameraDeviceListenerAttached || !mediaDevices) return;
  mediaDevices.removeEventListener("devicechange", handleCameraDeviceChange);
  cameraDeviceListenerAttached = false;
}

voiceDeviceService.subscribe((devices) =>
  emit({
    microphonePermission: devices.permission,
    microphones: devices.inputDevices,
    speakers: devices.outputDevices,
    selectedMicrophoneId: devices.selectedInputId,
    selectedSpeakerId: devices.selectedOutputId,
    microphoneTestActive: devices.microphoneTestActive,
    microphoneLevel: devices.microphoneLevel,
    speakerTestActive: devices.outputTestActive,
    notice: devices.notice ?? snapshot.notice,
    ...(devices.error
      ? { error: createError(devices.permission === "denied" ? "MICROPHONE_DENIED" : "DEVICE_UNAVAILABLE", devices.error) }
      : {}),
  }),
);

export const meetingPreJoinService = {
  getSnapshot: () => snapshot,

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  configure(request: MeetingClientJoinRequest, roomInfo: MeetingPreJoinRoomInfo): void {
    emit({ request, roomInfo, error: null, notice: null });
  },

  activate(): void {
    attachCameraDeviceListener();
    void this.refreshDevices();
  },

  deactivate(): void {
    detachCameraDeviceListener();
    this.stopDevicePreviews();
  },

  async refreshDevices(): Promise<void> {
    try {
      await refreshCameraDevices(false);
      await voiceDeviceService.refresh(false);
    } catch {
      emit({ error: createError("DEVICE_UNAVAILABLE", "Media devices could not be listed.") });
    }
  },

  async requestMicrophoneAccess(): Promise<boolean> {
    emit({ busy: true, error: null, notice: null });
    const devices = await voiceDeviceService.refresh(true);
    emit({ busy: false });
    if (devices.permission !== "granted") {
      emit({ error: createError("MICROPHONE_DENIED", devices.error ?? "Microphone permission was not granted.") });
      return false;
    }
    return true;
  },

  async startCameraPreview(): Promise<boolean> {
    if (!mediaDevices?.getUserMedia) {
      emit({
        cameraPermission: "unsupported",
        error: createError("CAMERA_UNSUPPORTED", "Camera preview is unavailable in this runtime."),
      });
      return false;
    }

    stopCameraTracks();
    const generation = cameraPreviewGeneration;
    emit({ busy: true, error: null, notice: null, cameraPreviewActive: false, cameraPreviewStream: null });
    try {
      const stream = await mediaDevices.getUserMedia({ audio: false, video: videoConstraints() });
      if (generation !== cameraPreviewGeneration) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      cameraStream = stream;
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack?.addEventListener(
        "ended",
        () => {
          if (cameraStream !== stream || generation !== cameraPreviewGeneration) return;
          cameraStream = null;
          emit({
            cameraPreviewActive: false,
            cameraPreviewStream: null,
            notice: "Camera preview stopped because the device is no longer available.",
            error: createError("CAMERA_MISSING", "The camera disconnected. Choose another device or join with camera off."),
          });
          void handleCameraDeviceChange();
        },
        { once: true },
      );
      emit({
        busy: false,
        cameraPermission: "granted",
        cameraPreviewActive: true,
        cameraPreviewStream: stream,
        error: null,
      });
      await refreshCameraDevices(false);
      return true;
    } catch (value) {
      if (generation !== cameraPreviewGeneration) return false;
      const mapped = cameraError(value);
      emit({
        busy: false,
        cameraPermission: mapped.code === "CAMERA_DENIED" ? "denied" : snapshot.cameraPermission,
        cameraPreviewActive: false,
        cameraPreviewStream: null,
        error: mapped,
      });
      return false;
    }
  },

  stopCameraPreview(): void {
    stopCameraTracks();
    emit({ cameraPreviewActive: false, cameraPreviewStream: null });
  },

  async selectCamera(deviceId: string): Promise<boolean> {
    if (!snapshot.cameras.some((device) => device.deviceId === deviceId)) return false;
    const restartPreview = snapshot.cameraPreviewActive;
    emit({ selectedCameraId: deviceId, error: null, notice: null });
    persist();
    return restartPreview ? this.startCameraPreview() : true;
  },

  async selectMicrophone(deviceId: string): Promise<boolean> {
    const restartTest=snapshot.microphoneTestActive;if(restartTest)voiceDeviceService.stopMicrophoneTest();const selected=await voiceDeviceService.selectInput(deviceId);if(selected&&restartTest)await this.testMicrophone();return selected;
  },

  selectSpeaker(deviceId: string): boolean {
    // Keep active Radio/Podcast playback on its current sink while preparing this meeting.
    return voiceDeviceService.selectOutput(deviceId, { notifyConsumers: false });
  },

  testMicrophone: () => voiceDeviceService.startMicrophoneTest(noiseShieldService.createMicrophoneCapturePlan(voiceDeviceService.getAudioCaptureConstraints()).constraints),
  stopMicrophoneTest: () => voiceDeviceService.stopMicrophoneTest(),
  testSpeaker: () => voiceDeviceService.testOutput(),

  stopDevicePreviews(): void {
    this.stopCameraPreview();
    voiceDeviceService.stopTests();
  },

  setJoinMuted(joinMuted: boolean): void {
    emit({ joinMuted });
    persist();
  },

  setJoinCameraOff(joinCameraOff: boolean): void {
    emit({ joinCameraOff });
    persist();
  },

  setNoiseShieldMode(noiseShieldMode: MeetingNoiseShieldMode): void { const state=noiseShieldService.requestMode(noiseShieldMode);emit({noiseShieldMode:state.requestedMode,noiseShieldAvailableModes:state.availableModes,noiseShieldStatus:state.status,noiseShieldFallbackReason:state.fallbackReason,error:state.status==="unavailable"?createError("DEVICE_UNAVAILABLE",state.fallbackReason??"Noise Shield is unavailable for this microphone/runtime."):null});meetingStore.patch(meetingStore.getSnapshot().generation,{noiseShield:{requested:noiseShieldMode!=="off",applied:state.status==="applied",requestedMode:state.requestedMode,appliedMode:state.appliedMode,availableModes:state.availableModes,provider:state.provider,status:state.status,fallbackReason:state.fallbackReason}});persist();},
  setNoiseShield(enabled: boolean): void { this.setNoiseShieldMode(enabled?"standard":"off"); },

  async submit(): Promise<MeetingPreJoinSubmitResult> {
    const request = snapshot.request;
    if (!request) {
      return {
        ok: false,
        error: { code: "MEETING_CONTEXT_INVALID", message: "Choose a meeting before joining.", recoverable: false },
      };
    }
    emit({ busy: true, error: null, notice: null });
    this.stopDevicePreviews();
    const inviteResult = await meetingInviteCredentialService.redeem(request.roomId);
    if (!inviteResult.ok) {
      const error = { code: "MEETING_TOKEN_UNAVAILABLE" as const, message: inviteResult.message, recoverable: false, providerCode: inviteResult.code };
      emit({ busy: false, error: createError("TOKEN_FAILED", inviteResult.message, false) });
      return { ok: false, error };
    }
    const next: MeetingClientJoinRequest = {
      ...request,
      joinMuted: snapshot.joinMuted,
      joinCameraOff: snapshot.joinCameraOff,
      cameraDeviceId: snapshot.selectedCameraId,
      noiseShield: snapshot.noiseShieldMode !== "off",
      noiseShieldMode: snapshot.noiseShieldMode,
      requestedSources: {
        ...request.requestedSources,
        camera: request.requestedSources.camera && !snapshot.joinCameraOff && snapshot.cameraPermission === "granted",
      },
    };
    const result = await meetingService.join(next, true);
    if (result.ok) detachCameraDeviceListener();
    emit({
      busy: false,
      ...(!result.ok ? { error: createError("TOKEN_FAILED", result.error.message, result.error.recoverable) } : {}),
    });
    return result;
  },

  dispose(): void {
    this.deactivate();
    emit({ request: null, roomInfo: null, error: null, notice: null, busy: false });
  },
};
