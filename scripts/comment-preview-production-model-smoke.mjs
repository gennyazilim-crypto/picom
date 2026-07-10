import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration=readFileSync("supabase/migrations/20260710207000_comment_preview_production_model.sql","utf8");
const service=readFileSync("src/services/mentionFeedService.ts","utf8");
const types=readFileSync("src/services/supabase/database.types.ts","utf8");
const component=readFileSync("src/components/MentionFeedFooter.tsx","utf8");
const test=readFileSync("supabase/tests/rls/comment_preview_production_model.sql","utf8");

for(const marker of ["reply.reply_to_message_id=message.id","reply.channel_id=message.channel_id","public.can_view_message(reply.id)","not public.users_are_blocked","preview_rank<=2","left(visible_reply.body,180)","comment_preview jsonb"]) assert.ok(migration.includes(marker),`missing derived preview marker: ${marker}`);
assert.ok(!migration.includes("create table public.feed_comments"),"task must not create a parallel social comment graph");
assert.ok(service.includes("mapCommentPreview"),"service must map safe derived previews");
assert.ok(service.includes("body.slice(0, 180)"),"client must retain compact bound");
assert.ok(types.includes("comment_preview: Json"),"database types must include derived preview JSON");
assert.ok(component.includes("slice(0, 2)"),"UI must remain compact");
for(const marker of ["public preview counts visible active replies","private parent and comments do not leak","deleted reply body is excluded"]) assert.ok(test.includes(marker),`missing pgTAP coverage: ${marker}`);
console.log("Comment preview production model smoke: PASS");
