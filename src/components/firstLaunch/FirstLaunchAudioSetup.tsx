import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../i18n";
import { voiceDeviceService, type VoiceDeviceOption, type VoiceDeviceSnapshot } from "../../services/voiceDeviceService";

type AudioDeviceKind = "input" | "output";

function deviceLabel(device: VoiceDeviceOption, kind: AudioDeviceKind, index: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (!device.labelIsFallback) return device.label;
  return t(kind === "input" ? "audioVideo.fallbackMicrophone" : "audioVideo.fallbackSpeaker", { number: index + 1 });
}

function errorMessage(snapshot: VoiceDeviceSnapshot, t: (key: string) => string): string | null {
  if (!snapshot.error) return null;
  switch (snapshot.errorKind) {
    case "permission": return t("audioVideo.error.permission");
    case "unavailable": return t("audioVideo.error.unavailable");
    case "busy": return t("audioVideo.error.busy");
    case "unsupported": return t("audioVideo.error.unsupported");
    case "output-routing": return t("audioVideo.error.outputRouting");
    default: return t("audioVideo.error.unknown");
  }
}

export function FirstLaunchAudioSetup() {
  const { t } = useTranslation("firstLaunch");
  const [snapshot, setSnapshot] = useState<VoiceDeviceSnapshot>(() => voiceDeviceService.getSnapshot());
  const [changingInput, setChangingInput] = useState(false);
  const canRouteOutput = useMemo(() => voiceDeviceService.supportsOutputSelection(), []);
  const error = errorMessage(snapshot, t);
  const microphoneStatus = snapshot.microphoneTestActive
    ? snapshot.microphoneTestPassed ? t("audioVideo.inputDetected") : t("audioVideo.listening")
    : snapshot.microphoneTestAttempted ? snapshot.microphoneTestPassed ? t("audioVideo.testPassed") : t("audioVideo.noInputDetected") : t("audioVideo.notTested");
  const outputLabel = snapshot.outputDevices.find((device) => device.deviceId === snapshot.selectedOutputId);

  useEffect(() => {
    const unsubscribe = voiceDeviceService.subscribe(setSnapshot);
    // Enumeration intentionally does not request permission; only the explicit CTA below does.
    void voiceDeviceService.refresh(false);
    return () => {
      voiceDeviceService.stopTests();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (canRouteOutput || snapshot.selectedOutputId === "default" || !snapshot.outputDevices.some((device) => device.deviceId === "default")) return;
    voiceDeviceService.selectOutput("default");
  }, [canRouteOutput, snapshot.outputDevices, snapshot.selectedOutputId]);

  const requestMicrophone = () => void voiceDeviceService.refresh(true);
  const selectInput = async (deviceId: string) => {
    setChangingInput(true);
    try {
      await voiceDeviceService.selectInput(deviceId);
    } finally {
      setChangingInput(false);
    }
  };

  if (!snapshot.isSupported) {
    return <section className="first-launch-audio-setup" aria-labelledby="first-launch-audio-unavailable">
      <article className="first-launch-audio-status is-unavailable" role="status">
        <strong id="first-launch-audio-unavailable">{t("audioVideo.unavailableTitle")}</strong>
        <p>{t("audioVideo.unavailableBody")}</p>
      </article>
    </section>;
  }

  if (snapshot.permission !== "granted") {
    const denied = snapshot.setupStatus === "denied";
    const unavailable = snapshot.setupStatus === "unavailable";
    return <section className="first-launch-audio-setup" aria-labelledby="first-launch-audio-permission">
      <article className={`first-launch-audio-primer${denied || unavailable ? " is-error" : ""}`}>
        <div>
          <span className="first-launch-audio-overline">{t("audioVideo.microphone")}</span>
          <strong id="first-launch-audio-permission">{denied ? t("audioVideo.accessBlocked") : unavailable ? t("audioVideo.noMicrophoneFound") : t("audioVideo.permissionTitle")}</strong>
          <p>{denied ? t("audioVideo.permissionBlockedBody") : unavailable ? t("audioVideo.noMicrophoneBody") : t("audioVideo.permissionBody")}</p>
        </div>
        {error ? <p className="first-launch-audio-error" role="alert">{error}</p> : null}
        <button type="button" className="primary" onClick={requestMicrophone} disabled={snapshot.isLoading}>
          {snapshot.isLoading ? t("audioVideo.requesting") : denied || unavailable ? t("audioVideo.tryAgain") : t("audioVideo.enableMicrophone")}
        </button>
        <small>{t("audioVideo.localOnly")}</small>
      </article>
    </section>;
  }

  return <section className="first-launch-audio-setup" aria-label={t("audioVideo.audioSetupLabel")}>
    {snapshot.isLoading ? <p className="first-launch-audio-note" role="status">{t("audioVideo.loadingDevices")}</p> : null}
    <div className="first-launch-audio-grid">
      <fieldset className="first-launch-audio-section">
        <legend>{t("audioVideo.microphone")}</legend>
        <label className="first-launch-audio-field">
          <span>{t("audioVideo.inputDevice")}</span>
          <select value={snapshot.selectedInputId} onChange={(event) => void selectInput(event.target.value)} disabled={changingInput || snapshot.isLoading || snapshot.inputDevices.length === 0}>
            {snapshot.inputDevices.length === 0 ? <option value="default">{t("audioVideo.noMicrophoneFound")}</option> : null}
            {snapshot.inputDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{deviceLabel(device, "input", index, t)}</option>)}
          </select>
        </label>
        {snapshot.inputDevices.length === 0 ? <p className="first-launch-audio-note">{t("audioVideo.noMicrophoneBody")}</p> : <>
          <div className="first-launch-audio-meter-card">
            <div><span>{t("audioVideo.inputLevel")}</span><strong aria-live="polite">{microphoneStatus}</strong></div>
            <div className="first-launch-audio-meter" role="meter" aria-label={t("audioVideo.inputLevel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(snapshot.microphoneLevel * 100)} aria-valuetext={t("audioVideo.inputLevelPercent", { value: Math.round(snapshot.microphoneLevel * 100) })}>
              <span style={{ transform: `scaleX(${snapshot.microphoneLevel})` }} />
            </div>
          </div>
          <div className="first-launch-audio-actions">
            <button type="button" className="secondary" onClick={() => snapshot.microphoneTestActive ? voiceDeviceService.stopMicrophoneTest() : void voiceDeviceService.startMicrophoneTest()}>
              {snapshot.microphoneTestActive ? t("audioVideo.stopTest") : t("audioVideo.testMicrophone")}
            </button>
          </div>
        </>}
      </fieldset>

      <fieldset className="first-launch-audio-section">
        <legend>{t("audioVideo.speaker")}</legend>
        {canRouteOutput ? <label className="first-launch-audio-field">
          <span>{t("audioVideo.outputDevice")}</span>
          <select value={snapshot.selectedOutputId} onChange={(event) => voiceDeviceService.selectOutput(event.target.value)} disabled={snapshot.outputDevices.length === 0}>
            {snapshot.outputDevices.length === 0 ? <option value="default">{t("audioVideo.noOutputFound")}</option> : null}
            {snapshot.outputDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{deviceLabel(device, "output", index, t)}</option>)}
          </select>
        </label> : <div className="first-launch-audio-system-default"><span>{t("audioVideo.outputDevice")}</span><strong>{t("audioVideo.systemDefault")}</strong><small>{t("audioVideo.systemDefaultBody")}</small></div>}
        {snapshot.outputDevices.length === 0 ? <p className="first-launch-audio-note">{t("audioVideo.noOutputFound")}</p> : null}
        <div className="first-launch-audio-output-status" role="status" aria-live="polite">
          <span>{t("audioVideo.selectedOutput")}</span>
          <strong>{canRouteOutput && outputLabel ? deviceLabel(outputLabel, "output", snapshot.outputDevices.indexOf(outputLabel), t) : t("audioVideo.systemDefault")}</strong>
        </div>
        <div className="first-launch-audio-actions">
          <button type="button" className="secondary" onClick={() => void voiceDeviceService.testOutput()} disabled={snapshot.outputTestActive}>
            {snapshot.outputTestActive ? t("audioVideo.playingTestSound") : t("audioVideo.testSpeakers")}
          </button>
        </div>
      </fieldset>
    </div>
    <aside className="first-launch-audio-health" aria-live="polite">
      <div><span>{t("audioVideo.microphone")}</span><strong>{snapshot.inputDevices.length ? t("audioVideo.configured") : t("audioVideo.unavailable")}</strong></div>
      <div><span>{t("audioVideo.speaker")}</span><strong>{snapshot.outputDevices.length || !canRouteOutput ? t("audioVideo.ready") : t("audioVideo.unavailable")}</strong></div>
    </aside>
    {error ? <p className="first-launch-audio-error" role="alert">{error}</p> : null}
    {snapshot.notice ? <p className="first-launch-audio-note" role="status">{t("audioVideo.deviceChanged")}</p> : null}
  </section>;
}
