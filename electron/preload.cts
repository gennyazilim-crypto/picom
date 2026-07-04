import { contextBridge } from "electron";

type PicomRuntimeInfo = Readonly<{
  runtime: "electron";
  platform: string;
  versions: Readonly<{
    electron?: string;
    chrome?: string;
    node?: string;
  }>;
}>;

const runtimeInfo: PicomRuntimeInfo = Object.freeze({
  runtime: "electron",
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  })
});

const bridge = Object.freeze({
  getRuntimeInfo: (): PicomRuntimeInfo => runtimeInfo
});

contextBridge.exposeInMainWorld("picomDesktop", bridge);