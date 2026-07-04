export const clipboardService = {
  async copyText(text: string) {
    try { await navigator.clipboard?.writeText(text); return { ok: true }; }
    catch { return { ok: false, reason: "Clipboard is unavailable in this runtime." }; }
  }
};