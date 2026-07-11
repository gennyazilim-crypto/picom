import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [
  ["src/types/audio.ts", "radio_ended"],
  ["src/components/audio/AudioFeedCard.tsx", "Open in Radio"],
  ["src/components/audio/AudioFeedCard.tsx", "VerifiedBadge"],
  ["src/components/audio/ProfileAudioSections.tsx", "radioService.saveRadio"],
  ["src/components/audio/ProfileAudioSections.tsx", "communityNavigationService.rememberRadioSession"],
  ["src/services/advancedSearchService.ts", "radioSessionId"],
  ["src/services/deepLinkService.ts", "picom://radio/"],
  ["src/services/audio/audioFeedReadStateService.ts", "audio_feed_read_states"],
  ["src/services/audio/radioScheduleReminderService.ts", "radioSessionId: session.id"],
  ["supabase/migrations/20260711001500_radio_feed_profile_community_integration.sql", "users mark visible audio feed items read"],
];
for (const [file, token] of checks) if (!read(file).includes(token)) throw new Error(file + " is missing integration contract: " + token);
const app = read("src/App.tsx");
if (!app.includes('result.category === "Radio"') || !app.includes('action.type === "radio"')) throw new Error("App Radio search/deep-link routing contract is incomplete.");
console.log("Radio feed, profile, search, notification, and deep-link integration smoke passed.");
