import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const roots = ["src", "electron", "dist", "dist-electron", "release"].filter(existsSync);
const allowedExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".html", ".css", ".map", ".yml", ".yaml"]);
const violations = [];

function walk(path) {
  for (const entry of readdirSync(path)) {
    const absolute = join(path, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      if (!["node_modules", ".git", ".tmp", "tmp"].includes(entry)) walk(absolute);
      continue;
    }
    if (!allowedExtensions.has(extname(entry).toLowerCase()) || stats.size > 8 * 1024 * 1024) continue;
    const text = readFileSync(absolute, "utf8");
    const display = relative(process.cwd(), absolute);
    if (/VITE_[A-Z0-9_]*(LIVEKIT_API_KEY|LIVEKIT_API_SECRET|REDIS_PASSWORD|TURN_KEY)/.test(text)) violations.push(`${display}: server secret exposed through Vite name`);
    if (/wss:\/\/[A-Za-z0-9.-]*(staging|localhost|127\.0\.0\.1)[A-Za-z0-9.:-]*/i.test(text) && /dist|release/.test(display.replaceAll("\\", "/"))) violations.push(`${display}: non-production LiveKit endpoint in production artifact`);
    if (/(?:LIVEKIT_API_SECRET|REDIS_PASSWORD|TURN_PRIVATE_KEY)\s*[=:]\s*["'][A-Fa-f0-9_-]{24,}["']/.test(text)) violations.push(`${display}: probable secret literal`);
  }
}

for (const root of roots) walk(resolve(root));
if (violations.length) throw new Error(`Self-hosted LiveKit environment boundary failed:\n${violations.join("\n")}`);
console.log(`Self-hosted LiveKit environment boundary passed across ${roots.join(", ") || "no generated artifact roots"}; no values were printed.`);
