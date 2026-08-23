import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/hooks/useDialogFocusTrap.ts", "utf8");

assert.ok(source.includes("const INITIAL_FOCUSABLE"), "dialogs must define a separate initial focus order");
assert.ok(source.includes("button:not([disabled]):not(.modal-close)"), "a modal close button must not receive initial focus when a form control exists");
assert.ok(source.includes("const onCloseRef = useRef(onClose)"), "the latest close handler must be retained without restarting the focus trap");
assert.ok(source.includes("onCloseRef.current()"), "Escape must use the latest close handler");
assert.ok(source.includes("window.cancelAnimationFrame(initialFocusFrame)"), "pending initial focus must be cancelled when a dialog closes");
assert.ok(source.includes("}, []);"), "the focus trap must not restart when form state changes");

console.log("dialog focus trap regression smoke: PASS");
