import type { FilePickerAdapter } from "../types";
import { unavailable } from "./unavailable";

export const desktopFilePicker: FilePickerAdapter = {
  async pickFiles(options) {
    const input = document.createElement("input");
    input.type = "file";
    if (options?.accept) input.accept = options.accept;
    input.multiple = Boolean(options?.multiple);
    return new Promise((resolve) => {
      input.onchange = () => {
        const files = [...(input.files ?? [])];
        resolve(files.length ? { ok: true, data: files } : unavailable("No file selected."));
      };
      input.click();
    });
  },
};
