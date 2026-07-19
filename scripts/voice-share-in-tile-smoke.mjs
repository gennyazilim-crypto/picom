import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [view, css, picker] = await Promise.all([
  read("src/components/VoiceRoomView.tsx"),
  read("src/components/VoiceRoomView.css"),
  read("src/components/voice/ScreenSharePickerModal.tsx"),
]);

const checks = [
  [view.includes("VoiceParticipantScreenShare"), "screen share video mounts inside participant tiles"],
  [view.includes("has-screen-share"), "sharing tiles get a dedicated class"],
  [view.includes("voice-room-tile__share-controls"), "wide/full controls render on sharing tiles"],
  [view.includes('shareLayout === "wide"'), "wide screen mode is toggleable"],
  [view.includes('shareLayout === "fullscreen"'), "full screen mode is toggleable"],
  [view.includes("requestFullscreen"), "native fullscreen is available from the tile"],
  [!view.includes("ScreenSharePreview"), "legacy top-stage ScreenSharePreview is removed"],
  [view.includes("screenShares={connected ? snapshot.screenShares : []}"), "live shares pass into the stage grid"],
  [view.includes("ScreenSharePickerModal"), "share dock opens a dedicated picker modal"],
  [view.includes("onOpenSharePicker"), "control dock Share uses picker callback"],
  [!view.includes("onClick={screenSharing ? onStopScreenShare : onOpenSettings}"), "Share no longer opens settings"],
  [picker.includes("Choose what to share"), "picker modal asks the user to choose a source"],
  [picker.includes("screenCaptureService.listSources"), "picker loads capture sources on open"],
  [css.includes(".voice-room-tile__screen"), "in-tile screen video styles exist"],
  [css.includes(".voice-room-stage-grid.is-share-wide"), "wide layout styles exist"],
  [css.includes(".voice-room-stage-grid.is-share-fullscreen"), "fullscreen layout styles exist"],
  [css.includes(".voice-room-tile__share-controls"), "share control chip styles exist"],
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error(`Voice share-in-tile smoke failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Voice share-in-tile smoke passed (${checks.length} checks).`);
