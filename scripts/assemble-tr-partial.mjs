import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import partA from "./tr-part-a.mjs";
import partB from "./tr-part-b.mjs";
import partC from "./tr-part-c.mjs";
import partModal from "./tr-part-modal.mjs";

const merged = { ...partA, ...partB, ...partC, ...partModal };
const out = `/** Auto-assembled Turkish catalog for settings i18n. */
export default ${JSON.stringify(merged, null, 2)};
`;
writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "settings-i18n-tr-partial.mjs"), out);
console.log("assembled TR keys:", Object.keys(merged).length);
