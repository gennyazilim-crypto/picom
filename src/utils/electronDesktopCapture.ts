/**
 * Shared Chromium desktop-capture constraints for Electron screen/window sources.
 * Used by Go Live local preview and LiveKit publish so both paths match.
 */
export function createElectronDesktopCaptureConstraints(
  sourceId: string,
  includeAudio: boolean,
  options: Readonly<{ maxWidth?: number; maxHeight?: number; maxFrameRate?: number }> = {},
): MediaStreamConstraints {
  const maxWidth = options.maxWidth ?? 1920;
  const maxHeight = options.maxHeight ?? 1080;
  const maxFrameRate = options.maxFrameRate ?? 30;
  const video = {
    mandatory: {
      chromeMediaSource: "desktop",
      chromeMediaSourceId: sourceId,
      maxWidth,
      maxHeight,
      maxFrameRate,
    },
  } as unknown as MediaTrackConstraints;

  if (!includeAudio) {
    return { audio: false, video };
  }

  return {
    audio: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
      },
    } as unknown as MediaTrackConstraints,
    video,
  };
}

export async function acquireElectronDesktopCaptureStream(
  sourceId: string,
  options: Readonly<{ includeAudio?: boolean; maxWidth?: number; maxHeight?: number; maxFrameRate?: number }> = {},
): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("SCREEN_CAPTURE_UNAVAILABLE");
  }
  const includeAudio = options.includeAudio !== false;
  if (!includeAudio) {
    return navigator.mediaDevices.getUserMedia(
      createElectronDesktopCaptureConstraints(sourceId, false, options),
    );
  }
  try {
    return await navigator.mediaDevices.getUserMedia(
      createElectronDesktopCaptureConstraints(sourceId, true, options),
    );
  } catch {
    return navigator.mediaDevices.getUserMedia(
      createElectronDesktopCaptureConstraints(sourceId, false, options),
    );
  }
}

export type LocalPreviewAttachResult = Readonly<{
  videoWidth: number;
  videoHeight: number;
  readyState: MediaStreamTrackState;
}>;

/**
 * Bind a live MediaStream to a video element and wait until real frames exist.
 * Does not stop tracks on detach — caller owns track lifecycle.
 */
export async function attachLocalPreviewStream(
  video: HTMLVideoElement,
  stream: MediaStream,
  options: Readonly<{ timeoutMs?: number }> = {},
): Promise<LocalPreviewAttachResult> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState !== "live") {
    throw new Error("PREVIEW_TRACK_NOT_LIVE");
  }

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.srcObject = stream;

  const waitForFrames = new Promise<LocalPreviewAttachResult>((resolve, reject) => {
    let settled = false;
    const finish = (ok: boolean, reason?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("loadeddata", onMeta);
      video.removeEventListener("resize", onMeta);
      if (ok) {
        resolve({
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: track.readyState,
        });
        return;
      }
      reject(new Error(reason || "PREVIEW_NO_FRAMES"));
    };

    const onMeta = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0 && track.readyState === "live") {
        finish(true);
      }
    };

    const timer = window.setTimeout(() => {
      finish(false, `PREVIEW_TIMEOUT ${video.videoWidth}x${video.videoHeight} track=${track.readyState}`);
    }, timeoutMs);

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("loadeddata", onMeta);
    video.addEventListener("resize", onMeta);
    onMeta();
  });

  try {
    await video.play();
  } catch {
    // Autoplay can reject while muted metadata still loads; frame wait is authoritative.
  }

  return waitForFrames;
}

export function detachLocalPreviewStream(video: HTMLVideoElement | null, stream: MediaStream | null): void {
  if (!video) return;
  if (stream && video.srcObject === stream) {
    video.srcObject = null;
  } else if (!stream) {
    video.srcObject = null;
  }
}
