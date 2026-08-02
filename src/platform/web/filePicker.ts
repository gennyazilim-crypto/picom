import type { FilePickerAdapter } from "../types";
import { unavailable } from "./unsupported";

export const webFilePicker: FilePickerAdapter = {
  async pickFiles(options) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      if (options?.accept) input.accept = options.accept;
      input.multiple = Boolean(options?.multiple);
      input.onchange = () => {
        const files = [...(input.files ?? [])];
        resolve(
          files.length
            ? { ok: true, data: files }
            : unavailable("CANCELLED", "No file selected."),
        );
      };
      input.oncancel = () => resolve(unavailable("CANCELLED", "File picker was cancelled."));
      input.click();
    });
  },
};
