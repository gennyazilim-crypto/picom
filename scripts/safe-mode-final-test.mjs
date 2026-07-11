import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const assert = (condition, message) => { if (!condition) throw new Error(message); };

class MemoryStorage {
  #values = new Map();
  get length() { return this.#values.size; }
  key(index) { return [...this.#values.keys()][index] ?? null; }
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(String(key)); }
  keys() { return [...this.#values.keys()]; }
}

const storage = new MemoryStorage();
let reloadCount = 0;
let cacheClearCount = 0;
let logExportCount = 0;
const windowObject = { location: { search: "", reload: () => { reloadCount += 1; } } };
const context = vm.createContext({ console, Date, URLSearchParams, localStorage: storage, window: windowObject });

function loadTypeScriptModule(path, imports = {}) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const wrapper = vm.runInContext(`(function(require, module, exports) { ${output}\n})`, context, { filename: path });
  wrapper((id) => {
    if (Object.prototype.hasOwnProperty.call(imports, id)) return imports[id];
    throw new Error(`Unexpected test import: ${id}`);
  }, module, module.exports);
  return module.exports;
}

const settingsModule = loadTypeScriptModule("src/services/settingsService.ts", {
  "./dataSourceService": { dataSourceService: { getStatus: () => ({ isMock: true, isSupabase: false }) } },
  "./supabase/supabaseClient": { getSupabaseClient: () => null },
});
const loggingMock = { loggingService: { logWarn: () => undefined, exportLogs: () => { logExportCount += 1; return JSON.stringify({ entries: [], redacted: true }); } } };
const cacheMock = { cacheManagementService: { clearAllNonEssentialCache: async () => { cacheClearCount += 1; return { message: "Non-essential cache cleared." }; } } };
const safeModeModule = loadTypeScriptModule("src/services/safeModeService.ts", {
  "./cacheManagementService": cacheMock,
  "./loggingService": loggingMock,
  "./settingsService": settingsModule,
});
const { settingsService } = settingsModule;
const { safeModeService } = safeModeModule;

storage.setItem("picom.auth.session", "preserved-session-marker");
storage.setItem("picom-settings", "{broken-json");
const recoveredSettings = settingsService.getSettings();
assert(recoveredSettings.theme === "light", "Corrupted settings did not reset to safe defaults");
assert(storage.getItem("picom-settings") === null, "Corrupted settings payload was not removed");
assert(storage.keys().some((key) => key.startsWith("picom-settings.backup.")), "Corrupted settings backup was not created");

let state = safeModeService.getStartupState();
assert(state.active && state.reason === "corrupted_settings_placeholder", "Corrupted settings did not force Safe Mode");
assert(state.disabledServices.includes("Voice paused") && state.disabledServices.includes("Realtime paused"), "Optional service pause list is incomplete");

await safeModeService.resetSettings();
await safeModeService.clearCache();
const exportResult = safeModeService.exportLogs();
assert(cacheClearCount === 1 && exportResult.ok && logExportCount === 1, "Safe Mode recovery actions failed");
assert(storage.getItem("picom.auth.session") === "preserved-session-marker", "Safe Mode recovery cleared auth state");

safeModeService.exitSafeMode();
assert(!safeModeService.getStartupState().active, "Safe Mode flags were not cleared");
assert(!safeModeService.recordStartupCrash().active, "A single crash should not force Safe Mode");
state = safeModeService.recordStartupCrash();
assert(state.active && state.reason === "repeated_startup_crash", "Repeated crash threshold did not activate Safe Mode");
assert(!safeModeService.recordStartupStable().active, "Stable startup did not reset the crash loop");

safeModeService.enableSafeMode("manual_flag");
safeModeService.restartNormally();
assert(reloadCount === 1, "Restart normally must trigger exactly one renderer reload");
assert(!safeModeService.getStartupState().active, "Restart normally left Safe Mode active");
assert(storage.getItem("picom:safe-mode:startup-crash-count") === null, "Restart normally left a crash-loop counter");
assert(storage.getItem("picom.auth.session") === "preserved-session-marker", "Restart normally cleared auth state");

windowObject.location.search = "?safeMode";
assert(safeModeService.getStartupState().reason === "query_flag", "Query Safe Mode flag was not honored");
windowObject.location.search = "";
assert(!safeModeService.getStartupState().active, "Safe Mode remained active after explicit query flag removal");

const main = readFileSync("src/main.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
assert(main.includes("if (safeModeActive) return") && main.includes("if (!safeMode.active)"), "Startup optional services are not fully guarded");
assert(app.includes("if (safeMode.active) {\n      setVoiceSnapshot(initialVoiceSnapshot)") && app.includes("safeMode.active || !authSession"), "Renderer optional voice/remote paths are not guarded");

console.log("Safe Mode final behavioral and structural test passed.");
