export type VoiceDevicePermission = "prompt" | "granted" | "denied" | "unsupported";
export type VoiceDeviceSetupStatus = "unknown" | "prompt" | "requesting" | "granted" | "denied" | "unavailable" | "error" | "unsupported";
export type VoiceDeviceErrorKind = "permission" | "unavailable" | "busy" | "unsupported" | "output-routing" | "unknown" | null;
export type VoiceAudioCaptureOptions = Readonly<{
  deviceId?: ConstrainDOMString;
  echoCancellation?: ConstrainBoolean;
  noiseSuppression?: ConstrainBoolean;
  autoGainControl?: ConstrainBoolean;
}>;

export type VoiceDeviceOption = {
  deviceId: string;
  label: string;
  labelIsFallback?: boolean;
  isDefault: boolean;
};

export type VoiceDeviceSelectionOptions = Readonly<{
  notifyConsumers?: boolean;
}>;

export type VoiceDeviceSnapshot = {
  isSupported: boolean;
  permission: VoiceDevicePermission;
  setupStatus: VoiceDeviceSetupStatus;
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
  /** True after a user has started a local microphone test during this app session. */
  microphoneTestAttempted: boolean;
  /** Set only after the local analyser has observed a real input threshold during this app session. */
  microphoneTestPassed: boolean;
  outputTestActive: boolean;
  isLoading: boolean;
  error: string | null;
  errorKind: VoiceDeviceErrorKind;
  notice: string | null;
  deviceRevision: number;
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
  setupStatus: mediaDevices ? "unknown" : "unsupported",
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
  microphoneTestAttempted: false,
  microphoneTestPassed: false,
  outputTestActive: false,
  isLoading: false,
  error: null,
  errorKind: null,
  notice: null,
  deviceRevision: 0,
};

const listeners = new Set<(next: VoiceDeviceSnapshot) => void>();
const preferenceListeners = new Set<(next: VoiceDeviceSnapshot) => void>();
let listeningForDeviceChanges = false;
let microphoneTestStream: MediaStream | null = null;
let microphoneTestContext: AudioContext | null = null;
let microphoneTestFrame: number | null = null;
let outputTestContext: AudioContext | null = null;
let outputTestTimer: ReturnType<typeof setTimeout> | null = null;
let outputTestResolve: (() => void) | null = null;
let outputTestGeneration = 0;
let microphoneTestGeneration = 0;
let inputSelectionGeneration = 0;
let refreshGeneration = 0;
let deviceChangeTimer: ReturnType<typeof setTimeout> | null = null;
let microphonePermissionStatus: PermissionStatus | null = null;
let permissionStatusCleanup: (() => void) | null = null;

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

function stopOutputTestResources(): void {
  if (outputTestTimer !== null) clearTimeout(outputTestTimer);
  outputTestTimer = null;
  const resolve = outputTestResolve;
  outputTestResolve = null;
  if (outputTestContext) void outputTestContext.close().catch(() => undefined);
  outputTestContext = null;
  resolve?.();
}

const toOptions = (devices: MediaDeviceInfo[], kind: MediaDeviceKind): VoiceDeviceOption[] =>
  devices
    .filter((device) => device.kind === kind)
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `${kind === "audioinput" ? "Microphone" : "Speaker"} ${index + 1}`,
      labelIsFallback: !device.label,
      isDefault: device.deviceId === "default",
    }));

const normalizeSelection = (selectedId: string, devices: VoiceDeviceOption[]) =>
  devices.some((device) => device.deviceId === selectedId)
    ? selectedId
    : devices.find((device) => device.deviceId === "default")?.deviceId ?? devices[0]?.deviceId ?? "default";

const errorKindFrom = (error: unknown): Exclude<VoiceDeviceErrorKind, null> =>
  error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")
    ? "permission"
    : error instanceof DOMException && (error.name === "NotFoundError" || error.name === "OverconstrainedError")
      ? "unavailable"
      : error instanceof DOMException && (error.name === "NotReadableError" || error.name === "AbortError")
        ? "busy"
        : "unknown";

const permissionFromError = (error: unknown): VoiceDevicePermission => {
  const errorKind = errorKindFrom(error);
  if (errorKind === "permission") return "denied";
  return snapshot.permission;
};

const deviceErrorMessage = (error: unknown): string => error instanceof DOMException && (error.name === "NotReadableError" || error.name === "AbortError")
  ? "The selected microphone is busy in another application. Picom can fall back to the system default input."
  : error instanceof DOMException && (error.name === "NotFoundError" || error.name === "OverconstrainedError")
    ? "The selected microphone is no longer available."
    : "Voice devices could not be loaded.";

async function applyObservedMicrophonePermission(state: PermissionState): Promise<void> {
  if (state === "denied") {
    voiceDeviceService.stopMicrophoneTest();
    emit({ permission: "denied", setupStatus: "denied", deviceRevision: snapshot.deviceRevision + 1, error: "Microphone permission was revoked. Enable it in system settings, then retry from Picom.", errorKind: "permission", notice: "Microphone access changed; the meeting microphone was turned off." });
    publishPreferences();
    return;
  }
  if (state === "granted") {
    emit({ permission: "granted", setupStatus: "granted", deviceRevision: snapshot.deviceRevision + 1, error: null, errorKind: null, notice: "Microphone permission is available again. Picom is restoring your meeting device preference." });
    await voiceDeviceService.refresh(false);
    publishPreferences();
    return;
  }
  if (snapshot.permission !== "granted") emit({ permission: "prompt", setupStatus: "prompt", error: null, errorKind: null });
}

async function attachPermissionStatusListener(): Promise<void> {
  if (microphonePermissionStatus || !navigator.permissions?.query) return;
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    if (!listeners.size) return;
    microphonePermissionStatus = status;
    const onChange = () => { void applyObservedMicrophonePermission(status.state); };
    status.addEventListener("change", onChange);
    permissionStatusCleanup = () => status.removeEventListener("change", onChange);
    if (status.state === "granted" || status.state === "denied") await applyObservedMicrophonePermission(status.state);
  } catch {
    // Permission API support varies; explicit user actions remain the fallback.
  }
}

function detachPermissionStatusListener(): void {
  permissionStatusCleanup?.();
  permissionStatusCleanup = null;
  microphonePermissionStatus = null;
}

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
      void attachPermissionStatusListener();
    }

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && listeningForDeviceChanges) {
        mediaDevices?.removeEventListener("devicechange", voiceDeviceService.handleDeviceChange);
        listeningForDeviceChanges = false;
        if (deviceChangeTimer) clearTimeout(deviceChangeTimer);
        deviceChangeTimer = null;
        detachPermissionStatusListener();
      }
    };
  },

  handleDeviceChange(): void {
    if (deviceChangeTimer) clearTimeout(deviceChangeTimer);
    deviceChangeTimer = setTimeout(() => {
      deviceChangeTimer = null;
      emit({ deviceRevision: snapshot.deviceRevision + 1 });
      void voiceDeviceService.refresh(false).then(() => publishPreferences());
    }, 350);
  },

  subscribePreferences(listener: (next: VoiceDeviceSnapshot) => void): () => void {
    preferenceListeners.add(listener);
    listener(snapshot);
    return () => preferenceListeners.delete(listener);
  },

  getAudioCaptureConstraints(): VoiceAudioCaptureOptions {
    return createAudioConstraints();
  },

  supportsOutputSelection(): boolean {
    if (typeof AudioContext === "undefined") return false;
    return typeof (AudioContext.prototype as AudioContext & { setSinkId?: unknown }).setSinkId === "function";
  },

  getPermissionGuidance(): string {
    if (typeof navigator === "undefined") return "Open the operating-system privacy settings, allow microphone access for Picom, then retry.";
    const platform = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
    if (platform.includes("win")) return "Windows: open Settings > Privacy & security > Microphone, then allow microphone access for desktop apps and Picom.";
    if (platform.includes("mac")) return "macOS: open System Settings > Privacy & Security > Microphone, enable Picom, then restart Picom if requested.";
    if (platform.includes("linux")) return "Linux: allow microphone access in your desktop privacy or application permissions, and verify the PipeWire/PulseAudio input is available.";
    return "Open the operating-system privacy settings, allow microphone access for Picom, then retry.";
  },

  async refresh(requestPermission = false): Promise<VoiceDeviceSnapshot> {
    if (!mediaDevices?.enumerateDevices) {
      emit({ isSupported: false, permission: "unsupported", setupStatus: "unsupported", error: "Media device selection is not supported in this runtime.", errorKind: "unsupported" });
      return snapshot;
    }

    const generation = ++refreshGeneration;
    emit({ isLoading: true, error: null, errorKind: null, notice: null, ...(requestPermission ? { setupStatus: "requesting" as const } : {}) });
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
      const inputRemoved = !inputDevices.some((device) => device.deviceId === previousInputId);
      const outputRemoved = !outputDevices.some((device) => device.deviceId === previousOutputId);
      const notice = inputRemoved && outputRemoved
        ? "The selected microphone and speaker were removed. Picom switched to available system devices."
        : inputRemoved
          ? "The selected microphone was removed. Picom switched to an available input."
          : outputRemoved
            ? "The selected speaker was removed. Picom switched to an available output."
            : null;
      if (generation !== refreshGeneration) return snapshot;
      if (inputRemoved) stopMicrophoneTestResources();
      if (outputRemoved) stopOutputTestResources();
      emit({
        inputDevices,
        outputDevices,
        selectedInputId,
        selectedOutputId,
        permission,
        setupStatus: permission === "granted" ? "granted" : permission,
        isLoading: false,
        notice,
        microphoneTestActive: inputRemoved ? false : snapshot.microphoneTestActive,
        microphoneLevel: inputRemoved ? 0 : snapshot.microphoneLevel,
        microphoneTestAttempted: inputRemoved ? false : snapshot.microphoneTestAttempted,
        microphoneTestPassed: inputRemoved ? false : snapshot.microphoneTestPassed,
        outputTestActive: outputRemoved ? false : snapshot.outputTestActive,
      });
      persist();
      if (selectedInputId !== previousInputId || selectedOutputId !== previousOutputId) {
        publishPreferences();
      }
    } catch (error) {
      permission = permissionFromError(error);
      if (generation !== refreshGeneration) return snapshot;
      emit({
        permission,
        setupStatus: errorKindFrom(error) === "unavailable" ? "unavailable" : permission === "denied" ? "denied" : "error",
        isLoading: false,
        notice: null,
        errorKind: errorKindFrom(error),
        error: permission === "denied" ? "Microphone permission was denied. Enable it in system settings and try again." : deviceErrorMessage(error),
      });
    }
    return snapshot;
  },

  async selectInput(deviceId: string): Promise<boolean> {
    if (!snapshot.inputDevices.some((device) => device.deviceId === deviceId)) return false;
    const generation = ++inputSelectionGeneration;
    try {
      const nextSnapshot = { ...snapshot, selectedInputId: deviceId };
      const stream = await mediaDevices!.getUserMedia({
        audio: createAudioConstraints(nextSnapshot),
        video: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      if (generation !== inputSelectionGeneration) return false;
      voiceDeviceService.stopMicrophoneTest();
      emit({ selectedInputId: deviceId, permission: "granted", setupStatus: "granted", error: null, errorKind: null, notice: null });
      persist();
      publishPreferences();
      return true;
    } catch (error) {
      if (generation !== inputSelectionGeneration) return false;
      if (deviceId !== "default" && snapshot.inputDevices.some((device) => device.deviceId === "default")) {
        try {
          const fallback = await mediaDevices!.getUserMedia({ audio: createAudioConstraints({ ...snapshot, selectedInputId: "default" }), video: false });
          fallback.getTracks().forEach((track) => track.stop());
          if (generation !== inputSelectionGeneration) return false;
          voiceDeviceService.stopMicrophoneTest();
          emit({ selectedInputId: "default", permission: "granted", setupStatus: "granted", deviceRevision: snapshot.deviceRevision + 1, error: null, errorKind: null, notice: "The selected microphone was unavailable. Picom switched to the system default input." });
          persist();publishPreferences();return true;
        } catch { /* Report the original selection failure below. */ }
      }
      const permission = permissionFromError(error);
      emit({ permission, setupStatus: errorKindFrom(error) === "unavailable" ? "unavailable" : permission === "denied" ? "denied" : "error", errorKind: errorKindFrom(error), error: deviceErrorMessage(error) });
      return false;
    }
  },

  selectOutput(deviceId: string, options: VoiceDeviceSelectionOptions = {}): boolean {
    if (!snapshot.outputDevices.some((device) => device.deviceId === deviceId)) return false;
    if (snapshot.outputTestActive) voiceDeviceService.stopOutputTest();
    emit({ selectedOutputId: deviceId, error: null, errorKind: null, notice: null });
    persist();
    if (options.notifyConsumers !== false) publishPreferences();
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

  async startMicrophoneTest(captureConstraints?: VoiceAudioCaptureOptions): Promise<boolean> {
    if (!mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      emit({ permission: "unsupported", setupStatus: "unsupported", error: "Microphone testing is unavailable in this runtime.", errorKind: "unsupported" });
      return false;
    }
    voiceDeviceService.stopMicrophoneTest();
    const generation = ++microphoneTestGeneration;
    try {
      const stream = await mediaDevices.getUserMedia({ audio: captureConstraints ?? createAudioConstraints(), video: false });
      if (generation !== microphoneTestGeneration) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      const context = new AudioContext();
      microphoneTestStream = stream;
      microphoneTestContext = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      emit({ permission: "granted", setupStatus: "granted", microphoneTestActive: true, microphoneLevel: 0, microphoneTestAttempted: true, microphoneTestPassed: false, error: null, errorKind: null });
      const measure = () => {
        if (generation !== microphoneTestGeneration || microphoneTestContext !== context || microphoneTestStream !== stream) return;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) { const normalized = (sample - 128) / 128; sum += normalized * normalized; }
        const level = Math.min(1, Math.sqrt(sum / samples.length) * 3.4);
        emit({ microphoneLevel: level, microphoneTestPassed: snapshot.microphoneTestPassed || level >= 0.06 });
        microphoneTestFrame = requestAnimationFrame(measure);
      };
      measure();
      return true;
    } catch (error) {
      if (generation === microphoneTestGeneration) stopMicrophoneTestResources();
      const permission = permissionFromError(error);
      if (generation === microphoneTestGeneration) emit({ permission, setupStatus: errorKindFrom(error) === "unavailable" ? "unavailable" : permission === "denied" ? "denied" : "error", microphoneTestActive: false, microphoneLevel: 0, errorKind: errorKindFrom(error), error: permission === "denied" ? "Microphone permission was denied. Enable it in system settings and try again." : "The selected microphone could not be tested." });
      return false;
    }
  },

  stopMicrophoneTest(): void {
    microphoneTestGeneration += 1;
    stopMicrophoneTestResources();
    emit({ microphoneTestActive: false, microphoneLevel: 0 });
  },

  async testOutput(): Promise<boolean> {
    if (typeof AudioContext === "undefined") { emit({ error: "Speaker testing is unavailable in this runtime.", errorKind: "unsupported" }); return false; }
    voiceDeviceService.stopOutputTest();
    const generation = ++outputTestGeneration;
    emit({ outputTestActive: true, error: null, errorKind: null });
    const context = new AudioContext() as AudioContext & { setSinkId?: (sinkId: string) => Promise<void> };
    outputTestContext = context;
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
      await new Promise<void>((resolve) => {
        outputTestResolve = resolve;
        outputTestTimer = setTimeout(() => {
          outputTestTimer = null;
          outputTestResolve = null;
          resolve();
        }, 520);
      });
      if (generation !== outputTestGeneration) return false;
      emit({ outputTestActive: false });
      return true;
    } catch (error) {
      emit({ outputTestActive: false, errorKind: error instanceof Error && error.message === "OUTPUT_ROUTING_UNSUPPORTED" ? "output-routing" : "unknown", error: error instanceof Error && error.message === "OUTPUT_ROUTING_UNSUPPORTED" ? "This runtime cannot route test audio to a selected speaker. Use the system default output." : "The selected speaker could not play the test tone." });
      return false;
    } finally {
      if (outputTestContext === context) {
        outputTestContext = null;
        await context.close().catch(() => undefined);
      }
      if (generation === outputTestGeneration) {
        outputTestTimer = null;
        outputTestResolve = null;
      }
    }
  },

  stopOutputTest(): void {
    outputTestGeneration += 1;
    stopOutputTestResources();
    emit({ outputTestActive: false });
  },

  stopTests(): void {
    voiceDeviceService.stopMicrophoneTest();
    voiceDeviceService.stopOutputTest();
  },

  reset(): void {
    voiceDeviceService.stopTests();
    emit({ ...defaultPreferences, setupStatus: "prompt", microphoneTestAttempted: false, microphoneTestPassed: false, error: null, errorKind: null, notice: null });
    persist();
    publishPreferences();
  },
};
