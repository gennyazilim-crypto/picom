const STORAGE_KEY = "picom.dataExportPlaceholder.v1";
const SCHEMA_VERSION = 1;
const maxExportTextLength = 500;

const includedPlaceholderScopes = [
  "profile placeholder",
  "community membership placeholder",
  "settings summary placeholder",
  "own messages placeholder",
  "attachments metadata placeholder",
];

const excludedSensitiveFields = [
  "passwords",
  "password hashes",
  "session tokens",
  "auth tokens",
  "refresh tokens",
  "cookies",
  "Supabase privileged keys",
  "LiveKit credentials",
  "signing keys",
  "private server fields",
  "raw IP addresses",
  "private channel data the user cannot access",
];

const complianceSafetyNotes =
  "This renderer-generated placeholder export intentionally excludes credentials, server secrets, and inaccessible private data. A production export must be generated and authorized by the backend.";

type StoredDataExportState = Readonly<{
  schemaVersion: typeof SCHEMA_VERSION;
  exportId: string | null;
  requestedAt: string | null;
  status: "not_requested" | "ready_placeholder";
}>;

export type DataExportStatus = Readonly<{
  exportId: string | null;
  requestedAt: string | null;
  status: StoredDataExportState["status"];
  message: string;
}>;

export type DataExportPayload = Readonly<{
  exportId: string;
  generatedAt: string;
  format: "json_placeholder";
  profile: {
    displayName: string | null;
    statusText: string | null;
    bio: string | null;
  };
  included: string[];
  excluded: string[];
  safety: {
    rendererGenerated: true;
    containsCredentials: false;
    containsServerSecrets: false;
    requiresBackendVerification: true;
  };
  notes: string;
}>;

export type DataExportResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; message: string }>;

export type DataExportProfileInput = Readonly<{
  displayName?: string;
  statusText?: string;
  bio?: string;
}>;

function getDefaultState(): StoredDataExportState {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportId: null,
    requestedAt: null,
    status: "not_requested",
  };
}

function readState(): StoredDataExportState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();

    const parsed = JSON.parse(raw) as Partial<StoredDataExportState>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return getDefaultState();

    return {
      schemaVersion: SCHEMA_VERSION,
      exportId: typeof parsed.exportId === "string" ? parsed.exportId : null,
      requestedAt: typeof parsed.requestedAt === "string" ? parsed.requestedAt : null,
      status: parsed.status === "ready_placeholder" ? "ready_placeholder" : "not_requested",
    };
  } catch {
    return getDefaultState();
  }
}

function writeState(next: StoredDataExportState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }
}

function toStatus(state: StoredDataExportState): DataExportStatus {
  return {
    exportId: state.exportId,
    requestedAt: state.requestedAt,
    status: state.status,
    message: state.status === "ready_placeholder"
      ? "Data export placeholder is ready. It excludes passwords, tokens, internal identifiers, and private server fields."
      : "No data export placeholder has been requested yet.",
  };
}

function sanitizeExportText(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxExportTextLength);
}

function sanitizeProfile(profile: DataExportProfileInput) {
  return {
    displayName: sanitizeExportText(profile.displayName),
    statusText: sanitizeExportText(profile.statusText),
    bio: sanitizeExportText(profile.bio),
  };
}

export const dataExportService = {
  getStatus(): DataExportStatus {
    return toStatus(readState());
  },

  requestExportPlaceholder(): DataExportResult<DataExportStatus> {
    const requestedAt = new Date().toISOString();
    const next: StoredDataExportState = {
      schemaVersion: SCHEMA_VERSION,
      exportId: `export_${Date.now()}`,
      requestedAt,
      status: "ready_placeholder",
    };
    writeState(next);

    return {
      ok: true,
      data: toStatus(next),
    };
  },

  buildPlaceholderPayload(profile: DataExportProfileInput): DataExportResult<DataExportPayload> {
    const state = readState();
    if (!state.exportId) {
      return {
        ok: false,
        message: "Request a data export placeholder before downloading it.",
      };
    }

    return {
      ok: true,
      data: {
        exportId: state.exportId,
        generatedAt: new Date().toISOString(),
        format: "json_placeholder",
        profile: sanitizeProfile(profile),
        included: includedPlaceholderScopes,
        excluded: excludedSensitiveFields,
        safety: {
          rendererGenerated: true,
          containsCredentials: false,
          containsServerSecrets: false,
          requiresBackendVerification: true,
        },
        notes: complianceSafetyNotes,
      },
    };
  },

  downloadPlaceholderJson(payload: DataExportPayload): DataExportResult<{ fileName: string }> {
    const fileName = `picom-data-export-${payload.exportId}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.click();
    URL.revokeObjectURL(url);

    return {
      ok: true,
      data: { fileName },
    };
  },
};
