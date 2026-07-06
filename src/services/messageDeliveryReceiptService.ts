import type { MessageDeliveryStatus } from "../types/community";

export type DeliveryReceiptTone = "neutral" | "success" | "warning" | "danger";

const labels: Record<MessageDeliveryStatus, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
  queued_offline: "Queued offline",
};

const descriptions: Record<MessageDeliveryStatus, string> = {
  sending: "Picom is sending this message.",
  sent: "The server accepted this message.",
  delivered: "Delivery receipt placeholder for future recipient confirmation.",
  failed: "This message failed to send. Copy the text or retry when available.",
  queued_offline: "This message is queued locally until the connection returns.",
};

const tones: Record<MessageDeliveryStatus, DeliveryReceiptTone> = {
  sending: "neutral",
  sent: "success",
  delivered: "success",
  failed: "danger",
  queued_offline: "warning",
};

export const messageDeliveryReceiptService = {
  normalize(status?: MessageDeliveryStatus | null): MessageDeliveryStatus {
    return status ?? "sent";
  },

  getLabel(status?: MessageDeliveryStatus | null): string {
    return labels[this.normalize(status)];
  },

  getDescription(status?: MessageDeliveryStatus | null): string {
    return descriptions[this.normalize(status)];
  },

  getTone(status?: MessageDeliveryStatus | null): DeliveryReceiptTone {
    return tones[this.normalize(status)];
  },

  isRecoverable(status?: MessageDeliveryStatus | null): boolean {
    const normalized = this.normalize(status);
    return normalized === "failed" || normalized === "queued_offline";
  },
};

