import { useEffect, useState } from "react";
import { AppIcon } from "../AppIcon";
import { voiceDeviceService, type VoiceDeviceSnapshot } from "../../services/voiceDeviceService";
import { audioPlayerService, type AudioPlayerServiceSnapshot } from "../../services/audio/audioPlayerService";

export function VoiceDeviceSelection() {
  const [state, setState] = useState<VoiceDeviceSnapshot>(() => voiceDeviceService.getSnapshot());
  const [playback, setPlayback] = useState<AudioPlayerServiceSnapshot>(() => audioPlayerService.getSnapshot());
  const permissionGuidance = voiceDeviceService.getPermissionGuidance();

  useEffect(() => {
    const unsubscribeDevices = voiceDeviceService.subscribe(setState);
    const unsubscribePlayback = audioPlayerService.subscribe(setPlayback);
    void voiceDeviceService.refresh(false);
    return () => {
      voiceDeviceService.stopMicrophoneTest();
      unsubscribeDevices();
      unsubscribePlayback();
    };
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
      {state.notice ? <p className="settings-note" role="status">{state.notice}</p> : null}

      <div className="settings-status-card" aria-label="Microphone permission status">
        <span>Microphone permission</span>
        <strong>{state.permission === "granted" ? "Granted" : state.permission === "denied" ? "Denied" : "Not requested"}</strong>
        <small>{state.permission === "denied" ? permissionGuidance : "Picom never requests microphone or camera capture at startup."}</small>
      </div>

      <label className="settings-field">
        <span>Microphone input</span>
        <select value={state.selectedInputId} onChange={(event) => void voiceDeviceService.selectInput(event.target.value)} disabled={state.permission !== "granted" || state.inputDevices.length === 0}>
          {state.inputDevices.length === 0 ? <option value="default">No microphones available</option> : null}
          {state.inputDevices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select>
      </label>

      <div className="settings-status-card" aria-label="Microphone input test">
        <span>Microphone test</span>
        <strong>{state.microphoneTestActive ? "Listening locally" : "Stopped"}</strong>
        <small>The meter is processed in memory. Picom does not record, upload, or store test audio.</small>
        <progress max={1} value={state.microphoneLevel} aria-label="Microphone input level" aria-valuetext={`${Math.round(state.microphoneLevel * 100)} percent`} />
        <div className="settings-inline-actions">
          <button className="settings-secondary-button" type="button" disabled={state.permission !== "granted" || state.inputDevices.length === 0} onClick={() => state.microphoneTestActive ? voiceDeviceService.stopMicrophoneTest() : void voiceDeviceService.startMicrophoneTest()}>{state.microphoneTestActive ? "Stop microphone test" : "Test microphone"}</button>
        </div>
      </div>

      <label className="settings-field">
        <span>Input sensitivity: {Math.round(state.inputSensitivity * 100)}%</span>
        <input type="range" min={0.05} max={1} step={0.05} value={state.inputSensitivity} aria-label="Microphone input sensitivity" aria-valuetext={`${Math.round(state.inputSensitivity * 100)} percent`} onChange={(event) => voiceDeviceService.updateProcessingOptions({ inputSensitivity: Number(event.target.value) })} />
      </label>

      <label className="settings-toggle-row"><span><strong>Echo cancellation</strong><small>{state.supportedConstraints.echoCancellation ? "Reduce echo from local speakers during voice capture." : "Not supported by this runtime."}</small></span><input type="checkbox" disabled={!state.supportedConstraints.echoCancellation} checked={state.echoCancellation} onChange={(event) => voiceDeviceService.updateProcessingOptions({ echoCancellation: event.target.checked })} /></label>
      <label className="settings-toggle-row"><span><strong>Noise suppression</strong><small>{state.supportedConstraints.noiseSuppression ? "Use the browser-supported noise suppression constraint." : "Not supported by this runtime."}</small></span><input type="checkbox" disabled={!state.supportedConstraints.noiseSuppression} checked={state.noiseSuppression} onChange={(event) => voiceDeviceService.updateProcessingOptions({ noiseSuppression: event.target.checked })} /></label>
      <label className="settings-toggle-row"><span><strong>Automatic gain control</strong><small>{state.supportedConstraints.autoGainControl ? "Allow supported capture devices to normalize microphone gain." : "Not supported by this runtime."}</small></span><input type="checkbox" disabled={!state.supportedConstraints.autoGainControl} checked={state.autoGainControl} onChange={(event) => voiceDeviceService.updateProcessingOptions({ autoGainControl: event.target.checked })} /></label>

      <label className="settings-field">
        <span>Speaker output</span>
        <select value={state.selectedOutputId} onChange={(event) => voiceDeviceService.selectOutput(event.target.value)} disabled={state.outputDevices.length === 0}>
          {state.outputDevices.length === 0 ? <option value="default">System default output</option> : null}
          {state.outputDevices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select>
      </label>

      <div className="settings-inline-actions">
        <button className="settings-secondary-button" type="button" onClick={() => void voiceDeviceService.testOutput()} disabled={state.outputTestActive}>{state.outputTestActive ? "Playing test tone..." : "Test speaker output"}</button>
      </div>

      <label className="settings-field">
        <span>Radio and Podcast volume: {Math.round(playback.volume * 100)}%</span>
        <input type="range" min={0} max={1} step={0.05} value={playback.volume} aria-label="Default Radio and Podcast volume" aria-valuetext={`${Math.round(playback.volume * 100)} percent`} onChange={(event) => audioPlayerService.setVolume(Number(event.target.value))} />
      </label>

      <div className="settings-inline-actions">
        <button className="settings-secondary-button" type="button" onClick={() => void voiceDeviceService.refresh(false)} disabled={state.isLoading}>Refresh devices</button>
        <button className="settings-secondary-button" type="button" onClick={() => voiceDeviceService.reset()}>Use system defaults</button>
      </div>
      <div className="settings-status-card" aria-label="Camera policy"><span>Camera</span><strong>Not requested by Picom Full MVP</strong><small>Voice rooms and screen sharing do not enable camera capture. Picom will not request camera permission from this settings page.</small></div>
      <div className="settings-status-card" aria-label="Screen share guidance"><span>Screen sharing</span><strong>Choose a source from an active voice room</strong><small>Windows and Linux use Picom's validated desktop source picker. macOS may require Screen Recording permission in System Settings. No screen capture starts from Settings.</small></div>
      <p className="settings-note">Selected devices apply to active LiveKit voice where supported. Radio and Podcast playback uses the same speaker through Chromium output routing, with a safe system-default fallback.</p>
    </div>
  );
}
