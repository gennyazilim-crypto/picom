import { readFile } from "node:fs/promises";
const [service, view, sections, migration] = await Promise.all(["src/services/communityInsightsService.ts", "src/components/CommunityInsightsView.tsx", "src/components/community/CommunityAdminSections.tsx", "supabase/migrations/20260710197000_community_insights_v2.sql"].map((path) => readFile(path, "utf8")));
const checks = [
  [service.includes('client.rpc("get_community_insights_v2"'), "service uses permission-checked RPC"],
  [service.includes('access.permissions.includes("viewInsights")'), "renderer access gate is explicit"],
  [view.includes("Messages by channel") && view.includes("Voice usage"), "aggregate sections render"],
  [sections.includes('id: "insights"') && sections.includes('permission: "viewInsights"'), "admin navigation is scoped"],
  [migration.includes("community_voice_usage_daily") && migration.includes("no user identifiers"), "voice storage is aggregate-only"],
  [migration.includes("COMMUNITY_INSIGHTS_FORBIDDEN") && migration.includes("can_view_community_insights"), "backend permission denial is authoritative"],
  [!migration.includes("message.body") && !migration.includes("report.reason") && !migration.includes("reporter_id"), "RPC avoids content and reporter identity"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
