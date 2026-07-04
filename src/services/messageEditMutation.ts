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
}>;

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

export async function editSupabaseMessage(client: SupabaseClient<Database>, messageId: string, body: string): Promise<MessageEditMutationResult> {
  const { data, error } = await client
    .from("messages")
    .update({
      body,
      edited_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .is("deleted_at", null)
    .select(MESSAGE_EDIT_SELECT)
    .single();

  if (error || !data) {
    return { data: null, error };
  }

  return {
    data: mapMessageEditRow(data),
    error: null,
  };
}
