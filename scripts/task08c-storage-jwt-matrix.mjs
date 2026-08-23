/**
 * TASK 08C — local Storage JWT matrix against Supabase local stack.
 * Uses real Auth JWTs + Storage API. Service role only for fixture setup/cleanup.
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

function statusJson() {
  const out = execSync("npx supabase status -o json", { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 });
  const start = out.indexOf("{");
  return JSON.parse(out.slice(start));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const status = statusJson();
const url = status.API_URL || status.apiUrl || "http://127.0.0.1:54321";
const anon = status.ANON_KEY || status.anonKey;
const service = status.SERVICE_ROLE_KEY || status.serviceRoleKey;
assert(anon && service, "local anon/service keys missing");

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const anonClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

const runId = randomUUID().slice(0, 8);
const password = `Task08c-${runId}!Aa1`;

async function makeUser(label) {
  const email = `task08c-${label}-${runId}@picom.test`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert(!created.error, `createUser ${label}: ${created.error?.message}`);
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  assert(!signed.error, `signIn ${label}: ${signed.error?.message}`);
  return { email, id: created.data.user.id, client };
}

const owner = await makeUser("owner");
const unrelated = await makeUser("unrelated");

const privateBuckets = [
  "business-verification-documents",
  "message-attachments",
  "direct-message-attachments",
];

const buckets = await admin.storage.listBuckets();
assert(!buckets.error, `listBuckets: ${buckets.error?.message}`);
for (const name of privateBuckets) {
  const b = (buckets.data || []).find((x) => x.name === name);
  assert(b, `missing bucket ${name}`);
  assert(b.public === false, `${name} must not be public`);
}

// Fixture: place a private object with service role (server path), then deny client roles.
const bucket = "business-verification-documents";
const orgId = randomUUID();
const appId = randomUUID();
const docId = randomUUID();
const objectPath = `business-applications/${orgId}/${appId}/${docId}.pdf`;
const payload = new Blob([`%PDF-1.1\n%task08c-${runId}\n`], { type: "application/pdf" });

const up = await admin.storage.from(bucket).upload(objectPath, payload, {
  contentType: "application/pdf",
  upsert: false,
});
assert(!up.error, `service fixture upload failed: ${up.error?.message}`);

const anonDown = await anonClient.storage.from(bucket).download(objectPath);
assert(!!anonDown.error, "anon must not download private verification document");

const unrelatedDown = await unrelated.client.storage.from(bucket).download(objectPath);
assert(!!unrelatedDown.error, "unrelated authenticated must not download private verification document");

const unrelatedDel = await unrelated.client.storage.from(bucket).remove([objectPath]);
const stillThere = await admin.storage.from(bucket).download(objectPath);
assert(!stillThere.error, "unrelated delete must not remove private object");

const signed = await admin.storage.from(bucket).createSignedUrl(objectPath, 60);
assert(!signed.error && signed.data?.signedUrl, "service/root signed URL path must work");

// Owner without org membership must not upload into business-applications path.
const ownerUp = await owner.client.storage.from(bucket).upload(
  `business-applications/${randomUUID()}/${randomUUID()}/${randomUUID()}.pdf`,
  payload,
  { contentType: "application/pdf", upsert: false },
);
assert(!!ownerUp.error, "unrelated-to-org authenticated upload must be denied");

await admin.storage.from(bucket).remove([objectPath]);
await admin.auth.admin.deleteUser(owner.id);
await admin.auth.admin.deleteUser(unrelated.id);

console.log("STORAGE_JWT_MATRIX=PASS");
console.log(
  JSON.stringify({
    bucket,
    anonDenied: true,
    unrelatedReadDenied: true,
    unrelatedDeleteDenied: true,
    unauthorizedUploadDenied: true,
    signedUrlAllowed: true,
    privateBucketsVerified: privateBuckets,
    runId,
  }),
);
