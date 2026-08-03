/**
 * Publisher program i18n parity + hardcoded Turkish/English UI scan.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const {
  PUBLISHER_PROGRAM_LOCALES,
  PUBLISHER_PROGRAM_I18N_KEYS,
  assertPublisherProgramLocaleParity,
  translatePublisherProgram,
} = await import(pathToFileURL(join(root, "src/services/localization/publisherProgramCatalog.ts")).href);

const { SUPPORTED_UI_LANGUAGES } = await import(
  pathToFileURL(join(root, "src/services/localization/uiLanguages.ts")).href
);

test("publisher program catalogs cover 10 locales with identical keys", () => {
  assert.equal(SUPPORTED_UI_LANGUAGES.length, 10);
  const parity = assertPublisherProgramLocaleParity();
  assert.equal(parity.ok, true, parity.ok === false ? parity.detail : "");
  assert.ok(PUBLISHER_PROGRAM_I18N_KEYS.length > 80);
  for (const locale of SUPPORTED_UI_LANGUAGES) {
    for (const key of PUBLISHER_PROGRAM_I18N_KEYS) {
      assert.ok(PUBLISHER_PROGRAM_LOCALES[locale][key].trim().length > 0, `${locale}.${key}`);
    }
  }
});

test("unknown locale normalizes for publisher catalog", () => {
  assert.equal(
    translatePublisherProgram("apply.title", "xx"),
    PUBLISHER_PROGRAM_LOCALES.en["apply.title"],
  );
  assert.match(translatePublisherProgram("apply.title", "tr"), /Başvurusu|başvurusu/i);
});

test("publisher UI components use catalog translator (no hardcoded TR eligibility copy)", () => {
  const files = [
    "src/components/publisher/PublisherApplicationWorkspace.tsx",
    "src/components/publisher/PublisherDashboardWorkspace.tsx",
    "src/components/rootDashboard/modules/PublisherCreatorReviewPage.tsx",
  ];
  for (const rel of files) {
    const src = readFileSync(join(root, rel), "utf8");
    assert.match(src, /translatePublisherProgram/);
    assert.doesNotMatch(src, /Henüz başvuru koşullarını karşılamıyorsunuz/);
    assert.doesNotMatch(src, /language === ["']tr["'] \?/);
  }
});
