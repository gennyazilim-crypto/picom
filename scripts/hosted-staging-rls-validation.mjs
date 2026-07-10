import { createClient } from "@supabase/supabase-js";

const shouldRun = process.argv.includes("--run");
const requiredNames = [
  "PICOM_RLS_STAGING_URL",
  "PICOM_RLS_STAGING_ANON_KEY",
  "PICOM_RLS_STAGING_CONFIRM",
  "PICOM_RLS_COMMUNITY_ID",
  "PICOM_RLS_PUBLIC_CHANNEL_ID",
  "PICOM_RLS_PRIVATE_CHANNEL_ID",
  "PICOM_RLS_PRIVATE_MESSAGE_ID",
  "PICOM_RLS_PRIVATE_ATTACHMENT_ID",
  "PICOM_RLS_PRIVATE_STORAGE_BUCKET",
  "PICOM_RLS_PRIVATE_STORAGE_PATH",
  ...["OWNER", "ADMIN", "MODERATOR", "MEMBER", "VISITOR"].flatMap((role) => [
    `PICOM_RLS_${role}_EMAIL`,
    `PICOM_RLS_${role}_PASSWORD`,
  ]),
];

const missing = requiredNames.filter((name) => !process.env[name]?.trim());
const matrix = {
  owner: { expectedRole: "owner", member: true, privateRead: true },
  admin: { expectedRole: "admin", member: true, privateRead: true },
  moderator: { expectedRole: "moderator", member: true, privateRead: false },
  member: { expectedRole: "member", member: true, privateRead: false },
  visitor: { expectedRole: undefined, member: false, privateRead: false },
};

function pass(message) { console.log(`OK ${message}`); }
function fail(message) { throw new Error(`Hosted staging RLS validation failed: ${message}`); }

function validateConfiguration() {
  if (missing.length) fail(`missing ${missing.join(", ")}. Values were not printed.`);
  if (process.env.PICOM_RLS_STAGING_CONFIRM !== "STAGING_ONLY") fail("PICOM_RLS_STAGING_CONFIRM must equal STAGING_ONLY.");
  if (/service[_-]?role|sb_secret_/i.test(process.env.PICOM_RLS_STAGING_ANON_KEY)) fail("staging key must be anon/publishable, not service-role.");
  let url;
  try { url = new URL(process.env.PICOM_RLS_STAGING_URL); } catch { fail("staging URL is invalid."); }
  if (url.protocol !== "https:" || url.username || url.password) fail("staging URL must be credential-free HTTPS.");
}

async function isVisible(client, table, id) {
  const { data, error } = await client.from(table).select("id").eq("id", id).limit(1);
  if (error) fail(`${table} visibility query returned ${error.code ?? "an error"}.`);
  return data?.length === 1;
}

async function assertVisibility(client, label, expectedPrivate) {
  const publicVisible = await isVisible(client, "channels", process.env.PICOM_RLS_PUBLIC_CHANNEL_ID);
  if (!publicVisible) fail(`${label} cannot read the public fixture channel.`);

  for (const [table, envName] of [
    ["channels", "PICOM_RLS_PRIVATE_CHANNEL_ID"],
    ["messages", "PICOM_RLS_PRIVATE_MESSAGE_ID"],
    ["attachments", "PICOM_RLS_PRIVATE_ATTACHMENT_ID"],
  ]) {
    const visible = await isVisible(client, table, process.env[envName]);
    if (visible !== expectedPrivate) fail(`${label} ${table} private visibility expected ${expectedPrivate}, received ${visible}.`);
  }

  const { data, error } = await client.storage
    .from(process.env.PICOM_RLS_PRIVATE_STORAGE_BUCKET)
    .download(process.env.PICOM_RLS_PRIVATE_STORAGE_PATH);
  const storageVisible = !error && Boolean(data);
  if (storageVisible !== expectedPrivate) fail(`${label} private Storage visibility expected ${expectedPrivate}, received ${storageVisible}.`);
  pass(`${label}: public read and private channel/message/attachment/storage boundary`);
}

async function validateActor(role, policy) {
  const upper = role.toUpperCase();
  const client = createClient(process.env.PICOM_RLS_STAGING_URL, process.env.PICOM_RLS_STAGING_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: process.env[`PICOM_RLS_${upper}_EMAIL`],
    password: process.env[`PICOM_RLS_${upper}_PASSWORD`],
  });
  if (authError || !authData.user) fail(`${role} synthetic account could not authenticate.`);

  const { data: memberships, error: membershipError } = await client
    .from("community_members")
    .select("role:roles(name)")
    .eq("community_id", process.env.PICOM_RLS_COMMUNITY_ID)
    .eq("user_id", authData.user.id);
  if (membershipError) fail(`${role} membership query returned ${membershipError.code ?? "an error"}.`);
  const isMember = Boolean(memberships?.length);
  if (isMember !== policy.member) fail(`${role} membership expected ${policy.member}, received ${isMember}.`);
  if (policy.expectedRole) {
    const roleValue = memberships?.[0]?.role;
    const roleName = Array.isArray(roleValue) ? roleValue[0]?.name : roleValue?.name;
    if (roleName?.toLowerCase() !== policy.expectedRole) fail(`${role} fixture has the wrong community role.`);
  }

  await assertVisibility(client, role, policy.privateRead);
  await client.auth.signOut({ scope: "local" });
}

if (!shouldRun) {
  console.log("Hosted staging RLS runner is read-only and requires --run plus explicit STAGING_ONLY confirmation.");
  console.log(`Required configuration names: ${requiredNames.join(", ")}`);
  console.log("No database connection was made and no credential values were printed.");
  process.exit(0);
}

validateConfiguration();
const anonymous = createClient(process.env.PICOM_RLS_STAGING_URL, process.env.PICOM_RLS_STAGING_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
await assertVisibility(anonymous, "anonymous", false);
for (const [role, policy] of Object.entries(matrix)) await validateActor(role, policy);
console.log("Hosted staging RLS validation passed for owner/admin/moderator/member/visitor without service-role credentials.");
