import assert from "node:assert/strict";
import { test } from "node:test";

function isPublisherDiscoveryEligible(session) {
  return (
    (session.status === "live" || session.status === "reconnecting") &&
    session.visibilityMode === "public_discovery" &&
    session.moderationStatus === "approved" &&
    session.deletedAt == null &&
    session.hiddenAt == null &&
    session.broadcasterCanBroadcast
  );
}

function applySearchWithinEligible(items, query) {
  const q = query.trim().toLowerCase();
  return items.filter((item) => isPublisherDiscoveryEligible(item) && item.title.toLowerCase().includes(q));
}

const approvedLive = {
  id: "a",
  title: "Approved Stream",
  category: "game",
  status: "live",
  visibilityMode: "public_discovery",
  moderationStatus: "approved",
  deletedAt: null,
  hiddenAt: null,
  broadcasterCanBroadcast: true,
};

test("unapproved / non-eligible streams stay hidden", () => {
  assert.equal(isPublisherDiscoveryEligible({ ...approvedLive, broadcasterCanBroadcast: false }), false);
  assert.equal(isPublisherDiscoveryEligible({ ...approvedLive, visibilityMode: "channel_members" }), false);
  assert.equal(isPublisherDiscoveryEligible({ ...approvedLive, moderationStatus: "blocked" }), false);
});

test("approved active stream is visible", () => {
  assert.equal(isPublisherDiscoveryEligible(approvedLive), true);
});

test("featured and search cannot bypass eligibility", () => {
  const ineligible = {
    ...approvedLive,
    id: "b",
    title: "Secret Ineligible",
    broadcasterCanBroadcast: false,
  };
  const pool = [approvedLive, ineligible];
  const featured = pool.filter(isPublisherDiscoveryEligible).sort((a, b) => a.id.localeCompare(b.id))[0];
  assert.equal(featured?.id, "a");
  assert.equal(applySearchWithinEligible(pool, "Secret").length, 0);
  assert.equal(applySearchWithinEligible(pool, "Approved").length, 1);
});

test("badge revoke (canBroadcast false) removes card and decreases count", () => {
  const before = [approvedLive, { ...approvedLive, id: "c", title: "Second" }];
  assert.equal(before.filter(isPublisherDiscoveryEligible).length, 2);
  const afterRevoke = before.map((item, index) =>
    index === 0 ? { ...item, broadcasterCanBroadcast: false } : item,
  );
  const visible = afterRevoke.filter(isPublisherDiscoveryEligible);
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.id, "c");
});

test("live count stays consistent with filtered list length", () => {
  const items = [
    approvedLive,
    { ...approvedLive, id: "x", status: "ended" },
    { ...approvedLive, id: "y", deletedAt: "2026-01-01T00:00:00Z" },
  ];
  const visible = items.filter(isPublisherDiscoveryEligible);
  assert.equal(visible.length, 1);
});
