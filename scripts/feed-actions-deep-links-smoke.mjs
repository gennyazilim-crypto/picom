import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const assertIncludes = (source, value, label) => {
  if (!source.includes(value)) throw new Error(`${label}: missing ${value}`);
};
const assertExcludes = (source, value, label) => {
  if (source.includes(value)) throw new Error(`${label}: stale ${value}`);
};

const app = read("src/App.tsx");
const footer = read("src/components/MentionFeedFooter.tsx");
const feedMain = read("src/components/MentionFeedMain.tsx");
const audioCard = read("src/components/audio/AudioFeedCard.tsx");
const audioSource = read("src/services/audio/audioDataSource.ts");
const radioService = read("src/services/audio/radioService.ts");

assertIncludes(app, "reactionService.addReaction", "text reaction persistence");
assertIncludes(app, "reactionService.removeReaction", "text reaction removal");
assertIncludes(app, "readStateService.markChannelRead", "text read persistence");
assertIncludes(app, "setHighlightedMessageId(item.messageId)", "exact message deep link");
assertIncludes(app, "canViewChannel(access, channel)", "deep-link access recheck");
assertIncludes(app, "Copy message reference", "text reference action");
assertIncludes(app, "Report message", "text report action");
assertExcludes(app, "Mention feed message highlight placeholder prepared", "text deep link");
assertIncludes(footer, "onOpenComments", "comment detail path");
assertIncludes(audioCard, "onCopyReference", "audio reference action");
assertIncludes(audioCard, "onReport", "audio report action");
assertIncludes(feedMain, "useAudioCatalogState", "audio realtime reconciliation");
assertIncludes(feedMain, "removeRadioReaction", "radio reaction toggle");
assertIncludes(audioSource, "async removeRadioReaction", "radio reaction persistence");
assertIncludes(radioService, "removeRadioReaction", "radio service contract");

console.log("Feed actions and deep-link contract passed.");
