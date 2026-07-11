export type VoiceDevicePermission = "prompt" | "granted" | "denied" | "unsupported";
export type VoiceAudioCaptureOptions = Readonly<{
  deviceId?: ConstrainDOMString;
  echoCancellation?: ConstrainBoolean;
  noiseSuppression?: ConstrainBoolean;
  autoGainControl?: ConstrainBoolean;
}>;

export type VoiceDeviceOption = {
  deviceId: string;
  label: string;
  isDefault: boolean;
};

export type VoiceDeviceSnapshot = {
  isSupported: boolean;
  permission: VoiceDevicePermission;
  inputDevices: VoiceDeviceOption[];
  outputDevices: VoiceDeviceOption[];
  selectedInputId: string;
  selectedOutputId: string;
  inputSensitivity: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  supportedConstraints: Readonly<{ echoCancellation: boolean; noiseSuppression: boolean; autoGainControl: boolean }>;
  microphoneTestActive: boolean;
  microphoneLevel: number;
  outputTestActive: boolean;
  isLoading: boolean;
  error: string | null;
};

const STORAGE_KEY = "picom.voice-device-preferences.v1";

type StoredPreferences = Pick<VoiceDeviceSnapshot, "selectedInputId" | "selectedOutputId" | "inputSensitivity" | "echoCancellation" | "noiseSuppression" | "autoGainControl">;

const defaultPreferences: StoredPreferences = {
  selectedInputId: "default",
  selectedOutputId: "default",
  inputSensitivity: 0.35,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const readPreferences = (): StoredPreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences;
    const value = JSON.parse(raw) as Partial<StoredPreferences>;
    return {
      selectedInputId: typeof value.selectedInputId === "string" ? value.selectedInputId : "default",
      selectedOutputId: typeof value.selectedOutputId === "string" ? value.selectedOutputId : "default",
      inputSensitivity: typeof value.inputSensitivity === "number" && Number.isFinite(value.inputSensitivity) ? Math.min(1, Math.max(0.05, value.inputSensitivity)) : defaultPreferences.inputSensitivity,
      echoCancellation: value.echoCancellation !== false,
      noiseSuppression: value.noiseSuppression !== false,
      autoGainControl: value.autoGainControl !== false,
    };
  } catch {
    return defaultPreferences;
  }
};

const initialPreferences = readPreferences();
const mediaDevices = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
const supportedMediaConstraints = mediaDevices?.getSupportedConstraints?.() ?? {};
let snapshot: VoiceDeviceSnapshot = {
  isSupported: Boolean(mediaDevices),
  permission: mediaDevices ? "prompt" : "unsupported",
  inputDevices: [],
  outputDevices: [],
  ...initialPreferences,
  supportedConstraints: {
    echoCancellation: supportedMediaConstraints.echoCancellation === true,
    noiseSuppression: supportedMediaConstraints.noiseSuppression === true,
    autoGainControl: supportedMediaConstraints.autoGainControl === true,
  },
  microphoneTestActive: false,
  microphoneLevel: 0,
  outputTestActive: false,
  isLoading: false,
  error: null,
};

const listeners = new Set<(next: VoiceDeviceSnapshot) => void>();
const preferenceListeners = new Set<(next: VoiceDeviceSnapshot) => void>();
let listeningForDeviceChanges = false;
let microphoneTestStream: MediaStream | null = null;
let microphoneTestContext: AudioContext | null = null;
let microphoneTestFrame: number | null = null;

const emit = (next: Partial<VoiceDeviceSnapshot>) => {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener(snapshot));
};

const persist = () => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedInputId: snapshot.selectedInputId,
        selectedOutputId: snapshot.selectedOutputId,
        inputSensitivity: snapshot.inputSensitivity,
        echoCancellation: snapshot.echoCancellation,
        noiseSuppression: snapshot.noiseSuppression,
        autoGainControl: snapshot.autoGainControl,
      } satisfies StoredPreferences),
    );
  } catch {
    // Restricted storage keeps current-session preferences without persisting media data.
  }
};

const publishPreferences = () => preferenceListeners.forEach((listener) => listener(snapshot));

const createAudioConstraints = (value: VoiceDeviceSnapshot = snapshot): VoiceAudioCaptureOptions => ({
  ...(value.selectedInputId === "default" ? {} : { deviceId: { exact: value.selectedInputId } }),
  ...(value.supportedConstraints.echoCancellation ? { echoCancellation: value.echoCancellation } : {}),
  ...(value.supportedConstraints.noiseSuppression ? { noiseSuppression: value.noiseSuppression } : {}),
  ...(value.supportedConstraints.autoGainControl ? { autoGainControl: value.autoGainControl } : {}),
});

function stopMicrophoneTestResources(): void {
  if (microphoneTestFrame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(microphoneTestFrame);
  microphoneTestFrame = null;
  microphoneTestStream?.getTracks().forEach((track) => track.stop());
  microphoneTestStream = null;
  if (microphoneTestContext) void microphoneTestContext.close().catch(() => undefined);
  microphoneTestContext = null;
}

const toOptions = (devices: MediaDeviceInfo[], kind: MediaDeviceKind): VoiceDeviceOption[] =>
  devices
    .filter((device) => device.kind === kind)
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `${kind === "audioinput" ? "Microphone" : "Speaker"} ${index + 1}`,
      isDefault: device.deviceId === "default",
    }));

const normalizeSelection = (selectedId: string, devices: VoiceDeviceOption[]) =>
  devices.some((device) => device.deviceId === selectedId) ? selectedId : devices[0]?.deviceId || "default";

const permissionFromError = (error: unknown): VoiceDevicePermission =>
  error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")
    ? "denied"
    : snapshot.permission;

export const voiceDeviceService = {
  getSnapshot(): VoiceDeviceSnapshot {
    return snapshot;
  },

  subscribe(listener: (next: VoiceDeviceSnapshot) => void): () => void {
    listeners.add(listener);
    listener(snapshot);

    if (!listeningForDeviceChanges && mediaDevices) {
      mediaDevices?.addEventListener("devicechange", voiceDeviceService.handleDeviceChange);
      listeningForDeviceChanges = true;
    }

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && listeningForDeviceChanges) {
        mediaDevices?.removeEventListener("devicechange", voiceDeviceService.handleDeviceChange);
        listeningForDeviceChanges = false;
      }
    };
  },

  handleDeviceChange(): void {
    void voiceDeviceService.refresh(false);
  },

  subscribePreferences(listener: (next: VoiceDeviceSnapshot) => void): () => void {
    preferenceListeners.add(listener);
    listener(snapshot);
    return () => preferenceListeners.delete(listener);
  },

  getAudioCaptureConstraints(): VoiceAudioCaptureOptions {
    return createAudioConstraints();
  },

  async refresh(requestPermission = false): Promise<VoiceDeviceSnapshot> {
    if (!mediaDevices?.enumerateDevices) {
      emit({ isSupported: false, permission: "unsupported", error: "Media device selection is not supported in this runtime." });
      return snapshot;
    }

    if (!requestPermission && snapshot.permission !== "granted") return snapshot;
    emit({ isLoading: true, error: null });
    let permission = snapshot.permission;
    try {
      if (requestPermission) {
        const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
        stream.getTracks().forEach((track) => track.stop());
        permission = "granted";
      }

      const previousInputId = snapshot.selectedInputId;
      const previousOutputId = snapshot.selectedOutputId;
      const devices = await mediaDevices.enumerateDevices();
      const inputDevices = toOptions(devices, "audioinput");
      const outputDevices = toOptions(devices, "audiooutput");
      const selectedInputId = normalizeSelection(snapshot.selectedInputId, inputDevices);
      const selectedOutputId = normalizeSelection(snapshot.selectedOutputId, outputDevices);
      emit({ inputDevices, outputDevices, selectedInputId, selectedOutputId, permission, isLoading: false });
      persist();
      if (selectedInputId !== previousInputId || selectedOutputId !== previousOutputId) {
        if (snapshot.microphoneTestActive) voiceDeviceService.stopMicrophoneTest();
        publishPreferences();
      }
    } catch (error) {
      permission = permissionFromError(error);
      emit({
        permission,
        isLoading: false,
        error: permission === "denied" ? "Microphone permission was denied. Enable it in system settings and try again." : "Voice devices could not be loaded.",
      });
    }
    return snapshot;
  },

  async selectInput(deviceId: string): Promise<boolean> {
    if (!snapshot.inputDevices.some((device) => device.deviceId === deviceId)) return false;
    try {
      const nextSnapshot = { ...snapshot, selectedInputId: deviceId };
      const stream = await mediaDevices!.getUserMedia({
        audio: createAudioConstraints(nextSnapshot),
        video: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      emit({ selectedInputId: deviceId, permission: "granted", error: null });
      persist();
      publishPreferences();
      return true;
    } catch (error) {
      emit({ permission: permissionFromError(error), error: "The selected microphone is unavailable." });
      return false;
    }
  },

  selectOutput(deviceId: string): boolean {
    if (!snapshot.outputDevices.some((device) => device.deviceId === deviceId)) return false;
    emit({ selectedOutputId: deviceId, error: null });
    persist();
    publishPreferences();
    return true;
  },

  updateProcessingOptions(partial: Partial<Pick<VoiceDeviceSnapshot, "inputSensitivity" | "echoCancellation" | "noiseSuppression" | "autoGainControl">>): void {
    emit({
      inputSensitivity: partial.inputSensitivity === undefined ? snapshot.inputSensitivity : Math.min(1, Math.max(0.05, partial.inputSensitivity)),
      echoCancellation: snapshot.supportedConstraints.echoCancellation && partial.echoCancellation !== undefined ? partial.echoCancellation : snapshot.echoCancellation,
      noiseSuppression: snapshot.supportedConstraints.noiseSuppression && partial.noiseSuppression !== undefined ? partial.noiseSuppression : snapshot.noiseSuppression,
      autoGainControl: snapshot.supportedConstraints.autoGainControl && partial.autoGainControl !== undefined ? partial.autoGainControl : snapshot.autoGainControl,
      error: null,
    });
    persist();
    publishPreferences();
  },

  async startMicrophoneTest(): Promise<boolean> {
    if (!mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      emit({ error: "Microphone testing is unavailable in this runtime." });
      return false;
    }
    voiceDeviceService.stopMicrophoneTest();
    try {
      microphoneTestStream = await mediaDevices.getUserMedia({ audio: createAudioConstraints(), video: false });
      microphoneTestContext = new AudioContext();
      const source = microphoneTestContext.createMediaStreamSource(microphoneTestStream);
      const analyser = microphoneTestContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      emit({ permission: "granted", microphoneTestActive: true, microphoneLevel: 0, error: null });
      const measure = () => {
        if (!microphoneTestContext || !microphoneTestStream) return;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) { const normalized = (sample - 128) / 128; sum += normalized * normalized; }
        emit({ microphoneLevel: Math.min(1, Math.sqrt(sum / samples.length) * 3.4) });
        microphoneTestFrame = requestAnimationFrame(measure);
      };
      measure();
      return true;
    } catch (error) {
      stopMicrophoneTestResources();
      const permission = permissionFromError(error);
      emit({ permission, microphoneTestActive: false, microphoneLevel: 0, error: permission === "denied" ? "Microphone permission was denied. Enable it in system settings and try again." : "The selected microphone could not be tested." });
      return false;
    }
  },

  stopMicrophoneTest(): void {
    stopMicrophoneTestResources();
    emit({ microphoneTestActive: false, microphoneLevel: 0 });
  },

  async testOutput(): Promise<boolean> {
    if (typeof AudioContext === "undefined") { emit({ error: "Speaker testing is unavailable in this runtime." }); return false; }
    emit({ outputTestActive: true, error: null });
    const context = new AudioContext() as AudioContext & { setSinkId?: (sinkId: string) => Promise<void> };
    try {
      if (snapshot.selectedOutputId !== "default") {
        if (!context.setSinkId) throw new Error("OUTPUT_ROUTING_UNSUPPORTED");
        await context.setSinkId(snapshot.selectedOutputId);
      }
      await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 440;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.45);
      await new Promise((resolve) => setTimeout(resolve, 520));
      emit({ outputTestActive: false });
      return true;
    } catch (error) {
      emit({ outputTestActive: false, error: error instanceof Error && error.message === "OUTPUT_ROUTING_UNSUPPORTED" ? "This runtime cannot route test audio to a selected speaker. Use the system default output." : "The selected speaker could not play the test tone." });
      return false;
    } finally {
      await context.close().catch(() => undefined);
    }
  },

  reset(): void {
    voiceDeviceService.stopMicrophoneTest();
    emit({ ...defaultPreferences, error: null });
    persist();
    publishPreferences();
  },
};
