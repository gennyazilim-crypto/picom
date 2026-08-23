import { settingsModalEn } from "../src/services/settings/settingsModalEn.ts";
import privacy from "./tr-part-modal-privacy.mjs";
import profile from "./tr-part-modal-profile.mjs";
import notifications from "./tr-part-modal-notifications.mjs";
import voiceCompanionDiag from "./tr-part-modal-voice-companion-diag.mjs";
import advanced from "./tr-part-modal-advanced.mjs";

const merged = {
  ...privacy,
  ...profile,
  ...notifications,
  ...voiceCompanionDiag,
  ...advanced,
};

const missing = Object.keys(settingsModalEn).filter((key) => !merged[key]);
if (missing.length) {
  console.error("Missing modal TR:", missing.length, missing.slice(0, 20));
  process.exit(1);
}

export default merged;
