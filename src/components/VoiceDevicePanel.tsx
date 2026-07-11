import { useEffect, useState } from "react";
import { voiceDeviceService, type VoiceDeviceSnapshot } from "../services/voiceDeviceService";
import { AppIcon } from "./AppIcon";

export function VoiceDevicePanel() {
  const [devices, setDevices] = useState<VoiceDeviceSnapshot>(() => voiceDeviceService.getSnapshot());

  useEffect(() => {
    const unsubscribe = voiceDeviceService.subscribe(setDevices);
    void voiceDeviceService.refresh(false);
    return unsubscribe;
  }, []);

  const requestAccess = () => {
    void voiceDeviceService.refresh(true);
  };

  const hasInput = devices.inputDevices.length > 0;
  const hasOutput = devices.outputDevices.length > 0;
  const statusCopy = devices.permission === "denied"
    ? voiceDeviceService.getPermissionGuidance()
    : devices.permission === "unsupported"
      ? "Audio device selection is unavailable in this runtime."
      : devices.permission !== "granted"
        ? "Enable microphone access to select an input device."
        : !hasInput
          ? "No microphone was detected. Connect a device and refresh."
          : "Device changes apply to the active room without rejoining.";

  return (
    <section className="voice-device-panel" aria-labelledby="voice-device-panel-title">
      <header>
        <div>
          <span className="eyebrow">Audio devices</span>
          <h4 id="voice-device-panel-title">Input and output</h4>
        </div>
        <button
          type="button"
          className="voice-device-refresh"
          onClick={requestAccess}
          disabled={devices.isLoading || !devices.isSupported}
        >
          {devices.isLoading ? "Checking..." : devices.permission === "granted" ? "Refresh" : "Enable microphone"}
        </button>
      </header>

      <div className="voice-device-fields">
        <label>
          <span><AppIcon name="microphone" size="sm" /> Microphone</span>
          <select
            aria-label="Voice microphone"
            value={devices.selectedInputId}
            disabled={!hasInput || devices.isLoading}
            onChange={(event) => { void voiceDeviceService.selectInput(event.target.value); }}
          >
            {!hasInput ? <option value="default">No microphone available</option> : null}
            {devices.inputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
            ))}
          </select>
        </label>

        <label>
          <span><AppIcon name="headphones" size="sm" /> Speaker</span>
          <select
            aria-label="Voice speaker"
            value={devices.selectedOutputId}
            disabled={!hasOutput || devices.isLoading}
            onChange={(event) => { voiceDeviceService.selectOutput(event.target.value); }}
          >
            {!hasOutput ? <option value="default">System default output</option> : null}
            {devices.outputDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
            ))}
          </select>
        </label>
      </div>

      <p className={devices.error ? "voice-device-status is-error" : "voice-device-status"} role={devices.error ? "alert" : "status"}>
        {devices.error ?? devices.notice ?? statusCopy}
      </p>
    </section>
  );
}
