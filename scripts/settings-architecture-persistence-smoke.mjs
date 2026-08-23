import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const requireText = (source, value, label) => { if (!source.includes(value)) throw new Error(`${label}: missing ${value}`); };
const rejectText = (source, value, label) => { if (source.includes(value)) throw new Error(`${label}: forbidden ${value}`); };

const service = read("src/services/settingsService.ts");
const modal = read("src/components/SettingsModal.tsx");
const app = read("src/App.tsx");
const migration = read("supabase/migrations/20260711148400_user_settings_persistence.sql");
const localeMigration = read("supabase/migrations/20260804000000_user_settings_preferred_locale.sql");
const databaseTypes = read("src/services/supabase/database.types.ts");

requireText(service, "const currentSchemaVersion = 14", "versioned local schema");
requireText(service, "appearanceSettings", "device-local appearance settings");
for (const scope of ["local-device", "user-account-synced", "community-specific", "server-controlled"]) requireText(service, `\"${scope}\"`, `settings scope ${scope}`);
requireText(service, "localStore(): Storage | null", "safe local storage boundary");
requireText(service, "sessionStore(): Storage | null", "safe session storage boundary");
requireText(service, "importLegacySettings", "legacy theme and first-launch migration");
requireText(service, "settings.firstLaunchSetupCompleted === true", "first-launch state preservation");
requireText(service, "fromVersion: 11", "schema 11 -> 12 first-launch draft migration");
requireText(service, "fromVersion: 12", "schema 12 -> 13 stable first-launch step migration");
requireText(service, "fromVersion: 13", "schema 13 -> 14 appearance studio migration");
requireText(service, "normalizeAccessibilitySettings", "semantic text-size migration");
requireText(service, "resetAppearanceStudio", "scoped appearance reset");
requireText(service, "firstLaunchSetup: \"local-device\"", "device-only first-launch draft");
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

// Language preference: mode is stored separately from the resolved locale, both persist
// locally and sync to Supabase, and remote values are normalized before use.
requireText(service, "languageMode", "separate system/manual language mode");
requireText(service, 'languageMode: LanguageMode = settings.appearanceSettings?.languageMode === "manual"', "language mode normalization");
requireText(service, "resolveSystemUiLanguage(readSystemLocale())", "system-mode locale re-resolution");
requireText(service, "preferred_locale: accountSettings.appearanceSettings.language", "locale upsert to Supabase");
requireText(service, "preferred_locale_mode: accountSettings.appearanceSettings.languageMode", "locale mode upsert to Supabase");
requireText(service, "preferred_locale,preferred_locale_mode", "locale columns selected on hydrate");
requireText(service, "normalizeUiLanguage(result.data.preferred_locale)", "remote locale normalized, never trusted raw");
requireText(service, "fromVersion: 10", "schema 10 -> 11 language mode migration");
requireText(localeMigration, "add column if not exists preferred_locale text not null default 'en'", "idempotent locale column");
requireText(localeMigration, "user_settings_preferred_locale_check", "locale value constraint");
requireText(localeMigration, "user_settings_preferred_locale_mode_check", "locale mode value constraint");
for (const locale of ["'en'", "'tr'", "'de'", "'fr'", "'es'", "'it'", "'pt'", "'nl'", "'pl'", "'ru'"]) {
  requireText(localeMigration, locale, `supported locale ${locale} in check constraint`);
}
requireText(databaseTypes, "preferred_locale", "generated locale database contract");

// The dedicated Language & Region section owns the language control; Appearance must not
// render a duplicate selector.
requireText(service, '"Language & Region"', "Language & Region settings section registered");
rejectText(modal, "listSettingsLanguageOptions(appearanceSettings.language)", "duplicate language selector left in Appearance");
requireText(modal, "LanguageRegionSection", "Language & Region section wired into the settings shell");

console.log("Settings architecture and persistence contract passed.");
