import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
}

class FakeTrack {
  readyState = "live";
  stopped = false;
  #listeners = new Map();
  addEventListener(type, listener) { this.#listeners.set(type, listener); }
  removeEventListener(type) { this.#listeners.delete(type); }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.readyState = "ended";
    this.#listeners.get("ended")?.();
  }
}

const activeTracks = [];
const requests = [];
const mediaListeners = new Set();
let devices = [
  { kind: "videoinput", deviceId: "default", label: "" },
  { kind: "videoinput", deviceId: "camera-2", label: "Desk camera" },
  { kind: "audioinput", deviceId: "mic-1", label: "Microphone" },
  { kind: "audiooutput", deviceId: "speaker-1", label: "Speaker" },
];

function stream() {
  const track = new FakeTrack();
  activeTracks.push(track);
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  };
}

globalThis.localStorage = new MemoryStorage();
globalThis.window = {
  picomDesktop: undefined,
  addEventListener() {},
  removeEventListener() {},
};
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
  mediaDevices: {
    async enumerateDevices() { return devices; },
    async getUserMedia(constraints) { requests.push(constraints); return stream(); },
    async getDisplayMedia(constraints) { requests.push({ display: constraints }); return stream(); },
    addEventListener(type, listener) { if (type === "devicechange") mediaListeners.add(listener); },
    removeEventListener(type, listener) { if (type === "devicechange") mediaListeners.delete(listener); },
  },
} });

const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: "custom" });
const { meetingPreJoinService } = await vite.ssrLoadModule("/src/services/meeting/meetingPreJoinService.ts");
const { screenCaptureService } = await vite.ssrLoadModule("/src/services/screenCaptureService.ts");
const { createElectronDesktopCaptureConstraints } = await vite.ssrLoadModule("/src/utils/electronDesktopCapture.ts");

meetingPreJoinService.activate();
await meetingPreJoinService.refreshDevices();
assert.equal(requests.length, 0, "camera enumeration must not request a stream");
assert.deepEqual(meetingPreJoinService.getSnapshot().cameras.map((camera) => camera.deviceId), ["default", "camera-2"], "only videoinput devices are enumerated");
assert.equal(meetingPreJoinService.getSnapshot().cameras[0].labelIsFallback, true, "empty camera labels require a localized deterministic fallback");

assert.equal(await meetingPreJoinService.selectCamera("camera-2"), true, "a selected camera uses the regular meeting preference source");
assert.equal(await meetingPreJoinService.startCameraPreview(), true, "an explicit action starts a camera preview");
assert.deepEqual(requests.at(-1), { audio: false, video: { deviceId: { exact: "camera-2" }, width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 24, max: 30 } } }, "camera setup is video-only and uses the selected exact device");
assert.equal(meetingPreJoinService.getSnapshot().cameraPreviewStream?.getVideoTracks()[0].readyState, "live", "only a live video track can activate preview");
assert.equal(JSON.parse(localStorage.getItem("picom.meeting-prejoin.v1")).selectedCameraId, "camera-2", "camera selection persists through the regular meeting preference");
const initialCameraTrack = activeTracks.at(-1);
meetingPreJoinService.stopCameraPreview();
assert.equal(initialCameraTrack.stopped, true, "stopping preview releases all camera tracks");

assert.equal(await meetingPreJoinService.startCameraPreview(), true);
const removedCameraTrack = activeTracks.at(-1);
devices = devices.filter((device) => device.deviceId !== "camera-2");
for (const listener of mediaListeners) listener();
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(removedCameraTrack.stopped, true, "camera removal stops the active stream");
assert.equal(meetingPreJoinService.getSnapshot().cameraPreviewActive, false, "camera removal never silently restarts a fallback preview");
assert.equal(meetingPreJoinService.getSnapshot().selectedCameraId, "default", "missing camera falls back deterministically");
devices = [
  { kind: "videoinput", deviceId: "default", label: "" },
  { kind: "videoinput", deviceId: "camera-2", label: "Desk camera" },
  { kind: "audioinput", deviceId: "mic-1", label: "Microphone" },
  { kind: "audiooutput", deviceId: "speaker-1", label: "Speaker" },
];
await meetingPreJoinService.refreshDevices();

const deferred = [];
navigator.mediaDevices.getUserMedia = (constraints) => {
  requests.push(constraints);
  return new Promise((resolve) => deferred.push(resolve));
};
const stalePreview = meetingPreJoinService.startCameraPreview();
const currentPreview = meetingPreJoinService.startCameraPreview();
deferred[1](stream());
assert.equal(await currentPreview, true, "the current camera preview resolves");
const currentTrack = activeTracks.at(-1);
deferred[0](stream());
assert.equal(await stalePreview, false, "a late camera stream cannot overwrite the current preview");
assert.equal(activeTracks.at(-1).stopped, true, "a stale camera stream is immediately stopped");
meetingPreJoinService.stopCameraPreview();
assert.equal(currentTrack.stopped, true, "current preview cleanup releases the final stream");

const browserSources = await screenCaptureService.listSources();
assert.equal(browserSources.ok, true, "a browser fallback exposes only the native display picker entry");
assert.equal(requests.filter((request) => "display" in request).length, 0, "screen capture is not requested while listing browser capability");
if (browserSources.ok) {
  const chosen = await screenCaptureService.selectSource(browserSources.requestId, browserSources.sources[0].id);
  assert.equal(chosen.ok, true, "the browser picker path validates its synthetic session source");
  const browserCapture = await screenCaptureService.acquireBrowserDisplayMedia({ video: true, audio: false });
  assert.equal(browserCapture.ok, true, "display capture is an explicit user action");
  assert.deepEqual(requests.at(-1), { display: { video: true, audio: false } }, "screen preflight never requests display audio");
  if (browserCapture.ok) browserCapture.stream.getTracks().forEach((track) => track.stop());
}

let canceledRequest = null;
window.picomDesktop = {
  getRuntimeInfo: () => ({ runtime: "electron", platform: "win32", versions: {} }),
  screenCapture: {
    async getSources({ requestId }) {
      return { ok: true, native: true, requestId, sources: [{ id: "screen:1", name: "Primary display", type: "screen", thumbnailDataUrl: null, appIconDataUrl: null }] };
    },
    async selectSource({ sourceId }) { return { ok: true, native: true, source: { id: sourceId, name: "Primary display", type: "screen" } }; },
    async cancelSelection({ requestId }) { canceledRequest = requestId; return { ok: true, native: true, canceled: true }; },
  },
};
navigator.mediaDevices.getUserMedia = async (constraints) => { requests.push(constraints); return stream(); };
const electronSources = await screenCaptureService.listSources();
assert.equal(electronSources.ok, true, "Electron preflight enumerates real secure screen/window sources");
if (electronSources.ok) {
  const selected = await screenCaptureService.selectSource(electronSources.requestId, "screen:1");
  assert.equal(selected.ok, true, "Electron source selection is approved by the narrow bridge");
  const capture = await screenCaptureService.acquireElectronDesktopMedia("screen:1", { includeAudio: false });
  assert.equal(capture.ok, true, "Electron source opens a local video-only preflight stream");
  const constraints = requests.at(-1);
  assert.equal(constraints.audio, false, "Electron screen preflight does not capture audio");
  assert.equal(constraints.video.mandatory.chromeMediaSourceId, "screen:1", "Electron capture uses the validated source id");
  if (capture.ok) capture.stream.getTracks().forEach((track) => track.stop());
  await screenCaptureService.cancelSelection(electronSources.requestId);
  assert.equal(canceledRequest, electronSources.requestId, "unused source sessions can be explicitly invalidated");
}
assert.equal(createElectronDesktopCaptureConstraints("screen:1", false).audio, false, "the reusable Electron constraints preserve video-only capture");

const cameraComponent = readFileSync("src/components/firstLaunch/FirstLaunchCameraSetup.tsx", "utf8");
const screenComponent = readFileSync("src/components/firstLaunch/FirstLaunchScreenSharePreflight.tsx", "utf8");
assert.ok(!cameraComponent.includes("getUserMedia") && !cameraComponent.includes("LiveKit") && !cameraComponent.includes("MediaRecorder") && cameraComponent.includes("<label") && cameraComponent.includes("aria-live=\"polite\""), "camera UI delegates capture, never records or joins a call, and exposes labelled status");
assert.ok(!screenComponent.includes("LiveKit") && !screenComponent.includes("MediaRecorder") && screenComponent.includes("cancelSelection") && screenComponent.includes("track.stop()") && screenComponent.includes('addEventListener("ended"') && screenComponent.includes("<fieldset") && screenComponent.includes("<button"), "screen preflight is local-only, keyboard-accessible, and cleans preview resources");

const requiredKeys = ["camera.enable", "camera.select", "camera.previewLabel", "camera.error.denied", "screen.test", "screen.choose", "screen.captureReady", "screen.error.permission", "ready.camera", "ready.screenSharing"];
for (const locale of ["en", "tr", "de", "fr", "es", "it", "pt", "nl", "pl", "ru"]) {
  const catalog = JSON.parse(readFileSync(`src/i18n/locales/${locale}/firstLaunch.json`, "utf8"));
  for (const key of requiredKeys) assert.equal(typeof catalog[key], "string", `${locale} must provide ${key}`);
}

meetingPreJoinService.dispose();
assert.ok(activeTracks.every((track) => track.stopped), "camera and screen runtime test leaves no active task-owned track");
await vite.close();
console.log("First-launch camera and screen runtime: PASS — real device selection, video-only capture, local preflight, cleanup, hotplug, race safety, and locale coverage.");
