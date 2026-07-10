export type VoiceDevicePermission = "prompt" | "granted" | "denied" | "unsupported";

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
  isLoading: boolean;
  error: string | null;
};

const STORAGE_KEY = "picom.voice-device-preferences.v1";

type StoredPreferences = Pick<VoiceDeviceSnapshot, "selectedInputId" | "selectedOutputId">;

const readPreferences = (): StoredPreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { selectedInputId: "default", selectedOutputId: "default" };
    const value = JSON.parse(raw) as Partial<StoredPreferences>;
    return {
      selectedInputId: typeof value.selectedInputId === "string" ? value.selectedInputId : "default",
      selectedOutputId: typeof value.selectedOutputId === "string" ? value.selectedOutputId : "default",
    };
  } catch {
    return { selectedInputId: "default", selectedOutputId: "default" };
  }
};

const initialPreferences = readPreferences();
let snapshot: VoiceDeviceSnapshot = {
  isSupported: Boolean(navigator.mediaDevices),
  permission: navigator.mediaDevices ? "prompt" : "unsupported",
  inputDevices: [],
  outputDevices: [],
  selectedInputId: initialPreferences.selectedInputId,
  selectedOutputId: initialPreferences.selectedOutputId,
  isLoading: false,
  error: null,
};

const listeners = new Set<(next: VoiceDeviceSnapshot) => void>();
let listeningForDeviceChanges = false;

const emit = (next: Partial<VoiceDeviceSnapshot>) => {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener(snapshot));
};

const persist = () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      selectedInputId: snapshot.selectedInputId,
      selectedOutputId: snapshot.selectedOutputId,
    } satisfies StoredPreferences),
  );
};

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

    if (!listeningForDeviceChanges && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", voiceDeviceService.handleDeviceChange);
      listeningForDeviceChanges = true;
    }

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && listeningForDeviceChanges) {
        navigator.mediaDevices?.removeEventListener("devicechange", voiceDeviceService.handleDeviceChange);
        listeningForDeviceChanges = false;
      }
    };
  },

  handleDeviceChange(): void {
    void voiceDeviceService.refresh(false);
  },

  async refresh(requestPermission = false): Promise<VoiceDeviceSnapshot> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      emit({ isSupported: false, permission: "unsupported", error: "Media device selection is not supported in this runtime." });
      return snapshot;
    }

    emit({ isLoading: true, error: null });
    let permission = snapshot.permission;
    try {
      if (requestPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        stream.getTracks().forEach((track) => track.stop());
        permission = "granted";
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputDevices = toOptions(devices, "audioinput");
      const outputDevices = toOptions(devices, "audiooutput");
      const selectedInputId = normalizeSelection(snapshot.selectedInputId, inputDevices);
      const selectedOutputId = normalizeSelection(snapshot.selectedOutputId, outputDevices);
      emit({ inputDevices, outputDevices, selectedInputId, selectedOutputId, permission, isLoading: false });
      persist();
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId === "default" ? true : { deviceId: { exact: deviceId } },
        video: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      emit({ selectedInputId: deviceId, permission: "granted", error: null });
      persist();
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
    return true;
  },

  reset(): void {
    emit({ selectedInputId: "default", selectedOutputId: "default", error: null });
    persist();
  },
};
