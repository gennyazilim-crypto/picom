import { readFileSync } from "node:fs";

const files = {
  migration: readFileSync("supabase/migrations/20260711002500_dm_privacy_safety_full_mvp.sql", "utf8"),
  safety: readFileSync("src/services/directMessages/directSafetyService.ts", "utf8"),
  blocking: readFileSync("src/services/userBlockingService.ts", "utf8"),
  reports: readFileSync("src/services/reportService.ts", "utf8"),
  modal: readFileSync("src/components/ReportModal.tsx", "utf8"),
  dm: readFileSync("src/components/DirectMessagesView.tsx", "utf8"),
  settings: readFileSync("src/components/SettingsModal.tsx", "utf8"),
  app: readFileSync("src/App.tsx", "utf8"),
};

for (const marker of ["get_direct_message_privacy", "update_direct_message_privacy", "submit_safety_report", "REPORT_RATE_LIMITED", "direct_messages_user_rate_limit", "users_are_blocked", "reports_requester_select", "public.is_app_admin()", "revoke insert on public.reports"]) if (!files.migration.includes(marker)) throw new Error(`DM safety migration is missing ${marker}`);
for (const marker of ["everyone", "friends", "no_one", "getDirectMutedUntil", "updatePrivacy"]) if (!files.safety.includes(marker)) throw new Error(`DM safety service is missing ${marker}`);
for (const marker of ["subscribe", "notifyBlockedUsersChanged", "refreshRemoteBlocks"]) if (!files.blocking.includes(marker)) throw new Error(`Block synchronization is missing ${marker}`);
for (const marker of ["direct_message", "conversationId", "submit_safety_report", "recentCount >= 5"]) if (!files.reports.includes(marker) && !files.modal.includes(marker)) throw new Error(`DM reporting is missing ${marker}`);
for (const marker of ["Mute notifications", "Confirm block", "Report direct message", "onReportMessage", "getDirectMutedUntil"]) if (!files.dm.includes(marker)) throw new Error(`DM safety UI is missing ${marker}`);
for (const marker of ["Who can start a direct message", "directMessagePrivacy", "Blocked users"]) if (!files.settings.includes(marker)) throw new Error(`Privacy & Safety integration is missing ${marker}`);
for (const marker of ["userBlockingService.subscribe", "conversationId", 'targetType: "direct_message"']) if (!files.app.includes(marker)) throw new Error(`App safety wiring is missing ${marker}`);
if (/conversation\.messages\.(map|filter).*submitReport/s.test(files.reports)) throw new Error("Report service must not attach a full DM transcript.");
console.log("Direct-message privacy, block, report, and safety smoke passed.");
