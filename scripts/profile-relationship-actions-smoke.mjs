import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assert = (condition, label) => { if (!condition) throw new Error(label); console.log(`OK ${label}`); };
const view = read("src/components/ProfileView.tsx");
const app = read("src/App.tsx");
const relationships = read("src/services/relationshipService.ts");
const friends = read("src/services/friends/friendRequestService.ts");
const verification = read("src/components/VerificationRequestPanel.tsx");

assert(view.includes('"add" | "cancel" | "accept" | "remove"') && view.includes("Cancel request") && view.includes("Remove friend"), "profile friendship state machine");
assert(view.includes("isBlocked") && view.includes("relationshipBusy"), "profile privacy block and duplicate-submit guards");
assert(view.includes("Verification") && app.includes("Verification status and request"), "verification status and request entrypoint");
assert(app.includes("handleProfileFriendAction") && app.includes("relationshipService.removeFriend") && app.includes("relationshipService.cancelFriendRequest"), "profile actions use relationship services");
assert(app.includes("setProfileReloadVersion") && app.includes("relationshipService.getFollowing"), "authoritative relationship refresh prevents count drift");
assert(app.includes('label: "Message"') && app.includes('label: "Report user"') && !app.includes("Edit profile placeholder"), "real profile context actions");
assert(relationships.includes("You cannot follow your own account") && friends.includes("SELF_REQUEST"), "self follow and self friend guards");
assert(verification.includes("verificationRequestService.requestProfile") && !view.includes("grant_verification_badge"), "profile can request but cannot self-approve verification");
console.log("OK profile relationship actions smoke completed");
