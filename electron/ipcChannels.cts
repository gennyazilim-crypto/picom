export const IPC_CHANNELS = Object.freeze({
  windowControl: "picom:window-control",
  windowIsMaximized: "picom:window-is-maximized",
  windowMaximizeStateChanged: "picom:window-maximize-state-changed",
  screenCaptureGetSources: "picom:screen-capture-get-sources",
  screenCaptureSelectSource: "picom:screen-capture-select-source",
  screenCaptureCancelSelection: "picom:screen-capture-cancel-selection",
  notificationShow: "picom:notification-show",
  incomingCallShow: "picom:incoming-call-show",
  incomingCallDismiss: "picom:incoming-call-dismiss",
  incomingCallRespond: "picom:incoming-call-respond",
  incomingCallAction: "picom:incoming-call-action",
  traySetStatus: "picom:tray-set-status",
  traySetMuted: "picom:tray-set-muted",
  traySetCloseToTray: "picom:tray-set-close-to-tray",
  trayShowWindow: "picom:tray-show-window",
  trayQuit: "picom:tray-quit",
  trayAction: "picom:tray-action",
  startupGetState: "picom:startup-get-state",
  startupSetEnabled: "picom:startup-set-enabled",
  filePickImages: "picom:file-pick-images",
  fileSaveText: "picom:file-save-text",
  clipboardReadText: "picom:clipboard-read-text",
  clipboardWriteText: "picom:clipboard-write-text",
  externalOpenUrl: "picom:external-open-url",
  deepLinkOpen: "picom:deep-link-open",
  powerResume: "picom:power-resume",
  updateGetState: "picom:update-get-state",
  updateCheck: "picom:update-check",
  updateDownload: "picom:update-download",
  updateInstall: "picom:update-install",
  updateStateChanged: "picom:update-state-changed",
  activityGetSnapshot: "picom:activity-get-snapshot",
});

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export function isIpcChannel(channel: unknown): channel is IpcChannel {
  return typeof channel === "string" && Object.values(IPC_CHANNELS).includes(channel as IpcChannel);
}
