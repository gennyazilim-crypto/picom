import fs from "node:fs";

const composer = fs.readFileSync("src/components/MessageComposer.tsx", "utf8");
const chatMain = fs.readFileSync("src/components/ChatMain.tsx", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");
const doc = fs.readFileSync("docs/composer-permission-states.md", "utf8");

const checks = [
  [composer.includes("disabledReason?: string"), "composer disabled prop"],
  [composer.includes("composer-permission-hint"), "permission hint"],
  [composer.includes("disabled={Boolean(disabledReason)}"), "disabled controls"],
  [chatMain.includes("composerDisabledReason"), "ChatMain permission reason"],
  [chatMain.includes("role.id === currentMember?.roleId"), "role lookup"],
  [css.includes(".message-composer.is-disabled"), "disabled composer CSS"],
  [doc.includes("Backend/Supabase permissions remain the source of truth"), "permission boundary doc"]
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  console.error(`Composer permission states smoke failed: ${failed.join(", ")}`);
  process.exit(1);
}

console.log("Composer permission states smoke passed.");
