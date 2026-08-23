import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rendererEntry = readFileSync("src/main.tsx", "utf8");
const panelEntry = readFileSync("src/components/rootDashboard/PanelEntryButton.tsx", "utf8");

assert.match(panelEntry, /useTranslation\("admin"\)/, "admin panel entry must use its translated labels");
assert.match(rendererEntry, /<I18nProvider locale=\{startupLocale\}>[\s\S]*<DesktopRendererRoot \/>/, "renderer root must always provide translations before rendering app shells");

console.log("i18n root provider smoke: PASS");
