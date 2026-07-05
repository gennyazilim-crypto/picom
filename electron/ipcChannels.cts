export const IPC_CHANNELS = Object.freeze({
  windowControl: "picom:window-control",
  windowIsMaximized: "picom:window-is-maximized",
  windowMaximizeStateChanged: "picom:window-maximize-state-changed",
  screenCaptureGetSources: "picom:screen-capture-get-sources",
  notificationShow: "picom:notification-show"
});

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export function isIpcChannel(channel: unknown): channel is IpcChannel {
  return typeof channel === "string" && Object.values(IPC_CHANNELS).includes(channel as IpcChannel);
}
