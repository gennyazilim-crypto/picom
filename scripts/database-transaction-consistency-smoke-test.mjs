import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  doc: readFileSync(resolve(root, "docs/database-transaction-consistency.md"), "utf8"),
  communityService: readFileSync(resolve(root, "src/services/communityService.ts"), "utf8"),
  channelService: readFileSync(resolve(root, "src/services/channelService.ts"), "utf8"),
  acceptInviteConfig: readFileSync(resolve(root, "supabase/config.toml"), "utf8"),
};

const requiredDocPhrases = [
  "create_community_with_defaults",
  "send_message_with_attachments",
  "transfer_community_ownership",
  "accept_invite_transaction",
  "audit log",
  "Edge Function",
  "Do not implement destructive transaction RPCs",
  "Known gaps",
];

const checks = [
  ...requiredDocPhrases.map((phrase) => [files.doc.includes(phrase), `doc includes ${phrase}`]),
  [files.communityService.includes("createCommunity"), "community create path exists"],
  [files.channelService.includes("createChannel"), "channel create path exists"],
  [files.acceptInviteConfig.includes("[functions.accept-invite]"), "accept invite function configured"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length > 0) {
  throw new Error(`Database transaction consistency smoke test failed: ${failed.join(", ")}`);
}

console.log("Database transaction consistency smoke test passed.");
