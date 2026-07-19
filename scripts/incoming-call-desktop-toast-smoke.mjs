import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [toast, channels, preload, hook, service, validation] = await Promise.all([
  read("electron/incomingCallToast.cts"),
  read("electron/ipcChannels.cts"),
  read("electron/preload.cts"),
  read("src/hooks/useVoiceCallInvites.ts"),
  read("src/services/voice/incomingCallDesktopToastService.ts"),
  read("electron/ipcPayloadValidation.cts"),
]);

const checks = [
  [toast.includes("showIncomingCallToast"), "desktop incoming-call toast window helper exists"],
  [toast.includes("alwaysOnTop: true"), "toast stays above other windows"],
  [toast.includes("skipTaskbar: true"), "toast does not clutter the taskbar"],
  [channels.includes("incomingCallShow"), "incoming call show IPC channel exists"],
  [channels.includes("incomingCallAction"), "incoming call action IPC channel exists"],
  [preload.includes("incomingCall:"), "preload exposes incomingCall bridge"],
  [preload.includes("IPC_CHANNELS.incomingCallShow"), "preload whitelists show channel"],
  [validation.includes("parseIncomingCallToastPayload"), "incoming call payload is validated"],
  [validation.includes('route === "dm"'), "dm deep links are allowed for notifications"],
  [service.includes("shouldSurfaceDesktopIncomingCall"), "desktop surface gate exists"],
  [hook.includes("incomingCallDesktopToastService.show"), "unfocused calls open the desktop toast"],
  [hook.includes("shouldSurfaceDesktopIncomingCall"), "hook gates toast on focus/visibility"],
  [hook.includes('silent: true'), "OS notification stays silent while toast rings"],
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error(`Incoming call desktop toast smoke failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Incoming call desktop toast smoke passed (${checks.length} checks).`);
