import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWebPath, pathFromActiveView } from "../src/web/routeMap.ts";

test("live-now route parses session id into live view params", () => {
  const parsed = parseWebPath("/live-now/550e8400-e29b-41d4-a716-446655440000");
  assert.equal(parsed.activeView, "live");
  assert.equal(parsed.params.liveSessionId, "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(parsed.isAuthRoute, false);
});

test("live discovery path remains /live without session id", () => {
  const parsed = parseWebPath("/live");
  assert.equal(parsed.activeView, "live");
  assert.equal(parsed.params.liveSessionId, undefined);
});

test("pathFromActiveView builds watch deep link from session id", () => {
  assert.equal(pathFromActiveView("live"), "/live");
  assert.equal(
    pathFromActiveView("live", { liveSessionId: "550e8400-e29b-41d4-a716-446655440000" }),
    "/live-now/550e8400-e29b-41d4-a716-446655440000",
  );
});
