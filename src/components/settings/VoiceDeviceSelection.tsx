import { useEffect, useState } from "react";
import { AppIcon } from "../AppIcon";
import { voiceDeviceService, type VoiceDeviceSnapshot } from "../../services/voiceDeviceService";

export function VoiceDeviceSelection() {
  const [state, setState] = useState<VoiceDeviceSnapshot>(() => voiceDeviceService.getSnapshot());

  useEffect(() => {
    const unsubscribe = voiceDeviceService.subscribe(setState);
    void voiceDeviceService.refresh(false);
    return unsubscribe;
  }, []);

  if (!state.isSupported) {
    return <p className="settings-note">Device selection is unavailable in this runtime. Picom will use the system defaults.</p>;
  }

  return (
    <div className="voice-device-settings">
      <div className="settings-row-copy">
        <strong>Audio devices</strong>
        <span>Permission is requested only when you choose to enable microphone access.</span>
      </div>

      {state.permission !== "granted" ? (
        <button className="settings-action-button" type="button" onClick={() => void voiceDeviceService.refresh(true)} disabled={state.isLoading}>
          <AppIcon name="microphone" size="sm" />
          {state.isLoading ? "Checking devices..." : "Allow microphone and load devices"}
        </button>
      ) : null}

      {state.error ? <p className="settings-inline-error" role="alert">{state.error}</p> : null}

      <label className="settings-field">
        <span>Microphone input</span>
        <select value={state.selectedInputId} onChange={(event) => void voiceDeviceService.selectInput(event.target.value)} disabled={state.permission !== "granted" || state.inputDevices.length === 0}>
          {state.inputDevices.length === 0 ? <option value="default">No microphones available</option> : null}
          {state.inputDevices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select>
      </label>

      <label className="settings-field">
        <span>Speaker output</span>
        <select value={state.selectedOutputId} onChange={(event) => voiceDeviceService.selectOutput(event.target.value)} disabled={state.outputDevices.length === 0}>
          {state.outputDevices.length === 0 ? <option value="default">System default output</option> : null}
          {state.outputDevices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select>
      </label>

      <div className="settings-inline-actions">
        <button className="settings-secondary-button" type="button" onClick={() => void voiceDeviceService.refresh(false)} disabled={state.isLoading}>Refresh devices</button>
        <button className="settings-secondary-button" type="button" onClick={() => voiceDeviceService.reset()}>Use system defaults</button>
      </div>
      <p className="settings-note">Speaker routing is applied where Chromium and the operating system support output selection. Live voice connections remain on their current device until the next join.</p>
    </div>
  );
}
