import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { meetingPreJoinService } from "../../services/meeting/meetingPreJoinService";
import type { MeetingPreJoinSnapshot } from "../../types/meetingPreJoin";
import type { VoiceDeviceOption } from "../../services/voiceDeviceService";
import { attachLocalPreviewStream, detachLocalPreviewStream } from "../../utils/electronDesktopCapture";

export type FirstLaunchCameraSetupSummary = Readonly<{
  attempted: boolean;
  passed: boolean;
  skipped: boolean;
}>;

type CameraSetupStatus = "unknown" | "prompt" | "requesting" | "granted" | "denied" | "unavailable" | "in-use" | "error" | "unsupported";

type FirstLaunchCameraSetupProps = Readonly<{
  onSummaryChange: (summary: FirstLaunchCameraSetupSummary) => void;
}>;

function cameraLabel(device: VoiceDeviceOption, index: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  return device.labelIsFallback ? t("camera.fallbackCamera", { number: index + 1 }) : device.label;
}

function cameraStatus(snapshot: MeetingPreJoinSnapshot, permissionHint: PermissionState | "unknown"): CameraSetupStatus {
  if (snapshot.cameraPermission === "unsupported") return "unsupported";
  if (snapshot.busy) return "requesting";
  switch (snapshot.error?.code) {
    case "CAMERA_DENIED": return "denied";
    case "CAMERA_MISSING": return "unavailable";
    case "CAMERA_BUSY": return "in-use";
    case "CAMERA_UNSUPPORTED": return "unsupported";
    case "DEVICE_UNAVAILABLE": return "error";
    default: break;
  }
  if (snapshot.cameraPermission === "granted") return "granted";
  if (permissionHint === "denied") return "denied";
  return permissionHint === "unknown" ? "unknown" : "prompt";
}

function statusText(status: CameraSetupStatus, previewActive: boolean, t: (key: string) => string): string {
  if (previewActive) return t("camera.active");
  switch (status) {
    case "requesting": return t("camera.starting");
    case "denied": return t("camera.accessBlocked");
    case "unavailable": return t("camera.unavailable");
    case "in-use": return t("camera.inUse");
    case "unsupported": return t("camera.unsupported");
    case "error": return t("camera.error");
    default: return t("camera.notTested");
  }
}

function errorText(snapshot: MeetingPreJoinSnapshot, t: (key: string) => string): string | null {
  switch (snapshot.error?.code) {
    case "CAMERA_DENIED": return t("camera.error.denied");
    case "CAMERA_MISSING": return t("camera.error.unavailable");
    case "CAMERA_BUSY": return t("camera.error.inUse");
    case "CAMERA_UNSUPPORTED": return t("camera.error.unsupported");
    case "DEVICE_UNAVAILABLE": return t("camera.error.unknown");
    default: return null;
  }
}

/** A device-local camera check backed by the regular meeting pre-join service. */
export function FirstLaunchCameraSetup({ onSummaryChange }: FirstLaunchCameraSetupProps) {
  const { t } = useTranslation("firstLaunch");
  const [snapshot, setSnapshot] = useState<MeetingPreJoinSnapshot>(() => meetingPreJoinService.getSnapshot());
  const [permissionHint, setPermissionHint] = useState<PermissionState | "unknown">("unknown");
  const [dimensions, setDimensions] = useState<Readonly<{ width: number; height: number }> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const summaryRef = useRef<FirstLaunchCameraSetupSummary>({ attempted: false, passed: false, skipped: false });

  const updateSummary = (patch: Partial<FirstLaunchCameraSetupSummary>) => {
    const next = { ...summaryRef.current, ...patch };
    summaryRef.current = next;
    onSummaryChange(next);
  };

  useEffect(() => {
    const unsubscribe = meetingPreJoinService.subscribe(() => setSnapshot(meetingPreJoinService.getSnapshot()));
    // Device listing and the optional Permissions API query never open a camera stream.
    meetingPreJoinService.activate();
    const permissions = typeof navigator === "undefined" ? undefined : navigator.permissions;
    let permissionStatus: PermissionStatus | null = null;
    let active = true;
    const syncPermission = () => {
      if (!active || !permissionStatus) return;
      setPermissionHint(permissionStatus.state);
      void meetingPreJoinService.handleCameraPermissionChange(permissionStatus.state);
    };
    if (permissions?.query) {
      void permissions.query({ name: "camera" as PermissionName }).then((result) => {
        if (!active) return;
        permissionStatus = result;
        syncPermission();
        permissionStatus.addEventListener("change", syncPermission);
      }).catch(() => undefined);
    }
    return () => {
      active = false;
      permissionStatus?.removeEventListener("change", syncPermission);
      unsubscribe();
      meetingPreJoinService.deactivate();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = snapshot.cameraPreviewStream;
    let active = true;
    if (!video || !stream || !snapshot.cameraPreviewActive) {
      detachLocalPreviewStream(video, stream);
      setDimensions(null);
      return;
    }
    void attachLocalPreviewStream(video, stream).then((result) => {
      if (!active || result.readyState !== "live") return;
      setDimensions({ width: result.videoWidth, height: result.videoHeight });
      updateSummary({ attempted: true, passed: true, skipped: false });
    }).catch(() => {
      if (!active) return;
      meetingPreJoinService.stopCameraPreview();
      updateSummary({ attempted: true, passed: false });
    });
    return () => {
      active = false;
      detachLocalPreviewStream(video, stream);
    };
  }, [snapshot.cameraPreviewActive, snapshot.cameraPreviewStream]);

  const status = cameraStatus(snapshot, permissionHint);
  const error = errorText(snapshot, t);
  const selectedCamera = useMemo(
    () => snapshot.cameras.find((device) => device.deviceId === snapshot.selectedCameraId),
    [snapshot.cameras, snapshot.selectedCameraId],
  );
  const showControls = status === "granted" || snapshot.cameraPreviewActive || snapshot.cameras.length > 0;

  const enableCamera = () => {
    updateSummary({ attempted: true, passed: false, skipped: false });
    void meetingPreJoinService.startCameraPreview();
  };

  const skipCamera = () => {
    meetingPreJoinService.stopCameraPreview();
    updateSummary({ skipped: true, passed: false });
  };

  return <section className="first-launch-camera-setup" aria-labelledby="first-launch-camera-heading">
    <header className="first-launch-media-section-heading">
      <div>
        <p className="first-launch-audio-overline">{t("camera.eyebrow")}</p>
        <h2 id="first-launch-camera-heading">{t("camera.title")}</h2>
        <p>{t("camera.body")}</p>
      </div>
      <span className={`first-launch-media-status is-${status}`} role="status" aria-live="polite">{statusText(status, snapshot.cameraPreviewActive, t)}</span>
    </header>

    {!showControls ? <article className={`first-launch-camera-primer${status === "denied" || status === "unavailable" || status === "in-use" || status === "unsupported" || status === "error" ? " is-error" : ""}`}>
      <div>
        <strong>{status === "denied" ? t("camera.accessBlocked") : status === "unavailable" ? t("camera.noCameraFound") : status === "in-use" ? t("camera.inUse") : status === "unsupported" ? t("camera.unsupported") : t("camera.permissionTitle")}</strong>
        <p>{status === "denied" ? t("camera.permissionBlockedBody") : status === "unavailable" ? t("camera.unavailableBody") : status === "in-use" ? t("camera.inUseBody") : status === "unsupported" ? t("camera.unsupportedBody") : t("camera.permissionBody")}</p>
      </div>
      {error ? <p className="first-launch-audio-error" role="alert">{error}</p> : null}
      <div className="first-launch-media-actions">
        {status !== "unsupported" ? <button type="button" className="primary" onClick={enableCamera} disabled={status === "requesting"}>{status === "requesting" ? t("camera.starting") : status === "denied" || status === "unavailable" || status === "in-use" || status === "error" ? t("camera.tryAgain") : t("camera.enable")}</button> : null}
        <button type="button" className="secondary" onClick={skipCamera}>{t("camera.skip")}</button>
      </div>
      <small>{t("camera.localOnly")}</small>
    </article> : <div className="first-launch-camera-grid">
      <fieldset className="first-launch-audio-section">
        <legend>{t("camera.title")}</legend>
        <label className="first-launch-audio-field">
          <span>{t("camera.select")}</span>
          <select value={snapshot.selectedCameraId} onChange={(event) => void meetingPreJoinService.selectCamera(event.target.value)} disabled={snapshot.busy || snapshot.cameras.length === 0}>
            {snapshot.cameras.length === 0 ? <option value="default">{t("camera.noCameraFound")}</option> : null}
            {snapshot.cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{cameraLabel(camera, index, t)}</option>)}
          </select>
        </label>
        <div className="first-launch-media-actions">
          <button type="button" className="secondary" onClick={() => snapshot.cameraPreviewActive ? meetingPreJoinService.stopCameraPreview() : enableCamera()} disabled={snapshot.busy || status === "unsupported" || snapshot.cameras.length === 0}>{snapshot.cameraPreviewActive ? t("camera.stop") : t("camera.start")}</button>
          <button type="button" className="secondary" onClick={skipCamera}>{t("camera.skip")}</button>
        </div>
        {error ? <p className="first-launch-audio-error" role="alert">{error}</p> : null}
        {snapshot.error?.code === "CAMERA_MISSING" && snapshot.notice ? <p className="first-launch-audio-note" role="status">{t("camera.deviceChanged")}</p> : null}
        <dl className="first-launch-media-health" aria-label={t("camera.healthLabel")}>
          <div><dt>{t("camera.deviceStatus")}</dt><dd>{selectedCamera ? t("camera.detected") : t("camera.unavailable")}</dd></div>
          <div><dt>{t("camera.permissionStatus")}</dt><dd>{status === "granted" || snapshot.cameraPreviewActive ? t("camera.granted") : statusText(status, false, t)}</dd></div>
          <div><dt>{t("camera.previewStatus")}</dt><dd>{snapshot.cameraPreviewActive ? t("camera.active") : t("camera.notTested")}</dd></div>
        </dl>
      </fieldset>
      <figure className="first-launch-camera-preview" aria-labelledby="first-launch-camera-preview-caption">
        <div className="first-launch-camera-preview-frame">
          <video ref={videoRef} autoPlay muted playsInline aria-label={t("camera.previewLabel")} />
          {!snapshot.cameraPreviewActive ? <span>{t("camera.previewIdle")}</span> : null}
        </div>
        <figcaption id="first-launch-camera-preview-caption">{snapshot.cameraPreviewActive && dimensions ? t("camera.previewDimensions", { width: dimensions.width, height: dimensions.height }) : t("camera.previewLabel")}</figcaption>
      </figure>
    </div>}
  </section>;
}
