import { readFileSync } from "node:fs";

const read = (filePath) => readFileSync(filePath, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const modal = read("src/components/CreateCommunityModal.tsx");
for (const marker of [
  'useState<CommunityKind | null>("text")',
  'kind: "text"',
  'kind: "radio"',
  'kind: "podcast"',
  "Text Community",
  "Radio Community",
  "Podcast Community",
  "Community name",
  "iconFile?: File",
  'visibility: "public" | "secret"',
  "publicReadEnabled",
  "templateId",
  "CreateCommunitySubmitResult",
  "Radio and Podcast are locked for now.",
]) assert(modal.includes(marker), `Typed community wizard is missing ${marker}`);
assert(!modal.includes("placeholder toast"), "Typed community wizard contains a raw placeholder path");

const service = read("src/services/communityService.ts");
for (const marker of ["iconUrl?: string | null", 'visibility?: "public" | "private"', "publicReadEnabled?: boolean", "icon_url: iconUrl", "visibility,", "public_read_enabled: publicReadEnabled"]) assert(service.includes(marker), `Community service is missing ${marker}`);

const app = read("src/App.tsx");
for (const marker of [
  "CreateCommunityFormValue",
  "CreateCommunitySubmitResult",
  "communityService.createCommunity({ ...createInput, iconUrl })",
  "communityViewForKind(community.kind)",
  'completion.startChoice === "createCommunity"',
  "setCreateCommunityOpen(true)",
]) assert(app.includes(marker), `App typed creation integration is missing ${marker}`);

const factory = read("src/utils/communityFactory.ts");
assert(factory.includes("supportsTextChannels(summary.kind)"), "Non-text community factory still prepares text channels");
const audioView = read("src/components/audio/CommunityAudioView.tsx");
assert(audioView.includes('community.kind === "podcast" ? "podcasts" : "live"'), "Created Podcast/Radio shell does not select the correct initial tab");
const onboarding = read("src/components/onboarding/OnboardingStepCommunity.tsx");
for (const kind of ["Text", "Radio", "Podcast"]) assert(onboarding.includes(kind), `Onboarding create choice does not explain ${kind}`);

const css = read("src/components/CreateCommunityModal.css");
for (const marker of [".community-kind-grid", ".community-kind-card", "var(--accent)", "var(--border)", "var(--text-primary)", ":focus-visible", "prefers-reduced-motion"]) assert(css.includes(marker), `Typed wizard CSS is missing ${marker}`);
assert(!/#[0-9a-f]{3,8}\b/iu.test(css), "Typed wizard CSS contains a hardcoded color");

console.log("Typed Text/Radio/Podcast community creation wizard contract passed.");
