import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

export const MESSAGE_EDIT_SELECT = "id, body, edited_at" as const;

export type EditedMessageSummary = Readonly<{
  id: string;
  body: string;
  editedAt: string;
}>;

export type MessageEditRow = Readonly<{
  id: string;
  body: string;
  edited_at: string | null;
}>;

export type MessageEditMutationResult = Readonly<{
  data: EditedMessageSummary | null;
  error: unknown;
  conflict?: "version" | "deleted" | "forbidden";
}>;

function classifyConflict(error: unknown): MessageEditMutationResult["conflict"] {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error ?? "");
  if (message.includes("MESSAGE_VERSION_CONFLICT")) return "version";
  if (message.includes("MESSAGE_DELETED_CONFLICT")) return "deleted";
  if (message.includes("MESSAGE_EDIT_FORBIDDEN")) return "forbidden";
  return undefined;
}

export function mapMessageEditRow(row: MessageEditRow): EditedMessageSummary {
  return {
    id: row.id,
    body: row.body,
    editedAt: row.edited_at ?? new Date().toISOString(),
  };
}

export function createMockEditedMessage(messageId: string, body: string): EditedMessageSummary {
  return {
    id: messageId,
    body,
    editedAt: new Date().toISOString(),
  };
}

export async function editSupabaseMessage(client: SupabaseClient<Database>, messageId: string, body: string, expectedEditedAt?: string | null): Promise<MessageEditMutationResult> {
  const { data, error } = await client.rpc("edit_message_with_version", {
    target_message_id: messageId,
    next_body: body,
    expected_edited_at: expectedEditedAt ?? null,
  });
  const row = data?.[0];

  if (error || !row) {
    return { data: null, error, conflict: classifyConflict(error) };
  }

  return {
    data: mapMessageEditRow(row),
    error: null,
  };
}
