const { contextBridge, ipcRenderer } = require("electron");

const allowedCommands = new Set(["connect", "publish", "verify-media", "mute-cycle", "verify-controls", "screen-restart", "simulate-reconnect", "wait-reconnected", "cleanup"]);

contextBridge.exposeInMainWorld("picomHostedMediaE2E", Object.freeze({
  getConfig: () => ipcRenderer.invoke("picom-hosted-media:get-config"),
  screenCapture: Object.freeze({
    getSources: () => ipcRenderer.invoke("picom-hosted-media:get-screen-sources"),
    selectSource: (requestId, sourceId) => ipcRenderer.invoke("picom-hosted-media:select-screen-source", { requestId, sourceId }),
    cancelSelection: (requestId) => ipcRenderer.invoke("picom-hosted-media:cancel-screen-selection", { requestId }),
  }),
  onCommand: (callback) => {
    if (typeof callback !== "function") return () => undefined;
    const listener = (_event, command) => {
      if (!command || typeof command.id !== "string" || !allowedCommands.has(command.type)) return;
      callback(Object.freeze({ id: command.id, type: command.type, payload: command.payload ?? null }));
    };
    ipcRenderer.on("picom-hosted-media:command", listener);
    return () => ipcRenderer.removeListener("picom-hosted-media:command", listener);
  },
  report: (result) => {
    if (!result || typeof result.commandId !== "string" || typeof result.ok !== "boolean") return;
    ipcRenderer.send("picom-hosted-media:result", {
      commandId: result.commandId,
      ok: result.ok,
      data: result.data ?? null,
      error: typeof result.error === "string" ? result.error.slice(0, 300) : null,
    });
  },
}));
