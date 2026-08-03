/**
 * TASK26 production closed-application storage denial matrix.
 * Never prints secrets/JWTs. Usage:
 *   node scripts/tmp-t26-storage-closed-denial.mjs --run
 */
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const shouldRun = process.argv.includes("--run");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "cqnsetsmcduraryemhbi";
const BUCKET = "publisher-application-documents";
const results = [];
const cleanupUsers = [];
const cleanupApps = [];
const cleanupObjects = [];

if (!shouldRun) {
  console.log("TASK26 storage denial BLOCKED until --run");
  process.exit(0);
}

function redact(detail) {
  return String(detail ?? "")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .slice(0, 240);
}

function record(caseId, status, detail = "") {
  results.push({ caseId, status, detail: redact(detail) });
  console.log(`[${status}] ${caseId}${detail ? ` | ${redact(detail).slice(0, 160)}` : ""}`);
}

function getApiKeys(ref) {
  const args = ["supabase", "projects", "api-keys", "--project-ref", ref, "--reveal", "--output", "json"];
  const output = process.platform === "win32"
    ? execFileSync("cmd.exe", ["/d", "/s", "/c", `npx ${args.join(" ")}`], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: process.env,
    })
    : execFileSync("npx", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: process.env });
  const keys = JSON.parse(output);
  const service = keys.find((k) => /service.?role|secret/i.test(String(k.name ?? k.type ?? "")));
  const anon = keys.find((k) => /anon|publishable/i.test(String(k.name ?? k.type ?? "")));
  return {
    service: String(service?.api_key ?? service?.key ?? "").trim(),
    anon: String(anon?.api_key ?? anon?.key ?? "").trim(),
  };
}

async function createActor(admin, anonKey, url, label, runId, password) {
  const email = `picom-t26-${label}-${runId}@example.invalid`;
  const username = `t26_${label}_${runId}`.slice(0, 24);
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: `t26-${label}`, picom_internal_test: true },
  });
  if (created.error || !created.data.user) throw created.error || new Error(`create ${label}`);
  const id = created.data.user.id;
  cleanupUsers.push(id);
  await admin.from("profiles").upsert({ id, username, display_name: `t26-${label}`, status: "online" });
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id, email, client, label };
}

async function insertOpenApp(admin, userId, status = "draft") {
  const ins = await admin.from("publisher_applications").insert({
    user_id: userId,
    application_type: "creator",
    status,
    display_publisher_name: `T26 ${status}`,
    short_bio: "TASK26 storage denial fixture application.",
    categories: ["general"],
    follower_count_at_application: status === "draft" || status === "withdrawn" ? 0 : 5000,
    community_member_count_at_application: 0,
    eligibility_paths: status === "draft" || status === "withdrawn" ? [] : ["follower_threshold"],
  }).select("id,status").single();
  if (ins.error) throw ins.error;
  cleanupApps.push(ins.data.id);
  return ins.data;
}

async function tryUpload(client, objectPath, bytes = "t26-smoke") {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const up = await client.storage.from(BUCKET).upload(objectPath, blob, {
    contentType: "application/pdf",
    upsert: false,
  });
  return up;
}

async function objectExists(admin, objectPath) {
  const folder = objectPath.split("/").slice(0, -1).join("/");
  const name = objectPath.split("/").pop();
  const listed = await admin.storage.from(BUCKET).list(folder, { search: name });
  if (listed.error) return { ok: false, error: listed.error.message };
  const hit = (listed.data || []).some((f) => f.name === name);
  return { ok: true, exists: hit };
}

async function cleanup(admin) {
  for (const p of cleanupObjects) {
    try { await admin.storage.from(BUCKET).remove([p]); } catch { /* ignore */ }
  }
  for (const id of cleanupApps) {
    try {
      await admin.from("publisher_application_documents").delete().eq("application_id", id);
      await admin.from("publisher_applications").delete().eq("id", id);
    } catch { /* ignore */ }
  }
  for (const id of cleanupUsers) {
    try {
      await admin.from("publisher_applications").delete().eq("user_id", id);
      await admin.auth.admin.deleteUser(id);
    } catch { /* ignore */ }
  }
}

async function main() {
  if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) throw new Error("SUPABASE_ACCESS_TOKEN required");
  const url = `https://${PROD_REF}.supabase.co`;
  const keys = getApiKeys(PROD_REF);
  if (!keys.service || !keys.anon) throw new Error("api keys incomplete");
  const admin = createClient(url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
  const runId = randomUUID().slice(0, 8);
  const password = `P!${randomBytes(18).toString("base64url")}9z`;

  const applicant = await createActor(admin, keys.anon, url, "app", runId, password);
  const foreign = await createActor(admin, keys.anon, url, "foreign", runId, password);
  record("actors", "PASS");

  // Open draft upload PASS
  const openApp = await insertOpenApp(admin, applicant.id, "draft");
  const openPath = `${applicant.id}/${runId}-open.pdf`;
  const openUp = await tryUpload(applicant.client, openPath);
  if (!openUp.error) cleanupObjects.push(openPath);
  record("open_draft_upload", openUp.error ? "FAIL" : "PASS", openUp.error?.message || "uploaded");

  // Closed statuses: rejected, withdrawn, approved, suspended
  for (const closedStatus of ["rejected", "withdrawn", "approved", "suspended"]) {
    // Ensure only this closed app exists for applicant (delete open first after first iteration)
    await admin.from("publisher_applications").delete().eq("user_id", applicant.id);
    cleanupApps.length = 0;
    const closed = await insertOpenApp(admin, applicant.id, closedStatus);
    record(`seed_${closedStatus}`, closed?.id ? "PASS" : "FAIL", closedStatus);

    const denyPath = `${applicant.id}/${runId}-${closedStatus}.pdf`;
    const denyUp = await tryUpload(applicant.client, denyPath, `deny-${closedStatus}`);
    if (!denyUp.error) {
      cleanupObjects.push(denyPath);
      const exists = await objectExists(admin, denyPath);
      record(
        `closed_${closedStatus}_upload_denied`,
        "FAIL",
        `upload succeeded; object_exists=${exists.exists}`,
      );
      await admin.storage.from(BUCKET).remove([denyPath]);
    } else {
      const exists = await objectExists(admin, denyPath);
      record(
        `closed_${closedStatus}_upload_denied`,
        !exists.exists ? "PASS" : "FAIL",
        denyUp.error.message || "denied",
      );
    }

    // DB document row should not exist for failed upload
    const docs = await admin.from("publisher_application_documents").select("id").eq("application_id", closed.id);
    record(
      `closed_${closedStatus}_no_doc_row`,
      !docs.error && (docs.data || []).length === 0 ? "PASS" : "WARN",
      docs.error?.message || `rows=${(docs.data || []).length}`,
    );
  }

  // Recreate open app to test foreign/path bypass while applicant has open app
  await admin.from("publisher_applications").delete().eq("user_id", applicant.id);
  cleanupApps.length = 0;
  await insertOpenApp(admin, applicant.id, "submitted");

  // Foreign user path DENIED
  {
    const foreignPath = `${applicant.id}/${runId}-foreign.pdf`;
    const up = await tryUpload(foreign.client, foreignPath);
    if (!up.error) {
      cleanupObjects.push(foreignPath);
      await admin.storage.from(BUCKET).remove([foreignPath]);
    }
    record("foreign_path_upload_denied", up.error ? "PASS" : "FAIL", up.error?.message || "unexpected success");
  }

  // Encoding / traversal style bypass attempts
  const bypassPaths = [
    `${applicant.id}/../${foreign.id}/${runId}-trav.pdf`,
    `${applicant.id}%2f../${foreign.id}/${runId}-enc.pdf`,
    `./${applicant.id}/${runId}-dot.pdf`,
    `${applicant.id}\\${runId}-win.pdf`,
  ];
  for (const p of bypassPaths) {
    const up = await tryUpload(foreign.client, p);
    if (!up.error) {
      cleanupObjects.push(p);
      await admin.storage.from(BUCKET).remove([p]);
    }
    record(
      `bypass_${p.includes("%") ? "encoding" : p.includes("..") ? "traversal" : p.includes("\\") ? "backslash" : "dot"}`,
      up.error ? "PASS" : "FAIL",
      up.error?.message || "unexpected success",
    );
  }

  // Overwrite existing object while closed
  {
    await admin.from("publisher_applications").delete().eq("user_id", applicant.id);
    cleanupApps.length = 0;
    await insertOpenApp(admin, applicant.id, "draft");
    const overwritePath = `${applicant.id}/${runId}-overwrite.pdf`;
    const first = await tryUpload(applicant.client, overwritePath, "v1");
    if (!first.error) cleanupObjects.push(overwritePath);
    record("seed_overwrite_object", first.error ? "FAIL" : "PASS", first.error?.message);

    await admin.from("publisher_applications").update({ status: "rejected", follower_count_at_application: 5000, eligibility_paths: ["follower_threshold"] }).eq("user_id", applicant.id);
    const second = await applicant.client.storage.from(BUCKET).upload(overwritePath, new Blob(["v2"]), {
      contentType: "application/pdf",
      upsert: true,
    });
    record("closed_overwrite_denied", second.error ? "PASS" : "FAIL", second.error?.message || "unexpected success");
  }

  // Signed upload URL while closed
  {
    const { data, error } = await applicant.client.storage.from(BUCKET).createSignedUploadUrl(`${applicant.id}/${runId}-signed.pdf`);
    record(
      "closed_signed_upload_url_denied",
      error || !data ? "PASS" : "FAIL",
      error?.message || (data ? "signed url issued" : "denied"),
    );
  }

  await cleanup(admin);
  record("cleanup", "PASS");

  const fail = results.filter((r) => r.status === "FAIL");
  const summary = { productionRef: PROD_REF, pass: results.filter((r) => r.status === "PASS").length, fail: fail.length, warn: results.filter((r) => r.status === "WARN").length, results };
  const outDir = path.join(root, "docs/audit/evidence", `live-now-publisher-real-device-certification-${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}Z`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "18-storage-closed-application-denial.txt"), JSON.stringify(summary, null, 2));
  console.log(`EVIDENCE_DIR=${outDir}`);
  console.log(`SUMMARY pass=${summary.pass} fail=${summary.fail} warn=${summary.warn}`);
  if (fail.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`FATAL ${redact(e?.message || e)}`);
  process.exit(1);
});
