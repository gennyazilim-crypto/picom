import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

export const MESSAGE_DELETE_SELECT = "id, deleted_at" as const;

export type DeletedMessageSummary = Readonly<{
  id: string;
  deletedAt: string;
}>;

export type MessageDeleteRow = Readonly<{
  id: string;
  deleted_at: string | null;
}>;

export type MessageDeleteMutationResult = Readonly<{
  data: DeletedMessageSummary | null;
  error: unknown;
  conflict?: "version" | "forbidden";
}>;

function classifyConflict(error: unknown): MessageDeleteMutationResult["conflict"] {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error ?? "");
  if (message.includes("MESSAGE_VERSION_CONFLICT")) return "version";
  if (message.includes("MESSAGE_DELETE_FORBIDDEN")) return "forbidden";
  return undefined;
}

export function mapMessageDeleteRow(row: MessageDeleteRow): DeletedMessageSummary {
  return {
    id: row.id,
    deletedAt: row.deleted_at ?? new Date().toISOString(),
  };
}

export function createMockDeletedMessage(messageId: string): DeletedMessageSummary {
  return {
    id: messageId,
    deletedAt: new Date().toISOString(),
  };
}

export async function deleteSupabaseMessage(client: SupabaseClient<Database>, messageId: string, expectedEditedAt?: string | null): Promise<MessageDeleteMutationResult> {
  const { data, error } = await client.rpc("delete_message_with_version", {
    target_message_id: messageId,
    expected_edited_at: expectedEditedAt ?? null,
  });
  const row = data?.[0];

  if (error || !row) {
    return { data: null, error, conflict: classifyConflict(error) };
  }

  return {
    data: mapMessageDeleteRow(row),
    error: null,
  };
}
