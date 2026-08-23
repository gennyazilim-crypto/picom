/**
 * Ensures Help & Support CSS is present and wired (prevents unstyled topic-button concat).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const CSS = join(ROOT, "src/components/support/HelpSupportWorkspace.css");
const VIEW = join(ROOT, "src/components/HelpCenterView.tsx");
const WORKSPACE = join(ROOT, "src/components/support/HelpSupportWorkspace.tsx");

test("HelpSupportWorkspace.css exists with topic list layout rules", () => {
  assert.equal(existsSync(CSS), true);
  const css = readFileSync(CSS, "utf8");
  assert.match(css, /\.help-center-view\s*\{/);
  assert.match(css, /\.help-topic-list\s*button\s*>\s*span\s*\{/);
  assert.match(css, /display:\s*grid/);
});

test("HelpCenterView imports support stylesheet and groups topics", () => {
  const src = readFileSync(VIEW, "utf8");
  assert.match(src, /HelpSupportWorkspace\.css/);
  assert.match(src, /help-topic-group/);
  assert.match(src, /help-center-header__copy/);
});

test("HelpSupportWorkspace imports its stylesheet", () => {
  const src = readFileSync(WORKSPACE, "utf8");
  assert.match(src, /import\s+["']\.\/HelpSupportWorkspace\.css["']/);
});
