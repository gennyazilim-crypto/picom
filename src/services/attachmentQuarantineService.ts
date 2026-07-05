import type { Attachment, AttachmentScanStatus } from "../types/community";
import { attachmentScanService } from "./attachmentScanService";

export type AttachmentQuarantineReviewStatus = "needs_review" | "released_placeholder" | "blocked_placeholder";

export type AttachmentAccessDecision = Readonly<{
  canRender: boolean;
  quarantined: boolean;
  status: AttachmentScanStatus;
  title: string;
  message: string;
}>;

export type AttachmentQuarantineSummary = Readonly<{
  quarantinedCount: number;
  needsReviewCount: number;
  placeholder: true;
}>;

const quarantinedStatuses = new Set<AttachmentScanStatus>(["suspicious", "failed"]);

export const attachmentQuarantineService = {
  isQuarantined(status: AttachmentScanStatus | null | undefined): boolean {
    return quarantinedStatuses.has(status ?? "skipped_development");
  },

  getAccessDecision(attachment: Pick<Attachment, "scanStatus">): AttachmentAccessDecision {
    const scan = attachmentScanService.getScanStatus(attachment.scanStatus);
    const quarantined = this.isQuarantined(scan.status);

    if (quarantined) {
      return {
        canRender: false,
        quarantined: true,
        status: scan.status,
        title: "Attachment blocked for safety",
        message: "This attachment is quarantined and cannot be previewed.",
      };
    }

    if (!scan.safeToRender) {
      return {
        canRender: false,
        quarantined: false,
        status: scan.status,
        title: "Attachment unavailable",
        message: scan.reason,
      };
    }

    return {
      canRender: true,
      quarantined: false,
      status: scan.status,
      title: "Attachment available",
      message: scan.reason,
    };
  },

  getAdminSummaryPlaceholder(): AttachmentQuarantineSummary {
    return {
      quarantinedCount: 0,
      needsReviewCount: 0,
      placeholder: true,
    };
  },

  getReviewRoutePlaceholders() {
    return {
      list: "GET /admin/attachments/quarantine",
      review: "PATCH /admin/attachments/:attachmentId/review",
    } as const;
  },
};
