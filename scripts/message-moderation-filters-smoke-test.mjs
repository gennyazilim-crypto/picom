import { readFileSync } from "node:fs";

const service = readFileSync("src/services/messageModerationFilterService.ts", "utf8");
const component = readFileSync("src/components/MessageModerationFiltersPanel.tsx", "utf8");
const sidebar = readFileSync("src/components/CommunitySidebar.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260710003800_advanced_moderation_filters.sql", "utf8");

const failures = [];

if (!service.includes("blockedWords")) failures.push("Moderation service should support blocked words.");
if (!service.includes("maxMentionsPerMessage")) failures.push("Moderation service should support mention limits.");
if (!service.includes("checkMessage")) failures.push("Moderation service should expose checkMessage().");
if (!component.includes("server-side Supabase enforcement")) failures.push("Moderation UI should identify the backend enforcement boundary.");
if (!component.includes("canManageModeration")) failures.push("Moderation UI should remain role gated.");
if (!sidebar.includes("MessageModerationFiltersPanel")) failures.push("CommunitySidebar should mount moderation filters panel.");
if (!app.includes("messageModerationFilterService.checkMessage")) failures.push("Message send should check moderation filters before sending.");
if (!migration.includes("messages_moderation_guard") || !migration.includes("enable row level security")) failures.push("Supabase moderation trigger/RLS migration should exist.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Message moderation filters smoke passed.");
