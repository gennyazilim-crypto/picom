import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeLiveNowCtaState,
  resolveLiveNowCtaActions,
  resolveCtaStateFromProgram,
} from "../src/services/publisher/liveNowCtaState.ts";

const baseEligibility = {
  eligible: false,
  eligibilityPaths: [],
  activeFollowerCount: 0,
  requiredFollowerCount: 5000,
  largestOwnedCommunityId: null,
  largestOwnedCommunityName: null,
  largestOwnedCommunityActiveMemberCount: 0,
  requiredCommunityMemberCount: 3000,
  evaluatedAt: new Date().toISOString(),
};

function program(partial) {
  return {
    canBroadcast: false,
    profile: null,
    activeBadge: null,
    eligibility: { ...baseEligibility },
    ...partial,
  };
}

test("normal user under threshold gets requirements CTA", () => {
  const actions = resolveLiveNowCtaActions("threshold_not_met", { allowed: false });
  assert.equal(actions.length, 1);
  assert.deepEqual(actions[0], { kind: "link", key: "requirements", route: "/publisher/apply" });
});

test("eligible user gets Creator/Publisher application CTA", () => {
  const actions = resolveLiveNowCtaActions("eligible_not_applied", { allowed: false });
  assert.deepEqual(actions[0], { kind: "link", key: "apply", route: "/publisher/apply" });
});

test("pending application shows under-review chip", () => {
  for (const state of ["submitted", "under_review"]) {
    const actions = resolveLiveNowCtaActions(state, { allowed: false });
    assert.equal(actions.length, 1);
    assert.deepEqual(actions[0], { kind: "status_chip", key: "under_review" });
  }
});

test("approved publisher gets dashboard + go live gated by preflight", () => {
  const disabled = resolveLiveNowCtaActions("approved_active", { allowed: false });
  assert.equal(disabled.length, 2);
  assert.deepEqual(disabled[0], { kind: "link", key: "dashboard", route: "/publisher/dashboard" });
  assert.deepEqual(disabled[1], { kind: "go_live", enabled: false });

  const enabled = resolveLiveNowCtaActions("approved_active", { allowed: true });
  assert.deepEqual(enabled[1], { kind: "go_live", enabled: true });
});

test("suspended and revoked hide go-live and show account message", () => {
  assert.deepEqual(resolveLiveNowCtaActions("suspended", { allowed: true }), [
    { kind: "account_message", key: "suspended" },
  ]);
  assert.deepEqual(resolveLiveNowCtaActions("revoked", { allowed: true }), [
    { kind: "account_message", key: "revoked" },
  ]);
});

test("rejected shows view decision CTA", () => {
  assert.deepEqual(resolveLiveNowCtaActions("rejected", { allowed: false })[0], {
    kind: "link",
    key: "view_decision",
    route: "/publisher/apply",
  });
});

test("draft and additional_information_required CTAs", () => {
  assert.deepEqual(resolveLiveNowCtaActions("draft", null)[0], {
    kind: "link",
    key: "complete_application",
    route: "/publisher/apply",
  });
  assert.deepEqual(resolveLiveNowCtaActions("additional_information_required", null)[0], {
    kind: "link",
    key: "complete_info",
    route: "/publisher/apply",
  });
});

test("resolveCtaStateFromProgram prefers server ctaState", () => {
  assert.equal(resolveCtaStateFromProgram(program({ ctaState: "approved_active" })), "approved_active");
  assert.equal(normalizeLiveNowCtaState("not-a-state"), "threshold_not_met");
});

test("go live never enabled from UI alone without preflight.allowed", () => {
  const actions = resolveLiveNowCtaActions("approved_active", null);
  const goLive = actions.find((a) => a.kind === "go_live");
  assert.ok(goLive && goLive.kind === "go_live");
  assert.equal(goLive.enabled, false);
});
