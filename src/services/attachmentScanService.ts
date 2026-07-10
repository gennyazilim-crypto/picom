export type AttachmentScanStatus = "pending" | "clean" | "suspicious" | "failed" | "skipped_development";

export type AttachmentScanInput = Readonly<{
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}>;

export type AttachmentScanResult = Readonly<{
  status: AttachmentScanStatus;
  safeToRender: boolean;
  reason: string;
}>;

const renderableStatuses = new Set<AttachmentScanStatus>(["clean", "skipped_development"]);

export const attachmentScanService = {
  scanFilePlaceholder(input: AttachmentScanInput): AttachmentScanResult {
    if (!input.fileName.trim() || !input.mimeType.trim() || input.sizeBytes <= 0) {
      return {
        status: "failed",
        safeToRender: false,
        reason: "Attachment scan placeholder could not verify required metadata.",
      };
    }

    return {
      status: "skipped_development",
      safeToRender: true,
      reason: "Development placeholder: no malware scanner is configured yet.",
    };
  },

  getScanStatus(status: AttachmentScanStatus | null | undefined): AttachmentScanResult {
    const normalized = status ?? "pending";

    if (renderableStatuses.has(normalized)) {
      return {
        status: normalized,
        safeToRender: true,
        reason: normalized === "clean" ? "Attachment scan passed." : "Attachment scan skipped in development mode.",
      };
    }

    return {
      status: normalized,
      safeToRender: false,
      reason: normalized === "pending"
        ? "Attachment scan is still pending."
        : normalized === "suspicious"
          ? "Attachment blocked for safety."
          : "Attachment scan failed; rendering is blocked.",
    };
  },

  canRenderAttachment(status: AttachmentScanStatus | null | undefined): boolean {
    return this.getScanStatus(status).safeToRender;
  },
};
