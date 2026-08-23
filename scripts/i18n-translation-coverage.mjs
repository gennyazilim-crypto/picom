/**
 * i18n translation coverage gate.
 *
 * The existing catalog-integrity smoke verifies STRUCTURE (every locale has every
 * namespace and every key). It passes even when a locale's values are verbatim English,
 * which is exactly how ~290 of 553 keys per locale shipped untranslated without any
 * check failing.
 *
 * This gate closes that hole: it fails when a non-English locale's value is byte-identical
 * to the English source, unless the value is a brand term, a pure-placeholder string, or an
 * explicitly reviewed loanword for that specific locale.
 *
 * Usage: node scripts/i18n-translation-coverage.mjs [--report]
 *   --report lists every offending key instead of the first 40.
 * Exit code 1 on any unreviewed identical value.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const LOCALES_DIR = path.join(process.cwd(), "src", "i18n", "locales");
const SOURCE_LOCALE = "en";

/**
 * Product and brand terms that stay identical in every locale by design.
 * Adding to this list means "this string is intentionally never translated anywhere".
 */
const BRAND_VALUES = new Set([
  "Picom",
  "PICOM",
  "PICOM DESKTOP",
  "HAVOOC",
  "HAVOOC Support Hub",
  "havooc",
  "Kickstarter",
  "LIVE NOW",
  "Live Now",
  "DM",
  "Google",
  "Outlook",
  "ICS / Google / Outlook",
]);

/**
 * Per-locale keys whose English value is genuinely the correct word in that language
 * (loanwords and shared spellings), reviewed one by one. A key listed here for `de` is
 * still required to be translated in every other locale.
 */
const REVIEWED_IDENTICAL = {
  de: [
    "auth:login.legal.support",
    "auth:hero.preview.voice.channel",
    "common:status.offline",
    "common:status.online",
    "common:communitySettings.banner",
    "common:communitySettings.name",
    "common:communitySettings.categoryDesign",
    "common:communitySettings.categoryGaming",
    "common:onboarding.stepTheme",
    "common:onboarding.stepCommunity",
    "common:onboarding.optional",
    "common:communityAdmin.events",
    "common:communityAdmin.moderation",
    "community:discovery.category.design",
    "community:discovery.category.gaming",
    "feed:live.count.one",
    "feed:live.count.other",
    "feed:live.communityFallback",
    "feed:live.category.chat",
    "feed:live.category.other",
    "havooc:hub.factWebsite",
    "havooc:hub.roadmapTitle",
    "navigation:nav.feed.label",
    "navigation:nav.communities.label",
    "navigation:nav.live.label",
    "navigation:nav.radio.label",
    "navigation:nav.podcasts.label",
    "navigation:nav.events.label",
    "messaging:sidebar.chats",
    "messaging:list.live",
    "messaging:status.online",
    "messaging:status.offline",
    "events:calendar.agenda",
    "events:field.community",
    "events:header.title",
    "events:location.community",
    "events:status.live",
    "events:type.livestream",
    "events:type.meeting",
    "events:type.social",
    "events:type.video",
    "events:type.workshop",
    "events:wizard.step.details",
    "firstLaunch:theme.system",
    "feed:tabs.feed",
  ],
  es: [
    "common:boolean.no",
    "common:communitySettings.banner",
    "common:communityAdmin.general",
    "common:communityAdmin.roles",
    "feed:live.category.chat",
    "navigation:nav.feed.label",
    "navigation:nav.radio.label",
    "navigation:nav.podcasts.label",
    "messaging:sidebar.chats",
    "events:calendar.agenda",
    "events:community.personal",
    "events:type.general",
    "events:type.social",
    "feed:tabs.feed",
  ],
  fr: [
    "common:communitySettings.description",
    "common:communitySettings.mentions",
    "common:communitySettings.categoryDesign",
    "common:communityAdmin.structure",
    "common:communityAdmin.messages",
    "common:profile.message",
    "community:discovery.category.design",
    "errors:recovery.type",
    "feed:live.category.other",
    "havooc:hub.statNotes",
    "navigation:nav.radio.label",
    "navigation:nav.podcasts.label",
    "navigation:settings.Notifications",
    "messaging:sidebar.title",
    "events:calendar.agenda",
    "events:detail.actions",
    "events:field.description",
    "events:field.type",
    "events:type.social",
    "events:visibility.public",
    "events:visibility.secret",
    "events:wizard.step.audience",
    "firstLaunch:permissions.notifications",
    "live:controls.volume",
  ],
  it: [
    "auth:field.password",
    "auth:login.legal.privacy",
    "common:status.offline",
    "common:status.online",
    "common:boolean.no",
    "common:communitySettings.banner",
    "common:communitySettings.categoryDesign",
    "common:onboarding.stepCommunity",
    "community:discovery.category.design",
    "feed:live.count.one",
    "feed:live.count.other",
    "feed:live.communityFallback",
    "feed:live.category.chat",
    "feed:live.category.other",
    "havooc:hub.roadmapTitle",
    "navigation:nav.feed.label",
    "navigation:nav.live.label",
    "navigation:nav.radio.label",
    "navigation:settings.Account",
    "messaging:status.online",
    "messaging:status.offline",
    "events:calendar.agenda",
    "events:field.community",
    "events:location.community",
    "events:type.social",
    "events:type.video",
    "events:type.workshop",
    "live:controls.volume",
    "live:controls.pip",
    "feed:tabs.feed",
    "feed:posts.count.one",
  ],
  nl: [
    "auth:login.legal.privacy",
    "auth:login.legal.support",
    "auth:hero.preview.voice.channel",
    "common:status.offline",
    "common:status.online",
    "common:count.items.one",
    "common:count.items.other",
    "common:communitySettings.banner",
    "common:communitySettings.categoryGaming",
    "common:onboarding.stepCommunity",
    "community:discovery.openToJoin",
    "errors:recovery.type",
    "feed:live.count.one",
    "feed:live.count.other",
    "feed:live.communityFallback",
    "feed:live.category.game",
    "feed:live.category.chat",
    "feed:live.category.other",
    "havooc:hub.statusPill",
    "havooc:hub.factWebsite",
    "havooc:hub.roadmapTitle",
    "navigation:nav.feed.label",
    "navigation:nav.live.label",
    "navigation:nav.radio.label",
    "navigation:nav.podcasts.label",
    "navigation:settings.Account",
    "messaging:sidebar.chats",
    "messaging:list.live",
    "messaging:list.statusAria",
    "messaging:status.online",
    "messaging:status.offline",
    "events:calendar.agenda",
    "events:calendar.week",
    "events:field.community",
    "events:field.type",
    "events:location.community",
    "events:status.live",
    "events:type.livestream",
    "events:type.video",
    "events:type.workshop",
    "events:wizard.step.details",
    "live:controls.volume",
    "feed:tabs.feed",
  ],
  pl: [
    "common:status.offline",
    "common:status.online",
    "navigation:nav.radio.label",
    "messaging:status.online",
    "messaging:status.offline",
    "events:calendar.agenda",
    "feed:posts.count.one",
  ],
  pt: [
    "common:count.items.one",
    "common:communitySettings.banner",
    "common:communitySettings.categoryDesign",
    "community:discovery.category.design",
    "navigation:nav.feed.label",
    "navigation:nav.podcasts.label",
    "events:calendar.agenda",
    "events:type.social",
    "events:type.workshop",
    "live:controls.volume",
    "live:controls.pip",
    "feed:tabs.feed",
  ],
  ru: [],
  tr: [
    "events:type.video",
  ],
};

/** A value carrying no translatable text (pure interpolation, punctuation, or digits). */
function hasNoTranslatableText(value) {
  return !/[a-zA-ZÀ-ɏЀ-ӿ]/.test(value.replace(/\{\{[^}]*\}\}/g, ""));
}

function flatten(node, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

function loadLocale(locale) {
  const dir = path.join(LOCALES_DIR, locale);
  const catalog = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const namespace = file.slice(0, -".json".length);
    catalog[namespace] = flatten(JSON.parse(readFileSync(path.join(dir, file), "utf8")));
  }
  return catalog;
}

const reportAll = process.argv.includes("--report");
const locales = readdirSync(LOCALES_DIR).filter((entry) => entry !== SOURCE_LOCALE);
const source = loadLocale(SOURCE_LOCALE);
const sourceKeyCount = Object.values(source).reduce((sum, ns) => sum + Object.keys(ns).length, 0);

const failures = [];
const summary = [];

for (const locale of locales.sort()) {
  const target = loadLocale(locale);
  const reviewed = new Set(REVIEWED_IDENTICAL[locale] ?? []);
  let translated = 0;
  let exempt = 0;
  const localeFailures = [];

  for (const [namespace, sourceKeys] of Object.entries(source)) {
    for (const [key, sourceValue] of Object.entries(sourceKeys)) {
      if (typeof sourceValue !== "string") continue;
      const targetValue = target[namespace]?.[key];
      // A key present in English but absent here is a gap, not something to skip:
      // silently continuing is how untranslated surfaces stayed invisible before.
      if (typeof targetValue !== "string") {
        localeFailures.push(`${locale}  ${namespace}:${key}  MISSING (en = "${sourceValue}")`);
        continue;
      }
      if (sourceValue !== targetValue) {
        translated += 1;
        continue;
      }
      if (BRAND_VALUES.has(sourceValue) || hasNoTranslatableText(sourceValue) || reviewed.has(`${namespace}:${key}`)) {
        exempt += 1;
        continue;
      }
      localeFailures.push(`${locale}  ${namespace}:${key}  = "${sourceValue}"`);
    }
  }

  failures.push(...localeFailures);
  const covered = translated + exempt;
  summary.push(
    `  ${locale.padEnd(3)} ${String(covered).padStart(4)}/${sourceKeyCount} covered` +
      `  (${translated} translated, ${exempt} intentionally identical, ${localeFailures.length} untranslated)`,
  );
}

console.log(`i18n translation coverage — source "${SOURCE_LOCALE}", ${sourceKeyCount} keys, ${locales.length} target locales`);
console.log(summary.join("\n"));

if (failures.length > 0) {
  console.error(`\ni18n translation coverage: FAIL — ${failures.length} key(s) missing or identical to English.`);
  console.error("Translate them, or add the key to REVIEWED_IDENTICAL / BRAND_VALUES if identical is correct.\n");
  const shown = reportAll ? failures : failures.slice(0, 40);
  console.error(shown.join("\n"));
  if (!reportAll && failures.length > shown.length) {
    console.error(`… ${failures.length - shown.length} more. Re-run with --report for the full list.`);
  }
  process.exit(1);
}

console.log("\ni18n translation coverage: PASS — no unreviewed English values in any target locale.");
