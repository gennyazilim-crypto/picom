import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  LIVE_CHAT_LOCALES,
  LIVE_CHAT_I18N_KEYS,
  assertLiveChatLocaleParity,
  translateLiveChat,
} = await import(pathToFileURL(join(root, "src/services/localization/liveChatCatalog.ts")).href);
const { SUPPORTED_UI_LANGUAGES } = await import(
  pathToFileURL(join(root, "src/services/localization/uiLanguages.ts")).href
);

test("live chat catalogs cover 10 locales with identical keys", () => {
  assert.equal(SUPPORTED_UI_LANGUAGES.length, 10);
  const parity = assertLiveChatLocaleParity();
  assert.equal(parity.ok, true, parity.ok === false ? parity.detail : "");
  assert.ok(LIVE_CHAT_I18N_KEYS.length > 40);
  for (const locale of SUPPORTED_UI_LANGUAGES) {
    for (const key of LIVE_CHAT_I18N_KEYS) {
      assert.ok(LIVE_CHAT_LOCALES[locale][key].trim().length > 0, `${locale}.${key}`);
    }
  }
});

test("live chat translator interpolates and normalizes unknown locale", () => {
  assert.match(translateLiveChat("slowMode.label", "en", { seconds: 30 }), /30/);
  assert.equal(translateLiveChat("liveChat.title", "xx"), LIVE_CHAT_LOCALES.en["liveChat.title"]);
  assert.match(translateLiveChat("liveChat.title", "ar"), /الدردشة|مباشر/);
});
