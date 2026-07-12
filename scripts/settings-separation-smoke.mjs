import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const policySource = await readFile("src/services/navigation/settingsNavigationPolicyService.ts", "utf8");
const compiled = ts.transpileModule(policySource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const policy = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const access = (partial) => ({ isOwner: false, isAdmin: false, isModerator: false, isMember: true, isVisitor: false, canOpenAdminPanel: false, canOpenModeratorPanel: false, ...partial });
assert.equal(policy.settingsNavigationPolicyService.createGlobalUserSettingsRequest().source, "global-sidebar");
assert.equal(policy.settingsNavigationPolicyService.resolveCommunityDestination(access({ isOwner: true, canOpenAdminPanel: true })), "admin");
assert.equal(policy.settingsNavigationPolicyService.resolveCommunityDestination(access({ isAdmin: true, canOpenAdminPanel: true })), "admin");
assert.equal(policy.settingsNavigationPolicyService.resolveCommunityDestination(access({ isModerator: true, canOpenModeratorPanel: true })), "moderator");
assert.equal(policy.settingsNavigationPolicyService.resolveCommunityDestination(access({})), "member");
assert.equal(policy.settingsNavigationPolicyService.resolveCommunityDestination(access({ isMember: false, isVisitor: true })), "visitor");

const app = await readFile("src/App.tsx", "utf8");
const profile = await readFile("src/components/ProfileView.tsx", "utf8");
const rail = await readFile("src/components/ServerRail.tsx", "utf8");
const miniCard = await readFile("src/components/UserMiniCard.tsx", "utf8");
const shortcuts = await readFile("src/services/shortcutService.ts", "utf8");
const menu = await readFile("src/services/menuService.ts", "utf8");
const deepLinks = await readFile("src/services/deepLinkService.ts", "utf8");

assert.equal((app.match(/openSettings\(\)/g) ?? []).length, 1, "Only the global-sidebar handler may open User Settings");
assert.match(app, /onOpenSettings=\{openGlobalUserSettings\}/);
assert.doesNotMatch(app, /cmd-settings|matchesEvent\("settings"\)|requestInitialSection\("Profile"\)|requestInitialSection\("Help Center"\)/);
assert.doesNotMatch(app, /onEditProfile=|onRequestVerification=/);
assert.match(profile, /onEditProfile \? <button/);
assert.match(profile, /onRequestVerification \? <button/);
assert.doesNotMatch(rail, /Settings|onOpenSettings/);
assert.doesNotMatch(miniCard, /Settings|onOpenSettings/);
assert.doesNotMatch(shortcuts, /action: "settings"/);
assert.doesNotMatch(menu, /open-settings/);
assert.doesNotMatch(deepLinks, /action: \{ type: "settings" \}/);

console.log("User and community Settings separation smoke PASS");
