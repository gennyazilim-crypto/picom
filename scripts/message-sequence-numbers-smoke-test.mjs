import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  migration: readFileSync(resolve(root, "supabase/migrations/20260704002500_message_sequence_numbers.sql"), "utf8"),
  messageService: readFileSync(resolve(root, "src/services/messageService.ts"), "utf8"),
  messageListQuery: readFileSync(resolve(root, "src/services/messageListQuery.ts"), "utf8"),
  messageSendMutation: readFileSync(resolve(root, "src/services/messageSendMutation.ts"), "utf8"),
  localState: readFileSync(resolve(root, "src/state/useLocalMessageState.ts"), "utf8"),
  app: readFileSync(resolve(root, "src/App.tsx"), "utf8"),
  communityTypes: readFileSync(resolve(root, "src/types/community.ts"), "utf8"),
  sharedMessageDto: readFileSync(resolve(root, "packages/shared/src/dto/message.ts"), "utf8"),
  realtimeHook: readFileSync(resolve(root, "src/hooks/useSupabaseMessageRealtime.ts"), "utf8"),
  databaseTypes: readFileSync(resolve(root, "src/services/supabase/database.types.ts"), "utf8"),
  doc: readFileSync(resolve(root, "docs/message-sequence-numbers.md"), "utf8"),
};

const checks = [
  [files.migration.includes("add column if not exists sequence bigint"), "sequence column migration"],
  [files.migration.includes("pg_advisory_xact_lock"), "per-channel advisory lock"],
  [files.migration.includes("messages_channel_sequence_unique"), "channel sequence unique index"],
  [files.migration.includes("trg_messages_assign_sequence"), "sequence trigger"],
  [files.messageService.includes("client_message_id, sequence, created_at"), "message service selects sequence"],
  [files.messageListQuery.includes(".order(\"sequence\""), "message list orders by sequence"],
  [files.messageSendMutation.includes("sequence: row.sequence"), "send mutation maps sequence"],
  [files.localState.includes("compareMessagesByDisplayOrder"), "local display ordering helper"],
  [files.app.includes("sequence: message.sequence"), "app maps sequence into UI state"],
  [files.communityTypes.includes("sequence?: number | null"), "runtime message sequence type"],
  [files.sharedMessageDto.includes("sequence?: number | null"), "shared message DTO sequence type"],
  [files.realtimeHook.includes("sequence: message.sequence"), "realtime metadata carries sequence"],
  [files.databaseTypes.includes("sequence: number | null"), "supabase database type sequence"],
  [files.doc.includes("Compound pagination is documented but not yet implemented"), "pagination limitation documented"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length > 0) {
  throw new Error(`Message sequence numbers smoke test failed: ${failed.join(", ")}`);
}

console.log("Message sequence numbers smoke test passed.");
