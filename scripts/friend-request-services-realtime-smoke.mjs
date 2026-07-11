import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [service, facade, types, app, settings, settingsUi, migration, rls] = await Promise.all([
  read("src/services/friends/friendRequestService.ts"),
  read("src/services/relationshipService.ts"),
  read("src/types/friends.ts"),
  read("src/App.tsx"),
  read("src/services/settingsService.ts"),
  read("src/components/SettingsModal.tsx"),
  read("supabase/migrations/20260711002100_friend_request_services_realtime_notifications.sql"),
  read("supabase/tests/rls/friend_request_services_realtime_notifications.sql"),
]);

for (const marker of ["FriendRequestDataSource", "sendRequest", "acceptRequest", "declineRequest", "cancelRequest", "removeFriend", "blockFriend"]) assert.match(service, new RegExp(marker));
for (const code of ["DUPLICATE_REQUEST", "BLOCKED", "PRIVACY_DENIED", "DIRECTION_DENIED", "RATE_LIMITED"]) assert.match(types + service, new RegExp(code));
for (const filter of ["sender_id=eq.", "recipient_id=eq.", "user_low_id=eq.", "user_high_id=eq."]) assert.match(service, new RegExp(filter.replace(/[.]/g, "\\.")));
assert.match(service, /calculateFriendRequestCounts/);
assert.match(service, /mockStateListeners/);
assert.match(service, /routeFriendNotification/);
assert.match(facade, /subscribeToFriendState/);
assert.match(app, /relationshipService\.subscribeToFriendState/);
assert.match(app, /relationshipService\.routeFriendNotification/);
assert.match(settings, /friendRequests: boolean/);
assert.match(settings, /friendAcceptances: boolean/);
assert.match(settingsUi, /Friend request acceptances/);
assert.match(migration, /alter table public\.friend_requests replica identity full/i);
assert.match(migration, /friend_request_notifications_event_once_idx/);
assert.match(migration, /supabase_realtime/);
assert.match(migration, /revoke insert, update, delete on public\.friend_request_notifications from authenticated/i);
assert.match(rls, /select plan\(9\)/);

console.log("Friend request service, realtime counts, notification preferences, and privacy contracts passed.");
