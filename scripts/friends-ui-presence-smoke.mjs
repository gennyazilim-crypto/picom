import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const [view,direct,app,styles,presence,friendService,mock,types,migration,rls]=await Promise.all([
  read("src/components/FriendsView.tsx"),read("src/components/DirectMessagesView.tsx"),read("src/App.tsx"),read("src/styles.css"),read("src/services/friends/friendPresenceService.ts"),read("src/services/friends/friendRequestService.ts"),read("src/data/mockFriends.ts"),read("src/types/friends.ts"),read("supabase/migrations/20260711002200_friends_ui_presence_suggestions.sql"),read("supabase/tests/rls/friends_ui_presence_suggestions.sql"),
]);
for(const tab of ["all","online","pending","suggestions","blocked"]) assert.match(types+view,new RegExp(`\"${tab}\"`));
for(const action of ["onAcceptRequest","onDismissRequest","onCancelRequest","onRemoveFriend","onUnblockFriend"]) assert.match(view,new RegExp(action));
assert.match(direct,/onOpenFriends/);assert.match(direct,/onOpenPendingFriends/);assert.doesNotMatch(direct,/Friends are available from Picom's friends area/);
assert.match(app,/friendRequestCount=\{friendState\.counts\.pending\}/);assert.match(app,/friendPresenceService\.subscribe/);
assert.match(presence,/45_000/);assert.match(presence,/publishOwnPresence\("offline", false\)/);assert.doesNotMatch(presence,/profile.*statusText|payload.*statusText/i);
assert.match(styles,/\.friend-presence-dot\.status-online/);assert.match(styles,/\.friend-presence-dot\.status-offline/);assert.doesNotMatch(styles,/friend-presence-dot[^}]*verified/);
assert.match(friendService,/!userBlockingService\.isBlocked\(candidate\.userId\)/);assert.match(friendService,/list_friend_suggestions/);
assert.ok((mock.match(/mutualCommunityCount:/g)??[]).length>=6,"mock suggestions need mutual-community signals");
assert.match(migration,/public\.can_send_friend_request/);assert.match(migration,/public\.user_follows/);assert.match(migration,/request\.status='pending'/);assert.match(migration,/share_presence/);assert.match(migration,/Custom status text is never published/);
assert.match(rls,/select plan\(10\)/);
console.log("Friends UI tabs, actions, safe presence, suggestions, and DM routing contracts passed.");
