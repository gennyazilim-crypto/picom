import { contextBridge } from "electron";

const picomDesktop = Object.freeze({
  runtime: "electron" as const,
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  })
});

contextBridge.exposeInMainWorld("picomDesktop", picomDesktop);