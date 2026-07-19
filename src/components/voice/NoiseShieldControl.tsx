import { useEffect, useState, useSyncExternalStore } from "react";
import type { NoiseCancellationMode } from "../../types/audioProcessing";
import type { NoiseShieldSnapshot } from "../../types/noiseShield";
import { noiseShieldService } from "../../services/noiseShieldService";
import { noiseShieldControlService } from "../../services/voice/noiseShieldControlService";
import { noiseShieldDiagnosticsService } from "../../services/voice/noiseShieldDiagnosticsService";
import { voiceDeviceService, type VoiceDeviceSnapshot } from "../../services/voiceDeviceService";
import { AppIcon } from "../AppIcon";
import "./NoiseShieldControl.css";

const modeDescriptions: Record<NoiseCancellationMode, string> = {
  off: "Disable native noise suppression while keeping echo and gain preferences independent.",
  standard: "Use supported Chromium WebRTC microphone noise suppression.",
  enhanced: "Stronger local suppression through the optional official LiveKit processor.",
  "voice-focus": "Suppress nearby background voices around one primary speaker.",
};

const allModes: readonly NoiseCancellationMode[] = ["off", "standard", "enhanced", "voice-focus"];

function useNoiseShield(): NoiseShieldSnapshot {
  const [snapshot, setSnapshot] = useState(() => noiseShieldService.getSnapshot());
  useEffect(() => noiseShieldService.subscribe(() => setSnapshot(noiseShieldService.getSnapshot())), []);
  return snapshot;
}

function useVoiceDevices(): VoiceDeviceSnapshot {
  const [snapshot, setSnapshot] = useState(() => voiceDeviceService.getSnapshot());
  useEffect(() => voiceDeviceService.subscribe(setSnapshot), []);
  return snapshot;
}

function supportReason(mode: NoiseCancellationMode, snapshot: NoiseShieldSnapshot): string | null {
  if (snapshot.availableModes.includes(mode)) return null;
  if (mode === "enhanced" || mode === "voice-focus") return "The optional official LiveKit processor package/provider is not available in this build. Standard remains available.";
  return "This runtime does not expose native microphone noise suppression.";
}

export function NoiseShieldSettingsPanel() {
  const snapshot = useNoiseShield();
  const devices = useVoiceDevices();
  const [busy, setBusy] = useState(false);
  const status = devices.permission === "denied" ? "Permission required" : devices.permission === "granted" && devices.inputDevices.length === 0 ? "No microphone detected" : noiseShieldControlService.statusLabel(snapshot);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  };

  return (
    <section className="noise-shield-settings" aria-labelledby="noise-shield-settings-title">
      <header>
        <span className="noise-shield-mark" aria-hidden="true"><AppIcon name="voice" size="md" /></span>
        <div><h3 id="noise-shield-settings-title">Noise Shield</h3><p>Microphone-only processing. Radio, Podcasts, music, and screen-share system audio are never filtered.</p></div>
      </header>

      <div className="noise-shield-mode-grid" role="radiogroup" aria-label="Noise cancellation mode">
        {allModes.map((mode) => {
          const reason = supportReason(mode, snapshot);
          return <button key={mode} type="button" role="radio" aria-checked={snapshot.requestedMode === mode} disabled={busy || Boolean(reason)} title={reason ?? undefined} onClick={() => void run(() => noiseShieldControlService.setMode(mode))}><strong>{noiseShieldControlService.labels[mode]}</strong><small>{reason ?? modeDescriptions[mode]}</small></button>;
        })}
      </div>

      <div className="noise-shield-status-card" role="status" aria-live="polite">
        <span><AppIcon name="voice" size="sm" />{status}</span>
        <dl><div><dt>Requested</dt><dd>{noiseShieldControlService.labels[snapshot.requestedMode]}</dd></div><div><dt>Applied</dt><dd>{noiseShieldControlService.labels[snapshot.appliedMode]}</dd></div></dl>
        {snapshot.fallbackReason ? <p>{snapshot.fallbackReason}</p> : null}
        {(snapshot.status === "failed" || snapshot.status === "fallback" || snapshot.status === "fallback-standard" || snapshot.status === "unavailable") ? <button type="button" disabled={busy || devices.permission !== "granted"} onClick={() => void run(() => noiseShieldControlService.retry())}>Retry processing</button> : null}
      </div>

      <div className="noise-shield-independent-controls">
        <label><span><strong>Echo cancellation</strong><small>{devices.supportedConstraints.echoCancellation ? "Reduce local speaker echo independently of Noise Shield." : "Not supported by this runtime."}</small></span><input type="checkbox" checked={snapshot.settings.echoCancellation} disabled={busy || !devices.supportedConstraints.echoCancellation} onChange={(event) => void run(() => noiseShieldControlService.updateSettings({ echoCancellation: event.target.checked }))} /></label>
        <label><span><strong>Automatic gain control</strong><small>{devices.supportedConstraints.autoGainControl ? "Normalize supported microphone gain independently." : "Not supported by this runtime."}</small></span><input type="checkbox" checked={snapshot.settings.autoGainControl} disabled={busy || !devices.supportedConstraints.autoGainControl} onChange={(event) => void run(() => noiseShieldControlService.updateSettings({ autoGainControl: event.target.checked }))} /></label>
        <label><span><strong>Remember for this device</strong><small>Store the mode and independent processing preferences locally.</small></span><input type="checkbox" checked={snapshot.settings.rememberForDevice} disabled={busy} onChange={(event) => void run(() => noiseShieldControlService.updateSettings({ rememberForDevice: event.target.checked, preferredInputDeviceId: devices.selectedInputId }))} /></label>
      </div>

      <NoiseShieldDiagnosticsPanel />

      <p className="noise-shield-voice-focus-warning"><strong>Voice Focus:</strong> may suppress other real speakers near a shared microphone. It is never the default and is not intended for music or studio use.</p>
    </section>
  );
}

export function NoiseShieldDiagnosticsPanel() {
  const diagnostics = useSyncExternalStore(
    noiseShieldDiagnosticsService.subscribe,
    noiseShieldDiagnosticsService.getSnapshot,
    noiseShieldDiagnosticsService.getSnapshot,
  );
  const supported = Object.entries(diagnostics.supportedConstraints).filter(([, value]) => value).map(([key]) => key).join(", ") || "none reported";
  const applied = diagnostics.appliedTrackSettings;

  return (
    <details className="noise-shield-diagnostics">
      <summary><span><AppIcon name="settings" size="xs" />Support diagnostics</span><small>Privacy-safe</small></summary>
      <div className="noise-shield-diagnostics-body">
        <dl>
          <div><dt>Requested / applied</dt><dd>{diagnostics.requestedMode} / {diagnostics.appliedMode}</dd></div>
          <div><dt>Provider / status</dt><dd>{diagnostics.provider} / {diagnostics.status}</dd></div>
          <div><dt>Processor</dt><dd>{diagnostics.processorState ?? "not attached"}</dd></div>
          <div><dt>Initialization</dt><dd>{diagnostics.processorInitializationDurationMs === null ? "not measured" : `${Math.round(diagnostics.processorInitializationDurationMs)} ms`}</dd></div>
          <div><dt>Input device</dt><dd>{diagnostics.inputDeviceKey}</dd></div>
          <div><dt>Permission</dt><dd>{diagnostics.permission}</dd></div>
          <div><dt>Lifecycle</dt><dd>{diagnostics.lifecycle.lastEvent} / generation {diagnostics.lifecycle.generation}</dd></div>
          <div><dt>CPU approximation</dt><dd>{diagnostics.performance.cpuApproximation}</dd></div>
          <div><dt>Renderer memory</dt><dd>{diagnostics.performance.rendererMemoryBucket}</dd></div>
        </dl>
        <p><strong>Supported:</strong> {supported}</p>
        <p><strong>Applied track:</strong> echo {String(applied?.echoCancellation ?? "unknown")}, noise {String(applied?.noiseSuppression ?? "unknown")}, gain {String(applied?.autoGainControl ?? "unknown")}</p>
        {diagnostics.fallbackReason || diagnostics.errorCode ? <p className="noise-shield-diagnostics-warning"><strong>{diagnostics.errorCode ?? "Fallback"}:</strong> {diagnostics.fallbackReason ?? "See the current processing state."}</p> : null}
        <p className="noise-shield-diagnostics-privacy">No raw audio, waveform, full device identifier, device label, token, or room/session object is captured by this panel.</p>
      </div>
    </details>
  );
}

export function NoiseShieldQuickControl({
  connected,
  variant = "compact",
}: {
  connected: boolean;
  variant?: "compact" | "card";
}) {
  const snapshot = useNoiseShield();
  const value = snapshot.availableModes.includes(snapshot.requestedMode) ? snapshot.requestedMode : snapshot.appliedMode;

  if (variant === "card") {
    return (
      <div className="noise-shield-quick-control noise-shield-quick-control--card">
        <div className="noise-shield-quick-control__status" role="status">
          <strong>{noiseShieldControlService.labels[snapshot.appliedMode]}</strong>
          <small>
            {noiseShieldControlService.statusLabel(snapshot)} · Echo {snapshot.settings.echoCancellation ? "on" : "off"}
          </small>
        </div>
        <label className="noise-shield-quick-control__field">
          <span>Processing mode</span>
          <select
            aria-label="Change Noise Shield mode"
            value={value}
            disabled={!connected || snapshot.status === "loading"}
            onChange={(event) => void noiseShieldControlService.setMode(event.target.value as NoiseCancellationMode)}
          >
            {snapshot.availableModes.map((mode) => (
              <option key={mode} value={mode}>
                {noiseShieldControlService.labels[mode]}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <label className="noise-shield-quick-control">
      <AppIcon name="voice" size="sm" />
      <span>
        <strong>Shield: {noiseShieldControlService.labels[snapshot.appliedMode]}</strong>
        <small>
          {noiseShieldControlService.statusLabel(snapshot)} · Echo {snapshot.settings.echoCancellation ? "on" : "off"}
        </small>
      </span>
      <select
        aria-label="Change Noise Shield mode"
        value={value}
        disabled={!connected || snapshot.status === "loading"}
        onChange={(event) => void noiseShieldControlService.setMode(event.target.value as NoiseCancellationMode)}
      >
        {snapshot.availableModes.map((mode) => (
          <option key={mode} value={mode}>
            {noiseShieldControlService.labels[mode]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NoiseShieldCompactStatus({ interactive = false }: { interactive?: boolean }) {
  const snapshot = useNoiseShield();
  const label = snapshot.status === "fallback" || snapshot.status === "fallback-standard" ? "Standard fallback" : noiseShieldControlService.labels[snapshot.appliedMode];
  return interactive ? <button type="button" className="noise-shield-compact-status" aria-label={`Noise Shield ${label}. Change mode`} disabled={snapshot.availableModes.length < 2 || snapshot.status === "loading"} onClick={() => void noiseShieldControlService.setMode(noiseShieldControlService.nextAvailableMode(snapshot))}><AppIcon name="voice" size="xs" />Shield: {label}</button> : <span className="noise-shield-compact-status" role="status"><AppIcon name="voice" size="xs" />Shield: {label}</span>;
}
