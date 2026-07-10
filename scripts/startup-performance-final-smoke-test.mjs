import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const index = read("index.html");
const bootstrap = read("public/theme-bootstrap.js");
const main = read("src/main.tsx");
const app = read("src/App.tsx");
const docs = read("docs/startup-performance-final.md");

assert(index.includes("/theme-bootstrap.js") && index.indexOf("/theme-bootstrap.js") < index.indexOf("/src/main.tsx"), "Theme bootstrap must run before the renderer entry");
assert(bootstrap.includes('localStorage.getItem("picom-settings")') && bootstrap.includes("document.documentElement.dataset.theme"), "Early theme bootstrap is incomplete");
assert(main.includes("scheduleOptionalRendererServices") && main.includes("requestIdleCallback") && main.includes('import("./services/sleepWakeResumeService")'), "Optional renderer services are not deferred");
assert(main.indexOf("ReactDOM.createRoot") < main.lastIndexOf("scheduleOptionalRendererServices(safeMode.active)"), "Optional services must be scheduled after React render");

for (const component of ["SettingsModal", "OnboardingFlow", "MentionFeedMain", "ProfileView", "DirectMessagesView", "SavedMessagesView", "DiscoveryView", "FriendsView"]) {
  assert(app.includes(`const ${component} = lazy(`), `${component} is not deferred`);
}
assert(app.includes("DeferredViewBoundary") && app.includes("<Suspense fallback={null}>") , "Lazy views and overlays need safe Suspense boundaries");

for (const marker of ["early theme", "optional services", "lazy", "bundle warning", "packaged cold-start"]) {
  assert(docs.toLowerCase().includes(marker), `Startup performance review is missing ${marker}`);
}

console.log("Startup performance structural audit passed; packaged cold-start timing remains a release measurement.");
