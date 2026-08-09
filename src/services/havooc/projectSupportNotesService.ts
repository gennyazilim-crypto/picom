import { getSupabaseClient } from "../supabase/supabaseClient";
import { featureFlagService } from "../featureFlagService";
import { analyticsQueue } from "../analytics/analyticsQueue";
import {
  HAVOOC_PROJECT_ID,
  SUPPORT_NOTE_PAGE_SIZE,
} from "../../config/havoocLinks";
import { validateSupportNoteBody, type SupportNoteValidationCode } from "./supportNoteText";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

function rpc(client: NonNullable<ReturnType<typeof getSupabaseClient>>, fn: string, args: Record<string, unknown> = {}) {
  return (client as unknown as RpcClient).rpc(fn, args);
}

export type SupportNoteSort = "newest" | "oldest";

export type ProjectSupportNote = Readonly<{
  id: string;
  projectId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}>;

export type SupportNotesPage = Readonly<{
  notes: ProjectSupportNote[];
  hasMore: boolean;
  nextCursorCreatedAt: string | null;
  nextCursorId: string | null;
}>;

export type SupportProject = Readonly<{
  id: string;
  displayName: string;
  ownerUserId: string | null;
  isPublic: boolean;
}>;

export type SupportNoteErrorCode =
  | "FEATURE_DISABLED"
  | "AUTH_REQUIRED"
  | "NOTE_EMPTY"
  | "NOTE_WORD_LIMIT"
  | "NOTE_TOO_LONG"
  | "NOTE_LINKS_DENIED"
  | "NOTE_NOT_FOUND"
  | "NOTE_REMOVED"
  | "RATE_LIMITED"
  | "PERMISSION_DENIED"
  | "ACCOUNT_RESTRICTED"
  | "CANNOT_REPORT_OWN"
  | "RPC_FAILED";

type Result<T> = { ok: true; data: T } | { ok: false; code: SupportNoteErrorCode; message: string };

function mapRpcError(error: { message?: string; code?: string } | null): SupportNoteErrorCode {
  const msg = String(error?.message ?? "").toUpperCase();
  if (msg.includes("AUTH_REQUIRED")) return "AUTH_REQUIRED";
  if (msg.includes("NOTE_EMPTY")) return "NOTE_EMPTY";
  if (msg.includes("NOTE_WORD_LIMIT")) return "NOTE_WORD_LIMIT";
  if (msg.includes("NOTE_TOO_LONG")) return "NOTE_TOO_LONG";
  if (msg.includes("NOTE_LINKS_DENIED")) return "NOTE_LINKS_DENIED";
  if (msg.includes("NOTE_NOT_FOUND")) return "NOTE_NOT_FOUND";
  if (msg.includes("NOTE_REMOVED")) return "NOTE_REMOVED";
  if (msg.includes("RATE_LIMITED")) return "RATE_LIMITED";
  if (msg.includes("PERMISSION_DENIED")) return "PERMISSION_DENIED";
  if (msg.includes("ACCOUNT_RESTRICTED")) return "ACCOUNT_RESTRICTED";
  if (msg.includes("CANNOT_REPORT_OWN")) return "CANNOT_REPORT_OWN";
  return "RPC_FAILED";
}

function trackNoteEvent(
  name:
    | "havooc_support_note_create"
    | "havooc_support_note_edit"
    | "havooc_support_note_delete"
    | "havooc_support_note_report",
  projectId: string,
): void {
  // Never include note body or PII.
  analyticsQueue.start();
  analyticsQueue.enqueue(name, { project: projectId.slice(0, 40) });
}

function rowFromRpc(row: Record<string, unknown> | null | undefined): ProjectSupportNote | null {
  if (!row || typeof row !== "object") return null;
  const id = typeof row.id === "string" ? row.id : "";
  const projectId = typeof row.project_id === "string" ? row.project_id : "";
  const userId = typeof row.user_id === "string" ? row.user_id : "";
  const body = typeof row.body === "string" ? row.body : "";
  const createdAt = typeof row.created_at === "string" ? row.created_at : "";
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : createdAt;
  if (!id || !projectId || !userId || !body || !createdAt) return null;
  return { id, projectId, userId, body, createdAt, updatedAt };
}

function gateEnabled(): boolean {
  return featureFlagService.isEnabled("enableHavoocSupportHub");
}

export const projectSupportNotesService = {
  projectId: HAVOOC_PROJECT_ID,

  async getProject(projectId = HAVOOC_PROJECT_ID): Promise<Result<SupportProject | null>> {
    if (!gateEnabled()) return { ok: false, code: "FEATURE_DISABLED", message: "HAVOOC Support Hub is disabled." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "get_support_project", { target_project_id: projectId });
    if (error) return { ok: false, code: mapRpcError(error), message: error.message ?? "RPC failed" };
    if (data == null) return { ok: true, data: null };
    const obj = data as Record<string, unknown>;
    return {
      ok: true,
      data: {
        id: String(obj.id ?? ""),
        displayName: String(obj.display_name ?? ""),
        ownerUserId: typeof obj.owner_user_id === "string" ? obj.owner_user_id : null,
        isPublic: obj.is_public === true,
      },
    };
  },

  async listNotes(input: {
    projectId?: string;
    sort?: SupportNoteSort;
    limit?: number;
    cursorCreatedAt?: string | null;
    cursorId?: string | null;
  } = {}): Promise<Result<SupportNotesPage>> {
    if (!gateEnabled()) return { ok: false, code: "FEATURE_DISABLED", message: "HAVOOC Support Hub is disabled." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "list_project_support_notes", {
      target_project_id: input.projectId ?? HAVOOC_PROJECT_ID,
      sort_order: input.sort ?? "newest",
      page_limit: input.limit ?? SUPPORT_NOTE_PAGE_SIZE,
      cursor_created_at: input.cursorCreatedAt ?? null,
      cursor_id: input.cursorId ?? null,
    });
    if (error) return { ok: false, code: mapRpcError(error), message: error.message ?? "RPC failed" };
    const payload = (data ?? {}) as Record<string, unknown>;
    const rawNotes = Array.isArray(payload.notes) ? payload.notes : [];
    const notes = rawNotes
      .map((item) => rowFromRpc(item as Record<string, unknown>))
      .filter((n): n is ProjectSupportNote => Boolean(n));
    return {
      ok: true,
      data: {
        notes,
        hasMore: payload.has_more === true,
        nextCursorCreatedAt:
          typeof payload.next_cursor_created_at === "string" ? payload.next_cursor_created_at : null,
        nextCursorId: typeof payload.next_cursor_id === "string" ? payload.next_cursor_id : null,
      },
    };
  },

  async getMyNote(projectId = HAVOOC_PROJECT_ID): Promise<Result<ProjectSupportNote | null>> {
    if (!gateEnabled()) return { ok: false, code: "FEATURE_DISABLED", message: "HAVOOC Support Hub is disabled." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "get_my_project_support_note", { target_project_id: projectId });
    if (error) return { ok: false, code: mapRpcError(error), message: error.message ?? "RPC failed" };
    return { ok: true, data: rowFromRpc(data as Record<string, unknown> | null) };
  },

  async upsertNote(rawBody: string, projectId = HAVOOC_PROJECT_ID): Promise<Result<ProjectSupportNote>> {
    if (!gateEnabled()) return { ok: false, code: "FEATURE_DISABLED", message: "HAVOOC Support Hub is disabled." };
    const validation = validateSupportNoteBody(rawBody);
    if (!validation.ok) {
      const code = validation.code as Exclude<SupportNoteValidationCode, "OK">;
      return { ok: false, code, message: code };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const existing = await this.getMyNote(projectId);
    const { data, error } = await rpc(client, "upsert_project_support_note", {
      target_project_id: projectId,
      raw_body: validation.normalized,
    });
    if (error) return { ok: false, code: mapRpcError(error), message: error.message ?? "RPC failed" };
    const note = rowFromRpc(data as Record<string, unknown>);
    if (!note) return { ok: false, code: "RPC_FAILED", message: "Invalid note payload." };
    trackNoteEvent(existing.ok && existing.data ? "havooc_support_note_edit" : "havooc_support_note_create", projectId);
    return { ok: true, data: note };
  },

  async deleteNote(projectId = HAVOOC_PROJECT_ID): Promise<Result<true>> {
    if (!gateEnabled()) return { ok: false, code: "FEATURE_DISABLED", message: "HAVOOC Support Hub is disabled." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { error } = await rpc(client, "delete_project_support_note", { target_project_id: projectId });
    if (error) return { ok: false, code: mapRpcError(error), message: error.message ?? "RPC failed" };
    trackNoteEvent("havooc_support_note_delete", projectId);
    return { ok: true, data: true };
  },

  async reportNote(input: {
    noteId: string;
    category: "spam" | "harassment" | "hate" | "scam" | "other";
    description?: string;
    projectId?: string;
  }): Promise<Result<string>> {
    if (!gateEnabled()) return { ok: false, code: "FEATURE_DISABLED", message: "HAVOOC Support Hub is disabled." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "report_project_support_note", {
      target_note_id: input.noteId,
      report_category: input.category,
      report_description: input.description ?? null,
    });
    if (error) return { ok: false, code: mapRpcError(error), message: error.message ?? "RPC failed" };
    trackNoteEvent("havooc_support_note_report", input.projectId ?? HAVOOC_PROJECT_ID);
    return { ok: true, data: String(data) };
  },

  subscribeNotes(
    projectId: string,
    onChange: () => void,
  ): () => void {
    if (!gateEnabled()) return () => undefined;
    const client = getSupabaseClient();
    if (!client) return () => undefined;
    const channel = client
      .channel(`project-support-notes:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_support_notes",
          filter: `project_id=eq.${projectId}`,
        },
        () => onChange(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  },
};
