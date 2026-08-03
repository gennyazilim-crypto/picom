/**
 * Ensures ProfileLeftCard rail stats + communities list CSS stay wired.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const CSS = join(ROOT, "src/components/ProfileView.css");
const VIEW = join(ROOT, "src/components/ProfileView.tsx");

test("ProfileView.css defines profile-rail-stats layout", () => {
  const css = readFileSync(CSS, "utf8");
  assert.match(css, /\.profile-rail-stats\s*\{/);
  assert.match(css, /\.profile-rail-stat\s*\{/);
  assert.match(css, /\.profile-rail-stat\s+strong\s*\{/);
  assert.match(css, /\.profile-rail-stat\s+span\s*\{/);
  assert.match(css, /display:\s*grid/);
});

test("ProfileLeftCard uses profile-rail-stats classes", () => {
  const src = readFileSync(VIEW, "utf8");
  assert.match(src, /className="profile-rail-stats"/);
  assert.match(src, /className="profile-rail-stat"/);
  assert.match(src, /import\s+["']\.\/ProfileView\.css["']/);
});

test("Profile communities list resets ul bullets and roles", () => {
  const css = readFileSync(CSS, "utf8");
  assert.match(css, /\.profile-community-list\s*\{[^}]*list-style:\s*none/s);
  assert.match(css, /\.profile-community-role\s*\{/);
  const src = readFileSync(VIEW, "utf8");
  assert.match(src, /className="profile-community-list"/);
  assert.match(src, /className="profile-community-role"/);
});
