import { readFile } from "node:fs/promises";

const [edge, token, service, view, panel, settings, manifest, config, preflight, runbook] = await Promise.all([
  "supabase/functions/admin-health/index.ts",
  "supabase/functions/_shared/livekit-token.ts",
  "src/services/adminOperationsService.ts",
  "src/components/AdminOperationsV2Sections.tsx",
  "src/components/AdminOperationsPanel.tsx",
  "src/services/settingsService.ts",
  "supabase/functions/release-manifest.json",
  "supabase/config.toml",
  "scripts/livekit-self-hosted-preflight.mjs",
  "infra/livekit/README.md",
].map((path) => readFile(path, "utf8")));

const checks = [
  [edge.includes('rpc("is_app_admin")') && edge.includes('rpc("get_admin_system_status_v2")'), "admin health is app-admin protected"],
  [edge.includes("livekit.RoomService/ListRooms") && token.includes("roomList: true"), "LiveKit health uses a short-lived server-admin probe"],
  [edge.includes("PICOM_LIVEKIT_DEPLOYMENT") && edge.includes("PICOM_LIVEKIT_TURN_DOMAIN") && edge.includes("PICOM_LIVEKIT_REDIS_CONFIGURED"), "self-hosted metadata is checked"],
  [service.includes('functions.invoke("admin-health"') && service.includes("getInfrastructureStatus"), "renderer uses the service layer"],
  [view.includes("AdminInfrastructureHealth") && view.includes("30_000"), "dashboard renders and refreshes protected health"],
  [panel.includes("<AdminInfrastructureHealth") && settings.includes('section === "Admin Operations"') === false, "authorized admin dashboard is reachable without becoming public navigation"],
  [manifest.includes('"admin-health"') && config.includes("[functions.admin-health]") && config.includes("verify_jwt = true"), "Edge deployment keeps JWT verification"],
  [preflight.includes("livekit\\.cloud") && preflight.includes("TURN TLS 443") && preflight.includes("WebRTC TCP 7881"), "network preflight rejects Cloud and checks self-hosted ports"],
  [runbook.includes("50000-60000/UDP") && runbook.includes("never commit"), "runbook records firewall and secret boundaries"],
  [!service.includes("LIVEKIT_API_SECRET") && !view.includes("LIVEKIT_API_SECRET") && !panel.includes("LIVEKIT_API_SECRET"), "renderer does not receive provider credentials"],
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console[ok ? "log" : "error"](`${ok ? "PASS" : "FAIL"}: ${label}`);
if (failed.length) process.exit(1);
