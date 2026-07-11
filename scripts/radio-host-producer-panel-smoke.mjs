import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const panel = read("src/components/audio/RadioHostProducerPanel.tsx");
const teamPanel = read("src/components/audio/RadioProductionTeamPanel.tsx");
const shell = read("src/components/audio/RadioCommunityShell.tsx");
const app = read("src/App.tsx");
const source = read("src/services/audio/audioDataSource.ts");
const repository = read("src/services/audio/radioRepository.ts");
const service = read("src/services/audio/radioService.ts");
const cover = read("src/services/audio/radioCoverService.ts");
const migration = read("supabase/migrations/20260711001100_radio_host_producer_controls.sql");
const hierarchyMigration = read("supabase/migrations/20260711001400_radio_roles_moderation_audit.sql");
const detail = read("src/components/audio/RadioPanel.tsx");

const required = [
  [panel, "Create a new schedule", "schedule creation"],
  [panel, "Save changes", "schedule editing"],
  [panel, "Start broadcast", "broadcast start"],
  [panel, "Confirm end", "explicit end confirmation"],
  [panel, "Confirm cancel", "explicit cancel confirmation"],
  [teamPanel, "Co-host", "co-host assignment"],
  [teamPanel, "Confirm removal", "host removal confirmation"],
  [panel, "Cover image", "cover control"],
  [panel, "Listener moderation", "listener moderation"],
  [panel, "Realtime connected", "connection state"],
  [panel, "radioService.", "service-only UI"],
  [shell, "<RadioHostProducerPanel", "shell integration"],
  [app, "currentUser={displayedCurrentUser}", "current user integration"],
  [app, "\"hostRadio\"", "radio host permission gate"],
  [app, "\"manageRadioPrograms\"", "radio admin permission gate"],
  [source, "client.rpc(\"transition_radio_session\"", "atomic transition RPC"],
  [source, "client.rpc(\"assign_radio_session_host\"", "host assignment RPC"],
  [source, "client.rpc(\"moderate_radio_listener\"", "listener moderation RPC"],
  [repository, "moderateListener", "repository moderation boundary"],
  [service, "moderateRadioListener", "service moderation boundary"],
  [cover, "from(\"audio-covers\")", "private cover storage"],
  [migration, "RADIO_TRANSITION_CONFIRMATION_MISMATCH", "server confirmation"],
  [migration, "can_manage_radio_session", "server permission enforcement"],
  [migration, "radio_host_assignment", "host audit event"],
  [migration, "moderation_action", "moderation audit event"],
  [migration, "radio_session_management_audit", "session audit trigger"],
  [hierarchyMigration, "RADIO_HOST_HIERARCHY_DENIED", "host hierarchy enforcement"],
  [hierarchyMigration, "RADIO_LISTENER_HIERARCHY_DENIED", "listener hierarchy enforcement"],
  [detail, "role=\"alertdialog\"", "detail confirmation dialog"],
];
for (const [content, marker, label] of required) {
  if (!content.includes(marker)) throw new Error("Missing " + label + ": " + marker);
}
for (const forbidden of ["getSupabaseClient", "supabase.from(", "console.log", "coming soon"]) {
  if (panel.includes(forbidden)) throw new Error("Host panel bypasses production boundary: " + forbidden);
  if (teamPanel.includes(forbidden)) throw new Error("Production team panel bypasses production boundary: " + forbidden);
}
console.log("Radio host and producer panel smoke test passed.");
