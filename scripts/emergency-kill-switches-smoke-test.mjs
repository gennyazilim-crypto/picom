import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const files = {
  service: "src/services/emergencyKillSwitchService.ts",
  remoteConfig: "src/services/remoteConfigService.ts",
  edge: "supabase/functions/client-config/index.ts",
  doc: "docs/emergency-kill-switches.md",
  remoteConfigDoc: "docs/remote-config.md",
  featureFlagsDoc: "docs/feature-flags.md",
  releaseChecklist: "docs/release-checklist.md",
  packageJson: "package.json",
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

const required = {
  service: [
    "EMERGENCY_KILL_SWITCH_KEYS",
    "disableRealtime",
    "disableUploads",
    "disableVoiceRooms",
    "disableDiscovery",
    "disableWebhooks",
    "disableBots",
    "disableNativeNotifications",
    "disableAutoUpdate",
    "disableMessageEditing",
    "disableInvites",
    "VITE_EMERGENCY_KILL_SWITCHES",
    "getFeatureAvailability",
    "shouldShowEntryPoint",
    "applyRemoteConfig",
    "sanitizeOverrides",
  ],
  remoteConfig: [
    "EmergencyKillSwitchOverrides",
    "emergencyKillSwitchService.applyRemoteConfig",
    "killSwitches",
  ],
  edge: [
    "killSwitches",
    "PICOM_DISABLE_REALTIME",
    "PICOM_DISABLE_UPLOADS",
  ],
  doc: [
    "Emergency Kill Switch Foundation",
    "not a security boundary",
    "VITE_EMERGENCY_KILL_SWITCHES",
    "Remote config shape",
    "Operator workflow placeholder",
  ],
  remoteConfigDoc: ["killSwitches", "PICOM_DISABLE_REALTIME"],
  featureFlagsDoc: ["emergencyKillSwitchService.getFeatureAvailability"],
  releaseChecklist: ["npm run emergency:kill-switches:smoke"],
  packageJson: ["emergency:kill-switches:smoke"],
};

const missing = [];
for (const [key, phrases] of Object.entries(required)) {
  for (const phrase of phrases) {
    if (!text[key].includes(phrase)) {
      missing.push(`${files[key]} missing: ${phrase}`);
    }
  }
}

const forbidden = [/\bsk-[A-Za-z0-9]{12,}/, /SERVICE_ROLE\s*=\s*[^<\s]/i, /LIVEKIT_API_SECRET\s*=\s*[^<\s]/i, /password\s*[:=]\s*['\"][^'\"]+['\"]/i];
const allText = Object.values(text).join("\n");
for (const pattern of forbidden) {
  if (pattern.test(allText)) {
    missing.push(`forbidden secret-like text matched: ${pattern}`);
  }
}

if (missing.length > 0) {
  console.error("Emergency kill switch smoke test failed:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Emergency kill switch smoke test passed.");
