import assert from "node:assert/strict";import{readFileSync}from"node:fs";
const card=readFileSync("src/components/feed/UnifiedFeedCard.tsx","utf8");const shell=readFileSync("src/components/feed/FeedCardShell.tsx","utf8");const bodies=readFileSync("src/components/feed/FeedSourceBodies.tsx","utf8");const footer=readFileSync("src/components/feed/FeedCardFooter.tsx","utf8");const css=readFileSync("src/components/feed/feedCards.css","utf8");const repository=readFileSync("src/services/feed/feedRepository.ts","utf8");const migration=readFileSync("supabase/migrations/20260712205000_unified_feed_card_metadata.sql","utf8");
for(const marker of ["FeedCardShell","FeedTextBody","FeedRadioBody","FeedPodcastBody","FeedCardFooter","sourceStatus","Content unavailable"])assert.ok(card.includes(marker),`missing unified card marker ${marker}`);
assert.ok(shell.includes("VerifiedBadge")&&shell.includes("verificationType"),"approved verification badge integration missing");
assert.ok(shell.includes("Mentioned you")===false,"reason copy must be supplied truthfully by card state");
for(const marker of ["item.userState.isDirectMention","item.userState.isFriendAuthored","item.userState.isFriendEngaged","Popular in"])assert.ok(card.includes(marker),`missing truthful reason ${marker}`);
for(const marker of ["uniqueExternalViewers","item.reactions","item.commenters","item.commentPreviews","isSaved","isUnread"])assert.ok(footer.includes(marker),`missing real social proof/action ${marker}`);
assert.ok(bodies.includes("FeedMediaGrid")&&bodies.includes("video")&&bodies.includes("listenerCount")&&bodies.includes("durationSeconds"),"source-specific card body missing");
assert.ok(!card.includes("supabase")&&!footer.includes("supabase"),"UI must not call Supabase");
assert.ok(repository.includes('get_feed_item_metadata_v2')&&repository.includes('get_feed_author_verifications'),"batch card metadata repository missing");
assert.ok(migration.includes("verification.status='approved'")&&migration.includes("limit 2"),"safe verification/comment preview contract missing");
assert.ok(css.includes("var(--surface)")&&css.includes("var(--focus-ring)")&&css.includes("@media(max-width:1280px)"),"token/focus/medium desktop styling missing");
console.log("Unified production Text/Radio/Podcast Feed cards smoke: PASS");

