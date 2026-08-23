import { analyticsQueue } from "../../services/analytics/analyticsQueue";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
import {
  HAVOOC_PROJECT_KEY,
  SUPPORT_NOTES_PAGE_SIZE,
} from "./havoocConfig";
import { validateSupportNoteBody } from "./havoocSupportNoteText";

export type SupportNoteSort = "newest" | "oldest";

export type SupportNoteAuthor = Readonly<{
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  isProjectOwner: boolean;
}>;

export type SupportNote = Readonly<{
  id: string;
  projectKey: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  isOwnNote: boolean;
  author: SupportNoteAuthor;
}>;

export type SupportNotesPage = Readonly<{
  notes: SupportNote[];
  nextCursor: { createdAt: string; id: string } | null;
}>;

export type OwnSupportNote = Readonly<{
  id: string;
  projectKey: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  moderationStatus: string;
}>;

type Result<T> = Readonly<{ ok: true; data: T } | { ok: false; code: string; message: string }>;

type ListPayload = {
  notes?: Array<{
    id: string;
    project_id: string;
    user_id: string;
    body: string;
    created_at: string;
    updated_at: string;
    author_display_name?: string | null;
    author_username?: string | null;
    author_avatar_url?: string | null;
    is_project_owner?: boolean | null;
  }>;
  has_more?: boolean;
  next_cursor_created_at?: string | null;
  next_cursor_id?: string | null;
};

type NoteRow = {
  id: string;
  project_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  moderation_status?: string;
};

function mapRpcError(error: { message?: string } | null): { code: string; message: string } {
  const raw = error?.message ?? "";
  if (raw.includes("AUTH_REQUIRED")) return { code: "auth_required", message: "Sign in to leave a support note." };
  if (raw.includes("NOTE_EMPTY")) return { code: "empty", message: "Write a short note before signing." };
  if (raw.includes("NOTE_WORD_LIMIT")) return { code: "too_long_words", message: "Notes can be at most 20 words." };
  if (raw.includes("NOTE_TOO_LONG")) return { code: "too_long_chars", message: "Notes can be at most 160 characters." };
  if (raw.includes("NOTE_LINKS_DENIED") || raw.includes("NOTE_HTML_DENIED")) {
    return { code: raw.includes("HTML") ? "html_forbidden" : "url_forbidden", message: "Links and HTML are not allowed in support notes." };
  }
  if (raw.includes("RATE_LIMITED")) return { code: "rate_limited", message: "Too many note updates. Please wait a moment and try again." };
  if (raw.includes("NOTE_NOT_FOUND") || raw.includes("CANNOT_REPORT_OWN")) {
    return { code: "forbidden", message: "You can only change your own support note." };
  }
  if (raw.includes("ACCOUNT_RESTRICTED")) return { code: "forbidden", message: "Your account cannot leave support notes right now." };
  return { code: "unknown", message: "Picom could not complete this support note action." };
}

function trackNoteEvent(
  name:
    | "havooc_support_note_create"
    | "havooc_support_note_edit"
    | "havooc_support_note_delete"
    | "havooc_support_note_report",
): void {
  analyticsQueue.start();
  analyticsQueue.enqueue(name, { projectKey: HAVOOC_PROJECT_KEY });
}

async function loadOwnerUserId(projectKey: string): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const response = await client.rpc("get_support_project" as never, { target_project_id: projectKey } as never);
  const payload = response.data as { owner_user_id?: string | null } | null;
  return payload?.owner_user_id ?? null;
}

async function hydrateAuthors(
  rows: NonNullable<ListPayload["notes"]>,
  ownerUserId: string | null,
  currentUserId: string | null,
): Promise<SupportNote[]> {
  const client = getSupabaseClient();
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const profileById = new Map<string, { display_name: string | null; username: string | null; avatar_url: string | null }>();

  if (client && userIds.length > 0) {
    const { data } = await client
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", userIds);
    for (const profile of data ?? []) {
      profileById.set(String((profile as { id: string }).id), profile as {
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
      });
    }
  }

  return rows.map((row) => {
    const profile = profileById.get(row.user_id);
    const displayName =
      row.author_display_name?.trim()
      || profile?.display_name?.trim()
      || row.author_username?.trim()
      || profile?.username?.trim()
      || "Player";
    const username = row.author_username?.trim() || profile?.username?.trim() || "";
    return {
      id: row.id,
      projectKey: row.project_id,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isOwnNote: Boolean(currentUserId && row.user_id === currentUserId),
      author: {
        userId: row.user_id,
        displayName,
        username,
        avatarUrl: row.author_avatar_url ?? profile?.avatar_url ?? null,
        isProjectOwner: Boolean(row.is_project_owner ?? (ownerUserId && row.user_id === ownerUserId)),
      },
    };
  });
}

export const havoocSupportNotesService = {
  async listNotes(input: {
    projectKey?: string;
    limit?: number;
    cursor?: { createdAt: string; id: string } | null;
    sort?: SupportNoteSort;
  } = {}): Promise<Result<SupportNotesPage>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "unavailable", message: "Support notes are unavailable." };

    const projectKey = input.projectKey ?? HAVOOC_PROJECT_KEY;
    const limit = input.limit ?? SUPPORT_NOTES_PAGE_SIZE;
    const response = await client.rpc("list_project_support_notes" as never, {
      target_project_id: projectKey,
      sort_order: input.sort ?? "newest",
      page_limit: limit,
      cursor_created_at: input.cursor?.createdAt ?? null,
      cursor_id: input.cursor?.id ?? null,
    } as never);

    if (response.error) {
      return { ok: false, ...mapRpcError(response.error) };
    }

    const payload = (response.data ?? {}) as ListPayload;
    const rows = Array.isArray(payload.notes) ? payload.notes : [];
    const { data: authData } = await client.auth.getUser();
    const currentUserId = authData.user?.id ?? null;
    const ownerUserId = await loadOwnerUserId(projectKey);
    const notes = await hydrateAuthors(rows, ownerUserId, currentUserId);
    const nextCursor =
      payload.has_more && payload.next_cursor_created_at && payload.next_cursor_id
        ? { createdAt: payload.next_cursor_created_at, id: payload.next_cursor_id }
        : null;

    return { ok: true, data: { notes, nextCursor } };
  },

  async getMyNote(projectKey: string = HAVOOC_PROJECT_KEY): Promise<Result<OwnSupportNote | null>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "unavailable", message: "Support notes are unavailable." };

    const response = await client.rpc("get_my_project_support_note" as never, {
      target_project_id: projectKey,
    } as never);
    if (response.error) return { ok: false, ...mapRpcError(response.error) };
    const row = response.data as NoteRow | null;
    if (!row?.id) return { ok: true, data: null };
    return {
      ok: true,
      data: {
        id: row.id,
        projectKey: row.project_id,
        body: row.body,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        moderationStatus: row.moderation_status ?? "visible",
      },
    };
  },

  async createNote(body: string, projectKey: string = HAVOOC_PROJECT_KEY): Promise<Result<SupportNote>> {
    return this.upsertNote(body, projectKey, "create");
  },

  async updateNote(_noteId: string, body: string, projectKey: string = HAVOOC_PROJECT_KEY): Promise<Result<SupportNote>> {
    return this.upsertNote(body, projectKey, "edit");
  },

  async upsertNote(
    body: string,
    projectKey: string = HAVOOC_PROJECT_KEY,
    mode: "create" | "edit" = "create",
  ): Promise<Result<SupportNote>> {
    const validation = validateSupportNoteBody(body);
    if (!validation.ok) {
      return {
        ok: false,
        code: validation.code,
        message:
          validation.code === "empty"
            ? "Write a short note before signing."
            : validation.code === "too_long_words"
              ? "Notes can be at most 20 words."
              : validation.code === "too_long_chars"
                ? "Notes can be at most 160 characters."
                : validation.code === "url_forbidden"
                  ? "Links are not allowed in support notes."
                  : "HTML is not allowed in support notes.",
      };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "unavailable", message: "Support notes are unavailable." };

    const response = await client.rpc("upsert_project_support_note" as never, {
      target_project_id: projectKey,
      raw_body: validation.body,
    } as never) as { data: NoteRow | null; error: { message?: string } | null };
    if (response.error || !response.data) {
      return { ok: false, ...mapRpcError(response.error) };
    }

    trackNoteEvent(mode === "edit" ? "havooc_support_note_edit" : "havooc_support_note_create");
    const row = response.data;
    return {
      ok: true,
      data: {
        id: row.id,
        projectKey: row.project_id,
        body: row.body,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isOwnNote: true,
        author: {
          userId: row.user_id,
          displayName: "You",
          username: "",
          avatarUrl: null,
          isProjectOwner: false,
        },
      },
    };
  },

  async deleteNote(_noteId: string, projectKey: string = HAVOOC_PROJECT_KEY): Promise<Result<true>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "unavailable", message: "Support notes are unavailable." };

    const { error } = await client.rpc("delete_project_support_note" as never, {
      target_project_id: projectKey,
    } as never);
    if (error) return { ok: false, ...mapRpcError(error) };
    trackNoteEvent("havooc_support_note_delete");
    return { ok: true, data: true };
  },

  async reportNote(
    noteId: string,
    reason: "spam" | "harassment" | "hate" | "scam" | "other" = "other",
    description?: string,
  ): Promise<Result<true>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "unavailable", message: "Reporting is unavailable." };

    const { error } = await client.rpc("report_project_support_note" as never, {
      target_note_id: noteId,
      report_category: reason,
      report_description: description ?? null,
    } as never);
    if (error) return { ok: false, ...mapRpcError(error) };
    trackNoteEvent("havooc_support_note_report");
    return { ok: true, data: true };
  },

  subscribeToProject(
    projectKey: string,
    onChange: () => void,
  ): () => void {
    const client = getSupabaseClient();
    if (!client) return () => undefined;

    const channel = client
      .channel(`project_support_notes:${projectKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_support_notes",
          filter: `project_id=eq.${projectKey}`,
        },
        () => {
          onChange();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  },
};
