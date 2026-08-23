import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const pats = [
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /service_role/i,
  /postgres:\/\//i,
  /sb_secret_/i,
];
const hits = [];
for (const f of fs.readdirSync(dir)) {
  const p = path.join(dir, f);
  if (!fs.statSync(p).isFile()) continue;
  if (f === "secret-scan.txt") continue;
  const t = fs.readFileSync(p, "utf8");
  for (const re of pats) {
    if (re.test(t)) hits.push(`${f}`);
  }
}
const unique = [...new Set(hits)];
const out = unique.length ? `SECRET_SCAN=FAIL\n${unique.join("\n")}` : "SECRET_SCAN=PASS";
fs.writeFileSync(path.join(dir, "secret-scan.txt"), out);
console.log(out);
