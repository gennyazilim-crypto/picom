import { cleanupOrphanedUploads } from "./lib/jobs/cleanup-orphaned-uploads.mjs";

const now = new Date("2026-07-05T00:00:00.000Z");
const fixtureAttachments = [
  {
    id: "old-pending",
    messageId: null,
    storagePath: "communities/one/channels/general/pending/user/old.png",
    status: "pending",
    createdAt: "2026-07-03T00:00:00.000Z",
  },
  {
    id: "recent-pending",
    messageId: null,
    storagePath: "communities/one/channels/general/pending/user/recent.png",
    status: "pending",
    createdAt: "2026-07-04T18:00:00.000Z",
  },
  {
    id: "attached-valid",
    messageId: "message-1",
    storagePath: "communities/one/channels/general/messages/message-1/image.png",
    status: "attached",
    createdAt: "2026-07-03T00:00:00.000Z",
  },
];

const result = await cleanupOrphanedUploads({
  attachments: fixtureAttachments,
  now,
  dryRun: true,
});

console.log(JSON.stringify({
  note: "Development dry-run placeholder only. No production files were deleted.",
  result,
}, null, 2));
