export type MessageHistoryExportFormat = "json" | "csv" | "html_placeholder";

export type MessageHistoryExportStatus = "queued_placeholder" | "permission_required" | "invalid_request";

export type MessageHistoryExportRequest = Readonly<{
  communityId: string;
  channelId: string;
  requestedById: string;
  format: MessageHistoryExportFormat;
  canExport: boolean;
}>;

export type MessageHistoryExportRecord = Readonly<{
  exportId: string;
  communityId: string;
  channelId: string;
  requestedById: string;
  format: MessageHistoryExportFormat;
  status: MessageHistoryExportStatus;
  createdAt: string;
  routePlaceholder: {
    create: "POST /channels/:channelId/export";
    status: "GET /exports/:exportId/status";
  };
}>;

export type MessageHistoryExportResult =
  | Readonly<{ ok: true; data: MessageHistoryExportRecord }>
  | Readonly<{ ok: false; error: { code: MessageHistoryExportStatus; message: string } }>;

const exportRecords: MessageHistoryExportRecord[] = [];

function createExportId(channelId: string): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `export-${channelId}-${suffix}`;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export const messageHistoryExportService = {
  requestChannelExportPlaceholder(input: MessageHistoryExportRequest): MessageHistoryExportResult {
    if (isBlank(input.communityId) || isBlank(input.channelId) || isBlank(input.requestedById)) {
      return {
        ok: false,
        error: {
          code: "invalid_request",
          message: "Message history export placeholder requires community, channel, and user context.",
        },
      };
    }

    if (!input.canExport) {
      return {
        ok: false,
        error: {
          code: "permission_required",
          message: "Message history export requires community management permission placeholder.",
        },
      };
    }

    const record: MessageHistoryExportRecord = {
      exportId: createExportId(input.channelId),
      communityId: input.communityId,
      channelId: input.channelId,
      requestedById: input.requestedById,
      format: input.format,
      status: "queued_placeholder",
      createdAt: new Date().toISOString(),
      routePlaceholder: {
        create: "POST /channels/:channelId/export",
        status: "GET /exports/:exportId/status",
      },
    };

    exportRecords.unshift(record);
    exportRecords.splice(20);

    return { ok: true, data: record };
  },

  getRecentExportPlaceholders(): MessageHistoryExportRecord[] {
    return exportRecords.map((record) => ({ ...record, routePlaceholder: { ...record.routePlaceholder } }));
  },
};

