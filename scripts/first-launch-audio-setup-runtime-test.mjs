import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
}

let devices = [
  { kind: "audioinput", deviceId: "default", label: "" },
  { kind: "audioinput", deviceId: "mic-2", label: "Desk microphone" },
  { kind: "audiooutput", deviceId: "default", label: "" },
  { kind: "audiooutput", deviceId: "speaker-2", label: "Headphones" },
  { kind: "videoinput", deviceId: "camera-1", label: "Camera" },
];
const requests = [];
const tracks = [];
const frames = new Map();
let nextFrame = 1;
let hasInput = false;
let deviceChangeListener;

function createStream() {
  const track = { stopped: false, stop() { this.stopped = true; } };
  tracks.push(track);
  return { getTracks: () => [track] };
}

class FakeAudioContext {
  static instances = [];
  constructor() { this.currentTime = 0; this.destination = {}; this.closed = false; this.sinkId = null; FakeAudioContext.instances.push(this); }
  createMediaStreamSource() { return { connect() {} }; }
  createAnalyser() { return { fftSize: 0, getByteTimeDomainData(buffer) { buffer.fill(128); if (hasInput) buffer[0] = 200; } }; }
  createOscillator() { return { frequency: { value: 0 }, connect() { return { connect() {} }; }, start() {}, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return {}; } }; }
  async resume() {}
  async close() { this.closed = true; }
  async setSinkId(id) { this.sinkId = id; }
}

globalThis.localStorage = new MemoryStorage();
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
  mediaDevices: {
    async enumerateDevices() { return devices; },
    async getUserMedia(constraints) { requests.push(constraints); return createStream(); },
    getSupportedConstraints() { return { echoCancellation: true, noiseSuppression: true, autoGainControl: true }; },
    addEventListener(name, listener) { if (name === "devicechange") deviceChangeListener = listener; }, removeEventListener() {},
  },
} });
Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: FakeAudioContext });
globalThis.requestAnimationFrame = (callback) => { const id = nextFrame++; frames.set(id, callback); return id; };
globalThis.cancelAnimationFrame = (id) => frames.delete(id);

const { voiceDeviceService } = await import("../src/services/voiceDeviceService.ts");
const firstLaunchAudio = readFileSync("src/components/firstLaunch/FirstLaunchAudioSetup.tsx", "utf8");
assert.ok(!firstLaunchAudio.includes("getUserMedia") && !firstLaunchAudio.includes("LiveKit") && !firstLaunchAudio.includes("video:"), "the first-launch UI must not own media capture, camera, or LiveKit");
const unsubscribe = voiceDeviceService.subscribe(() => {});
assert.equal(typeof deviceChangeListener, "function", "the shared service must listen for device hotplug events");

await voiceDeviceService.refresh(false);
assert.equal(requests.length, 0, "enumeration must not prompt for a microphone");
assert.deepEqual(voiceDeviceService.getSnapshot().inputDevices.map((device) => device.deviceId), ["default", "mic-2"], "only audio inputs are shown");
assert.deepEqual(voiceDeviceService.getSnapshot().outputDevices.map((device) => device.deviceId), ["default", "speaker-2"], "only audio outputs are shown");
assert.equal(voiceDeviceService.getSnapshot().inputDevices[0].labelIsFallback, true, "blank labels need localized UI fallbacks");
devices = [...devices, { kind: "audioinput", deviceId: "usb-mic", label: "USB microphone" }];
deviceChangeListener();
await new Promise((resolve) => setTimeout(resolve, 380));
assert.ok(voiceDeviceService.getSnapshot().inputDevices.some((device) => device.deviceId === "usb-mic"), "devicechange must refresh the device list without a restart");
devices = devices.filter((device) => device.deviceId !== "usb-mic");

await voiceDeviceService.refresh(true);
assert.deepEqual(requests[0], { audio: true, video: false }, "permission request must be audio-only");
assert.equal(tracks[0].stopped, true, "permission-primer stream is stopped immediately");
assert.equal(voiceDeviceService.getSnapshot().permission, "granted");
assert.equal(await voiceDeviceService.selectInput("mic-2"), true);
assert.equal(voiceDeviceService.selectOutput("speaker-2"), true);
const stored = JSON.parse(localStorage.getItem("picom.voice-device-preferences.v1"));
assert.deepEqual({ input: stored.selectedInputId, output: stored.selectedOutputId }, { input: "mic-2", output: "speaker-2" }, "device IDs persist without audio data");
assert.equal(JSON.stringify(stored).includes("base64"), false, "audio bytes must never persist");

hasInput = false;
assert.equal(await voiceDeviceService.startMicrophoneTest(), true);
assert.equal(voiceDeviceService.getSnapshot().microphoneTestPassed, false, "silence must not pass a microphone test");
const silentTrack = tracks.at(-1);
voiceDeviceService.stopMicrophoneTest();
assert.equal(silentTrack.stopped, true, "stopping a test stops all task-owned tracks");
assert.equal(frames.size, 0, "stopping a test cancels the analyser frame");

hasInput = true;
assert.equal(await voiceDeviceService.startMicrophoneTest(), true);
assert.ok(voiceDeviceService.getSnapshot().microphoneLevel > 0 && voiceDeviceService.getSnapshot().microphoneTestPassed, "input detection must derive from real analyser samples");
const activeTrack = tracks.at(-1);
devices = devices.filter((device) => device.deviceId !== "mic-2");
await voiceDeviceService.refresh(false);
assert.equal(activeTrack.stopped, true, "device loss stops the active test stream");
assert.equal(voiceDeviceService.getSnapshot().microphoneTestActive, false, "device loss ends, not restarts, a test");
assert.equal(voiceDeviceService.getSnapshot().selectedInputId, "default", "missing input falls back to default deterministically");
devices = devices.filter((device) => device.deviceId !== "speaker-2");
await voiceDeviceService.refresh(false);
assert.equal(voiceDeviceService.getSnapshot().selectedOutputId, "default", "missing output falls back safely to the system default");

devices = [
  { kind: "audioinput", deviceId: "default", label: "" },
  { kind: "audioinput", deviceId: "mic-2", label: "Desk microphone" },
  { kind: "audiooutput", deviceId: "default", label: "" },
  { kind: "audiooutput", deviceId: "speaker-2", label: "Headphones" },
];
await voiceDeviceService.refresh(false);
voiceDeviceService.selectOutput("speaker-2");
assert.equal(await voiceDeviceService.testOutput(), true, "speaker test is a local user action");
assert.equal(FakeAudioContext.instances.at(-1).sinkId, "speaker-2", "speaker test routes to selected output when supported");
assert.ok(FakeAudioContext.instances.at(-1).closed, "speaker context is closed after playback");
const sinkId = FakeAudioContext.prototype.setSinkId;
FakeAudioContext.prototype.setSinkId = undefined;
assert.equal(voiceDeviceService.supportsOutputSelection(), false, "unsupported output routing must expose system-default semantics rather than a fake picker");
FakeAudioContext.prototype.setSinkId = sinkId;

const deferred = [];
navigator.mediaDevices.getUserMedia = (constraints) => { requests.push(constraints); return new Promise((resolve) => deferred.push(resolve)); };
const oldSelection = voiceDeviceService.selectInput("default");
const currentSelection = voiceDeviceService.selectInput("mic-2");
deferred[1](createStream());
assert.equal(await currentSelection, true);
deferred[0](createStream());
assert.equal(await oldSelection, false, "a stale async selection cannot overwrite a newer one");
assert.equal(voiceDeviceService.getSnapshot().selectedInputId, "mic-2");

voiceDeviceService.stopTests();
unsubscribe();
assert.equal(frames.size, 0, "step cleanup releases all analyser frames");
assert.equal(voiceDeviceService.getSnapshot().outputTestActive, false, "step cleanup stops speaker testing");
assert.ok(!firstLaunchAudio.includes("fetch(") && !firstLaunchAudio.includes("localStorage") && !firstLaunchAudio.includes("MediaRecorder"), "first-launch test UI must not upload, store, or record audio");

console.log("First-launch audio setup runtime: PASS — permission gating, enumeration, persistence, analyser, output routing, fallback, races, and cleanup.");
