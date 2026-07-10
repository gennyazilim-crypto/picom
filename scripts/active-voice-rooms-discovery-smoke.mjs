import fs from "node:fs";

const service = fs.readFileSync("src/services/activeVoiceRoomDiscoveryService.ts", "utf8");
const rail = fs.readFileSync("src/components/FeedCompanionRail.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

for (const needle of ["getCommunityAccess", "canViewChannel", 'channel.type !== "voice"', "access.canViewMemberList", "access.isMember", "dataSourceService.getStatus().isMock"]) {
  if (!service.includes(needle)) throw new Error(`Voice room discovery safety is missing ${needle}`);
}
if (!rail.includes("Active voice rooms") || !rail.includes("room.canJoin")) throw new Error("Feed rail voice room section is incomplete");
if (!app.includes("activeVoiceRoomDiscoveryService.getVisibleRooms") || !app.includes("openDiscoveredVoiceRoom")) throw new Error("App voice room discovery integration is missing");

console.log("Active voice rooms discovery smoke passed.");
