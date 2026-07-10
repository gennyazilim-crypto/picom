import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const rail = fs.readFileSync("src/components/FeedCompanionRail.tsx", "utf8");
const feed = fs.readFileSync("src/components/MentionFeedMain.tsx", "utf8");

if (app.includes("feedVoiceState") || app.includes("setFeedVoiceState")) throw new Error("Feed mini card still uses isolated mock voice state");
for (const needle of ["voiceState={voiceSnapshot}", "voiceService.setMuted", "voiceService.setDeafened", "voiceService.leave"]) {
  if (!app.includes(needle)) throw new Error(`App voice mini integration is missing ${needle}`);
}
for (const needle of ["VoiceServiceSnapshot", 'voiceState.status !== "connected"', "voiceState.participants.length", "voiceState.muted", "voiceState.deafened"]) {
  if (!rail.includes(needle)) throw new Error(`Voice mini card is missing ${needle}`);
}
if (!feed.includes("VoiceServiceSnapshot")) throw new Error("Mention feed does not accept the production voice snapshot");

console.log("Voice mini card production integration smoke passed.");
