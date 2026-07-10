import { readFileSync } from "node:fs";
const migration=readFileSync("supabase/migrations/20260710189000_friend_requests_production.sql","utf8");
const service=readFileSync("src/services/relationshipService.ts","utf8");
const view=readFileSync("src/components/FriendsView.tsx","utf8");
for(const marker of ["send_friend_request","can_send_friend_request","friend_request_privacy","FRIEND_REQUEST_COOLDOWN","friend_request_notifications","list_friend_relationship_state","revoke insert,update,delete on public.friend_requests"]){if(!migration.includes(marker))throw new Error(`Missing migration marker: ${marker}`);}
for(const marker of ["cancelFriendRequest","blockFriend","subscribeToFriendNotifications","getFriendState"]){if(!service.includes(marker))throw new Error(`Missing service marker: ${marker}`);}
for(const marker of ["onRemoveFriend","onBlockFriend","onCancelRequest"]){if(!view.includes(marker))throw new Error(`Missing UI marker: ${marker}`);}
console.log("Friend requests production smoke test passed.");
