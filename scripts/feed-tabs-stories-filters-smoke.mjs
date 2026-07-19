import assert from "node:assert/strict";import{readFileSync}from"node:fs";
const main=readFileSync("src/components/MentionFeedMain.tsx","utf8"),tabs=readFileSync("src/components/MentionFeedTabs.tsx","utf8"),panel=readFileSync("src/components/MentionRightPanel.tsx","utf8"),viewer=readFileSync("src/components/StoryViewerModal.tsx","utf8"),storyService=readFileSync("src/services/storyService.ts","utf8"),ui=readFileSync("src/services/feed/feedUiStateService.ts","utf8"),migration=readFileSync("supabase/migrations/20260711003100_feed_tabs_followed_content_stories.sql","utf8"),css=readFileSync("src/components/MentionFeedMain.css","utf8");
assert.ok(
  tabs.includes('onTabChange("feed")')
    && tabs.includes('onTabChange("following")')
    && tabs.includes(">Feed<")
    && tabs.includes(">Takip<"),
  "two Feed tabs must remain",
);
for(const filter of ['"today"','"week"','"unread"','"saved"','"text"','"radio"','"podcast"'])assert.ok(panel.includes(filter),`missing filter ${filter}`);
assert.ok(main.includes("feedQueryService.refresh")&&main.includes("queriedSourceOrder"),"tabs must use ranked query ordering");
assert.ok(main.includes("sourceTypesForFilter")&&main.includes("createdAfterForFilter"),"filters must reach query contract");
assert.ok(storyService.includes('client.rpc("list_followed_content_stories"'),"stories must use followed-content RPC");
for(const source of["radio_session","podcast_episode","podcast_comment","text_message"])assert.ok(migration.includes(source),`story query missing ${source}`);
assert.ok(migration.includes("security_invoker=true")&&migration.includes("public.user_follows"),"stories must use RLS and persisted follows");
assert.ok(ui.includes("localStorage")&&ui.includes("seenStoryIds")&&ui.includes("setSelection"),"Feed UI state persistence missing");
assert.ok(viewer.includes("Open Radio")&&viewer.includes("Open episode")&&viewer.includes("Open in channel"),"story deep links must be source-correct");
assert.ok(/overflow-x\s*:\s*auto/.test(css)&&/max-width\s*:\s*100%/.test(css),"story row overflow contract missing");
assert.ok(!`${main}${tabs}`.includes("Mention Tracking"),"old text-heavy header must stay removed");
console.log("Feed tabs, filters, followed stories, and persistence smoke: PASS");
