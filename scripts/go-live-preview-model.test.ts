import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElectronDesktopCaptureConstraints } from "../src/utils/electronDesktopCapture.ts";

describe("electronDesktopCapture", () => {
  it("builds video-only desktop constraints for preview", () => {
    const constraints = createElectronDesktopCaptureConstraints("screen:1:0", false, {
      maxWidth: 1920,
      maxHeight: 1080,
      maxFrameRate: 30,
    });
    assert.equal(constraints.audio, false);
    const video = constraints.video as { mandatory: Record<string, unknown> };
    assert.equal(video.mandatory.chromeMediaSource, "desktop");
    assert.equal(video.mandatory.chromeMediaSourceId, "screen:1:0");
    assert.equal(video.mandatory.maxWidth, 1920);
  });

  it("includes desktop audio when requested", () => {
    const constraints = createElectronDesktopCaptureConstraints("window:abc", true);
    const audio = constraints.audio as { mandatory: Record<string, unknown> };
    assert.equal(audio.mandatory.chromeMediaSource, "desktop");
    assert.equal(audio.mandatory.chromeMediaSourceId, "window:abc");
  });
});
