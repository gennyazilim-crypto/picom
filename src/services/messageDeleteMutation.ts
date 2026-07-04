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
}>;

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

export async function deleteSupabaseMessage(client: SupabaseClient<Database>, messageId: string): Promise<MessageDeleteMutationResult> {
  const { data, error } = await client
    .from("messages")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .is("deleted_at", null)
    .select(MESSAGE_DELETE_SELECT)
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return {
    data: mapMessageDeleteRow(data),
    error: null,
  };
}
