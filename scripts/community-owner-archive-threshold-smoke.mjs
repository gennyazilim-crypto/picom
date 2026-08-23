import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const migration = readFileSync("supabase/migrations/20260809235000_community_archive_owner_transfer_threshold.sql", "utf8");
const service = readFileSync("src/services/community/communityArchiveEligibilityService.ts", "utf8");
const header = readFileSync("src/components/CommunityHeader.tsx", "utf8");
const sidebar = readFileSync("src/components/CommunitySidebar.tsx", "utf8");
const transferPanel = readFileSync("src/components/CommunityOwnershipTransferPanel.tsx", "utf8");

for (const marker of ["get_community_archive_eligibility", "current_member_count > 1000", "COMMUNITY_OWNERSHIP_TRANSFER_REQUIRED", "security definer", "for update"]) {
  assert.ok(migration.includes(marker), `threshold migration must contain ${marker}`);
}
assert.ok(service.includes('rpc("get_community_archive_eligibility"'), "eligibility service must use the authoritative RPC");
assert.ok(service.includes('.from("community_members")'), "eligibility service must fall back to the live membership source until the RPC is deployed");
assert.ok(service.includes('select("id", { count: "exact", head: true })'), "fallback membership count must be exact and server sourced");
assert.ok(header.includes("ownerArchiveRequiresTransfer"), "header must switch the owner action from the resolved eligibility");
assert.ok(sidebar.includes('openAdminPanel("danger-zone")'), "owner action must open the deletion safety section");
assert.ok(transferPanel.includes("eligibility?.requiresOwnershipTransfer === false"), "ownership transfer must stay hidden below the threshold");

const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
try {
  const { COMMUNITY_OWNER_ARCHIVE_MEMBER_LIMIT, requiresOwnershipTransferToArchive } = await vite.ssrLoadModule("/src/services/community/communityArchiveEligibilityService.ts");
  assert.equal(COMMUNITY_OWNER_ARCHIVE_MEMBER_LIMIT, 1_000, "the archive limit is 1,000 members");
  assert.equal(requiresOwnershipTransferToArchive(1_000), false, "exactly 1,000 members may archive");
  assert.equal(requiresOwnershipTransferToArchive(1_001), true, "1,001 members require ownership transfer");
  assert.equal(requiresOwnershipTransferToArchive(-1), true, "invalid member counts fail closed");

  const [{ CommunityHeader }, { I18nProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/components/CommunityHeader.tsx"),
    vite.ssrLoadModule("/src/i18n/index.ts"),
  ]);
  const community = {
    id: "community-1",
    kind: "text",
    ownerId: "owner-1",
    name: "Threshold QA",
    icon: "T",
    accentColor: "#007571",
    categories: [],
    roles: [],
    members: [],
    messages: [],
  };
  const access = {
    userId: "owner-1",
    communityKind: "text",
    status: "owner",
    visibility: "private",
    publicReadEnabled: false,
    permissions: [],
    isOwner: true,
    isAdmin: false,
    isModerator: false,
    isMember: true,
    isVisitor: false,
    canOpenAdminPanel: true,
    canOpenModeratorPanel: true,
    canJoin: false,
    canLeave: false,
    canViewPublicContent: false,
  };
  const callbacks = {
    onOpenAdminPanel: () => undefined,
    onOpenModeratorPanel: () => undefined,
    onOpenMemberPanel: () => undefined,
    onOpenVisitorPanel: () => undefined,
    onOpenJoinCommunity: () => undefined,
    onOpenLeaveCommunity: () => undefined,
    onPlaceholderAction: () => undefined,
  };
  const renderHeader = (ownerArchiveRequiresTransfer) => renderToStaticMarkup(
    React.createElement(I18nProvider, { locale: "tr" }, React.createElement(CommunityHeader, { community, access, ownerArchiveRequiresTransfer, ...callbacks })),
  );
  assert.match(renderHeader(false), />Sil</, "owners below the threshold receive the delete action");
  assert.match(renderHeader(true), />Önce devret</, "owners above the threshold receive the transfer action");
} finally {
  await vite.close();
}

console.log("community owner archive threshold smoke: PASS");
