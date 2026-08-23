import type { UiLanguage } from "../../services/settingsService";
import { useEffect, useState } from "react";
import { AppIcon } from "../AppIcon";
import { voiceDeviceService, type VoiceDeviceSnapshot } from "../../services/voiceDeviceService";
import { audioPlayerService, type AudioPlayerServiceSnapshot } from "../../services/audio/audioPlayerService";
import { settingsService } from "../../services/settingsService";
import { translateSettings } from "../../services/settings/settingsI18n";
import { NoiseShieldSettingsPanel } from "../voice/NoiseShieldControl";
import "./VoiceDeviceSelection.css";

export function VoiceDeviceSelection({ language }: { language?: UiLanguage }) {
  const lang = language ?? settingsService.getSettings().appearanceSettings.language;
  const t = (key: Parameters<typeof translateSettings>[0], params?: Record<string, string | number>) =>
    translateSettings(key, lang, params);
  const [state, setState] = useState<VoiceDeviceSnapshot>(() => voiceDeviceService.getSnapshot());
  const [playback, setPlayback] = useState<AudioPlayerServiceSnapshot>(() => audioPlayerService.getSnapshot());
  const permissionGuidance = voiceDeviceService.getPermissionGuidance();

  useEffect(() => {
    const unsubscribeDevices = voiceDeviceService.subscribe(setState);
    const unsubscribePlayback = audioPlayerService.subscribe(setPlayback);
    void voiceDeviceService.refresh(false);
    return () => {
      voiceDeviceService.stopTests();
      unsubscribeDevices();
      unsubscribePlayback();
    };
  }, []);

  useEffect(() => {
    const focusTarget = settingsService.consumeInitialFocus();
    if (!focusTarget) return;
    const elementId = focusTarget === "voice-output" ? "voice-settings-output" : "voice-settings-microphone";
    window.requestAnimationFrame(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const permissionLabel =
    state.permission === "granted"
      ? t("voice.permissionGranted")
      : state.permission === "denied"
        ? t("voice.permissionDenied")
        : t("voice.permissionNotRequested");

  if (!state.isSupported) {
    return (
      <section className="voice-settings-section voice-device-settings">
        <p className="voice-device-note">{t("voice.unsupported")}</p>
      </section>
    );
  }

  return (
    <div className="voice-device-settings">
      <section className="voice-settings-section" id="voice-settings-microphone">
        <h3 className="voice-settings-section-title">{t("voice.microphoneTitle")}</h3>
        <div className="settings-status-card settings-feature-card settings-feature-card--highlight" aria-label={t("voice.permissionAria")}>
          <span>{t("voice.permissionLabel")}</span>
          <strong>{permissionLabel}</strong>
          <small>{state.permission === "denied" ? permissionGuidance : t("voice.permissionStartupHint")}</small>
          {state.permission !== "granted" ? (
            <div className="settings-actions-row">
              <button type="button" className="settings-inline-action" onClick={() => void voiceDeviceService.refresh(true)} disabled={state.isLoading}>
                <AppIcon name="microphone" size="sm" />
                {state.isLoading ? t("voice.checkingDevices") : t("voice.allowMicrophone")}
              </button>
            </div>
          ) : null}
        </div>

        {state.error ? <p className="voice-device-error" role="alert">{state.error}</p> : null}
        {state.notice ? <p className="voice-device-note" role="status">{state.notice}</p> : null}

        <label className="voice-device-field">
          <span>{t("voice.inputLabel")}</span>
          <select className="voice-device-select" value={state.selectedInputId} onChange={(event) => void voiceDeviceService.selectInput(event.target.value)} disabled={state.permission !== "granted" || state.inputDevices.length === 0}>
            {state.inputDevices.length === 0 ? <option value="default">{t("voice.noMicrophones")}</option> : null}
            {state.inputDevices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
          </select>
        </label>

        <div className="settings-status-card settings-feature-card" aria-label={t("voice.testAria")}>
          <span>{t("voice.testTitle")}</span>
          <strong>{state.microphoneTestActive ? t("voice.listening") : t("voice.stopped")}</strong>
          <small>{t("voice.testPrivacyHint")}</small>
          <progress className="voice-device-meter" max={1} value={state.microphoneLevel} aria-label={t("voice.inputLevelAria")} aria-valuetext={t("voice.percent", { value: Math.round(state.microphoneLevel * 100) })} />
          <div className="settings-actions-row">
            <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={state.permission !== "granted" || state.inputDevices.length === 0} onClick={() => state.microphoneTestActive ? voiceDeviceService.stopMicrophoneTest() : void voiceDeviceService.startMicrophoneTest()}>{state.microphoneTestActive ? t("voice.stopTest") : t("voice.startTest")}</button>
          </div>
        </div>
      </section>

      <section className="voice-settings-section" id="voice-settings-processing">
        <h3 className="voice-settings-section-title">{t("voice.processingTitle")}</h3>
        <label className="voice-device-field">
          <span>{t("voice.sensitivity", { percent: Math.round(state.inputSensitivity * 100) })}</span>
          <input className="voice-device-range" type="range" min={0.05} max={1} step={0.05} value={state.inputSensitivity} aria-label={t("voice.sensitivityAria")} aria-valuetext={t("voice.percent", { value: Math.round(state.inputSensitivity * 100) })} onChange={(event) => voiceDeviceService.updateProcessingOptions({ inputSensitivity: Number(event.target.value) })} />
        </label>
        <label className="settings-toggle-row"><span><strong>{t("voice.echoCancellation")}</strong><small>{state.supportedConstraints.echoCancellation ? t("voice.echoHintSupported") : t("voice.notSupportedRuntime")}</small></span><input type="checkbox" disabled={!state.supportedConstraints.echoCancellation} checked={state.echoCancellation} onChange={(event) => voiceDeviceService.updateProcessingOptions({ echoCancellation: event.target.checked })} /></label>
        <label className="settings-toggle-row"><span><strong>{t("voice.noiseSuppression")}</strong><small>{state.supportedConstraints.noiseSuppression ? t("voice.noiseHintSupported") : t("voice.notSupportedRuntime")}</small></span><input type="checkbox" disabled={!state.supportedConstraints.noiseSuppression} checked={state.noiseSuppression} onChange={(event) => voiceDeviceService.updateProcessingOptions({ noiseSuppression: event.target.checked })} /></label>
        <label className="settings-toggle-row"><span><strong>{t("voice.autoGain")}</strong><small>{state.supportedConstraints.autoGainControl ? t("voice.autoGainHintSupported") : t("voice.notSupportedRuntime")}</small></span><input type="checkbox" disabled={!state.supportedConstraints.autoGainControl} checked={state.autoGainControl} onChange={(event) => voiceDeviceService.updateProcessingOptions({ autoGainControl: event.target.checked })} /></label>
      </section>

      <section className="voice-settings-section" id="voice-settings-output">
        <h3 className="voice-settings-section-title">{t("voice.outputTitle")}</h3>
        <label className="voice-device-field">
          <span>{t("voice.speakerOutput")}</span>
          <select className="voice-device-select" value={state.selectedOutputId} onChange={(event) => voiceDeviceService.selectOutput(event.target.value)} disabled={state.outputDevices.length === 0}>
            {state.outputDevices.length === 0 ? <option value="default">{t("voice.systemDefaultOutput")}</option> : null}
            {state.outputDevices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
          </select>
        </label>
        <div className="settings-actions-row">
          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void voiceDeviceService.testOutput()} disabled={state.outputTestActive}>{state.outputTestActive ? t("voice.playingTestTone") : t("voice.testSpeaker")}</button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => void voiceDeviceService.refresh(false)} disabled={state.isLoading}>{t("voice.refreshDevices")}</button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => voiceDeviceService.reset()}>{t("voice.useSystemDefaults")}</button>
        </div>
        <label className="voice-device-field">
          <span>{t("voice.radioVolume", { percent: Math.round(playback.volume * 100) })}</span>
          <input className="voice-device-range" type="range" min={0} max={1} step={0.05} value={playback.volume} aria-label={t("voice.radioVolumeAria")} aria-valuetext={t("voice.percent", { value: Math.round(playback.volume * 100) })} onChange={(event) => audioPlayerService.setVolume(Number(event.target.value))} />
        </label>
        <p className="voice-device-note">{t("voice.outputRoutingNote")}</p>
      </section>

      <div id="voice-settings-noise">
        <NoiseShieldSettingsPanel />
      </div>

      <section className="voice-settings-section" id="voice-settings-camera">
        <h3 className="voice-settings-section-title">{t("voice.cameraTitle")}</h3>
        <div className="settings-status-card settings-feature-card" aria-label={t("voice.cameraPolicyAria")}>
          <span>{t("voice.cameraLabel")}</span>
          <strong>{t("voice.cameraNotRequested")}</strong>
          <small>{t("voice.cameraPolicyHint")}</small>
        </div>
        <div className="settings-status-card settings-feature-card" aria-label={t("voice.screenShareAria")}>
          <span>{t("voice.screenShareLabel")}</span>
          <strong>{t("voice.screenShareStrong")}</strong>
          <small>{t("voice.screenShareHint")}</small>
        </div>
      </section>
    </div>
  );
}
