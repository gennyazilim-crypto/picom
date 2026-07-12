import { ConnectionState, LocalAudioTrack, LocalVideoTrack, Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";

type ClientConfig = Readonly<{ label: string; url: string; token: string; expectedRemoteCount: number; nativeCapture?: boolean }>;
type HarnessCommand = Readonly<{ id: string; type: "connect" | "publish" | "verify-media" | "mute-cycle" | "verify-controls" | "screen-restart" | "simulate-reconnect" | "wait-reconnected" | "cleanup"; payload: unknown }>;
type HarnessBridge = Readonly<{
  getConfig: () => Promise<ClientConfig>;
  screenCapture: Readonly<{
    getSources: () => Promise<{ ok: boolean; requestId?: string; sources?: Array<{ id: string; name: string; type: "screen" | "window" }>; error?: string }>;
    selectSource: (requestId: string, sourceId: string) => Promise<{ ok: boolean; source?: { id: string; name: string; type: "screen" | "window" }; error?: string }>;
    cancelSelection: (requestId: string) => Promise<{ ok: boolean; canceled?: boolean; error?: string }>;
  }>;
  onCommand: (callback: (command: HarnessCommand) => void) => () => void;
  report: (result: { commandId: string; ok: boolean; data?: unknown; error?: string }) => void;
}>;

declare global {
  interface Window { picomHostedMediaE2E: HarnessBridge }
}

const bridge = window.picomHostedMediaE2E;
const config = await bridge.getConfig();
const root = document.getElementById("evidence-root");
let room: Room | null = null;
let localAudio: LocalAudioTrack | null = null;
let localScreen: LocalVideoTrack | null = null;
let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let animationTimer: number | null = null;
let reconnectingEvents = 0;
let reconnectedEvents = 0;
let remoteMuteEvents = 0;
let remoteUnmuteEvents = 0;
let speakingObserved = false;
let currentScreenEvidence: Record<string, unknown> = {};
const attachedElements: HTMLMediaElement[] = [];

const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const safeError = (error: unknown) => String(error instanceof Error ? error.message : error).replace(/eyJ[A-Za-z0-9._-]+/g, "[redacted-token]").replace(/(?:https?|wss):\/\/\S+/g, "[redacted-url]").slice(0, 280);

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs: number, label: string) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

function remoteTracks(source: Track.Source): RemoteTrack[] {
  if (!room) return [];
  const tracks: RemoteTrack[] = [];
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.source === source && publication.track) tracks.push(publication.track);
    }
  }
  return tracks;
}

async function receivedBytes(track: RemoteTrack): Promise<number> {
  const stats = await track.getRTCStatsReport();
  let bytes = 0;
  stats?.forEach((report) => {
    if (report.type === "inbound-rtp" && !report.isRemote) bytes += Number(report.bytesReceived ?? 0);
  });
  return bytes;
}

async function connect() {
  room = new Room({ adaptiveStream: false, dynacast: false, disconnectOnPageLeave: false });
  room.on(RoomEvent.Reconnecting, () => { reconnectingEvents += 1; });
  room.on(RoomEvent.SignalReconnecting, () => { reconnectingEvents += 1; });
  room.on(RoomEvent.Reconnected, () => { reconnectedEvents += 1; });
  room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => { if (speakers.length > 0) speakingObserved = true; });
  room.on(RoomEvent.TrackMuted, (_publication, participant) => { if (!participant.isLocal) remoteMuteEvents += 1; });
  room.on(RoomEvent.TrackUnmuted, (_publication, participant) => { if (!participant.isLocal) remoteUnmuteEvents += 1; });
  await room.connect(config.url, config.token, { autoSubscribe: true });
  await room.startAudio().catch(() => undefined);
  return { connected: room.state === ConnectionState.Connected };
}

async function publish() {
  if (!room || room.state !== ConnectionState.Connected) throw new Error("Room is not connected.");
  let microphoneTrack: MediaStreamTrack | undefined;
  if (config.nativeCapture) {
    const microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    microphoneTrack = microphoneStream.getAudioTracks()[0];
  } else {
    audioContext = new AudioContext();
    await audioContext.resume();
    oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();
    oscillator.frequency.value = 420 + config.label.length * 17;
    gain.gain.value = 0.3;
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    microphoneTrack = destination.stream.getAudioTracks()[0];
  }
  if (!microphoneTrack) throw new Error("Microphone track is unavailable.");
  localAudio = new LocalAudioTrack(microphoneTrack, undefined, true, audioContext ?? undefined);
  await room.localParticipant.publishTrack(localAudio, { name: `picom-e2e-microphone-${config.label}`, source: Track.Source.Microphone });

  currentScreenEvidence = await publishScreen();
  return { microphonePublished: true, screenPublished: true, nativeMicrophonePermission: Boolean(config.nativeCapture), ...currentScreenEvidence };
}

async function publishScreen() {
  if (!room) throw new Error("Room is unavailable.");
  if (config.nativeCapture) {
    const cancelInventory = await bridge.screenCapture.getSources();
    if (!cancelInventory.ok || !cancelInventory.requestId || !cancelInventory.sources?.length) throw new Error("Native screen picker inventory is unavailable.");
    const canceled = await bridge.screenCapture.cancelSelection(cancelInventory.requestId);
    const canceledSelection = await bridge.screenCapture.selectSource(cancelInventory.requestId, cancelInventory.sources[0].id);
    if (!canceled.ok || !canceled.canceled || canceledSelection.ok) throw new Error("Native screen picker cancel flow did not fail closed.");

    const inventory = await bridge.screenCapture.getSources();
    const sources = inventory.sources ?? [];
    const screenCount = sources.filter((source) => source.type === "screen").length;
    const windowCount = sources.filter((source) => source.type === "window").length;
    const target = sources.find((source) => source.type === "window" && source.name.includes("Picom Certification Share Target"));
    if (!inventory.ok || !inventory.requestId || screenCount < 1 || windowCount < 1 || !target) throw new Error("Native screen/window picker inventory is incomplete.");
    const selected = await bridge.screenCapture.selectSource(inventory.requestId, target.id);
    if (!selected.ok || !selected.source) throw new Error("Native window source selection failed.");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: selected.source.id, maxFrameRate: 15 } },
    } as unknown as MediaStreamConstraints);
    const screenTrack = stream.getVideoTracks()[0];
    if (!screenTrack) throw new Error("Native desktop capture track is unavailable.");
    localScreen = new LocalVideoTrack(screenTrack, undefined, true);
    await room.localParticipant.publishTrack(localScreen, { name: `picom-e2e-screen-${config.label}`, source: Track.Source.ScreenShare, simulcast: false });
    return { nativeScreenCapture: true, pickerCancelPassed: true, screenSourceCount: screenCount, windowSourceCount: windowCount, selectedSourceType: selected.source.type };
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas screen source is unavailable.");
  let frame = 0;
  const draw = () => {
    frame += 1;
    context.fillStyle = frame % 2 ? "#173a3d" : "#254b50";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.font = "32px sans-serif";
    context.fillText(`Picom hosted share ${config.label}`, 42, 175);
    context.fillText(String(frame), 42, 225);
  };
  draw();
  animationTimer = window.setInterval(draw, 100);
  const screenTrack = canvas.captureStream(10).getVideoTracks()[0];
  if (!screenTrack) throw new Error("Synthetic screen track is unavailable.");
  localScreen = new LocalVideoTrack(screenTrack, undefined, true);
  await room.localParticipant.publishTrack(localScreen, { name: `picom-e2e-screen-${config.label}`, source: Track.Source.ScreenShare, simulcast: false });
  return { nativeScreenCapture: false };
}

async function restartScreen() {
  if (!room || !localScreen || !config.nativeCapture) throw new Error("Native screen track is unavailable for restart.");
  const previousTrack = localScreen.mediaStreamTrack;
  await room.localParticipant.unpublishTrack(localScreen, true);
  localScreen.stop();
  await waitFor(() => previousTrack.readyState === "ended", 5000, "native source-ended cleanup");
  localScreen = null;
  currentScreenEvidence = await publishScreen();
  return { sourceEnded: true, restarted: true, ...currentScreenEvidence };
}

async function verifyMedia() {
  if (!room) throw new Error("Room is unavailable.");
  await waitFor(() => room?.remoteParticipants.size === config.expectedRemoteCount, 30000, "remote participant list");
  await waitFor(() => remoteTracks(Track.Source.Microphone).length === config.expectedRemoteCount, 30000, "remote microphone subscriptions");
  await waitFor(() => remoteTracks(Track.Source.ScreenShare).length === config.expectedRemoteCount, 30000, "remote screen subscriptions");

  const audioTracks = remoteTracks(Track.Source.Microphone);
  const screenTracks = remoteTracks(Track.Source.ScreenShare);
  for (const track of screenTracks) {
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    track.attach(video);
    root?.append(video);
    attachedElements.push(video);
    await video.play().catch(() => undefined);
  }
  await waitFor(() => attachedElements.filter((element) => element instanceof HTMLVideoElement && element.videoWidth > 0 && element.videoHeight > 0).length >= config.expectedRemoteCount, 30000, "remote screen rendering");
  await waitFor(async () => (await Promise.all(audioTracks.map(receivedBytes))).every((bytes) => bytes > 0), 30000, "remote audio RTP bytes");
  await waitFor(async () => (await Promise.all(screenTracks.map(receivedBytes))).every((bytes) => bytes > 0), 30000, "remote screen RTP bytes");
  await waitFor(() => speakingObserved, 20000, "speaking indicator event");
  return {
    remoteParticipants: room.remoteParticipants.size,
    remoteAudioTracks: audioTracks.length,
    remoteScreenTracks: screenTracks.length,
    renderedScreens: attachedElements.filter((element) => element instanceof HTMLVideoElement && element.videoWidth > 0).length,
    speakingObserved,
  };
}

async function muteCycle() {
  if (!localAudio) throw new Error("Local microphone track is unavailable.");
  await localAudio.mute();
  const muted = localAudio.isMuted;
  await delay(500);
  await localAudio.unmute();
  const unmuted = !localAudio.isMuted;
  await delay(500);
  return { muted, unmuted };
}

async function verifyControls() {
  await waitFor(() => remoteMuteEvents >= config.expectedRemoteCount, 15000, "remote mute events");
  await waitFor(() => remoteUnmuteEvents >= config.expectedRemoteCount, 15000, "remote unmute events");
  return { remoteMuteEvents, remoteUnmuteEvents };
}

async function simulateReconnect() {
  if (!room) throw new Error("Room is unavailable.");
  const reconnectingBefore = reconnectingEvents;
  const reconnectedBefore = reconnectedEvents;
  await room.simulateScenario("signal-reconnect");
  await waitFor(() => reconnectingEvents > reconnectingBefore, 15000, "reconnecting event");
  await waitFor(() => reconnectedEvents > reconnectedBefore && room?.state === ConnectionState.Connected, 30000, "reconnected event");
  return { reconnecting: true, reconnected: true, mode: "provider-signal-simulation" };
}

async function waitReconnected() {
  if (!room) throw new Error("Room is unavailable.");
  await waitFor(() => reconnectingEvents > 0, 20000, "network reconnecting event");
  await waitFor(() => reconnectedEvents > 0 && room?.state === ConnectionState.Connected, 40000, "network reconnected event");
  return { reconnecting: true, reconnected: true, mode: "electron-network-emulation" };
}

async function cleanup() {
  const audioTrack = localAudio?.mediaStreamTrack ?? null;
  const screenTrack = localScreen?.mediaStreamTrack ?? null;
  if (room && localScreen) await room.localParticipant.unpublishTrack(localScreen, true).catch(() => undefined);
  if (room && localAudio) await room.localParticipant.unpublishTrack(localAudio, true).catch(() => undefined);
  localScreen?.stop();
  localAudio?.stop();
  oscillator?.stop();
  oscillator?.disconnect();
  if (animationTimer !== null) window.clearInterval(animationTimer);
  for (const element of attachedElements.splice(0)) element.remove();
  await audioContext?.close().catch(() => undefined);
  await room?.disconnect(true);
  const result = {
    disconnected: !room || room.state === ConnectionState.Disconnected,
    microphoneEnded: !audioTrack || audioTrack.readyState === "ended",
    screenEnded: !screenTrack || screenTrack.readyState === "ended",
    attachedElements: attachedElements.length,
  };
  room = null;
  localAudio = null;
  localScreen = null;
  return result;
}

const handlers = { connect, publish, "verify-media": verifyMedia, "mute-cycle": muteCycle, "verify-controls": verifyControls, "screen-restart": restartScreen, "simulate-reconnect": simulateReconnect, "wait-reconnected": waitReconnected, cleanup } as const;
bridge.onCommand((command) => {
  void Promise.resolve(handlers[command.type]()).then(
    (data) => bridge.report({ commandId: command.id, ok: true, data }),
    (error) => bridge.report({ commandId: command.id, ok: false, error: safeError(error) }),
  );
});
bridge.report({ commandId: "ready", ok: true, data: { label: config.label } });
