import assert from "node:assert/strict";
import { cleanupExpiredInvites, isInviteExpired } from "./lib/jobs/cleanup-expired-invites.mjs";

const now = new Date("2026-07-05T00:00:00.000Z");

assert.equal(isInviteExpired({ expiresAt: "2026-07-04T23:59:59.000Z", revokedAt: null }, now), true);
assert.equal(isInviteExpired({ expiresAt: "2026-07-05T00:00:01.000Z", revokedAt: null }, now), false);
assert.equal(isInviteExpired({ expiresAt: "2026-07-04T00:00:00.000Z", revokedAt: "2026-07-04T01:00:00.000Z" }, now), false);
assert.equal(isInviteExpired({ expiresAt: null, revokedAt: null }, now), false);

const invites = [
  { id: "expired-1", expiresAt: "2026-07-04T00:00:00.000Z", revokedAt: null },
  { id: "future-1", expiresAt: "2026-07-06T00:00:00.000Z", revokedAt: null },
  { id: "revoked-1", expiresAt: "2026-07-04T00:00:00.000Z", revokedAt: "2026-07-04T01:00:00.000Z" },
];

const dryRun = await cleanupExpiredInvites({ invites, now, dryRun: true, logger: { info() {} } });
assert.equal(dryRun.scanned, 3);
assert.equal(dryRun.expired, 1);
assert.equal(dryRun.revoked, 0);
assert.equal(dryRun.errors.length, 0);

const revokedIds = [];
const applied = await cleanupExpiredInvites({
  invites,
  now,
  dryRun: false,
  logger: { info() {} },
  markRevoked: async (invite) => {
    revokedIds.push(invite.id);
  },
});

assert.equal(applied.expired, 1);
assert.equal(applied.revoked, 1);
assert.deepEqual(revokedIds, ["expired-1"]);

const missingAdapter = await cleanupExpiredInvites({ invites, now, dryRun: false, logger: { info() {} } });
assert.equal(missingAdapter.expired, 1);
assert.equal(missingAdapter.revoked, 0);
assert.equal(missingAdapter.errors[0].reason, "MARK_REVOKED_ADAPTER_MISSING");

console.log("OK expired invites cleanup smoke test completed");
