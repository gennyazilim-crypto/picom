import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const confirmed = process.env.PICOM_CONFIRM_STORAGE_DELETE === "DELETE_ORPHANS";
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const graceHours = Math.max(1, Math.min(720, Number.parseInt(process.env.PICOM_STORAGE_ORPHAN_HOURS ?? "24", 10) || 24));
const resultLimit = Math.max(1, Math.min(1000, Number.parseInt(process.env.PICOM_STORAGE_ORPHAN_LIMIT ?? "500", 10) || 500));

async function main() {
  if (apply && !confirmed) throw new Error("Apply mode requires PICOM_CONFIRM_STORAGE_DELETE=DELETE_ORPHANS.");
  if (!url || !serviceRoleKey) {
    console.log(JSON.stringify({ status: "BLOCKED", mode: apply ? "apply" : "dry_run", reason: "SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY are required", deleted: 0 }, null, 2));
    if (apply) process.exitCode = 1;
    return;
  }

  const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const olderThan = new Date(Date.now() - graceHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await client.rpc("list_storage_orphan_candidates", { older_than: olderThan, result_limit: resultLimit });
  if (error) throw new Error(`Storage orphan inventory failed: ${error.message}`);
  const candidates = data ?? [];
  const byReason = candidates.reduce((summary, item) => ({ ...summary, [item.reason]: (summary[item.reason] ?? 0) + 1 }), {});
  let deleted = 0;
  const failures = [];

  if (apply) {
    for (const candidate of candidates) {
      const removal = await client.storage.from(candidate.bucket_id).remove([candidate.object_name]);
      if (removal.error) { failures.push({ bucket: candidate.bucket_id, reason: removal.error.message }); continue; }
      deleted += 1;
      if (candidate.bucket_id === "message-attachments") {
        await client.from("attachments").update({ status: "failed" }).eq("storage_path", candidate.object_name).is("message_id", null);
      }
    }
  }

  console.log(JSON.stringify({ status: failures.length ? "PARTIAL" : "OK", mode: apply ? "apply" : "dry_run", graceHours, scannedCandidates: candidates.length, byReason, deleted, failures: failures.length }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Storage cleanup failed"); process.exitCode = 1; });
