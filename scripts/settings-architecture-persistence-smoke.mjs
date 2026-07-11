import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const requireText = (source, value, label) => { if (!source.includes(value)) throw new Error(`${label}: missing ${value}`); };
const rejectText = (source, value, label) => { if (source.includes(value)) throw new Error(`${label}: forbidden ${value}`); };

const service = read("src/services/settingsService.ts");
const modal = read("src/components/SettingsModal.tsx");
const app = read("src/App.tsx");
const migration = read("supabase/migrations/20260711148400_user_settings_persistence.sql");
const databaseTypes = read("src/services/supabase/database.types.ts");

requireText(service, "const currentSchemaVersion = 9", "versioned local schema");
requireText(service, "appearanceSettings", "device-local appearance settings");
for (const scope of ["local-device", "user-account-synced", "community-specific", "server-controlled"]) requireText(service, `\"${scope}\"`, `settings scope ${scope}`);
requireText(service, "localStore(): Storage | null", "safe local storage boundary");
requireText(service, "sessionStore(): Storage | null", "safe session storage boundary");
requireText(service, "importLegacySettings", "legacy theme and first-launch migration");
requireText(service, "settings.firstLaunchSetupCompleted === true", "first-launch state preservation");
requireText(service, "byteLength: raw.length", "content-free corruption evidence");
rejectText(service, "raw.slice", "raw corrupted settings retention");
rejectText(service, "corrupted_settings_placeholder", "stale corruption placeholder");
requireText(service, "hydrateAccountSettings", "account settings hydration");
requireText(service, "syncAccountSettings", "account settings synchronization");
requireText(service, 'from("user_settings")', "settings repository table");
requireText(service, "subscribe(listener", "single settings notification source");
rejectText(modal, "sessionStorage", "component ad-hoc settings storage");
rejectText(app, 'sessionStorage.setItem("picom:settings:initial-section"', "App ad-hoc settings storage");
requireText(app, "settingsService.hydrateAccountSettings", "startup account hydration");
requireText(migration, "alter table public.user_settings enable row level security", "settings RLS");
requireText(migration, "user_id=auth.uid()", "owner-only settings policies");
requireText(databaseTypes, "user_settings:", "generated settings database contract");

console.log("Settings architecture and persistence contract passed.");
