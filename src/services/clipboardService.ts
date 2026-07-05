type ClipboardResult = { ok: true; native?: boolean } | { ok: false; native?: boolean; reason: string };
type ClipboardReadResult =
  | { ok: true; text: string; native?: boolean }
  | { ok: false; native?: boolean; reason: string };

async function writeViaBrowserClipboard(text: string): Promise<ClipboardResult> {
  try {
    await navigator.clipboard?.writeText(text);
    return { ok: true };
  } catch {
    return { ok: false, reason: "Clipboard is unavailable in this runtime." };
  }
}

async function readViaBrowserClipboard(): Promise<ClipboardReadResult> {
  try {
    const text = await navigator.clipboard?.readText();
    return { ok: true, text: text ?? "" };
  } catch {
    return { ok: false, reason: "Clipboard is unavailable in this runtime." };
  }
}

export const clipboardService = {
  async copyText(text: string): Promise<ClipboardResult> {
    const nativeClipboard = window.picomDesktop?.clipboard;
    if (nativeClipboard?.writeText) {
      const result = await nativeClipboard.writeText(text);
      if (result.ok) {
        return { ok: true, native: true };
      }

      return { ok: false, native: true, reason: result.error };
    }

    return writeViaBrowserClipboard(text);
  },

  async readText(): Promise<ClipboardReadResult> {
    const nativeClipboard = window.picomDesktop?.clipboard;
    if (nativeClipboard?.readText) {
      const result = await nativeClipboard.readText();
      if (result.ok) {
        return { ok: true, native: true, text: result.text };
      }

      return { ok: false, native: true, reason: result.error };
    }

    return readViaBrowserClipboard();
  }
};
