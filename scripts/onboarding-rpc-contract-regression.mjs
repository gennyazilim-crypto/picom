import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const RPC_NAME = "complete_current_user_onboarding";
const EXPECTED_ARGS = [
  ["target_profile", "jsonb"],
  ["target_followed_user_ids", "uuid[]"],
  ["target_theme", "text"],
  ["target_start_choice", "text"],
  ["target_invite_code", "text"],
];
const EXPECTED_RETURN_FIELDS = [
  ["completed", "boolean"],
  ["completed_at", "timestamptz"],
  ["followed_user_ids", "uuid[]"],
  ["theme_mode", "text"],
  ["initial_feed", "text"],
  ["start_choice", "text"],
];
const EXPECTED_TYPE_ARGS = [
  ["target_profile", "Json"],
  ["target_followed_user_ids", "string[]"],
  ["target_theme", '"light" | "dark" | "system"'],
  ["target_start_choice", '"createCommunity" | "joinInvite" | "mentionFeed"'],
  ["target_invite_code", "string | null"],
];
const EXPECTED_TYPE_RETURN_FIELDS = [
  ["completed", "boolean"],
  ["completed_at", "string"],
  ["followed_user_ids", "string[]"],
  ["theme_mode", '"light" | "dark" | "system"'],
  ["initial_feed", '"mention" | "community" | "invite"'],
  ["start_choice", '"createCommunity" | "joinInvite" | "mentionFeed"'],
];

function read(path) {
  return readFileSync(resolve(path), "utf8");
}

function findMatching(source, openIndex, open, close) {
  let depth = 0;
  let quote = null;
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === open) depth += 1;
    if (character === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`Unclosed ${open}${close} group.`);
}

function splitTopLevel(source, delimiter = ",") {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if ("({[".includes(character)) depth += 1;
    if (")}]".includes(character)) depth -= 1;
    if (character === delimiter && depth === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(source.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function parseSqlFields(source) {
  return splitTopLevel(source).map((item) => {
    const match = item.match(/^([a-z_][a-z0-9_]*)\s+([a-z][a-z0-9_]*(?:\[\])?)/i);
    if (!match) throw new Error(`Could not parse SQL field: ${item}`);
    return [match[1], match[2].toLowerCase()];
  });
}

function parseSqlContract(source) {
  const functionMatch = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${RPC_NAME}\\s*\\(`, "i").exec(source);
  if (!functionMatch) return null;

  const argsOpen = functionMatch.index + functionMatch[0].length - 1;
  const argsClose = findMatching(source, argsOpen, "(", ")");
  const returnsMatch = /returns\s+table\s*\(/i.exec(source.slice(argsClose));
  if (!returnsMatch) throw new Error(`${RPC_NAME} must return a table.`);
  const returnsOpen = argsClose + returnsMatch.index + returnsMatch[0].length - 1;
  const returnsClose = findMatching(source, returnsOpen, "(", ")");
  const bodyMarker = /\bas\s+\$\$/i.exec(source.slice(returnsClose));
  if (!bodyMarker) throw new Error(`${RPC_NAME} must have a SQL function body.`);
  const header = source.slice(functionMatch.index, returnsClose + bodyMarker.index);

  return {
    args: parseSqlFields(source.slice(argsOpen + 1, argsClose)),
    returns: parseSqlFields(source.slice(returnsOpen + 1, returnsClose)),
    header,
  };
}

function parseTypeFields(source) {
  return [...source.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:\s*([^;]+);/gm)].map((match) => [
    match[1],
    match[2].replace(/\s+/g, " ").trim(),
  ]);
}

function parseTypeContract(source) {
  const rpcMatch = new RegExp(`${RPC_NAME}:\\s*\\{`, "m").exec(source);
  if (!rpcMatch) throw new Error(`Missing ${RPC_NAME} in generated database types.`);
  const rpcOpen = rpcMatch.index + rpcMatch[0].lastIndexOf("{");
  const rpcClose = findMatching(source, rpcOpen, "{", "}");
  const block = source.slice(rpcOpen + 1, rpcClose);

  const argsMatch = /Args\s*:\s*\{/.exec(block);
  if (!argsMatch) throw new Error(`${RPC_NAME} generated type has no Args object.`);
  const argsOpen = argsMatch.index + argsMatch[0].lastIndexOf("{");
  const argsClose = findMatching(block, argsOpen, "{", "}");
  const returnsMatch = /Returns\s*:\s*Array\s*<\s*\{/.exec(block);
  if (!returnsMatch) throw new Error(`${RPC_NAME} generated type has no row return type.`);
  const returnsOpen = returnsMatch.index + returnsMatch[0].lastIndexOf("{");
  const returnsClose = findMatching(block, returnsOpen, "{", "}");

  return {
    args: parseTypeFields(block.slice(argsOpen + 1, argsClose)),
    returns: parseTypeFields(block.slice(returnsOpen + 1, returnsClose)),
  };
}

function parseClientPayload(source) {
  const rpcMatch = new RegExp(`client\\.rpc\\(\\s*["']${RPC_NAME}["']\\s*,\\s*\\{`, "m").exec(source);
  if (!rpcMatch) throw new Error(`Missing ${RPC_NAME} client RPC call.`);
  const payloadOpen = rpcMatch.index + rpcMatch[0].lastIndexOf("{");
  const payloadClose = findMatching(source, payloadOpen, "{", "}");
  return splitTopLevel(source.slice(payloadOpen + 1, payloadClose))
    .map((property) => {
      const match = property.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (!match) throw new Error(`Could not parse RPC payload property: ${property}`);
      return match[1];
    });
}

const migrationDirectory = resolve("supabase/migrations");
const contracts = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => ({ name, source: read(`supabase/migrations/${name}`) }))
  .map((migration) => ({ ...migration, contract: parseSqlContract(migration.source) }))
  .filter((migration) => migration.contract);

assert.ok(contracts.length > 0, `${RPC_NAME} is missing from migrations.`);
const latest = contracts.at(-1);
const onboardingService = read("src/services/onboarding/onboardingService.ts");
const clientPayload = parseClientPayload(onboardingService);
const generatedType = parseTypeContract(read("src/services/supabase/database.types.ts"));
const expectedArgNames = EXPECTED_ARGS.map(([name]) => name);
const expectedReturnNames = EXPECTED_RETURN_FIELDS.map(([name]) => name);
const flow = read("src/components/onboarding/OnboardingFlow.tsx");
const finishStart = flow.indexOf("const finish = async () => {");
const finishEnd = flow.indexOf("\n  const finishLabel", finishStart);
const finishBlock = flow.slice(finishStart, finishEnd);
const failureBranch = finishBlock.indexOf("if (!result.ok)");
const failureReturn = finishBlock.indexOf("return;", failureBranch);
const clearDraft = finishBlock.indexOf("onboardingDraftStore.clear(userId)");

assert.notEqual(latest.name, "20260711150900_auth_profile_onboarding_production.sql", "A new additive reconciliation migration is required.");
assert.deepEqual(latest.contract.args, EXPECTED_ARGS, "SQL RPC argument names, order, and types drifted from the canonical contract.");
assert.deepEqual(latest.contract.returns, EXPECTED_RETURN_FIELDS, "SQL RPC return contract drifted from the canonical contract.");
assert.deepEqual(clientPayload, expectedArgNames, "Client RPC payload must exactly match canonical SQL arguments.");
assert.deepEqual(generatedType.args, EXPECTED_TYPE_ARGS, "Generated type argument signature must exactly match the canonical SQL contract.");
assert.deepEqual(generatedType.returns, EXPECTED_TYPE_RETURN_FIELDS, "Generated type return signature must exactly match the canonical SQL contract.");
assert.deepEqual(generatedType.args.map(([name]) => name), expectedArgNames, "Generated type argument names must match canonical SQL arguments.");
assert.deepEqual(generatedType.returns.map(([name]) => name), expectedReturnNames, "Generated type return fields must match canonical SQL return fields.");
assert.ok(/security\s+definer/i.test(latest.contract.header), "RPC must remain SECURITY DEFINER.");
assert.ok(/set\s+search_path\s*=\s*pg_catalog\s*,\s*public\s*,\s*extensions/i.test(latest.contract.header), "RPC must use the hardened search_path.");
assert.ok(
  new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${RPC_NAME}\\(jsonb,\\s*uuid\\[\\],\\s*text,\\s*text,\\s*text\\)\\s+from\\s+public,\\s*anon,\\s*service_role`, "i").test(latest.source),
  "RPC must explicitly revoke PUBLIC, anon, and service_role execution.",
);
assert.ok(
  new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${RPC_NAME}\\(jsonb,\\s*uuid\\[\\],\\s*text,\\s*text,\\s*text\\)\\s+to\\s+authenticated`, "i").test(latest.source),
  "RPC must explicitly grant execution only to authenticated users.",
);
assert.ok(
  new RegExp(`drop\\s+function\\s+if\\s+exists\\s+public\\.${RPC_NAME}\\(jsonb,\\s*uuid\\[\\],\\s*text\\)`, "i").test(latest.source),
  "Reconciliation must remove the historical three-argument overload.",
);
assert.ok(
  new RegExp(`drop\\s+function\\s+if\\s+exists\\s+public\\.${RPC_NAME}\\(jsonb,\\s*uuid\\[\\],\\s*text,\\s*text\\)`, "i").test(latest.source),
  "Reconciliation must remove any partial four-argument overload.",
);
assert.ok(
  new RegExp(`drop\\s+function\\s+if\\s+exists\\s+public\\.${RPC_NAME}\\(jsonb,\\s*uuid\\[\\],\\s*text,\\s*text,\\s*text\\)`, "i").test(latest.source),
  "Reconciliation must remove the stale five-argument overload before creating the canonical one.",
);
assert.ok(/normalized_start_choice\s*=\s*'joinInvite'\s+and\s+normalized_invite_code\s+is\s+null/i.test(latest.source), "Join-invite onboarding must require a non-empty invite intent.");
assert.ok(!/accept_community_invite\s*\(/i.test(latest.source), "Onboarding completion must not accept invites inside the profile transaction.");
assert.ok(/target_invite_code:\s*input\.inviteCode\?\.trim\(\)\s*\|\|\s*null/.test(onboardingService), "Client must send invite intent as an explicit null when absent.");
assert.ok(/if\s*\(error\s*\|\|\s*!persisted\?\.completed\)/.test(onboardingService), "Client must fail closed when the RPC does not confirm completion.");
assert.ok(finishStart >= 0 && finishEnd > finishStart, "Onboarding finish flow is missing.");
assert.ok(failureBranch >= 0 && failureReturn > failureBranch && clearDraft > failureReturn, "RPC failures must return before local onboarding drafts are cleared.");
assert.ok(clearDraft < finishBlock.indexOf("await onComplete"), "Local onboarding drafts must clear only after successful RPC completion and before post-finish navigation.");

console.log(`Onboarding RPC contract regression passed (${latest.name}).`);
