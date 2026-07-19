import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [main, preload, channels, validation, service, picker, types] = await Promise.all([
  read("electron/main.cts"), read("electron/preload.cts"), read("electron/ipcChannels.cts"),
  read("electron/ipcPayloadValidation.cts"), read("src/services/screenCaptureService.ts"),
  read("src/components/voice/ScreenSharePicker.tsx"), read("src/types/picomDesktop.d.ts"),
]);

const checks = [
  [main.includes("isTrustedIpcEvent(event)"), "all capture handlers validate sender"],
  [main.includes("sourceWindow.isFocused()"), "source listing requires focused explicit action"],
  [main.includes("SCREEN_CAPTURE_SESSION_TTL_MS"), "source sessions expire"],
  [main.includes("MAX_SCREEN_CAPTURE_SOURCES") && main.includes("MAX_SCREEN_CAPTURE_DATA_URL_LENGTH"), "source output is bounded"],
  [main.includes("screenCaptureSessions.delete(event.sender)"), "selection and cancel invalidate sessions"],
  [validation.includes("parseScreenCaptureListPayload") && validation.includes("parseScreenCaptureSelectionPayload") && validation.includes("parseScreenCaptureCancelPayload"), "capture payload validators exist"],
  [preload.includes("selectSource:") && preload.includes("cancelSelection:"), "preload exposes only narrow capture methods"],
  [!preload.includes("desktopCapturer:"), "preload does not expose desktopCapturer"],
  [channels.includes("picom:screen-capture-select-source") && channels.includes("picom:screen-capture-cancel-selection"), "capture channels are whitelisted"],
  [service.includes("crypto.randomUUID") && service.includes("selectSource({ requestId, sourceId })"), "renderer uses unpredictable session id and validated selection"],
  [picker.includes('sources.length ? "Cancel"') && picker.includes("cancelSourceSelection"), "picker cancel is safe"],
  [picker.includes("startSelectedSource") && picker.includes("screenCaptureService.selectSource"), "start requires main-process selection approval"],
  [types.includes("selectSource:") && types.includes("cancelSelection:"), "renderer types match the bridge"],
];
const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) { console.error(`Secure screen picker smoke failed:\n- ${failures.join("\n- ")}`); process.exit(1); }
console.log(`Secure Electron screen share picker bridge smoke passed (${checks.length} checks).`);
