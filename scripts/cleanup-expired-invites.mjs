import { cleanupExpiredInvites } from "./lib/jobs/cleanup-expired-invites.mjs";

const now = new Date("2026-07-05T00:00:00.000Z");
const fixtureInvites = [
  { id: "invite-old", code: "OLDER01", expiresAt: "2026-07-04T00:00:00.000Z", revokedAt: null },
  { id: "invite-active", code: "ACTIVE01", expiresAt: "2026-07-06T00:00:00.000Z", revokedAt: null },
  { id: "invite-revoked", code: "REVOKED01", expiresAt: "2026-07-04T00:00:00.000Z", revokedAt: "2026-07-04T01:00:00.000Z" },
];

const result = await cleanupExpiredInvites({
  invites: fixtureInvites,
  now,
  dryRun: true,
});

console.log(JSON.stringify({
  note: "Development dry-run placeholder only. No production database was modified.",
  result,
}, null, 2));
