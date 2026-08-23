import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  return readFileSync(absolutePath, "utf8");
}

function assertContains(relativePath, needle, label) {
  const contents = readProjectFile(relativePath);
  if (!contents.includes(needle)) {
    throw new Error(`${label} not found in ${relativePath}`);
  }

  console.log(`✓ ${label}`);
}

function assertNotContains(relativePath, needle, label) {
  const contents = readProjectFile(relativePath);
  if (contents.includes(needle)) {
    throw new Error(`${label} unexpectedly found in ${relativePath}`);
  }

  console.log(`OK ${label}`);
}

try {
  assertContains("src/data/mockCommunities.ts", "export const mockCommunities", "mock communities data");
  assertContains("src/services/authService.ts", "getMockSession", "mock auth session path");
  assertNotContains("src/services/communityService.ts", "dataSource.isMock", "production community service has no mock branch");
  assertNotContains("src/services/channelService.ts", "dataSource.isMock", "production channel service has no mock branch");
  assertNotContains("src/services/messageService.ts", "dataSource.isMock", "production message service has no mock branch");
  assertNotContains("src/services/membersService.ts", "dataSource.isMock", "production members service has no mock branch");
  assertNotContains("src/services/reactionService.ts", "dataSource.isMock", "production reactions service has no mock branch");
  assertContains("src/App.tsx", "communityService.listCommunities()", "Supabase-backed community startup loading");
  assertContains("src/App.tsx", "channelService.listChannels(communityId)", "Supabase-backed channel startup loading");
  assertContains("src/config/dataSourcePolicy.ts", "selectMockFixture", "explicit mock fixture gate");
  const cleanupAudit = spawnSync(process.execPath, ["scripts/data-source-final-cleanup-smoke.mjs"], { cwd: root, encoding: "utf8" });
  if (cleanupAudit.status !== 0) throw new Error(cleanupAudit.stderr || cleanupAudit.stdout || "Data source cleanup audit failed.");
  process.stdout.write(cleanupAudit.stdout);
  console.log("✓ Mock fixture isolation and production data-source smoke test completed");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
